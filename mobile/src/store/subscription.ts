import { create } from "zustand";

// 订阅状态：免费用户 vs Pro。真实购买逻辑在 Phase 4 接 RevenueCat。
// 这里先建好状态机 + 功能门控，UI 可以先跑通。
export type Plan = "free" | "pro";

interface SubscriptionState {
  plan: Plan;
  loading: boolean;
  setPlan: (p: Plan) => void;
  setLoading: (b: boolean) => void;
  // Pro 专属功能门控
  isPro: () => boolean;
}

export const useSubscription = create<SubscriptionState>((set, get) => ({
  plan: "free",
  loading: false,
  setPlan: (p) => set({ plan: p }),
  setLoading: (b) => set({ loading: b }),
  isPro: () => get().plan === "pro",
}));

// 功能门控表：定义哪些能力需要 Pro
export const GATES = {
  multiPeriod: true, // 多周期技术分析
  tradePlan: true, // 交易计划（买入/卖出/止损区间）
  financialDetail: true, // 财务详情
  deepChart: true, // 长周期 K线 + 均线
  unlimitedSearch: false, // 搜索不限次（先全开，后续可改）
  noAds: true,
} as const;

export type GateKey = keyof typeof GATES;

export const featureEnabled = (key: GateKey): boolean => {
  if (!GATES[key]) return true;
  return useSubscription.getState().isPro();
};
