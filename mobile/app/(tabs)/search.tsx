import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, type SearchItem } from "../../src/api/client";
import { colors, font, radius, spacing } from "../../src/theme";
import { Card, StateView } from "../../src/components/ui";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    const text = q.trim();
    if (!text) {
      setItems([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.search(text);
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = () => {
    if (query.trim()) {
      // 直接代码/精确输入，跳分析页
      if (/^[\d.]+$/.test(query.trim()) || /^[a-zA-Z]{1,6}$/.test(query.trim())) {
        Keyboard.dismiss();
        router.push({ pathname: "/analyze", params: { q: query.trim().toUpperCase() } });
        return;
      }
      runSearch(query);
    }
  };

  const renderItem = ({ item }: { item: SearchItem }) => (
    <Card
      onPress={() => {
        Keyboard.dismiss();
        router.push({ pathname: "/analyze", params: { q: item.symbol } });
      }}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.code}>{item.exchange}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.symbol}>{item.symbol}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.h1}>搜索</Text>
        <Text style={styles.sub}>A 股 · 港股 · 美股</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSubmit}
          placeholder="输入代码或名称，如 600519 / 茅台 / AAPL"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />
        {query ? (
          <Pressable onPress={() => runSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.secid}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          searched && !loading ? (
            <StateView empty="没有匹配的股票，换个关键词试试" />
          ) : loading ? (
            <StateView loading />
          ) : (
            <View style={{ marginTop: 80, alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="trending-up" size={48} color={colors.border} />
              <Text style={styles.tip}>输入股票代码或名称开始分析</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  h1: { color: colors.text, fontSize: font.size.large, fontWeight: font.weight.bold },
  sub: { color: colors.textMuted, fontSize: font.size.footnote },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgInput,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: font.size.body, padding: 0 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  rowLeft: { gap: 2 },
  name: { color: colors.text, fontSize: font.size.body, fontWeight: font.weight.semibold },
  code: { color: colors.textMuted, fontSize: font.size.caption },
  rowRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  symbol: { color: colors.textSecondary, fontSize: font.size.footnote, fontWeight: font.weight.medium },
  tip: { color: colors.textMuted, fontSize: font.size.footnote },
});
