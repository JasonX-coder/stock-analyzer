import { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, type DiscoverCard } from "../../src/api/client";
import { useWatchlist } from "../../src/store/watchlist";
import { colors, font, radius, spacing } from "../../src/theme";
import { SwipeCard } from "../../src/components/SwipeCard";

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const watchlist = useWatchlist();
  const items = useWatchlist((s) => s.items);
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 自选股优先：把用户自选的 secid 传给后端，排在卡片最前
      const watchSecids = items.map((it) => it.secid);
      const res = await api.discover(14, watchSecids);
      setCards(res.cards || []);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }, []);

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      // 处理栈顶卡片：右滑加入自选，左滑跳过
      setCards((prev) => {
        const [top, ...rest] = prev;
        if (top && dir === "right") {
          watchlist.add({
            secid: top.secid,
            symbol: top.symbol,
            name: top.name,
            exchange: top.exchange,
            currency: top.currency,
          });
          showToast(`已加入自选 · ${top.name}`);
        }
        return rest;
      });
      // 剩余少于 4 张时静默补卡
      if (cards.length <= 4) {
        const watchSecids = items.map((it) => it.secid);
        api.discover(10, watchSecids).then((res) => setCards((prev) => [...prev, ...(res.cards || [])])).catch(() => {});
      }
    },
    [cards.length, watchlist, showToast, items]
  );

  const handleTap = useCallback(
    (card: DiscoverCard) => {
      router.push({ pathname: "/analyze", params: { q: card.symbol } });
    },
    [router]
  );

  // 手动按钮：模拟滑走
  const manualSwipe = useCallback(
    (dir: "left" | "right") => {
      handleSwipe(dir);
    },
    [handleSwipe]
  );

  const top = cards[0];
  const liked = top ? watchlist.has(top.secid) : false;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>发现</Text>
          <Text style={styles.sub}>
            {items.length ? `优先过 ${items.length} 只自选 · 推荐同类型` : "滑卡浏览，右滑收藏 · 左滑跳过"}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          onPress={load}
        >
          <Ionicons name="shuffle" size={18} color={colors.brand} />
        </Pressable>
      </View>

      <View style={styles.deck}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.loadingText}>正在收集行情卡片…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-done" size={48} color={colors.border} />
            <Text style={styles.emptyText}>今日卡片已浏览完</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>再来一批</Text>
            </Pressable>
          </View>
        ) : (
          // 倒序渲染，栈顶在最上层；只渲染前 3 张提升性能
          cards
            .slice(0, 3)
            .map((card, i) => (
              <SwipeCard
                key={card.secid}
                card={card}
                isTop={i === 0}
                index={i}
                onSwipe={handleSwipe}
                onTap={handleTap}
              />
            ))
            .reverse()
        )}
      </View>

      {/* 操作按钮 */}
      {top && !loading && !error && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={({ pressed }) => [styles.actBtn, styles.skipBtn, pressed && { transform: [{ scale: 0.92 }] }]}
            onPress={() => manualSwipe("left")}
          >
            <Ionicons name="close" size={30} color={colors.up} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actBtn, styles.detailBtn, pressed && { transform: [{ scale: 0.92 }] }]}
            onPress={() => handleTap(top)}
          >
            <Ionicons name="analytics" size={24} color={colors.brand} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actBtn, styles.likeBtn, pressed && { transform: [{ scale: 0.92 }] }]}
            onPress={() => manualSwipe("right")}
          >
            <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={colors.gold} />
          </Pressable>
        </View>
      )}

      {/* 轻提示 */}
      {toast ? (
        <View style={styles.toastWrap}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={16} color={colors.down} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  h1: { color: colors.text, fontSize: font.size.large, fontWeight: "700" },
  sub: { color: colors.textMuted, fontSize: font.size.footnote, marginTop: 2 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brandBg,
    alignItems: "center",
    justifyContent: "center",
  },
  deck: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  loadingText: { color: colors.textMuted, fontSize: font.size.footnote, marginTop: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: font.size.body, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandBg,
    marginTop: spacing.sm,
  },
  retryText: { color: colors.brand, fontSize: font.size.footnote, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  actBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  skipBtn: { width: 58, height: 58, backgroundColor: colors.bgCard, borderColor: "rgba(245,71,93,0.4)" },
  detailBtn: { width: 50, height: 50, backgroundColor: colors.bgCard, borderColor: "rgba(59,130,246,0.4)" },
  likeBtn: { width: 58, height: 58, backgroundColor: colors.bgCard, borderColor: "rgba(240,185,11,0.4)" },
  toastWrap: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  toastText: { color: colors.text, fontSize: font.size.footnote, fontWeight: "500" },
});
