import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { HeatmapChart } from "echarts/charts";
import { TooltipComponent, GridComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow } from "@/types/bug";

echarts.use([HeatmapChart, TooltipComponent, GridComponent, VisualMapComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  col1: string;
  col2: string;
  title: string;
  theme?: "light" | "dark";
}

export function DynamicHeatmap({ rows, col1, col2, title, theme }: Props) {
  const { values1, values2, heatData, maxCount } = useMemo(() => {
    // Build frequency maps — O(n) instead of O(n * rows * cols)
    const c1Canonical: Record<string, string> = {};
    const c2Canonical: Record<string, string> = {};
    const c1Freq: Record<string, number> = {};
    const c2Freq: Record<string, number> = {};

    // Pre-build a cross-frequency map in a single pass — O(n)
    const crossFreq: Record<string, number> = {};

    for (const r of rows) {
      const v1 = (r[col1] || "").trim();
      const v2 = (r[col2] || "").trim();
      if (!v1 || !v2) continue;

      const v1Lower = v1.toLowerCase();
      const v2Lower = v2.toLowerCase();

      if (!c1Canonical[v1Lower]) c1Canonical[v1Lower] = v1;
      if (!c2Canonical[v2Lower]) c2Canonical[v2Lower] = v2;

      c1Freq[v1Lower] = (c1Freq[v1Lower] || 0) + 1;
      c2Freq[v2Lower] = (c2Freq[v2Lower] || 0) + 1;

      const key = `${v1Lower}|||${v2Lower}`;
      crossFreq[key] = (crossFreq[key] || 0) + 1;
    }

    const v1Keys = Object.entries(c1Freq).sort(([, a], [, b]) => b - a).slice(0, 8).map(([k]) => k);
    const v2Keys = Object.entries(c2Freq).sort(([, a], [, b]) => b - a).slice(0, 8).map(([k]) => k);

    const v1 = v1Keys.map(k => c1Canonical[k]);
    const v2 = v2Keys.map(k => c2Canonical[k]);

    const data: number[][] = [];
    let max = 0;

    for (let i = 0; i < v1.length; i++) {
      for (let j = 0; j < v2.length; j++) {
        // O(1) lookup instead of O(n) filter
        const count = crossFreq[`${v1Keys[i]}|||${v2Keys[j]}`] || 0;
        data.push([j, i, count]);
        if (count > max) max = count;
      }
    }

    return { values1: v1, values2: v2, heatData: data, maxCount: max };
  }, [rows, col1, col2]);

  if (values1.length === 0 || values2.length === 0) return null;

  const isDark = theme !== "light";
  const colors = {
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    label: isDark ? "#e2e8f0" : "#1e293b",
    visualMapColors: isDark ? ["#1e293b", "#0ea5e9", "#8b5cf6"] : ["#f1f5f9", "#0ea5e9", "#8b5cf6"]
  };

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      backgroundColor: "rgba(15,15,20,0.9)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      formatter: (params: any) =>
        `${values1[params.data[1]]} × ${values2[params.data[0]]}<br/><b>${params.data[2]}</b>`,
    },
    grid: { left: 10, right: 40, top: 8, bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      data: values2.map(v => v.length > 10 ? v.slice(0, 9) + "…" : v),
      axisLabel: { fontSize: 10, color: colors.subText, rotate: 30 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colors.line } },
    },
    yAxis: {
      type: "category",
      data: values1.map(v => v.length > 14 ? v.slice(0, 12) + "…" : v),
      axisLabel: { fontSize: 10, color: colors.subText },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colors.line } },
    },
    visualMap: {
      min: 0,
      max: maxCount || 1,
      calculable: false,
      orient: "vertical",
      right: 0,
      top: "center",
      inRange: { color: colors.visualMapColors },
      textStyle: { color: colors.subText, fontSize: 10 },
    },
    series: [{
      type: "heatmap",
      data: heatData,
      label: { show: true, fontSize: 11, color: colors.label },
      itemStyle: { borderRadius: 3, borderColor: "transparent", borderWidth: 2 },
      emphasis: { itemStyle: { borderColor: "#0ea5e9", borderWidth: 2 } },
      animationDuration: 800,
    }],
  };

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: Math.max(220, values1.length * 40 + 60) }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}