import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "../theme";
import { fmtPrice, fmtPct } from "../lib/format";
import { Sparkline } from "./Sparkline";
import type { DiscoverCard } from "../api/client";

const SCREEN_W = Dimensions.get("window").width;
const CARD_W = Math.min(SCREEN_W - 56, 360);
const CARD_H = 460;
const SWIPE_THRESHOLD = SCREEN_W * 0.28; // 拖过这个比例视为决心滑走

type Props = {
  card: DiscoverCard;
  isTop: boolean;
  index: number; // 堆叠深度
  onSwipe: (dir: "left" | "right") => void;
  onTap: (card: DiscoverCard) => void;
};

// 单张翻卡：拖拽旋转 + 涨闪金光 / 跌闪红电
export function SwipeCard({ card, isTop, index, onSwipe, onTap }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  // 涨跌特效强度（0~1），由拖拽方向与涨跌方向叠加驱动
  const flashAmt = useSharedValue(0); // 金光（上涨）
  const boltAmt = useSharedValue(0); // 红电（下跌）

  // 涨跌判定：相对昨收
  const change = card.price != null && card.previousClose ? card.price - card.previousClose : null;
  const changePct = change && card.previousClose ? (change / card.previousClose) * 100 : null;
  const isUp = (change ?? 0) > 0;
  const isDown = (change ?? 0) < 0;
  const tone: "up" | "down" = isUp ? "up" : "down";

  // 顶部卡片：上涨时持续金光呼吸，下跌时红色闪电抖动
  useEffect(() => {
    if (!isTop) {
      flashAmt.value = 0;
      boltAmt.value = 0;
      return;
    }
    if (isUp) {
      flashAmt.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration: 1200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    } else if (isDown) {
      // 红色闪电：快速闪烁
      boltAmt.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 60 }),
          withTiming(0.2, { duration: 90 }),
          withTiming(0.7, { duration: 50 }),
          withTiming(0.1, { duration: 400 })
        ),
        -1,
        false
      );
    }
    return () => {
      cancelAnimation(flashAmt);
      cancelAnimation(boltAmt);
    };
  }, [isTop, isUp, isDown, flashAmt, boltAmt]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isTop)
        .onUpdate((e) => {
          translateX.value = e.translationX;
          translateY.value = e.translationY * 0.4;
          rotateZ.value = (e.translationX / SCREEN_W) * 22;
        })
        .onEnd((e) => {
          const dir = e.translationX > 0 ? "right" : "left";
          if (Math.abs(e.translationX) > SWIPE_THRESHOLD || Math.abs(e.velocityX) > 800) {
            const exitX = dir === "right" ? SCREEN_W : -SCREEN_W;
            translateX.value = withSpring(exitX, { velocity: e.velocityX, damping: 28, stiffness: 220 });
            rotateZ.value = withSpring(dir === "right" ? 28 : -28, { velocity: e.velocityX / 20 });
            runOnJS(onSwipe)(dir);
          } else {
            translateX.value = withSpring(0, { damping: 18 });
            translateY.value = withSpring(0, { damping: 18 });
            rotateZ.value = withSpring(0, { damping: 18 });
          }
        }),
    [isTop, onSwipe]
  );

  // 堆叠：非顶部卡片轻微缩小并下移
  const stackOffset = Math.min(index, 2);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + (isTop ? 0 : stackOffset * 10) },
      { rotate: `${rotateZ.value}deg` },
      { scale: isTop ? 1 : interpolate(stackOffset, [0, 1, 2], [1, 0.95, 0.9], Extrapolation.CLAMP) },
    ],
    opacity: index > 2 ? 0 : 1,
    zIndex: 10 - index,
  }));

  // 金光覆盖层透明度 = 呼吸 + 右滑加成
  const flashLayer = useAnimatedStyle(() => ({
    opacity: interpolate(
      flashAmt.value + (translateX.value > 0 ? translateX.value / SCREEN_W : 0),
      [0, 1],
      [0, 0.9],
      Extrapolation.CLAMP
    ),
  }));

  // 红色闪电覆盖层
  const boltLayer = useAnimatedStyle(() => ({
    opacity: interpolate(
      boltAmt.value + (translateX.value < 0 ? -translateX.value / SCREEN_W : 0),
      [0, 1],
      [0, 0.85],
      Extrapolation.CLAMP
    ),
  }));

  // 拖拽方向提示（LIKE / NOPE）透明度
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [40, 120], [0, 1], Extrapolation.CLAMP),
    transform: [{ rotate: "-18deg" }],
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-translateX.value, [40, 120], [0, 1], Extrapolation.CLAMP),
    transform: [{ rotate: "18deg" }],
  }));

  const priceColor = isUp ? colors.up : isDown ? colors.down : colors.text;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, { width: CARD_W, height: CARD_H }, cardStyle]}>
          {/* 涨：金色闪光渐变层 */}
          <Animated.View pointerEvents="none" style={[styles.flashLayer, styles.goldGlow, flashLayer]} />
          {/* 跌：红色闪电层 */}
          <Animated.View pointerEvents="none" style={[styles.flashLayer, boltLayer]}>
            <View style={styles.boltOverlay} />
            <Ionicons name="flash" size={60} color={colors.up} style={styles.boltIcon1} />
            <Ionicons name="flash" size={44} color={colors.up} style={styles.boltIcon2} />
          </Animated.View>

          {/* LIKE / NOPE 角标 */}
          <Animated.View pointerEvents="none" style={[styles.badge, styles.likeBadge, likeStyle]}>
            <Text style={styles.badgeText}>加入自选</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.badge, styles.nopeBadge, nopeStyle]}>
            <Text style={styles.badgeText}>跳过</Text>
          </Animated.View>

          <Pressable
            style={styles.inner}
            onPress={() => isTop && runOnJS(onTap)(card)}
          >
            {/* 顶部：名称 + 交易所 */}
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
                <Text style={styles.code}>{card.symbol} · {card.exchange}</Text>
              </View>
              <View style={[styles.toneChip, { backgroundColor: isUp ? colors.upBg : isDown ? colors.downBg : colors.bgInput }]}>
                <Ionicons name={isUp ? "arrow-up" : isDown ? "arrow-down" : "remove"} size={12} color={priceColor} />
                <Text style={[styles.toneChipText, { color: priceColor }]}>
                  {isUp ? "上涨" : isDown ? "下跌" : "平盘"}
                </Text>
              </View>
            </View>

            {/* 价格 + 涨跌 */}
            <View style={styles.priceBlock}>
              <Text style={[styles.price, { color: priceColor }]} adjustsFontSizeToFit>
                {fmtPrice(card.price, card.currency)}
              </Text>
              <View style={[styles.changeBox, { backgroundColor: isUp ? colors.upBg : isDown ? colors.downBg : colors.bgInput }]}>
                <Text style={[styles.changeText, { color: priceColor }]}>
                  {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(2)}` : "--"}
                </Text>
                <Text style={[styles.changeText, { color: priceColor }]}>{fmtPct(changePct)}</Text>
              </View>
            </View>

            {/* 迷你走势 */}
            <View style={styles.sparkWrap}>
              <Sparkline
                data={card.spark.map((r) => r.close)}
                width={CARD_W - 48}
                height={92}
                tone={tone}
              />
              <Text style={styles.sparkLabel}>近 30 日走势</Text>
            </View>

            {/* 昨收 / 最高 / 最低 */}
            <View style={styles.statsRow}>
              <Stat label="昨收" value={fmtPrice(card.previousClose, card.currency)} />
              <Stat label="最高" value={fmtPrice(card.high, card.currency)} />
              <Stat label="最低" value={fmtPrice(card.low, card.currency)} />
            </View>

            {/* 底部操作提示 */}
            <View style={styles.hintRow}>
              <View style={styles.hintItem}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                <Text style={styles.hintText}>左滑跳过</Text>
              </View>
              <View style={styles.hintItem}>
                <Text style={styles.hintText}>右滑加自选</Text>
                <Ionicons name="heart-circle" size={22} color={colors.gold} />
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { position: "absolute", alignItems: "center", justifyContent: "center" },
  card: {
    position: "absolute",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
  inner: { flex: 1, padding: spacing.lg },
  flashLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  goldGlow: {
    backgroundColor: "transparent",
    // 用径向感伪金光：多层金色圆点叠加
    shadowColor: colors.gold,
    shadowOpacity: 1,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  boltOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(245,71,93,0.18)",
  },
  boltIcon1: { position: "absolute", top: 90, left: 30, opacity: 0.9 },
  boltIcon2: { position: "absolute", bottom: 120, right: 26, opacity: 0.8 },
  badge: {
    position: "absolute",
    top: 28,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    zIndex: 5,
  },
  likeBadge: { left: 20, borderColor: colors.gold, backgroundColor: "rgba(240,185,11,0.12)" },
  nopeBadge: { right: 20, borderColor: colors.up, backgroundColor: "rgba(245,71,93,0.12)" },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: colors.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  code: { color: colors.textMuted, fontSize: font.size.footnote, marginTop: 2 },
  toneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  toneChipText: { fontSize: font.size.caption, fontWeight: "600" },
  priceBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  price: { fontSize: 38, fontWeight: "700", letterSpacing: -1 },
  changeBox: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.md, alignItems: "flex-end", gap: 2 },
  changeText: { fontSize: font.size.body, fontWeight: "700" },
  sparkWrap: { marginTop: spacing.lg, alignItems: "center", gap: spacing.xs },
  sparkLabel: { color: colors.textMuted, fontSize: font.size.caption },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.divider,
  },
  statItem: { alignItems: "center", flex: 1 },
  statLabel: { color: colors.textMuted, fontSize: font.size.caption },
  statValue: { color: colors.text, fontSize: font.size.footnote, fontWeight: "600", marginTop: 3 },
  hintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: spacing.md,
  },
  hintItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  hintText: { color: colors.textMuted, fontSize: font.size.caption },
});
