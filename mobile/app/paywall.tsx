import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../src/store/subscription";
import { API_BASE } from "../src/api/client";
import { colors, font, radius, spacing } from "../src/theme";
import {
  getPackages,
  purchasePackage,
  restorePurchases,
  isPurchasesConfigured,
  type PurchasePackage,
} from "../src/lib/purchases";

type Plan = {
  id: string;
  title: string;
  price: string;
  per: string;
  desc: string;
  highlight: boolean;
  badge?: string;
  pkg?: PurchasePackage;
};

// 当 RevenueCat 未配置（开发期）时的本地展示套餐
// 终身档已移除：与上线后真实 RC offering（仅月/年）保持一致，且规避 Apple 对
// 「非消耗型 + 自动续订」混用付费墙的审核风险。
const MOCK_PLANS: Plan[] = [
  { id: "monthly", title: "月度", price: "¥18", per: "/月", desc: "灵活订阅，随时取消", highlight: false },
  { id: "yearly", title: "年度", price: "¥128", per: "/年", desc: "约 ¥10.6/月，省 40%", highlight: true, badge: "最划算" },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setPlan = useSubscription((s) => s.setPlan);
  const [plans, setPlans] = useState<Plan[]>(MOCK_PLANS);
  const [selected, setSelected] = useState<string>("yearly");
  const [purchasing, setPurchasing] = useState(false);

  // 已配置 RevenueCat 时，从后台拉真实套餐与价格
  useEffect(() => {
    if (!isPurchasesConfigured) return;
    (async () => {
      const pkgs = await getPackages();
      if (pkgs.length) {
        const mapped: Plan[] = pkgs.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.priceString,
          per: p.per || "",
          desc: "",
          highlight: p.id.includes("yearly"),
          badge: p.id.includes("yearly") ? "最划算" : undefined,
          pkg: p,
        }));
        setPlans(mapped);
      }
    })();
  }, []);

  const purchase = useCallback(async () => {
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    setPurchasing(true);
    try {
      const pkg: PurchasePackage = plan.pkg || {
        id: plan.id,
        title: plan.title,
        priceString: plan.price,
        per: plan.per,
        raw: null,
      };
      const ok = await purchasePackage(pkg);
      if (ok) {
        setPlan("pro");
        Alert.alert("订阅成功", "已解锁全部 Pro 功能", [
          { text: "好的", onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      Alert.alert("购买失败", e.message || "请稍后重试");
    } finally {
      setPurchasing(false);
    }
  }, [plans, selected, setPlan, router]);

  const restore = useCallback(async () => {
    const ok = await restorePurchases();
    Alert.alert(ok ? "恢复成功" : "未找到订阅", ok ? "已解锁 Pro" : "未发现有效订阅记录");
  }, []);

  const features = [
    { icon: "analytics", text: "日/周/月多周期技术分析" },
    { icon: "trending-up", text: "买入、卖出、止损交易计划" },
    { icon: "bar-chart", text: "完整财务指标与历史对比" },
    { icon: "infinite", text: "长周期 K 线与均线系统" },
    { icon: "ban", text: "无广告打扰" },
    { icon: "rocket", text: "优先体验新功能" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.crownWrap}>
          <Ionicons name={"crown" as any} size={40} color={colors.gold} />
        </View>
        <Text style={styles.heroTitle}>升级 Pro</Text>
        <Text style={styles.heroSub}>解锁全部高级分析能力</Text>
      </View>

      <View style={styles.featureList}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon as any} size={16} color={colors.gold} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
            <Ionicons name="checkmark-circle" size={18} color={colors.down} />
          </View>
        ))}
      </View>

      <View style={styles.plans}>
        {plans.map((p) => {
          const active = selected === p.id;
          return (
            <Pressable
              key={p.id}
              style={({ pressed }) => [
                styles.plan,
                active && styles.planActive,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => setSelected(p.id)}
            >
              {p.badge ? (
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{p.badge}</Text>
                </View>
              ) : null}
              <View style={styles.planRadio}>
                <View style={[styles.radioOuter, active && { borderColor: colors.gold }]}>
                  {active ? <View style={styles.radioInner} /> : null}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{p.title}</Text>
                {p.desc ? <Text style={styles.planDesc}>{p.desc}</Text> : null}
              </View>
              <View style={styles.planPriceBox}>
                <Text style={styles.planPrice}>{p.price}</Text>
                <Text style={styles.planPer}>{p.per}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ paddingBottom: insets.bottom + 16, paddingHorizontal: spacing.lg }}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          onPress={purchase}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color="#1a1300" />
          ) : (
            <Text style={styles.ctaText}>立即订阅</Text>
          )}
        </Pressable>
        <Text style={styles.terms}>
          订阅自动续费，可随时在系统设置中取消。{"\n"}
          付款将在确认后从您的 Apple ID 扣除。
        </Text>
        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(`${API_BASE}/privacy`)}>
            <Text style={styles.legalLink}>隐私政策</Text>
          </Pressable>
          <Text style={styles.legalSep}>·</Text>
          <Pressable onPress={() => Linking.openURL(`${API_BASE}/terms`)}>
            <Text style={styles.legalLink}>用户协议</Text>
          </Pressable>
        </View>
        <Pressable onPress={restore}>
          <Text style={styles.restore}>恢复购买</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  hero: { alignItems: "center", paddingVertical: spacing.lg },
  crownWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: "rgba(240,185,11,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  heroTitle: { color: colors.text, fontSize: font.size.large, fontWeight: font.weight.bold },
  heroSub: { color: colors.textSecondary, fontSize: font.size.footnote, marginTop: 4 },
  featureList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, color: colors.text, fontSize: font.size.body },
  plans: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.sm },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  planActive: { borderColor: colors.gold, backgroundColor: "rgba(240,185,11,0.06)" },
  planBadge: {
    position: "absolute",
    top: -8,
    right: spacing.md,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  planBadgeText: { color: "#1a1300", fontSize: 10, fontWeight: font.weight.bold },
  planRadio: {},
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 11, height: 11, borderRadius: radius.pill, backgroundColor: colors.gold },
  planTitle: { color: colors.text, fontSize: font.size.body, fontWeight: font.weight.semibold },
  planDesc: { color: colors.textMuted, fontSize: font.size.caption, marginTop: 2 },
  planPriceBox: { alignItems: "flex-end" },
  planPrice: { color: colors.text, fontSize: font.size.headline, fontWeight: font.weight.bold },
  planPer: { color: colors.textMuted, fontSize: font.size.caption },
  cta: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md + 4,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  ctaText: { color: "#1a1300", fontSize: font.size.headline, fontWeight: font.weight.bold },
  terms: {
    color: colors.textMuted,
    fontSize: font.size.caption,
    textAlign: "center",
    lineHeight: 17,
    marginTop: spacing.md,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  legalLink: {
    color: colors.textSecondary,
    fontSize: font.size.caption,
    textDecorationLine: "underline",
  },
  legalSep: { color: colors.textMuted, fontSize: font.size.caption },
  restore: {
    color: colors.brand,
    fontSize: font.size.footnote,
    textAlign: "center",
    marginTop: spacing.sm,
    fontWeight: font.weight.medium,
  },
});
