import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, type AnalyzeResult } from "../src/api/client";
import { useWatchlist } from "../src/store/watchlist";
import { featureEnabled, useSubscription } from "../src/store/subscription";
import { colors, font, radius, spacing } from "../src/theme";
import { fmtPrice, fmtPct, fmtBig, trendMeta, biasMeta } from "../src/lib/format";
import { Card, SectionTitle, Chip, KV, StateView } from "../src/components/ui";
import { PriceChart } from "../src/components/PriceChart";
import { ProGate } from "../src/components/ProGate";

export default function AnalyzeScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const watchlist = useWatchlist();
  const plan = useSubscription((s) => s.plan);

  const load = useCallback(async () => {
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyze(q);
      setData(res);
    } catch (e: any) {
      setError(e.message || "分析失败");
    } finally {
      setLoading(false);
    }
  }, [q]);

  // 首次加载
  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header title={q} onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={styles.loadingText}>正在分析 {q}…</Text>
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header title={q} onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <StateView error={error} onRetry={load} />
        </View>
      </View>
    );
  }

  if (!data) return null;

  const change = data.price != null && data.previousClose ? data.price - data.previousClose : null;
  const changePct = change && data.previousClose ? (change / data.previousClose) * 100 : null;
  const tone = change == null ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
  const priceColor = tone === "up" ? colors.up : tone === "down" ? colors.down : colors.text;
  const inWatch = watchlist.has(data.secid);
  const bias = biasMeta(data.plan.bias);

  const proUnlocked = plan === "pro";
  const periods = [data.periods.day, data.periods.week, data.periods.month];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header
        title={data.name}
        subtitle={`${data.symbol} · ${data.exchange}`}
        onBack={() => router.back()}
        right={
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={() =>
              watchlist.toggle({
                secid: data.secid,
                symbol: data.symbol,
                name: data.name,
                exchange: data.exchange,
                currency: data.currency,
              })
            }
          >
            <Ionicons
              name={inWatch ? "star" : "star-outline"}
              size={20}
              color={inWatch ? colors.gold : colors.textSecondary}
            />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* 价格头卡 */}
        <Card style={styles.priceCard}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.price} adjustsFontSizeToFit>{fmtPrice(data.price, data.currency)}</Text>
              <Text style={styles.prevClose}>昨收 {fmtPrice(data.previousClose, data.currency)}</Text>
            </View>
            <View style={[styles.changeBox, { backgroundColor: tone === "up" ? colors.upBg : tone === "down" ? colors.downBg : colors.bgInput }]}>
              <Text style={[styles.changeText, { color: priceColor }]}>
                {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(2)}` : "--"}
              </Text>
              <Text style={[styles.changeText, { color: priceColor }]}>{fmtPct(changePct)}</Text>
            </View>
          </View>
        </Card>

        {/* 走势图 */}
        <View>
          <SectionTitle title="近一月走势" right={<Chip label={`${data.chart.length} 个交易日`} tone="flat" />} />
          <PriceChart rows={data.chart} />
        </View>

        {/* 综合结论 */}
        <View>
          <SectionTitle title="综合结论" />
          <Card style={styles.conclusionCard}>
            <View style={styles.biasRow}>
              <Chip label={bias.label} tone={bias.tone} solid />
              <Text style={styles.biasReason}>{data.plan.reason}</Text>
            </View>
            {proUnlocked ? (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <PlanLine icon="arrow-down-circle" tone="up" label="买入区间" value={data.plan.buyZone} />
                <PlanLine icon="arrow-up-circle" tone="down" label="卖出区间" value={data.plan.sellZone} />
                <PlanLine icon="shield" tone="gold" label="风险提示" value={data.plan.risk} />
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.lockedHint}>详细的买入/卖出/止损区间为 Pro 功能</Text>
                <Pressable
                  style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push("/paywall")}
                >
                  <Ionicons name="lock-closed" size={14} color={colors.gold} />
                  <Text style={styles.unlockText}>解锁交易计划</Text>
                </Pressable>
              </View>
            )}
          </Card>
        </View>

        {/* 多周期技术分析 */}
        <View>
          <SectionTitle title="多周期技术分析" right={!proUnlocked ? <Chip label="PRO" tone="gold" /> : undefined} />
          {proUnlocked ? (
            <View style={{ gap: spacing.sm }}>
              {periods.map((p) => (
                <PeriodCard key={p.label} period={p} />
              ))}
            </View>
          ) : (
            <Card>
              {/* 日线免费预览 */}
              <PeriodCard period={data.periods.day} preview />
              <View style={styles.gateDivider} />
              <ProGate title="周线 / 月线深度分析" />
            </Card>
          )}
        </View>

        {/* 财务摘要 */}
        <View>
          <SectionTitle title="公司财务" right={!proUnlocked ? <Chip label="PRO" tone="gold" /> : undefined} />
          {data.financial.available && proUnlocked ? (
            <Card>
              <KV label="报告期" value={data.financial.reportDate || "--"} />
              <KV
                label="营收"
                value={data.financial.revenue ? `${data.financial.revenue.value}${data.financial.revenue.unit}` : "--"}
                valueColor={trendColorNum(data.financial.revenueGrowth)}
              />
              {data.financial.revenueGrowth != null && (
                <KV label="营收同比" value={fmtPct(data.financial.revenueGrowth)} valueColor={trendColorNum(data.financial.revenueGrowth)} />
              )}
              <KV
                label="归母净利润"
                value={data.financial.parentNetProfit ? `${data.financial.parentNetProfit.value}${data.financial.parentNetProfit.unit}` : "--"}
                valueColor={trendColorNum(data.financial.parentNetProfitGrowth)}
              />
              <KV label="毛利率" value={data.financial.grossMargin != null ? `${data.financial.grossMargin}%` : "--"} />
              <KV label="净利率" value={data.financial.netMargin != null ? `${data.financial.netMargin}%` : "--"} />
              <KV label="ROE" value={data.financial.roe != null ? `${data.financial.roe}%` : "--"} />
              <KV label="资产负债率" value={data.financial.debtRatio != null ? `${data.financial.debtRatio}%` : "--"} />
              <KV label="EPS" value={data.financial.eps != null ? `${data.financial.eps}` : "--"} />
              <KV label="市盈率 PE" value={data.financial.pe != null ? `${data.financial.pe}` : "--"} />
            </Card>
          ) : data.financial.available && !proUnlocked ? (
            <Card>
              <View style={styles.financePreview}>
                <Ionicons name="stats-chart" size={40} color={colors.border} />
              </View>
              <ProGate title="查看完整财务指标" />
            </Card>
          ) : (
            <Card>
              <Text style={styles.emptyText}>{data.financial.summary || "暂无财务数据"}</Text>
            </Card>
          )}
        </View>

        <Text style={styles.disclaimer}>
          ⚠️ 以上分析基于公开行情数据，仅供学习研究，不构成投资建议。投资有风险，决策需谨慎。
        </Text>
      </ScrollView>
    </View>
  );
}

function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function PeriodCard({
  period,
  preview = false,
}: {
  period: AnalyzeResult["periods"]["day"];
  preview?: boolean;
}) {
  const t = trendMeta(period.trend);
  const toneColor = t.tone === "up" ? colors.up : t.tone === "down" ? colors.down : colors.flat;
  if (!period.available) {
    return (
      <Card>
        <Text style={styles.periodLabel}>{period.label}</Text>
        <Text style={styles.emptyText}>{period.summary}</Text>
      </Card>
    );
  }
  return (
    <Card>
      <View style={styles.periodHeader}>
        <Text style={styles.periodLabel}>{period.label}</Text>
        <Chip label={t.label} tone={t.tone} solid />
      </View>
      <View style={styles.periodGrid}>
        <GridKV label="区间涨幅" value={fmtPct(period.change)} color={toneColor} />
        <GridKV label="区间位置" value={period.position != null ? `${period.position}%` : "--"} />
        <GridKV label="最高" value={period.high?.toFixed(2) ?? "--"} />
        <GridKV label="最低" value={period.low?.toFixed(2) ?? "--"} />
        <GridKV label="支撑位" value={period.support?.toFixed(2) ?? "--"} color={colors.up} />
        <GridKV label="压力位" value={period.resistance?.toFixed(2) ?? "--"} color={colors.down} />
        <GridKV label="量能倍数" value={period.volumeRatio != null ? `${period.volumeRatio}` : "--"} />
        <GridKV label="快线MA" value={period.maFast?.toFixed(2) ?? "--"} />
      </View>
      {preview ? null : (
        period.notes && period.notes.length > 0 ? (
          <View style={styles.notesBox}>
            {period.notes.map((n, i) => (
              <Text key={i} style={styles.noteText}>· {n}</Text>
            ))}
          </View>
        ) : null
      )}
    </Card>
  );
}

function GridKV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={[styles.gridValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function PlanLine({
  icon,
  tone,
  label,
  value,
}: {
  icon: string;
  tone: "up" | "down" | "gold";
  label: string;
  value: string;
}) {
  const c = tone === "up" ? colors.up : tone === "down" ? colors.down : colors.gold;
  return (
    <View style={styles.planLine}>
      <View style={[styles.planIcon, { backgroundColor: `${c}22` }]}>
        <Ionicons name={icon as any} size={16} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.planLabel}>{label}</Text>
        <Text style={styles.planValue}>{value}</Text>
      </View>
    </View>
  );
}

function trendColorNum(v: number | null | undefined) {
  if (v == null) return undefined;
  return v > 0 ? colors.up : v < 0 ? colors.down : colors.flat;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: { color: colors.text, fontSize: font.size.headline, fontWeight: font.weight.bold },
  headerSub: { color: colors.textMuted, fontSize: font.size.caption, marginTop: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: colors.textMuted, fontSize: font.size.footnote, textAlign: "center", marginTop: spacing.md },
  priceCard: { padding: spacing.lg },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  price: { color: colors.text, fontSize: font.size.price, fontWeight: font.weight.bold, letterSpacing: -0.5 },
  prevClose: { color: colors.textMuted, fontSize: font.size.footnote, marginTop: 4 },
  changeBox: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: "flex-end", gap: 2 },
  changeText: { fontSize: font.size.body, fontWeight: font.weight.bold },
  conclusionCard: { gap: spacing.sm },
  biasRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  biasReason: { color: colors.textSecondary, fontSize: font.size.footnote, flex: 1, lineHeight: 19 },
  lockedHint: { color: colors.textMuted, fontSize: font.size.caption, marginBottom: spacing.sm },
  planLine: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  planIcon: { width: 28, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: 1 },
  planLabel: { color: colors.textMuted, fontSize: font.size.caption, marginBottom: 2 },
  planValue: { color: colors.text, fontSize: font.size.footnote, lineHeight: 19 },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: "rgba(240,185,11,0.14)",
  },
  unlockText: { color: colors.gold, fontSize: font.size.footnote, fontWeight: font.weight.semibold },
  gateDivider: { height: 0.5, backgroundColor: colors.divider, marginVertical: spacing.md },
  periodHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  periodLabel: { color: colors.text, fontSize: font.size.body, fontWeight: font.weight.semibold },
  periodGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs },
  gridItem: { width: "50%", paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  gridLabel: { color: colors.textMuted, fontSize: font.size.caption },
  gridValue: { color: colors.text, fontSize: font.size.footnote, fontWeight: font.weight.medium, marginTop: 2 },
  notesBox: { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.bgInput, borderRadius: radius.sm, gap: 4 },
  noteText: { color: colors.textSecondary, fontSize: font.size.caption, lineHeight: 18 },
  financePreview: { alignItems: "center", paddingVertical: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: font.size.footnote },
  disclaimer: {
    color: colors.textMuted,
    fontSize: font.size.caption,
    lineHeight: 17,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
