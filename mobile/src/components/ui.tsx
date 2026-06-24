import { ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { colors, radius, spacing, font } from "../theme";

// 卡片容器
export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          style,
          pressed && { opacity: 0.85 },
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// 区块标题
export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

// 标签 chip
export function Chip({
  label,
  tone = "flat",
  solid = false,
}: {
  label: string;
  tone?: "up" | "down" | "flat" | "brand" | "gold";
  solid?: boolean;
}) {
  const toneColor =
    tone === "up"
      ? colors.up
      : tone === "down"
      ? colors.down
      : tone === "brand"
      ? colors.brand
      : tone === "gold"
      ? colors.gold
      : colors.flat;
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: solid ? toneColor : `${toneColor}22`,
          borderWidth: solid ? 0 : 1,
          borderColor: `${toneColor}55`,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: solid ? "#fff" : toneColor }]}>{label}</Text>
    </View>
  );
}

// 键值行
export function KV({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

// 骨架屏
export function Skeleton({ width, height = 16, radius: r = 6 }: { width: number | string; height?: number; radius?: number }) {
  return (
    <View
      style={{
        width: width as any,
        height,
        borderRadius: r,
        backgroundColor: colors.skeleton,
      }}
    />
  );
}

// 加载/空/错误态
export function StateView({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: string | null;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.stateText}>加载中…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateText}>{error}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateText}>{empty}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: font.size.footnote,
    fontWeight: font.weight.semibold,
    letterSpacing: 0.3,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  chipText: {
    fontSize: font.size.caption,
    fontWeight: font.weight.semibold,
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  kvLabel: {
    color: colors.textSecondary,
    fontSize: font.size.footnote,
  },
  kvValue: {
    color: colors.text,
    fontSize: font.size.body,
    fontWeight: font.weight.medium,
  },
  stateWrap: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: font.size.body,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandBg,
    marginTop: spacing.xs,
  },
  retryText: {
    color: colors.brand,
    fontSize: font.size.footnote,
    fontWeight: font.weight.semibold,
  },
});
