// ── 配置数据 ──────────────────────────────────────────────
const INDICES = [
  { name: "上证指数", code: "1.000001" },
  { name: "深证成指", code: "0.399001" },
  { name: "创业板指", code: "0.399006" },
  { name: "沪深300",  code: "1.000300" },
];

// 推荐股票（可手动维护或后续接入动态数据）
const RECOMMEND_STOCKS = [
  { code: "600519", name: "贵州茅台", reason: "消费龙头，估值修复逻辑，机构持续增仓" },
  { code: "300750", name: "宁德时代", reason: "储能+动力电池双轮驱动，海外订单放量" },
  { code: "601318", name: "中国平安", reason: "险资龙头，股息率具吸引力，PB处历史低位" },
  { code: "002415", name: "海康威视", reason: "AI视觉赋能，政府采购回暖，毛利率改善" },
  { code: "000858", name: "五粮液", reason: "白酒次高端需求回升，渠道库存趋于合理" },
];

// 重点行业上下游
const INDUSTRY_CHAINS = [
  {
    name: "AI算力",
    tag: "科技·高景气",
    chain: [
      { code: "688981", name: "中芯国际", layer: "上游·芯片制造" },
      { code: "603501", name: "韦尔股份", layer: "上游·芯片设计" },
      { code: "002955", name: "鸿璟集团", layer: "中游·服务器" },
      { code: "300782", name: "卓胜微",   layer: "下游·终端应用" },
    ],
  },
  {
    name: "新能源汽车",
    tag: "制造·稳健",
    chain: [
      { code: "002594", name: "比亚迪",   layer: "整车" },
      { code: "300750", name: "宁德时代", layer: "电池" },
      { code: "601865", name: "福莱特",   layer: "玻璃盖板" },
      { code: "002460", name: "赣锋锂业", layer: "锂资源" },
    ],
  },
];

// 重点监控股票
const WATCH_STOCKS = [
  { code: "600036", name: "招商银行" },
  { code: "601166", name: "兴业银行" },
  { code: "000001", name: "平安银行" },
  { code: "601888", name: "中国中免" },
  { code: "688599", name: "天合光能" },
  { code: "002352", name: "顺丰控股" },
];

// ── 工具函数 ──────────────────────────────────────────────
const fmt = (v, d = 2) =>
  v == null || !Number.isFinite(+v) ? "-" : (+v).toLocaleString("zh-CN", { maximumFractionDigits: d });

function chgClass(v) {
  if (v > 0) return "positive";
  if (v < 0) return "negative";
  return "neutral";
}

function chgLabel(v) {
  if (v == null || !Number.isFinite(+v)) return "-";
  const s = (+v).toFixed(2);
  return v > 0 ? `+${s}%` : `${s}%`;
}

// 东方财富行情快照（单只）
async function fetchQuote(secid) {
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f43,f169,f170,f44,f45,f47&ut=bd1d9ddb04089700cf9c27f6f7426281`;
  const r = await fetch(url);
  const json = await r.json();
  const d = json?.data;
  if (!d) return null;
  return {
    name:   d.f58,
    price:  d.f43 / 100,
    chgPct: d.f170 / 100,
    high:   d.f44 / 100,
    low:    d.f45 / 100,
    vol:    d.f47,
  };
}

// 东方财富历史日K（近N根，用于迷你走势图）
async function fetchMiniKline(secid, n = 10) {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2&fields2=f51,f53&klt=101&fqt=1&beg=0&end=20500101&lmt=${n}`;
  const r = await fetch(url);
  const json = await r.json();
  return (json?.data?.klines || []).map(l => +l.split(",")[1]);
}

// ── 市场指数 ─────────────────────────────────────────────
async function loadIndices() {
  const grid = document.getElementById("indexGrid");
  const cards = await Promise.all(
    INDICES.map(async idx => {
      const q = await fetchQuote(idx.code).catch(() => null);
      const cls = q ? chgClass(q.chgPct) : "";
      return `
        <div class="index-card">
          <div class="ic-name">${idx.name}</div>
          <div class="ic-value ${cls}">${q ? fmt(q.price) : "—"}</div>
          <div class="ic-change ${cls}">${q ? chgLabel(q.chgPct) : ""}</div>
        </div>`;
    })
  );
  grid.innerHTML = cards.join("");
}

