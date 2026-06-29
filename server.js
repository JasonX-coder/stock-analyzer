import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const json = (res, status, payload) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
};

// 简易 TTL 缓存 + 并发去重：同一 key 的并发请求只打一次上游，
// 命中即返回缓存值；失败不缓存，避免错误被长期记住。
const cacheStore = new Map();
function withCache(key, ttlMs, producer) {
  const now = Date.now();
  const entry = cacheStore.get(key);
  if (entry && entry.expires > now) return Promise.resolve(entry.value);
  // 已有在途请求：复用，避免行情刷新时打爆上游
  if (entry && entry.inflight) return entry.inflight;
  const inflight = (async () => {
    try {
      const value = await producer();
      cacheStore.set(key, { value, expires: Date.now() + ttlMs, inflight: null });
      return value;
    } catch (e) {
      // 失败不缓存，清掉在途标记，下次重试
      const cur = cacheStore.get(key);
      if (cur) cur.inflight = null;
      throw e;
    }
  })();
  if (!entry) cacheStore.set(key, { value: undefined, expires: 0, inflight });
  else entry.inflight = inflight;
  return inflight;
}

async function fetchJson(url, { headers, timeoutMs = 6000 } = {}) {
  const target = new URL(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: headers || {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: "https://quote.eastmoney.com/",
        Origin: "https://quote.eastmoney.com",
        Connection: "keep-alive"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const detail = body ? `: ${body.slice(0, 120)}` : "";
      throw new Error(`行情源 ${target.host} 返回 ${response.status}${detail}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// 抓取纯文本行情（新浪/腾讯返回 var xxx="..."; 格式，通常 GBK 编码）
async function fetchText(url, { headers, timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: headers || {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "*/*",
        Referer: "https://finance.sina.com.cn/"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`行情源 ${new URL(url).host} 返回 ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    // 新浪/腾讯行情接口返回 GBK；用 TextDecoder 解码避免中文乱码
    const ctype = response.headers.get("content-type") || "";
    const useGbk = /gbk|gb2312/i.test(ctype) || /sinajs|gtimg/.test(url);
    if (useGbk) {
      try {
        return new TextDecoder("gbk").decode(buffer);
      } catch {
        return buffer.toString("utf8");
      }
    }
    return buffer.toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}

// 把证券统一标识转成各源需要的代码格式
function toSourceCodes(security) {
  const [market, code] = security.secid.split(".");
  // 新浪：sh/sz/hk/us
  let sina = null;
  if (market === "1") sina = `sh${code}`;
  else if (market === "0") sina = `sz${code}`;
  else if (market === "116") sina = `hk0${code}`.replace(/^hk0(\d{5})$/, "hk$1");
  else if (market === "105") sina = `gb_$${code.toLowerCase()}`;
  // 腾讯：sh/sz/hk/us
  let tencent = null;
  if (market === "1") tencent = `sh${code}`;
  else if (market === "0") tencent = `sz${code}`;
  else if (market === "116") tencent = `hk${code}`;
  else if (market === "105") tencent = `us${code}`;
  return { sina, tencent };
}

// 新浪实时报价：返回 { price, previousClose, high, low, open, name, source }
async function getSinaQuote(security) {
  const { sina } = toSourceCodes(security);
  if (!sina) throw new Error("新浪不支持该市场");
  const text = await fetchText(`https://hq.sinajs.cn/list=${sina}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://finance.sina.com.cn/"
    }
  });
  const match = text.match(/="([^"]*)"/);
  if (!match || !match[1]) throw new Error("新浪未返回行情");
  const fields = match[1].split(",");
  if (fields.length < 6) throw new Error("新浪行情字段不全");
  const name = fields[0] || security.name;
  const open = Number(fields[1]);
  const previousClose = Number(fields[2]);
  const price = Number(fields[3]);
  const high = Number(fields[4]);
  const low = Number(fields[5]);
  if (!Number.isFinite(price) || price === 0) throw new Error("新浪价格为空");
  return { name, price, previousClose, open, high, low, source: "sina" };
}

// 腾讯实时报价（备份）
async function getTencentQuote(security) {
  const { tencent } = toSourceCodes(security);
  if (!tencent) throw new Error("腾讯不支持该市场");
  const text = await fetchText(`https://qt.gtimg.cn/q=${tencent}`, {
    headers: { Referer: "https://gu.qq.com/" }
  });
  const match = text.match(/="([^"]*)"/);
  if (!match || !match[1]) throw new Error("腾讯未返回行情");
  const fields = match[1].split("~");
  if (fields.length < 5) throw new Error("腾讯行情字段不全");
  const name = fields[1] || security.name;
  const price = Number(fields[3]);
  const previousClose = Number(fields[4]);
  if (!Number.isFinite(price) || price === 0) throw new Error("腾讯价格为空");
  return { name, price, previousClose, source: "tencent" };
}

// 多源实时报价：新浪 → 腾讯 → 东方财富 K线末值
async function getRealtimeQuote(security) {
  return withCache(`quote:${security.secid}`, 5000, async () => {
    const sources = [getSinaQuote, getTencentQuote];
    for (const src of sources) {
      try {
        return await src(security);
      } catch (e) {
        // 尝试下一个源
      }
    }
    // 最终回退：用东方财富当日 K 线末值
    const today = dateText(new Date());
    const dayChart = await getEastmoneyKlines(security, 5, today, today).catch(() => null);
    const last = dayChart?.rows?.at(-1);
    if (!last) throw new Error("所有行情源都不可用");
    return {
      name: dayChart?.name || security.name,
      price: last.close,
      previousClose: dayChart.previousClose,
      source: "eastmoney"
    };
  });
}

// 由 secid（market.code）直接还原 security，跳过搜索解析，
// 避免用 symbol 重新解析时把港股/A股等位数相同的代码串号。
function securityFromSecid(secid) {
  const [market, code] = secid.split(".");
  if (!market || !code) return null;
  if (market === "1") return { secid, symbol: code, exchange: "沪深A股 · 上海", currency: "CNY", name: code };
  if (market === "0") return { secid, symbol: code, exchange: "沪深A股 · 深圳", currency: "CNY", name: code };
  if (market === "116") return { secid, symbol: code, exchange: "港股", currency: "HKD", name: code };
  if (market === "105") return { secid, symbol: code, exchange: "美股", currency: "USD", name: code };
  return null;
}

function secidFromCode(value) {
  const compact = value.trim().replace(/\s+/g, "");
  if (/^\d{6}$/.test(compact)) {
    return {
      secid: `${/^(5|6|9)/.test(compact) ? "1" : "0"}.${compact}`,
      symbol: compact,
      exchange: /^(5|6|9)/.test(compact) ? "沪深A股 · 上海" : "沪深A股 · 深圳",
      currency: "CNY"
    };
  }
  if (/^\d{1,5}$/.test(compact)) {
    const code = compact.padStart(5, "0");
    return { secid: `116.${code}`, symbol: code, exchange: "港股", currency: "HKD" };
  }
  if (/^[a-zA-Z][a-zA-Z0-9.-]{0,12}$/.test(compact)) {
    const code = compact.toUpperCase();
    return { secid: `105.${code}`, symbol: code, exchange: "美股", currency: "USD" };
  }
  return null;
}

function marketMeta(item) {
  const quoteId = item?.QuoteID || item?.ID || "";
  const code = item?.Code || item?.UnifiedCode || "";
  if (quoteId.includes(".")) {
    const [market, symbol] = quoteId.split(".");
    const currency = market === "116" ? "HKD" : market === "105" ? "USD" : "CNY";
    const exchange = market === "116" ? "港股" : market === "105" ? "美股" : item.SecurityTypeName || "沪深A股";
    return { secid: quoteId, symbol, exchange, currency };
  }
  return secidFromCode(code);
}

function eastmoneySecucode(security) {
  const [market, code] = security.secid.split(".");
  if (market === "1") return `${code}.SH`;
  if (market === "0") return `${code}.SZ`;
  if (market === "116") return `${code}.HK`;
  if (market === "105") return `${code}.O`;
  return code;
}

async function resolveSecurity(query) {
  const direct = secidFromCode(query);
  if (direct) return { ...direct, name: direct.symbol };

  return withCache(`resolve:${query}`, 600000, async () => {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(query)}&type=14&token=44c9d251add88e27b65ed86506f6e5da&count=8`;
    const data = await fetchJson(url);
    const items = data.QuotationCodeTable?.Data || [];
    const match = items.find((item) => {
      const classify = item.Classify || "";
      return ["AStock", "HKStock", "USStock", "Fund"].some((type) => classify.includes(type));
    }) || items[0];

    const meta = marketMeta(match);
    if (!meta) throw new Error("没有找到匹配的股票，请换用股票代码。");
    return { ...meta, name: match.Name || meta.symbol };
  });
}

// 搜索建议列表（给 App 搜索框用）
async function suggestSecurities(query) {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(query)}&type=14&token=44c9d251add88e27b65ed86506f6e5da&count=10`;
  const data = await fetchJson(url).catch(() => null);
  const items = data?.QuotationCodeTable?.Data || [];
  return items
    .filter((item) => {
      const classify = item.Classify || "";
      return ["AStock", "HKStock", "USStock"].some((type) => classify.includes(type));
    })
    .map((item) => {
      const meta = marketMeta(item);
      return meta ? { ...meta, name: item.Name || meta.symbol } : null;
    })
    .filter(Boolean);
}

// 发现页卡片池：横跨 A 股 / 港股 / 美股的高知名度标的，
// 供「发现」翻卡页兜底使用。每次随机洗牌取若干只，避免每次都一样。
const DISCOVER_POOL = [
  // A 股（沪深）
  "1.600519", "0.000001", "1.601318", "0.000858", "1.600036", "0.002594",
  "1.601899", "0.000333", "1.600276", "0.002475", "1.601012", "0.300750",
  // 港股
  "116.00700", "116.09988", "116.03690", "116.09618", "116.00020",
  // 美股
  "105.AAPL", "105.TSLA", "105.NVDA", "105.AMZN", "105.MSFT", "105.GOOG",
];

// 东财涨幅榜：按市场拉当日涨幅前列的 secid，用于「同类型相关推荐」
// market: "1.0"=沪深A股, "116"=港股, "105"=美股
async function getHotList(market, size = 20) {
  return withCache(`hotlist:${market}`, 60000, async () => {
    // 沪深A股用 fs=m:0 t:6 / m:1 t:80 两个板合并；港股 m:128 t:3；美股 m:105 t:6
    const boards =
      market === "116" ? [{ fs: "m:128 t:3", market: "116" }] :
      market === "105" ? [{ fs: "m:105 t:6", market: "105" }] :
      [{ fs: "m:1 t:2", market: "1" }, { fs: "m:0 t:6", market: "0" }];
    const params = new URLSearchParams({
      pn: "1",
      pz: String(size),
      po: "1", // 降序
      np: "1",
      fltt: "2",
      invt: "2",
      fid: "f3", // 按涨幅排
      fields: "f12,f14,f3", // 代码,名称,涨幅
    });
    const all = await Promise.all(
      boards.map(async (b) => {
        try {
          const data = await fetchJson(
            `https://push2.eastmoney.com/api/qt/clist/get?${params}&fs=${encodeURIComponent(b.fs)}`
          );
          return (data?.data?.diff || []).map((d) => ({
            secid: `${b.market}.${d.f12}`,
            symbol: String(d.f12),
            name: d.f14,
            changePct: Number(d.f3),
          }));
        } catch {
          return [];
        }
      })
    );
    // 合并后按涨幅降序取前 size
    return all.flat().sort((a, b) => (b.changePct || 0) - (a.changePct || 0)).slice(0, size);
  });
}

// 由 secid 构造一张发现页卡片（报价 + 近 30 日迷你走势）
async function buildDiscoverCard(secid) {
  const security = securityFromSecid(secid);
  if (!security) return null;
  try {
    const quote = await getRealtimeQuote(security);
    const end = dateText(new Date());
    const beginDate = new Date();
    beginDate.setDate(beginDate.getDate() - 35);
    const chart = await getEastmoneyKlines(security, 101, dateText(beginDate), end).catch(() => null);
    const rows = (chart?.rows || []).slice(-30).map((r) => ({
      time: r.time,
      close: r.close,
      high: r.high,
      low: r.low,
    }));
    return {
      secid: security.secid,
      symbol: security.symbol,
      name: quote.name || security.name,
      exchange: security.exchange,
      currency: security.currency,
      price: quote.price,
      previousClose: quote.previousClose,
      open: quote.open ?? null,
      high: quote.high ?? null,
      low: quote.low ?? null,
      source: quote.source,
      spark: rows,
    };
  } catch {
    return null;
  }
}

// 发现页：返回一批卡片，含实时报价 + 近 30 日迷你走势 K 线
// 排序策略：用户自选股优先（每日先过一遍自选）→ 同类型相关（自选所在市场的涨幅榜）
//           → 固定知名池兜底。watch 为逗号分隔的 secid 列表。
async function discoverCards(count = 12, watch = "") {
  const watchSecids = watch
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => securityFromSecid(s)); // 只保留合法 secid

  // 缓存 key 包含自选集合，避免不同用户串；但用排序后的哈希避免顺序影响
  const watchKey = watchSecids.slice().sort().join(",") || "none";
  return withCache(`discover:${count}:${watchKey}`, 20000, async () => {
    // 1) 自选优先
    const ordered = new Set(watchSecids);

    // 2) 同类型相关：取自选所在市场的涨幅榜补充
    const watchMarkets = [...new Set(watchSecids.map((s) => s.split(".")[0]))];
    if (watchMarkets.length) {
      const hot = await Promise.all(watchMarkets.map((m) => getHotList(m, 24)));
      for (const item of hot.flat()) {
        if (ordered.size < count * 2) ordered.add(item.secid);
      }
    }

    // 3) 固定池兜底洗牌补充
    const seed = Number(BigInt(Date.now()) / 20000n);
    const pool = DISCOVER_POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (seed * (i + 7) + 13) % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const secid of pool) {
      if (ordered.size < count * 2) ordered.add(secid);
    }

    // 保持「自选在前」顺序：用插入顺序
    const picks = [...ordered].slice(0, count * 2);

    const cards = await Promise.all(picks.map(buildDiscoverCard));
    // 过滤掉失败的，截到 count
    return cards.filter(Boolean).slice(0, count);
  });
}

