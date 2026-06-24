import { View, Text, StyleSheet, Pressable, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../../src/store/subscription";
import { api, API_BASE } from "../../src/api/client";
import { colors, font, radius, spacing } from "../../src/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const plan = useSubscription((s) => s.plan);

  const checkHealth = async () => {
    try {
      const h = await api.health();
      Alert.alert("服务状态", `正常 · v${h.version}\n${API_BASE}`);
    } catch (e: any) {
      Alert.alert("服务状态", `连接失败：${e.message}`);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.h1}>我的</Text>
      </View>

      {/* 订阅状态卡 */}
      <View style={styles.subCard}>
        <View style={{ flex: 1 }}>
          <View style={styles.subBadgeRow}>
            {plan === "pro" ? (
              <View style={[styles.badge, { backgroundColor: "rgba(240,185,11,0.18)" }]}>
                <Ionicons name={"crown" as any} size={12} color={colors.gold} />
                <Text style={[styles.badgeText, { color: colors.gold }]}>Pro 会员</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: colors.brandBg }]}>
                <Text style={[styles.badgeText, { color: colors.brand }]}>免费版</Text>
              </View>
            )}
          </View>
          <Text style={styles.subTitle}>
            {plan === "pro" ? "已解锁全部高级功能" : "升级解锁多周期分析、交易计划、财务详情"}
          </Text>
        </View>
        {plan !== "pro" ? (
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/paywall")}
          >
            <Text style={styles.upgradeText}>升级</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 菜单 */}
      <View style={styles.menuGroup}>
        <MenuItem icon="information-circle-outline" label="关于应用" onPress={() => Alert.alert("股市情报速览", "v1.0.0\n数据来自公开行情接口，仅供参考，不构成投资建议。")} />
        <MenuItem icon="server-outline" label="服务状态" onPress={checkHealth} />
        <MenuItem icon="shield-checkmark-outline" label="隐私政策" onPress={() => Linking.openURL(`${API_BASE}/privacy`)} />
        <MenuItem icon="document-text-outline" label="使用条款" onPress={() => Linking.openURL(`${API_BASE}/terms`)} />
        <MenuItem icon="star-outline" label="App Store 评分" onPress={() => Linking.openURL("itms-apps://itunes.apple.com/app/id000")} />
      </View>

      <Text style={styles.footer}>© 2026 股市情报速览 · 仅供学习研究</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <View style={styles.menuLeft}>
        <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  h1: { color: colors.text, fontSize: font.size.large, fontWeight: font.weight.bold },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  subBadgeRow: { marginBottom: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: font.size.caption, fontWeight: font.weight.bold },
  subTitle: { color: colors.textSecondary, fontSize: font.size.footnote, lineHeight: 18 },
  upgradeBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  upgradeText: { color: "#1a1300", fontSize: font.size.footnote, fontWeight: font.weight.bold },
  menuGroup: {
    margin: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  menuLabel: { color: colors.text, fontSize: font.size.body },
  footer: {
    color: colors.textMuted,
    fontSize: font.size.caption,
    textAlign: "center",
    marginTop: "auto",
    marginBottom: spacing.lg,
  },
});