// ── 推荐股票 ─────────────────────────────────────────────
async function loadRecommend() {
  const list = document.getElementById("recommendList");
  const rows = await Promise.all(
    RECOMMEND_STOCKS.map(async (s, i) => {
      const secid = /^(5|6|9)/.test(s.code) ? `1.${s.code}` : `0.${s.code}`;
      const q = await fetchQuote(secid).catch(() => null);
      const rankCls = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
      const cls = q ? chgClass(q.chgPct) : "";
      return `
        <div class="stock-row" data-code="${s.code}" data-secid="${secid}">
          <div class="stock-rank ${rankCls}">${i + 1}</div>
          <div class="stock-name-block">
            <div class="sn">${q?.name || s.name}</div>
            <div class="sc">${s.code}</div>
          </div>
          <div class="stock-price ${cls}">${q ? fmt(q.price) : "—"}</div>
          <div class="stock-change ${q ? (q.chgPct > 0 ? "up" : q.chgPct < 0 ? "down" : "flat") : ""}">${q ? chgLabel(q.chgPct) : "—"}</div>
          <div class="stock-reason">${s.reason}</div>
        </div>`;
    })
  );
  list.innerHTML = rows.join("");
  list.querySelectorAll(".stock-row").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.secid));
  });
}

// ── 行业上下游 ────────────────────────────────────────────
async function loadIndustry() {
  const container = document.getElementById("industryMap");
  const blocks = await Promise.all(
    INDUSTRY_CHAINS.map(async ind => {
      const nodes = await Promise.all(
        ind.chain.map(async node => {
          const secid = /^(5|6|9)/.test(node.code) ? `1.${node.code}` : `0.${node.code}`;
          const q = await fetchQuote(secid).catch(() => null);
          const cls = q ? chgClass(q.chgPct) : "";
          return `
            <div class="chain-node" data-secid="${secid}">
              <div class="cn-name">${q?.name || node.name}</div>
              <div class="cn-code">${node.layer}</div>
              <div class="cn-chg ${cls}">${q ? chgLabel(q.chgPct) : "—"}</div>
            </div>`;
        })
      );
      const nodesHtml = nodes.map((n, i) =>
        i < nodes.length - 1
          ? n + `<span class="chain-arrow">→</span>`
          : n
      ).join("");
      return `
        <div class="industry-block">
          <div class="industry-title">
            <span class="ib-name">${ind.name}</span>
            <span class="ib-tag">${ind.tag}</span>
          </div>
          <div class="industry-chain">${nodesHtml}</div>
        </div>`;
    })
  );
  container.innerHTML = blocks.join("");
  container.querySelectorAll(".chain-node").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.secid));
  });
}

// ── 重点监控 ─────────────────────────────────────────────
async function loadWatch() {
  const grid = document.getElementById("watchGrid");
  const cards = await Promise.all(
    WATCH_STOCKS.map(async s => {
      const secid = /^(5|6|9)/.test(s.code) ? `1.${s.code}` : `0.${s.code}`;
      const [q, bars] = await Promise.all([
        fetchQuote(secid).catch(() => null),
        fetchMiniKline(secid, 10).catch(() => []),
      ]);
      const cls = q ? chgClass(q.chgPct) : "";
      const miniBar = buildMiniBar(bars, q?.chgPct);
      return `
        <div class="watch-card" data-secid="${secid}">
          <div class="wc-header">
            <div>
              <div class="wc-name">${q?.name || s.name}</div>
              <div class="wc-code">${s.code}</div>
            </div>
            <div class="stock-change ${q ? (q.chgPct > 0 ? "up" : q.chgPct < 0 ? "down" : "flat") : ""}">${q ? chgLabel(q.chgPct) : "—"}</div>
          </div>
          <div class="wc-price ${cls}">${q ? fmt(q.price) : "—"}</div>
          <div class="wc-metrics">
            <div class="wc-metric"><strong>${q ? fmt(q.high) : "—"}</strong>最高</div>
            <div class="wc-metric"><strong>${q ? fmt(q.low) : "—"}</strong>最低</div>
            <div class="wc-metric"><strong>${q ? fmtVol(q.vol) : "—"}</strong>成交量</div>
          </div>
          <div class="wc-trend">${miniBar}</div>
        </div>`;
    })
  );
  grid.innerHTML = cards.join("");
  grid.querySelectorAll(".watch-card").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.secid));
  });
}

