import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors } from "../theme";

// 卡片用迷你走势：纯折线 + 渐变填充 + 末端高亮点
export function Sparkline({
  data,
  width = 240,
  height = 56,
  tone = "up",
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: "up" | "down";
}) {
  const model = useMemo(() => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = Math.max(max - min, 0.0001);
    const pad = 4;
    const stepX = (width - pad * 2) / Math.max(data.length - 1, 1);
    const pts = data.map((c, i) => ({
      x: pad + i * stepX,
      y: pad + (1 - (c - min) / range) * (height - pad * 2),
    }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const fill =
      `M${pts[0].x.toFixed(2)} ${height - pad} ` +
      pts.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
      ` L${pts[pts.length - 1].x.toFixed(2)} ${height - pad} Z`;
    return { line, fill, last: pts[pts.length - 1] };
  }, [data, width, height]);

  if (!model) return <View style={{ width, height }} />;

  const lineColor = tone === "up" ? colors.up : colors.down;
  const gradId = tone === "up" ? "sparkUp" : "sparkDown";

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity={0.32} />
            <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={model.fill} fill={`url(#${gradId})`} />
        <Path d={model.line} stroke={lineColor} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={model.last.x} cy={model.last.y} r={2.6} fill={lineColor} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