function dateText(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseKline(line) {
  const [time, open, close, high, low, volume, amount, amplitude] = line.split(",");
  return {
    time,
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume) || 0,
    amount: Number(amount) || 0,
    amplitude: Number(amplitude) || 0
  };
}

async function getEastmoneyKlines(security, klt, begin, end) {
  return withCache(`kline:${security.secid}:${klt}:${begin}:${end}`, 30000, async () => {
    const params = new URLSearchParams({
      secid: security.secid,
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58",
      klt: String(klt),
      fqt: "1",
      beg: begin,
      end
    });
    const data = await fetchJson(`https://push2his.eastmoney.com/api/qt/stock/kline/get?${params}`);
    if (data.rc !== 0 || !data.data?.klines?.length) {
      throw new Error("行情源没有返回 K 线数据。");
    }
    return {
      ...security,
      name: data.data.name || security.name,
      symbol: data.data.code || security.symbol,
      rows: data.data.klines.map(parseKline),
      previousClose: Number(data.data.preKPrice) || null
    };
  });
}

function unitValue(value) {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs >= 100000000) return { value: pct(value / 100000000), unit: "亿" };
  if (abs >= 10000) return { value: pct(value / 10000), unit: "万" };
  return { value: pct(value), unit: "" };
}

async function getFinancialSummary(security, latestPrice) {
  const secucode = eastmoneySecucode(security);
  // 财务数据更新频率低（按季报），缓存 6 小时；PE 基于缓存时的价格，足够参考。
  return withCache(`finance:${secucode}`, 6 * 60 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      reportName: "RPT_F10_FINANCE_MAINFINADATA",
      columns: "ALL",
      quoteColumns: "",
      filter: `(SECUCODE="${secucode}")`,
      pageNumber: "1",
      pageSize: "4",
      sortTypes: "-1",
      sortColumns: "REPORT_DATE",
      source: "HSF10",
      client: "PC"
    });

    const data = await fetchJson(`https://datacenter.eastmoney.com/securities/api/data/v1/get?${params}`).catch(() => null);
    const rows = data?.result?.data || [];
    if (!rows.length) {
      return {
        available: false,
        secucode,
        summary: "该市场或该公司暂未返回可用财务摘要数据。"
      };
    }

    const latest = rows[0];
    const revenue = unitValue(Number(latest.TOTALOPERATEREVE));
    const parentNetProfit = unitValue(Number(latest.PARENTNETPROFIT));
    const eps = Number(latest.EPSJB);
    const pe = Number.isFinite(latestPrice) && Number.isFinite(eps) && eps > 0 ? latestPrice / eps : null;
    const netMargin = Number(latest.XSJLL);
    const grossMargin = Number(latest.XSMLL);
    const isLoss = Number(latest.PARENTNETPROFIT) < 0;

    return {
      available: true,
      secucode,
      reportDate: latest.REPORT_DATE_NAME || latest.REPORT_DATE,
      reportType: latest.REPORT_TYPE || "",
      revenue,
      revenueRaw: Number(latest.TOTALOPERATEREVE),
      revenueGrowth: pct(Number(latest.TOTALOPERATEREVETZ)),
      parentNetProfit,
      parentNetProfitRaw: Number(latest.PARENTNETPROFIT),
      parentNetProfitGrowth: pct(Number(latest.PARENTNETPROFITTZ)),
      grossMargin: pct(grossMargin),
      netMargin: pct(netMargin),
      roe: pct(Number(latest.ROEJQ)),
      debtRatio: pct(Number(latest.ZCFZL)),
      eps: pct(eps),
      pe: pe ? pct(pe) : null,
      isLoss,
      profitStatus: isLoss ? "当前亏损" : "当前盈利",
      history: rows.slice().reverse().map((row) => ({
        label: row.REPORT_DATE_NAME || row.REPORT_DATE,
        revenue: Number(row.TOTALOPERATEREVE),
        parentNetProfit: Number(row.PARENTNETPROFIT)
      })).filter((row) => Number.isFinite(row.revenue) && Number.isFinite(row.parentNetProfit))
    };
  });
}

