import Constants from "expo-constants";

// 后端 API 基址，从 app.json extra 读取，支持本地/生产切换
const API_BASE =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  (process.env.EXPO_PUBLIC_API_BASE as string) ||
  "http://127.0.0.1:4173";

export interface SecurityRef {
  secid: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

export interface QuoteResult extends SecurityRef {
  price: number | null;
  previousClose: number | null;
  open?: number;
  high?: number;
  low?: number;
  source: string;
}

export interface SearchItem extends SecurityRef {}

export interface KlineRow {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  amplitude: number;
}

export interface KlineResult extends SecurityRef {
  rows: KlineRow[];
  previousClose: number | null;
}

export interface PeriodAnalysis {
  label: string;
  available: boolean;
  summary?: string;
  trend?: string;
  first?: number;
  last?: number;
  high?: number;
  low?: number;
  change?: number;
  maFast?: number | null;
  maSlow?: number | null;
  volumeRatio?: number;
  position?: number;
  support?: number;
  resistance?: number;
  pullbackBuy?: number;
  breakoutBuy?: number;
  stopLoss?: number;
  takeProfit?: number;
  notes?: string[];
}

export interface FinancialSummary {
  available: boolean;
  secucode?: string;
  summary?: string;
  reportDate?: string;
  reportType?: string;
  revenue?: { value: number; unit: string } | null;
  revenueGrowth?: number | null;
  parentNetProfit?: { value: number; unit: string } | null;
  parentNetProfitGrowth?: number | null;
  grossMargin?: number | null;
  netMargin?: number | null;
  roe?: number | null;
  debtRatio?: number | null;
  eps?: number | null;
  pe?: number | null;
  isLoss?: boolean;
  profitStatus?: string;
  history?: { label: string; revenue: number; parentNetProfit: number }[];
}

export interface TradePlan {
  bias: string;
  reason: string;
  buyZone: string;
  sellZone: string;
  risk: string;
}

export interface AnalyzeResult extends SecurityRef {
  asOf: string;
  price: number | null;
  previousClose: number | null;
  financial: FinancialSummary;
  periods: { day: PeriodAnalysis; week: PeriodAnalysis; month: PeriodAnalysis };
  plan: TradePlan;
  chart: KlineRow[];
}

async function request<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `请求失败 (${res.status})`);
    return data as T;
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("请求超时，请检查网络");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request<{ ok: boolean; version: string }>("/api/health"),
  search: (q: string) =>
    request<{ items: SearchItem[] } & Partial<SecurityRef>>("/api/search", { q }),
  quote: (q: string) => request<QuoteResult>("/api/quote", { q }),
  kline: (q: string, days = 180, klt = 101) =>
    request<KlineResult>("/api/kline", { q, days, klt }),
  finance: (q: string) => request<FinancialSummary>("/api/finance", { q }),
  analyze: (q: string) => request<AnalyzeResult>("/api/analyze", { q }),
};

export { API_BASE };
