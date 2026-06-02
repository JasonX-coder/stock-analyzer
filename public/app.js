const form = document.querySelector("#searchForm");
const input = document.querySelector("#queryInput");
const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#result");
const periodsEl = document.querySelector("#periods");
const financialPanel = document.querySelector("#financialPanel");
const canvas = document.querySelector("#chart");
const ctx = canvas.getContext("2d");

const fields = {
  exchange: document.querySelector("#exchange"),
  stockName: document.querySelector("#stockName"),
  symbol: document.querySelector("#symbol"),
  price: document.querySelector("#price"),
  bias: document.querySelector("#bias"),
  reason: document.querySelector("#reason"),
  buyZone: document.querySelector("#buyZone"),
  sellZone: document.querySelector("#sellZone"),
  risk: document.querySelector("#risk")
};

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatMoney(item) {
  if (!item || item.value === null || item.value === undefined) return "-";
  return `${formatNumber(item.value)}${item.unit || ""}`;
}

function changeClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function drawBarChart(rows) {
  if (!rows || !rows.length) return "";
  const max = Math.max(...rows.flatMap((row) => [Math.abs(row.revenue), Math.abs(row.parentNetProfit)]));
  if (!Number.isFinite(max) || max <= 0) return "";
  return `
    <div class="financeBars">
      ${rows.map((row) => {
        const revenueHeight = Math.max(6, (Math.abs(row.revenue) / max) * 120);
        const profitHeight = Math.max(6, (Math.abs(row.parentNetProfit) / max) * 120);
        return `
          <div class="barGroup">
            <div class="bars">
              <span class="bar revenueBar" style="height:${revenueHeight}px"></span>
              <span class="bar profitBar ${row.parentNetProfit < 0 ? "lossBar" : ""}" style="height:${profitHeight}px"></span>
            </div>
            <small>${row.label.replace("202", "2")}</small>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderFinancial(financial) {
  if (!financial?.available) {
    financialPanel.innerHTML = `
      <article class="financeCard">
        <div>
          <span class="eyebrow">财务情况</span>
          <h3>暂无财务摘要</h3>
        </div>
        <p class="financeEmpty">${financial?.summary || "当前股票暂未返回可用财务数据。"}</p>
      </article>
    `;
    return;
  }

  financialPanel.innerHTML = `
    <article class="financeCard">
      <div class="financeHeader">
        <div>
          <span class="eyebrow">财务情况 · ${financial.reportDate || ""}</span>
          <h3>${financial.profitStatus}</h3>
        </div>
        <span class="profitPill ${financial.isLoss ? "negativePill" : "positivePill"}">${financial.isLoss ? "亏损" : "盈利"}</span>
      </div>
      <div class="financeGrid">
        <div class="financeMetric"><span>市盈率</span><strong>${formatNumber(financial.pe)}</strong></div>
        <div class="financeMetric"><span>营收规模</span><strong>${formatMoney(financial.revenue)}</strong><em class="${changeClass(financial.revenueGrowth)}">${formatNumber(financial.revenueGrowth)}%</em></div>
        <div class="financeMetric"><span>归母净利润</span><strong>${formatMoney(financial.parentNetProfit)}</strong><em class="${changeClass(financial.parentNetProfitGrowth)}">${formatNumber(financial.parentNetProfitGrowth)}%</em></div>
        <div class="financeMetric"><span>毛利率</span><strong>${formatNumber(financial.grossMargin)}%</strong></div>
        <div class="financeMetric"><span>净利率</span><strong>${formatNumber(financial.netMargin)}%</strong></div>
        <div class="financeMetric"><span>ROE</span><strong>${formatNumber(financial.roe)}%</strong></div>
        <div class="financeMetric"><span>资产负债率</span><strong>${formatNumber(financial.debtRatio)}%</strong></div>
        <div class="financeMetric"><span>每股收益</span><strong>${formatNumber(financial.eps)}</strong></div>
      </div>
      <div class="financeChart">
        <div class="legend"><span><i class="revenueDot"></i>营收</span><span><i class="profitDot"></i>归母净利润</span></div>
        ${drawBarChart(financial.history)}
      </div>
    </article>
  `;
}

function drawChart(rows) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (!rows || rows.length < 2) {
    ctx.fillStyle = "#66717d";
    ctx.font = "16px Arial";
    ctx.fillText("图表数据不足", 30, 50);
    return;
  }

  const pad = { left: 58, right: 24, top: 24, bottom: 42 };
  const closes = rows.map((row) => row.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(max - min, 0.000001);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.strokeStyle = "#d9e0e7";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    const value = max - (span / 4) * i;
    ctx.fillStyle = "#66717d";
    ctx.font = "13px Arial";
    ctx.fillText(formatNumber(value), 12, y + 4);
  }

  ctx.strokeStyle = closes.at(-1) >= closes[0] ? "#0f8f5f" : "#c13d3d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  rows.forEach((row, index) => {
    const x = pad.left + (plotW * index) / (rows.length - 1);
    const y = pad.top + plotH - ((row.close - min) / span) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#17212b";
  ctx.font = "14px Arial";
  ctx.fillText("近一个月收盘走势", pad.left, height - 16);
}

function renderPeriod(period) {
  if (!period.available) {
    return `<article class="periodCard"><div><h3>${period.label}</h3></div><p>${period.summary}</p></article>`;
  }

  return `
    <article class="periodCard">
      <div>
        <h3>${period.label}</h3>
        <span class="badge">${period.trend}</span>
      </div>
      <div>
        <div class="metrics">
          <div class="metric"><span>涨跌幅</span><strong class="${changeClass(period.change)}">${formatNumber(period.change)}%</strong></div>
          <div class="metric"><span>收盘/现价</span><strong>${formatNumber(period.last)}</strong></div>
          <div class="metric"><span>支撑位</span><strong>${formatNumber(period.support)}</strong></div>
          <div class="metric"><span>压力位</span><strong>${formatNumber(period.resistance)}</strong></div>
          <div class="metric"><span>区间高点</span><strong>${formatNumber(period.high)}</strong></div>
          <div class="metric"><span>区间低点</span><strong>${formatNumber(period.low)}</strong></div>
          <div class="metric"><span>短均线</span><strong>${formatNumber(period.maFast)}</strong></div>
          <div class="metric"><span>量能倍数</span><strong>${formatNumber(period.volumeRatio)}</strong></div>
        </div>
        <ul class="notes">${period.notes.map((note) => `<li>${note}</li>`).join("")}</ul>
      </div>
    </article>
  `;
}

function render(data) {
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

async function analyze(query) {
  statusEl.textContent = "正在拉取行情、技术信号和财务摘要...";
  resultEl.classList.add("hidden");
  const response = await fetch(`/api/analyze?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "分析失败");
  render(data);
  const time = new Date(data.asOf).toLocaleString("zh-CN");
  statusEl.textContent = `分析完成，数据时间：${time}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) {
    statusEl.textContent = "请输入股票代码或名称。";
    return;
  }
  try {
    await analyze(query);
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

input.value = "600519";