function fmtVol(v) {
  if (!v || !Number.isFinite(+v)) return "—";
  if (v >= 1e8) return (v / 1e8).toFixed(1) + "亿手";
  if (v >= 1e4) return (v / 1e4).toFixed(1) + "万手";
  return v + "手";
}

function buildMiniBar(closes, chgPct) {
  if (!closes.length) return "";
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(max - min, 0.0001);
  const color = chgPct > 0 ? "var(--green)" : chgPct < 0 ? "var(--red)" : "var(--amber)";
  const bars = closes.map(c => {
    const h = Math.max(4, Math.round(((c - min) / span) * 36));
    return `<span class="wc-bar" style="height:${h}px;background:${color};opacity:0.7"></span>`;
  }).join("");
  return `<div class="wc-bars">${bars}</div>`;
}

// ── 全局刷新 ─────────────────────────────────────────────
function updateTime() {
  const now = new Date();
  document.getElementById("reportTime").textContent =
    `${now.toLocaleDateString("zh-CN")} ${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新`;
}

async function refreshAll() {
  const btn = document.getElementById("refreshBtn");
  btn.textContent = "刷新中…";
  btn.disabled = true;
  document.getElementById("dashStatus").textContent = "正在拉取行情数据...";
  try {
    await Promise.all([loadIndices(), loadRecommend(), loadIndustry(), loadWatch()]);
    updateTime();
    document.getElementById("dashStatus").textContent = "数据已更新，点击任意股票卡片查看详细分析。";
  } catch (e) {
    document.getElementById("dashStatus").textContent = "部分数据加载失败，稍后重试。";
  } finally {
    btn.textContent = "刷新数据";
    btn.disabled = false;
  }
}

// ── 个股分析弹层 ─────────────────────────────────────────
const modal = document.getElementById("stockModal");
const modalClose = document.getElementById("modalClose");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const periodsEl = document.getElementById("periods");
const financialPanel = document.getElementById("financialPanel");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");
const fields = {
  exchange: document.getElementById("exchange"),
  stockName: document.getElementById("stockName"),
  symbol: document.getElementById("symbol"),
  price: document.getElementById("price"),
  bias: document.getElementById("bias"),
  reason: document.getElementById("reason"),
  buyZone: document.getElementById("buyZone"),
  sellZone: document.getElementById("sellZone"),
  risk: document.getElementById("risk"),
};

modalClose.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });

async function openModal(secid) {
  modal.classList.remove("hidden");
  modal.scrollTop = 0;
  statusEl.textContent = "正在拉取行情、技术信号和财务摘要...";
  resultEl.classList.add("hidden");
  try {
    const res = await fetch(`/api/analyze?q=${secid.split(".")[1]}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "分析失败");
    renderDetail(data);
    statusEl.textContent = `分析完成，数据时间：${new Date(data.asOf).toLocaleString("zh-CN")}`;
  } catch (e) {
    statusEl.textContent = e.message;
  }
}

// ── 个股详情渲染（保持原有逻辑）────────────────────────────
function formatNumber(v) {
  if (v == null || Number.isNaN(+v)) return "-";
  return (+v).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatMoney(item) {
  if (!item || item.value == null) return "-";
  return `${formatNumber(item.value)}${item.unit || ""}`;
}

function changeClass(v) {
  if (v > 0) return "positive";
  if (v < 0) return "negative";
  return "neutral";
}

function drawBarChart(rows) {
  if (!rows?.length) return "";
  const max = Math.max(...rows.flatMap(r => [Math.abs(r.revenue), Math.abs(r.parentNetProfit)]));
  if (!Number.isFinite(max) || max <= 0) return "";
  return `<div class="financeBars">${rows.map(r => {
    const rh = Math.max(6, (Math.abs(r.revenue) / max) * 100);
    const ph = Math.max(6, (Math.abs(r.parentNetProfit) / max) * 100);
    return `<div class="barGroup"><div class="bars">
      <span class="bar revenueBar" style="height:${rh}px"></span>
      <span class="bar profitBar ${r.parentNetProfit < 0 ? "lossBar" : ""}" style="height:${ph}px"></span>
    </div><small>${r.label.replace("202","2")}</small></div>`;
  }).join("")}</div>`;
}

function renderFinancial(fin) {
  if (!fin?.available) {
    financialPanel.innerHTML = `<article class="financeCard"><div><span class="eyebrow">财务情况</span><h3>暂无财务摘要</h3></div><p class="financeEmpty">${fin?.summary || ""}</p></article>`;
    return;
  }
  financialPanel.innerHTML = `
    <article class="financeCard">
      <div class="financeHeader">
        <div><span class="eyebrow">财务情况 · ${fin.reportDate || ""}</span><h3>${fin.profitStatus}</h3></div>
        <span class="profitPill ${fin.isLoss ? "negativePill" : "positivePill"}">${fin.isLoss ? "亏损" : "盈利"}</span>
      </div>
      <div class="financeGrid">
        <div class="financeMetric"><span>市盈率</span><strong>${formatNumber(fin.pe)}</strong></div>
        <div class="financeMetric"><span>营收规模</span><strong>${formatMoney(fin.revenue)}</strong><em class="${changeClass(fin.revenueGrowth)}">${formatNumber(fin.revenueGrowth)}%</em></div>
        <div class="financeMetric"><span>归母净利润</span><strong>${formatMoney(fin.parentNetProfit)}</strong><em class="${changeClass(fin.parentNetProfitGrowth)}">${formatNumber(fin.parentNetProfitGrowth)}%</em></div>
        <div class="financeMetric"><span>毛利率</span><strong>${formatNumber(fin.grossMargin)}%</strong></div>
        <div class="financeMetric"><span>净利率</span><strong>${formatNumber(fin.netMargin)}%</strong></div>
        <div class="financeMetric"><span>ROE</span><strong>${formatNumber(fin.roe)}%</strong></div>
        <div class="financeMetric"><span>资产负债率</span><strong>${formatNumber(fin.debtRatio)}%</strong></div>
        <div class="financeMetric"><span>每股收益</span><strong>${formatNumber(fin.eps)}</strong></div>
      </div>
      <div class="financeChart">
        <div class="legend"><span><i class="revenueDot"></i>营收</span><span><i class="profitDot"></i>归母净利润</span></div>
        ${drawBarChart(fin.history)}
      </div>
    </article>`;
}

function drawChart(rows) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  if (!rows?.length || rows.length < 2) { ctx.fillStyle = "#66717d"; ctx.font = "16px Arial"; ctx.fillText("图表数据不足", 30, 50); return; }
  const pad = { left: 56, right: 24, top: 20, bottom: 38 };
  const closes = rows.map(r => r.close);
  const min = Math.min(...closes), max = Math.max(...closes);
  const span = Math.max(max - min, 0.000001);
  const pW = W - pad.left - pad.right, pH = H - pad.top - pad.bottom;
  ctx.strokeStyle = "#d9e0e7"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (pH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = "#66717d"; ctx.font = "13px Arial";
    ctx.fillText(formatNumber(max - (span / 4) * i), 4, y + 4);
  }
  ctx.strokeStyle = closes.at(-1) >= closes[0] ? "#0f8f5f" : "#c13d3d";
  ctx.lineWidth = 2.5; ctx.beginPath();
  rows.forEach((r, i) => {
    const x = pad.left + (pW * i) / (rows.length - 1);
    const y = pad.top + pH - ((r.close - min) / span) * pH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#17212b"; ctx.font = "13px Arial";
  ctx.fillText("近一个月收盘走势", pad.left, H - 14);
}

function renderPeriod(p) {
  if (!p.available) return `<article class="periodCard"><div><h3>${p.label}</h3></div><p>${p.summary}</p></article>`;
  return `
    <article class="periodCard">
      <div><h3>${p.label}</h3><span class="badge">${p.trend}</span></div>
      <div>
        <div class="metrics">
          <div class="metric"><span>涨跌幅</span><strong class="${changeClass(p.change)}">${formatNumber(p.change)}%</strong></div>
          <div class="metric"><span>现价</span><strong>${formatNumber(p.last)}</strong></div>
          <div class="metric"><span>支撑</span><strong>${formatNumber(p.support)}</strong></div>
          <div class="metric"><span>压力</span><strong>${formatNumber(p.resistance)}</strong></div>
          <div class="metric"><span>区间高</span><strong>${formatNumber(p.high)}</strong></div>
          <div class="metric"><span>区间低</span><strong>${formatNumber(p.low)}</strong></div>
          <div class="metric"><span>均线</span><strong>${formatNumber(p.maFast)}</strong></div>
          <div class="metric"><span>量比</span><strong>${formatNumber(p.volumeRatio)}</strong></div>
        </div>
        <ul class="notes">${p.notes.map(n => `<li>${n}</li>`).join("")}</ul>
      </div>
    </article>`;
}

function renderDetail(data) {
  fields.exchange.textContent = [data.exchange, data.currency].filter(Boolean).join(" · ");
  fields.stockName.textContent = data.name;
  fields.symbol.textContent = data.symbol;
  fields.price.textContent = formatNumber(data.price);
  fields.bias.textContent = data.plan.bias;
  fields.reason.textContent = data.plan.reason;
  fields.buyZone.textContent = data.plan.buyZone;
  fields.sellZone.textContent = data.plan.sellZone;
  fields.risk.textContent = data.plan.risk;
  renderFinancial(data.financial);
  periodsEl.innerHTML = [data.periods.day, data.periods.week, data.periods.month].map(renderPeriod).join("");
  drawChart(data.chart);
  resultEl.classList.remove("hidden");
}

// ── 保存图片 ─────────────────────────────────────────────
document.getElementById("saveBtn").addEventListener("click", async () => {
  const btn = document.getElementById("saveBtn");
  btn.textContent = "生成中…"; btn.disabled = true;
  try {
    const el = document.getElementById("dashboard");
    const canvas = await html2canvas(el, { backgroundColor: "#f4f6f8", scale: 1.5, useCORS: true, logging: false });
    const link = document.createElement("a");
    const now = new Date();
    link.download = `股市情报_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
    btn.textContent = "已保存!";
    setTimeout(() => { btn.textContent = "保存图片"; btn.disabled = false; }, 2000);
  } catch {
    btn.textContent = "保存图片"; btn.disabled = false;
  }
});

// ── 个股搜索框 ────────────────────────────────────────────
document.getElementById("searchForm").addEventListener("submit", async e => {
  e.preventDefault();
  const q = document.getElementById("queryInput").value.trim();
  if (!q) return;
  modal.classList.remove("hidden");
  modal.scrollTop = 0;
  statusEl.textContent = "正在分析...";
  resultEl.classList.add("hidden");
  try {
    const res = await fetch(`/api/analyze?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "分析失败");
    renderDetail(data);
    statusEl.textContent = `分析完成，数据时间：${new Date(data.asOf).toLocaleString("zh-CN")}`;
  } catch (e) {
    statusEl.textContent = e.message;
  }
});

// ── 初始化 ────────────────────────────────────────────────
refreshAll();
document.getElementById("refreshBtn").addEventListener("click", refreshAll);