function sma(values, size) {
  if (values.length < size) return null;
  const slice = values.slice(-size);
  return slice.reduce((sum, item) => sum + item, 0) / size;
}

function pct(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function analyzePeriod(rows, label, maFast, maSlow) {
  if (rows.length < 2) {
    return { label, available: false, summary: "数据不足，无法形成有效判断。" };
  }

  const closes = rows.map((row) => row.close);
  const last = rows.at(-1);
  const first = rows[0];
  const high = Math.max(...rows.map((row) => row.high));
  const low = Math.min(...rows.map((row) => row.low));
  const change = ((last.close - first.close) / first.close) * 100;
  const fast = sma(closes, maFast);
  const slow = sma(closes, maSlow);
  const avgVolume = rows.reduce((sum, row) => sum + row.volume, 0) / rows.length;
  const volumeRatio = avgVolume ? last.volume / avgVolume : 0;
  const range = Math.max(high - low, 0.000001);
  const position = ((last.close - low) / range) * 100;

  let trend = "震荡";
  if (change > 2 && fast && slow && fast > slow && last.close > fast) trend = "偏强";
  if (change < -2 && fast && slow && fast < slow && last.close < fast) trend = "偏弱";
  if (change > 4 && position > 70) trend = "强势上行";
  if (change < -4 && position < 30) trend = "弱势下行";

  const support = Math.min(low + range * 0.18, last.close * 0.985);
  const resistance = Math.max(high - range * 0.12, last.close * 1.015);
  const pullbackBuy = Math.max(support, last.close * 0.97);
  const breakoutBuy = resistance * 1.01;
  const stopLoss = support * 0.97;
  const takeProfit = resistance * 0.99;

  const notes = [];
  if (volumeRatio > 1.5 && change > 0) notes.push("近期量能放大且价格上涨，突破有效性更高。");
  if (volumeRatio > 1.5 && change < 0) notes.push("放量下跌，先等止跌信号。");
  if (position > 80) notes.push("价格接近区间高位，追涨性价比下降。");
  if (position < 20) notes.push("价格接近区间低位，需观察是否企稳。");
  if (!notes.length) notes.push("量价关系中性，适合等待方向确认。");

  return {
    label,
    available: true,
    trend,
    first: pct(first.close),
    last: pct(last.close),
    high: pct(high),
    low: pct(low),
    change: pct(change),
    maFast: fast ? pct(fast) : null,
    maSlow: slow ? pct(slow) : null,
    volumeRatio: pct(volumeRatio),
    position: pct(position),
    support: pct(support),
    resistance: pct(resistance),
    pullbackBuy: pct(pullbackBuy),
    breakoutBuy: pct(breakoutBuy),
    stopLoss: pct(stopLoss),
    takeProfit: pct(takeProfit),
    notes
  };
}

function tradePlan(day, week, month) {
  const usable = [day, week, month].filter((item) => item.available);
  const strong = usable.filter((item) => ["偏强", "强势上行"].includes(item.trend)).length;
  const weak = usable.filter((item) => ["偏弱", "弱势下行"].includes(item.trend)).length;
  const last = day.available ? day.last : week.last;

  let bias = "观望";
  let reason = "多周期信号不一致，优先等待放量突破或缩量回踩。";
  if (strong >= 2 && weak === 0) {
    bias = "偏多";
    reason = "至少两个周期偏强，适合用回踩确认或突破确认做交易计划。";
  }
  if (weak >= 2) {
    bias = "防守";
    reason = "至少两个周期偏弱，先控制仓位，等待重新站回关键均线。";
  }

  return {
    bias,
    reason,
    buyZone: day.available ? `${day.pullbackBuy} 附近低吸，或放量站上 ${day.breakoutBuy} 后再确认` : "日内数据不足",
    sellZone: day.available ? `${day.takeProfit} 附近分批止盈；跌破 ${day.stopLoss} 先止损或减仓` : "日内数据不足",
    risk: last ? `单笔交易先按 ${last} 附近现价估算仓位，止损距离不要超过可承受风险。` : "缺少现价，无法估算风险。"
  };
}

async function analyze(query) {
  // 聚合结果短缓存：基于日 K 末值，5 秒内重复请求直接命中，抗并发刷新
  return withCache(`analyze:${query}`, 5000, async () => {
    const security = await resolveSecurity(query);
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 45);
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);

    const [dayChart, dailyChart] = await Promise.all([
      getEastmoneyKlines(security, 5, dateText(today), dateText(today)).catch(() => null),
      getEastmoneyKlines(security, 101, dateText(yearAgo), dateText(today))
    ]);

    const intradayRows = dayChart?.rows?.length ? dayChart.rows : dailyChart.rows.slice(-2);
    const weekRows = dailyChart.rows.slice(-5);
    const monthRows = dailyChart.rows.filter((row) => row.time.replaceAll("-", "") >= dateText(monthAgo));

    const latest = dailyChart.rows.at(-1);
    const day = analyzePeriod(intradayRows, "当日", 5, 20);
    const week = analyzePeriod(weekRows, "当周", 3, 5);
    const month = analyzePeriod(monthRows, "当月", 5, 20);
    const financial = await getFinancialSummary(security, latest?.close || null);

    return {
      asOf: new Date().toISOString(),
      symbol: dailyChart.symbol,
      name: dailyChart.name,
      currency: security.currency,
      exchange: security.exchange,
      price: latest?.close || null,
      previousClose: dailyChart.previousClose,
      financial,
      periods: { day, week, month },
      plan: tradePlan(day, week, month),
      chart: monthRows
    };
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  let filePath = resolve(publicDir, requested);
  const publicRoot = `${publicDir}/`;

  if (filePath !== publicDir && !filePath.startsWith(publicRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  let body;
  // 支持 /privacy、/terms 这类无扩展名的页面：找不到时尝试追加 .html
  try {
    body = await readFile(filePath);
  } catch (error) {
    if ((error?.code === "ENOENT" || error?.code === "EISDIR") && !extname(filePath)) {
      filePath += ".html";
      try {
        body = await readFile(filePath);
      } catch (e2) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
    } else if (error?.code === "ENOENT" || error?.code === "EISDIR") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    } else {
      throw error;
    }
  }

  res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (url.pathname === "/api/health") {
      return json(res, 200, { ok: true, service: "stock-analyzer", version: "1.1.0", time: new Date().toISOString() });
    }

    if (url.pathname === "/api/analyze") {
      const query = url.searchParams.get("q") || "";
      if (!query.trim()) return json(res, 400, { error: "请输入股票代码或名称" });
      const result = await analyze(query);
      return json(res, 200, result);
    }

    // 细粒度端点：搜索/解析证券
    if (url.pathname === "/api/search") {
      const query = url.searchParams.get("q") || "";
      if (!query.trim()) return json(res, 400, { error: "请输入股票代码或名称" });
      const direct = secidFromCode(query);
      if (direct) {
        const quote = await getRealtimeQuote(direct).catch(() => null);
        return json(res, 200, { ...direct, name: quote?.name || direct.symbol, price: quote?.price ?? null });
      }
      const items = await suggestSecurities(query);
      return json(res, 200, { items });
    }

    // 发现页翻卡数据：一批含报价 + 迷你走势的股票卡片
    // watch=逗号分隔的 secid 列表（用户自选），自选股会被排在卡片最前
    if (url.pathname === "/api/discover") {
      const count = Math.min(Math.max(Number(url.searchParams.get("count")) || 12, 1), 24);
      const watch = url.searchParams.get("watch") || "";
      const cards = await discoverCards(count, watch);
      return json(res, 200, { cards });
    }

    // 细粒度端点：实时报价（多源）。优先用 secid 直接定位，避免 symbol 重解析串号
    if (url.pathname === "/api/quote") {
      const secid = url.searchParams.get("secid");
      const q = url.searchParams.get("q") || "";
      let security;
      if (secid) {
        security = securityFromSecid(secid);
        if (!security) return json(res, 400, { error: "无效的 secid" });
      } else {
        if (!q.trim()) return json(res, 400, { error: "请输入股票代码或名称" });
        security = await resolveSecurity(q);
      }
      const quote = await getRealtimeQuote(security);
      return json(res, 200, { ...security, ...quote });
    }

    // 细粒度端点：K线
    if (url.pathname === "/api/kline") {
      const q = url.searchParams.get("q") || "";
      const klt = Number(url.searchParams.get("klt") || 101);
      const days = Number(url.searchParams.get("days") || 180);
      if (!q.trim()) return json(res, 400, { error: "请输入股票代码或名称" });
      const security = await resolveSecurity(q);
      const end = dateText(new Date());
      const beginDate = new Date();
      beginDate.setDate(beginDate.getDate() - days);
      const chart = await getEastmoneyKlines(security, klt, dateText(beginDate), end);
      return json(res, 200, chart);
    }

    // 细粒度端点：财务摘要
    if (url.pathname === "/api/finance") {
      const q = url.searchParams.get("q") || "";
      if (!q.trim()) return json(res, 400, { error: "请输入股票代码或名称" });
      const security = await resolveSecurity(q);
      const quote = await getRealtimeQuote(security).catch(() => ({ price: null }));
      const financial = await getFinancialSummary(security, quote.price);
      return json(res, 200, financial);
    }

    await serveStatic(req, res);
  } catch (error) {
    if (req.url?.startsWith("/api/")) {
      return json(res, 500, { error: error.message || "分析失败" });
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Stock analyzer is running at http://${displayHost}:${port}`);
});
