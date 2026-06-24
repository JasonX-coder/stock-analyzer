import { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors, font } from "../theme";
import type { KlineRow } from "../api/client";
import { fmtPct } from "../lib/format";

const { width } = Dimensions.get("window");
const CHART_W = width - 32;
const CHART_H = 220;
const PAD = 8;

// 轻量 SVG 折线图 + 渐变填充
export function PriceChart({
  rows,
  showAxis = true,
}: {
  rows: KlineRow[];
  showAxis?: boolean;
}) {
  const model = useMemo(() => {
    if (!rows.length) return null;
    const closes = rows.map((r) => r.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = Math.max(max - min, 0.0001);
    const stepX = (CHART_W - PAD * 2) / Math.max(rows.length - 1, 1);

    const points = closes.map((c, i) => {
      const x = PAD + i * stepX;
      const y = PAD + (1 - (c - min) / range) * (CHART_H - PAD * 2);
      return { x, y, v: c };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const fillPath =
      `M${points[0].x.toFixed(2)} ${(CHART_H - PAD).toFixed(2)} ` +
      points.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
      ` L${points[points.length - 1].x.toFixed(2)} ${(CHART_H - PAD).toFixed(2)} Z`;

    const up = closes[closes.length - 1] >= closes[0];
    const last = points[points.length - 1];
    const first = closes[0];
    const lastClose = closes[closes.length - 1];
    const changePct = ((lastClose - first) / first) * 100;

    return { linePath, fillPath, last, up, min, max, changePct, lastClose };
  }, [rows]);

  if (!model) {
    return (
      <View style={[styles.box, { height: CHART_H }]}>
        <Text style={styles.empty}>暂无行情数据</Text>
      </View>
    );
  }

  const lineColor = model.up ? colors.up : colors.down;
  const gradId = model.up ? "gradUp" : "gradDown";

  return (
    <View style={styles.box}>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id="gradUp" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.up} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.up} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="gradDown" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.down} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.down} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={model.fillPath} fill={`url(#${gradId})`} />
        <Path d={model.linePath} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={model.last.x} cy={model.last.y} r={3.5} fill={lineColor} />
        <Circle cx={model.last.x} cy={model.last.y} r={7} fill={lineColor} opacity={0.18} />
      </Svg>
      {showAxis && (
        <View style={styles.axisRow}>
          <Text style={styles.axisText}>{model.max.toFixed(2)}</Text>
          <Text style={[styles.axisText, { color: lineColor }]}>
            {model.lastClose.toFixed(2)} ({fmtPct(model.changePct)})
          </Text>
          <Text style={styles.axisText}>{model.min.toFixed(2)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 8,
    alignItems: "center",
  },
  empty: {
    color: colors.textMuted,
    fontSize: font.size.body,
    textAlign: "center",
    marginTop: 80,
  },
  axisRow: {
    width: CHART_W,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: PAD,
    marginTop: 4,
  },
  axisText: {
    color: colors.textMuted,
    fontSize: font.size.caption,
  },
});
