import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "../theme";

// Pro 功能锁定遮罩：覆盖在付费内容上，点击跳付费墙
export function ProGate({ title = "Pro 专属功能" }: { title?: string }) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={22} color={colors.gold} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>订阅 Pro 解锁多周期技术分析、交易计划与财务详情</Text>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/paywall")}
      >
        <Text style={styles.btnText}>升级 Pro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: "rgba(240,185,11,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: font.size.headline,
    fontWeight: font.weight.semibold,
  },
  desc: {
    color: colors.textSecondary,
    fontSize: font.size.footnote,
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  btnText: {
    color: "#1a1300",
    fontSize: font.size.body,
    fontWeight: font.weight.bold,
  },
});
