/**
 * Module Breakdown Stacked Bar
 * Answers: "WHY is a module risky? What's the composition?"
 * Each bar = one module, stacked by severity/result values.
 * Sorted by risk score descending so the most dangerous modules are on top.
 */
import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ModuleRiskData } from "@/types/bug";
import { VALUE_COLORS, getRiskColor } from "@/utils/moduleRisk";

echarts.use([BarChart, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

interface Props {
  modules: ModuleRiskData[];
  theme?: "light" | "dark";
}

/** Map a raw breakdown key to a display color */
function getValueColor(key: string): string {
  const lookup = VALUE_COLORS[key.toLowerCase().trim()];
  if (lookup) return lookup;
  // Fallback: infer from keyword
  const k = key.toLowerCase();
  if (k.includes("critical") || k.includes("blocker") || k.includes("fail"))  return "#ef4444";
  if (k.includes("high") || k.includes("block"))                               return "#f97316";
  if (k.includes("medium") || k.includes("major"))                             return "#eab308";
  if (k.includes("low") || k.includes("minor") || k.includes("pass"))         return "#22c55e";
  if (k.includes("skip") || k.includes("n/a") || k.includes("not exec"))      return "#94a3b8";
  return "#475569";
}

export function ModuleStackedBar({ modules, theme }: Props) {
  const { series, categories, legend } = useMemo(() => {
    // Sort worst modules first (no artificial limits)
    const sorted = [...modules]
      .sort((a, b) => b.riskScore - a.riskScore);

    // Collect all unique breakdown keys across all modules
    const allKeys = Array.from(
      new Set(sorted.flatMap(m => Object.keys(m.breakdown)))
    ).sort((a, b) => {
      // Sort keys by severity weight: worst first
      const order = ["critical","blocker","fail","failed","high","blocked","medium","major","p1","p2","low","minor","pass","passed","skip","n/a","not exec"];
      const ai = order.findIndex(o => a.toLowerCase().includes(o));
      const bi = order.findIndex(o => b.toLowerCase().includes(o));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Y-axis categories (module names, truncated)
    const cats = sorted.map(m =>
      m.module.length > 18 ? m.module.slice(0, 17) + "…" : m.module
    );

    // One ECharts series per breakdown key
    const ser = allKeys.map(key => ({
      name: key,
      type: "bar",
      stack: "total",
      barMaxWidth: 28,
      itemStyle: {
        color: getValueColor(key),
        borderRadius: 0,
      },
      emphasis: {
        focus: "series",
        itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.4)" },
      },
      data: sorted.map(m => m.breakdown[key] ?? 0),
      label: {
        show: false,
      },
    }));

    return { series: ser, categories: cats, legend: allKeys };
  }, [modules]);

  const chartHeight = Math.max(280, categories.length * 36 + 80);

  const isDark = theme !== "light";
  const colors = {
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
    grid: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
    zoomFill: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
  };

  const option: echarts.EChartsCoreOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(10,12,20,0.95)",
      borderColor: "rgba(255,255,255,0.08)",
      extraCssText: "border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.6);",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      formatter: (params: any) => {
        const items = (params as any[]).filter((p: any) => p.value > 0);
        if (!items.length) return "";
        const module = modules.find(m =>
          m.module.startsWith(items[0].axisValue.replace("…", ""))
        );
        const color = module ? getRiskColor(module.riskScore) : "#94a3b8";
        const rows = items
          .sort((a: any, b: any) => b.value - a.value)
          .map((p: any) => `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span>
              <span style="color:#94a3b8;flex:1">${p.seriesName}</span>
              <b>${p.value}</b>
            </div>`)
          .join("");
        return `<div style="min-width:170px">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:${color}">
            ${module?.module ?? items[0].axisValue}
            <span style="font-size:10px;color:#94a3b8;font-weight:400"> · Risk ${module?.riskScore ?? ""}</span>
          </div>
          ${rows}
          <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:5px;padding-top:4px;font-size:11px;color:#94a3b8">
            Total: <b style="color:#e2e8f0">${items.reduce((s: number, p: any) => s + p.value, 0)}</b>
          </div>
        </div>`;
      },
    },
    legend: {
      data: legend,
      bottom: 4,
      textStyle: { color: colors.subText, fontSize: 10 },
      itemWidth: 12,
      itemHeight: 8,
      icon: "roundRect",
      type: "scroll",
    },
    dataZoom: [
      { type: "inside", yAxisIndex: 0 },
      { type: "slider", show: true, yAxisIndex: 0, right: 0, width: 14, 
        borderColor: "transparent", fillerColor: colors.zoomFill, 
        handleStyle: { color: "#94a3b8" }, showDetail: false }
    ],
    grid: {
      left: 8,
      right: 20,
      top: 8,
      bottom: legend.length > 5 ? 56 : 44,
      containLabel: true,
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: colors.grid } },
      axisLabel: { color: colors.subText, fontSize: 10 },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: categories,
      inverse: true, // worst on top
      axisLabel: {
        color: colors.subText,
        fontSize: 10.5,
        width: 110,
        overflow: "truncate",
      },
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { show: false },
    },
    series,
    animationDuration: 800,
    animationEasing: "cubicOut",
  };

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height: 280, width: "100%" }}
      notMerge
      lazyUpdate
    />
  );
}
