// 主题色板：深色为主的金融 App 风格
export const colors = {
  // 背景层
  bg: "#0B0E14",
  bgElevated: "#12161F",
  bgCard: "#171C26",
  bgInput: "#1E2430",

  // 文字
  text: "#E8ECF1",
  textSecondary: "#9BA4B5",
  textMuted: "#5C6678",

  // 边框/分隔
  border: "#232A37",
  divider: "#1B212B",

  // 语义色（A 股惯例：红涨绿跌）
  up: "#F5475D",
  upBg: "rgba(245,71,93,0.12)",
  down: "#16C784",
  downBg: "rgba(22,199,132,0.12)",
  flat: "#8A93A6",

  // 品牌色
  brand: "#3B82F6",
  brandBg: "rgba(59,130,246,0.14)",
  gold: "#F0B90B",

  // 功能
  overlay: "rgba(0,0,0,0.6)",
  skeleton: "#1E2430",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const font = {
  size: {
    caption: 11,
    footnote: 13,
    body: 15,
    headline: 17,
    title: 20,
    large: 28,
    price: 32,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

// 涨跌色映射
export const trendColor = (change?: number | null) => {
  if (change == null) return colors.textSecondary;
  if (change > 0) return colors.up;
  if (change < 0) return colors.down;
  return colors.flat;
};

// 涨跌符号
export const trendSign = (change?: number | null) => {
  if (change == null) return "";
  if (change > 0) return "+";
  return "";
};
