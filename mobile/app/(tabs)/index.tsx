import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useWatchlist } from "../../src/store/watchlist";
import type { WatchItem } from "../../src/store/watchlist";
import { api, type QuoteResult } from "../../src/api/client";
import { colors, font, radius, spacing } from "../../src/theme";
import { fmtPrice, fmtPct } from "../../src/lib/format";
import { Card, StateView } from "../../src/components/ui";

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const items = useWatchlist((s) => s.items);
  const [quotes, setQuotes] = useState<Record<string, QuoteResult | null>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadQuotes = useCallback(async (silent = false) => {
    if (!items.length) return;
    if (!silent) setLoading(true);
    setRefreshing(true);
    const results: Record<string, QuoteResult | null> = {};
    await Promise.all(
      items.map(async (it) => {
        try {
          results[it.secid] = await api.quote(it.symbol);
        } catch {
          results[it.secid] = null;
        }
      })
    );
    setQuotes(results);
    setLoading(false);
    setRefreshing(false);
  }, [items]);

  useFocusEffect(
    useCallback(() => {
      loadQuotes(true);
    }, [loadQuotes])
  );

  const renderItem = ({ item }: { item: WatchItem }) => {
    const q = quotes[item.secid];
    const change = q?.price != null && q?.previousClose ? q.price - q.previousClose : null;
    const changePct = change && q?.previousClose ? (change / q.previousClose) * 100 : null;
    const tone = change == null ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
    const toneColor = tone === "up" ? colors.up : tone === "down" ? colors.down : colors.flat;
    return (
      <Card onPress={() => router.push({ pathname: "/analyze", params: { q: item.symbol } })} style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.code}>{item.symbol} · {item.exchange}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.price}>{fmtPrice(q?.price ?? null, item.currency)}</Text>
          <Text style={[styles.change, { color: toneColor }]}>
            {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(2)}` : "--"}  {fmtPct(changePct)}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>自选股</Text>
          <Text style={styles.sub}>{items.length} 只关注</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          onPress={() => loadQuotes(false)}
        >
          <Ionicons name="refresh" size={18} color={colors.brand} />
        </Pressable>
      </View>

      {!items.length ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <StateView
            empty="还没有自选股"
          />
          <Pressable
            style={({ pressed }) => [styles.goSearch, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/search")}
          >
            <Text style={styles.goSearchText}>去搜索添加</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.secid}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadQuotes(false)}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={loading ? <StateView loading /> : null}
        />
      )}
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
  h1: { color: colors.text, fontSize: font.size.large, fontWeight: font.weight.bold },
  sub: { color: colors.textMuted, fontSize: font.size.footnote, marginTop: 2 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brandBg,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  rowLeft: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: font.size.body, fontWeight: font.weight.semibold },
  code: { color: colors.textMuted, fontSize: font.size.caption },
  rowRight: { alignItems: "flex-end", gap: 2 },
  price: { color: colors.text, fontSize: font.size.headline, fontWeight: font.weight.semibold },
  change: { fontSize: font.size.footnote, fontWeight: font.weight.medium },
  goSearch: {
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    marginTop: spacing.sm,
  },
  goSearchText: { color: "#fff", fontSize: font.size.body, fontWeight: font.weight.semibold },
});
