import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow } from "@/types/bug";

echarts.use([BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  groupCol: string;
  stackCol: string;
  title: string;
  theme?: "light" | "dark";
}

const STACK_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#0ea5e9", "#8b5cf6", "#ec4899", "#3b82f6",
];

export function DynamicStackedBar({ rows, groupCol, stackCol, title, theme }: Props) {
  const { groups, stackValues, seriesData } = useMemo(() => {
    // Single-pass: build cross-frequency map — O(n)
    const groupCanonical: Record<string, string> = {};
    const groupFreq: Record<string, number> = {};
    const stackCanonical: Record<string, string> = {};
    const crossFreq: Record<string, Record<string, number>> = {};

    for (const r of rows) {
      const g = (r[groupCol] || "").trim();
      const s = (r[stackCol] || "").trim();
      if (!g) continue;

      const gLower = g.toLowerCase();
      if (!groupCanonical[gLower]) groupCanonical[gLower] = g;
      groupFreq[gLower] = (groupFreq[gLower] || 0) + 1;

      if (s) {
        const sLower = s.toLowerCase();
        if (!stackCanonical[sLower]) stackCanonical[sLower] = s;
        if (!crossFreq[gLower]) crossFreq[gLower] = {};
        crossFreq[gLower][sLower] = (crossFreq[gLower][sLower] || 0) + 1;
      }
    }

    const topGroupKeys = Object.entries(groupFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([k]) => k);
    const topGroups = topGroupKeys.map(k => groupCanonical[k]);

    // Collect all stack values seen in top groups
    const stackFreq: Record<string, number> = {};
    for (const gKey of topGroupKeys) {
      const inner = crossFreq[gKey] || {};
      for (const [sKey, cnt] of Object.entries(inner)) {
        stackFreq[sKey] = (stackFreq[sKey] || 0) + cnt;
      }
    }
    const stacks = Object.entries(stackFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([k]) => stackCanonical[k]);

    const series = stacks.map((sv, i) => ({
      name: sv,
      type: "bar" as const,
      stack: "total",
      data: topGroupKeys.map(gKey => (crossFreq[gKey] || {})[sv.toLowerCase()] || 0),
      label: {
        show: true,
        position: "inside",
        formatter: (params: any) => params.value > 0 ? params.value : "",
        fontSize: 9,
        color: "#ffffff",
        fontWeight: "bold",
      },
      itemStyle: { color: STACK_COLORS[i % STACK_COLORS.length], borderRadius: i === stacks.length - 1 ? [3, 3, 0, 0] : 0 },
      animationDuration: 600,
      animationDelay: (idx: number) => idx * 80,
    }));

    return { groups: topGroups, stackValues: stacks, seriesData: series };
  }, [rows, groupCol, stackCol]);

  if (groups.length === 0) return null;

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
  };

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(15,15,20,0.9)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    legend: {
      data: stackValues,
      textStyle: { color: colors.subText, fontSize: 10 },
      bottom: 0,
      itemWidth: 12,
      itemHeight: 10,
    },
    grid: { left: 40, right: 16, top: 8, bottom: 36, containLabel: false },
    xAxis: {
      type: "category",
      data: groups.map(g => g.length > 14 ? g.slice(0, 12) + "…" : g),
      axisLabel: { fontSize: 10, color: colors.subText, rotate: 25 },
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: colors.subText },
      splitLine: { lineStyle: { color: colors.grid, type: "dashed" } },
    },
    series: seriesData,
  };

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} notMerge lazyUpdate />
    </div>
  );
}
