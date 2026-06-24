// 数字/价格/百分比格式化
export const fmtPrice = (v: number | null | undefined, currency = "CNY") => {
  if (v == null || !Number.isFinite(v)) return "--";
  const sym = currency === "USD" ? "$" : currency === "HKD" ? "HK$" : "¥";
  return `${sym}${v.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const fmtNum = (v: number | null | undefined, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return "--";
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const fmtPct = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "--";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
};

export const fmtPctRaw = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "--";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
};

// 大数字转亿/万
export const fmtBig = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "--";
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toFixed(2);
};

export const fmtVolume = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "--";
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿手`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万手`;
  return `${v}手`;
};

// 趋势中文映射 + 颜色 key
export const trendMeta = (trend?: string) => {
  switch (trend) {
    case "强势上行":
    case "偏强":
      return { label: trend, tone: "up" as const };
    case "弱势下行":
    case "偏弱":
      return { label: trend, tone: "down" as const };
    default:
      return { label: trend || "震荡", tone: "flat" as const };
  }
};

export const biasMeta = (bias?: string) => {
  switch (bias) {
    case "偏多":
      return { label: bias, tone: "up" as const };
    case "防守":
      return { label: bias, tone: "down" as const };
    default:
      return { label: bias || "观望", tone: "flat" as const };
  }
};
