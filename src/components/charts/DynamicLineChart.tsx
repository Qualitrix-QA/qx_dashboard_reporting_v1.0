/**
 * Dynamic Line Chart — groups date fields by day and plots a smooth area trend line.
 */
import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { TooltipComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow } from "@/types/bug";

echarts.use([LineChart, TooltipComponent, GridComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  colName: string;
  title: string;
  theme?: "light" | "dark";
}

export function DynamicLineChart({ rows, colName, title, theme }: Props) {
  const { labels, data } = useMemo(() => {
    const dailyCounts: Record<string, number> = {};

    for (const r of rows) {
      const val = (r[colName] || "").trim();
      if (!val) continue;

      // Extract just the YYYY-MM-DD grouping from standard date strings
      // Covers common formats like '2023-10-15', '10/15/2023', '2023-10-15T10:00:00Z'
      const match = val.match(/^(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})|(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
      
      let dateKey = val.slice(0, 10); // fallback
      
      if (match) {
        dateKey = match[0].replace(/\//g, "-");
      } else {
        // Try parsing via Date object if it's a weird format but recognizable
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          dateKey = d.toISOString().slice(0, 10);
        }
      }

      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }

    // Sort chronologically
    const sortedKeys = Object.keys(dailyCounts).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    return {
      labels: sortedKeys,
      data: sortedKeys.map(k => dailyCounts[k]),
    };
  }, [rows, colName]);

  const isDark = theme !== "light";
  const colors = {
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "rgba(255,255,255,0.05)" : "#e2e8f0"
  };

  const option: echarts.EChartsCoreOption = useMemo(() => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,15,20,0.9)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: "rgba(255,255,255,0.2)" } },
    },
    grid: { left: 10, right: 20, top: 40, bottom: 20, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLabel: { fontSize: 10, color: colors.subText },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colors.line } },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: colors.subText },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      {
        data,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: "#0ea5e9" },
        lineStyle: { color: "#0ea5e9", width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(14,165,233,0.5)" },
            { offset: 1, color: "rgba(14,165,233,0.0)" },
          ]),
        },
        animationDuration: 1000,
        animationEasing: "cubicOut",
      },
    ],
  }), [labels, data, colors.subText, colors.line, colors.grid]);

  if (labels.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in" data-chart-card>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Trend over {labels.length} days</p>
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 260 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
