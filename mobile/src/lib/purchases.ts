import { Platform } from "react-native";
import Constants from "expo-constants";
import { LOG_LEVEL } from "react-native-purchases";
import { useSubscription } from "../store/subscription";

// RevenueCat 封装：真实 StoreKit 2 购买。
// 需要先在 RevenueCat 后台创建 App + API Key，填入 app.json extra.revenueCatApiKey。
// 没配置 key 时，所有方法降级为本地 mock，方便开发期跑通 UI。

const apiKey = Constants.expoConfig?.extra?.revenueCatApiKey as string | undefined;
const ENTITLEMENT_ID = "pro"; // RevenueCat entitlement 标识

let initialized = false;
let packagesCache: any[] = [];

async function getPurchases() {
  try {
    const mod = await import("react-native-purchases");
    return mod.default;
  } catch {
    return null;
  }
}

export async function initPurchases() {
  if (initialized) return;
  initialized = true;
  const Purchases = await getPurchases();
  if (!Purchases || !apiKey) {
    // 开发期无 key：保持 free 状态
    return;
  }
  try {
    await Purchases.configure({ apiKey, appUserID: undefined });
    await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    const offerings = await Purchases.getOfferings();
    packagesCache = offerings.current?.availablePackages || [];
    await refreshEntitlements();
  } catch (e) {
    console.warn("RevenueCat init failed:", e);
  }
}

export async function refreshEntitlements() {
  const Purchases = await getPurchases();
  if (!Purchases || !apiKey) return;
  try {
    const info = await Purchases.getCustomerInfo();
    const isPro = !!info.entitlements.active[ENTITLEMENT_ID];
    useSubscription.getState().setPlan(isPro ? "pro" : "free");
  } catch (e) {
    console.warn("refresh entitlements failed:", e);
  }
}

export interface PurchasePackage {
  id: string;
  title: string;
  priceString: string;
  per?: string;
  raw: any;
}

export async function getPackages(): Promise<PurchasePackage[]> {
  const Purchases = await getPurchases();
  if (!Purchases || !apiKey || !packagesCache.length) {
    // mock 套餐（与上线真实 RC offering 保持一致：仅月/年，无终身档）
    return [
      { id: "monthly", title: "月度", priceString: "¥18.00", per: "/月", raw: null },
      { id: "yearly", title: "年度", priceString: "¥128.00", per: "/年", raw: null },
    ];
  }
  return packagesCache.map((p) => ({
    id: p.identifier,
    title: p.product.title || p.product.identifier,
    priceString: p.product.priceString,
    per: p.packageType,
    raw: p,
  }));
}

export async function purchasePackage(pkg: PurchasePackage): Promise<boolean> {
  const Purchases = await getPurchases();
  if (!Purchases || !apiKey || !pkg.raw) {
    // mock：直接解锁（仅开发用）
    await new Promise((r) => setTimeout(r, 800));
    useSubscription.getState().setPlan("pro");
    return true;
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg.raw);
    const isPro = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    useSubscription.getState().setPlan(isPro ? "pro" : "free");
    return isPro;
  } catch (e: any) {
    if (e.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const Purchases = await getPurchases();
  if (!Purchases || !apiKey) {
    useSubscription.getState().setPlan("free");
    return false;
  }
  try {
    const info = await Purchases.restorePurchases();
    const isPro = !!info.entitlements.active[ENTITLEMENT_ID];
    useSubscription.getState().setPlan(isPro ? "pro" : "free");
    return isPro;
  } catch (e) {
    console.warn("restore failed:", e);
    return false;
  }
}

export const isPurchasesConfigured = !!apiKey;
