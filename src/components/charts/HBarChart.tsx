import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, DataZoomComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, TooltipComponent, GridComponent, DataZoomComponent, CanvasRenderer]);

interface HBarChartProps {
  data: Record<string, number>;
  title: string;
  color?: string;
  theme?: "light" | "dark";
}

const BAR_COLORS = [
  "#0ea5e9", "#8b5cf6", "#f97316", "#22c55e",
  "#eab308", "#ef4444", "#ec4899", "#3b82f6",
];

export function HBarChart({ data, title, theme }: HBarChartProps) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const chartData = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .reverse(); // reverse for horizontal so biggest is on top

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
    zoomFill: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    label: isDark ? "#e2e8f0" : "#475569"
  };

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(15,15,20,0.9)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    // Added dataZoom for scrolling through all modules
    dataZoom: [
      { type: "inside", yAxisIndex: 0 },
      { type: "slider", show: true, yAxisIndex: 0, right: 0, width: 16, 
        borderColor: "transparent", fillerColor: colors.zoomFill, 
        handleStyle: { color: "#94a3b8" }, showDetail: false }
    ],
    grid: { left: 10, right: 36, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: colors.subText },
      splitLine: { lineStyle: { color: colors.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      data: chartData.map(([name]) => name.length > 22 ? name.slice(0, 20) + "…" : name),
      axisLabel: { fontSize: 10, color: colors.subText },
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { show: false },
    },
    series: [{
      type: "bar",
      data: chartData.map(([, value], i) => ({
        value,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: BAR_COLORS[(chartData.length - 1 - i) % BAR_COLORS.length] + "88" },
            { offset: 1, color: BAR_COLORS[(chartData.length - 1 - i) % BAR_COLORS.length] },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
      })),
      label: {
        show: true,
        position: "right",
        formatter: "{c}",
        fontSize: 10,
        color: colors.label,
        fontWeight: "bold",
      },
      barMaxWidth: 28,
      animationDuration: 600,
      animationEasing: "cubicOut",
      animationDelay: (idx: number) => idx * 60,
    }],
  };

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in">
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mb-2 text-[11px] text-muted-foreground">{chartData.length} items · {total} total</p>
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} notMerge lazyUpdate />
    </div>
  );
}
