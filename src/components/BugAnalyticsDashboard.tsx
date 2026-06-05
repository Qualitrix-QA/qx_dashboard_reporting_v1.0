import { useMemo, useState } from "react";
import { Sparkles, Info, Bug, Edit3, Trash2, Plus } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow, DataAnalysis, AISchema } from "@/types/bug";
import { getBugAnalyticsData, type BugAnalyticsData } from "@/utils/dashboardMapper";
import { Button } from "@/components/ui/button";

echarts.use([BarChart, PieChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  analysis: DataAnalysis;
  aiSchema?: AISchema | null;
  data?: BugAnalyticsData;
  onUpdateData?: (newData: BugAnalyticsData) => void;
  onReset?: () => void;
  hasOverrides?: boolean;
  isEditable?: boolean;
  theme?: "light" | "dark";
  onDelete?: () => void;
}

const BAR_COLORS = ["#3b82f6", "#06b6d4", "#6366f1", "#a855f7", "#ec4899"];
const SEV_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];

export function BugAnalyticsDashboard({ rows, analysis, aiSchema, data: propData, onUpdateData, onReset, hasOverrides, isEditable = false, theme, onDelete }: Props) {
  const data = useMemo(() => propData || getBugAnalyticsData(rows, analysis, aiSchema), [propData, rows, analysis, aiSchema]);
  
  const [showProductEditor, setShowProductEditor] = useState(false);
  const [showSeverityEditor, setShowSeverityEditor] = useState(false);

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
    label: isDark ? "#e2e8f0" : "#475569"
  };

  const bugsByProductOption: echarts.EChartsCoreOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
      },
      grid: { left: 40, right: 15, top: 25, bottom: 65 },
      xAxis: {
        type: "category",
        data: data.bugsByProduct.map(d => d.product),
        axisLabel: {
          fontSize: 10,
          color: colors.subText,
          rotate: 35,
          interval: 0
        },
        axisLine: { lineStyle: { color: colors.line } },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 11, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
      },
      series: [
        {
          type: "bar",
          data: data.bugsByProduct.map((d, i) => ({
            value: d.count,
            itemStyle: {
              color: BAR_COLORS[i % BAR_COLORS.length],
              borderRadius: [4, 4, 0, 0]
            }
          })),
          barMaxWidth: 26,
          label: {
            show: true,
            position: "top",
            color: colors.label,
            fontSize: 10,
            fontWeight: "bold"
          }
        }
      ]
    };
  }, [data.bugsByProduct, isDark]);

  const bySeverityOption: echarts.EChartsCoreOption = useMemo(() => {
    const total = data.bySeverity.reduce((sum, s) => sum + s.value, 0);
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: any) => {
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
          return `<b>${params.name}</b><br/>Count: <b>${params.value}</b> (${pct}%)`;
        }
      },
      legend: {
        orient: "horizontal",
        bottom: 0,
        textStyle: { color: colors.subText, fontSize: 10 },
        itemWidth: 10,
        itemHeight: 10
      },
      series: [
        {
          type: "pie",
          radius: ["45%", "75%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: "transparent",
            borderWidth: 2
          },
          label: {
            show: true,
            position: "outside",
            formatter: (params: any) => {
              return `${params.name}\n${params.percent}%`;
            },
            fontSize: 10,
            color: colors.subText
          },
          color: SEV_COLORS,
          data: data.bySeverity
        }
      ]
    };
  }, [data.bySeverity, isDark]);

  const handleKPIChange = (key: string, val: string) => {
    if (!onUpdateData) return;
    const updated = { ...data };
    if (key === "avgAge") {
      updated.avgAge = Math.max(0, parseFloat(val) || 0);
    } else {
      const intVal = Math.max(0, parseInt(val) || 0);
      if (key === "totalBugs") updated.totalBugs = intVal;
      else if (key === "openBugs") updated.openBugs = intVal;
      else if (key === "closedBugs") updated.closedBugs = intVal;
      else if (key === "dde") updated.dde = intVal;
    }
    onUpdateData(updated);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 rounded-lg text-[#3b82f6]">
            <Bug className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Defect Metrics & Bug Analytics</h2>
              {hasOverrides && onReset && isEditable && (
                <button
                  onClick={onReset}
                  className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-[#3b82f6] rounded border border-blue-500/20 hover:bg-blue-500/20 transition-all font-semibold"
                  title="Reset custom overrides to Excel data values"
                >
                  Reset to Excel
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">General bug tracking statistics, defect distribution by product and severity, DDE, and aging</p>
          </div>
        </div>
        {onDelete && isEditable && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
              title="Delete this slide"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview Banner */}
      {data.isDemo && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary animate-pulse" />
            <span>
              Showing <b>Demo Template</b>. Upload a sheet named <b>"Bug Analytics"</b> or <b>"Defect Metrics"</b> to view your live bug tracking datasets.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          {[
            { label: "Total Bugs", value: data.totalBugs, key: "totalBugs", sub: "All products", color: "border-t-[#1e3a8a] text-[#3b82f6]" },
            { label: "Open", value: data.openBugs, key: "openBugs", sub: "Active defects", color: "border-t-[#ef4444] text-[#ef4444]" },
            { label: "Closed", value: data.closedBugs, key: "closedBugs", sub: "Resolved", color: "border-t-[#22c55e] text-[#22c55e]" },
            { label: "DDE %", value: data.dde, key: "dde", sub: "Defect Detection Efficiency", color: "border-t-[#06b6d4] text-[#06b6d4]" },
            { label: "Avg Age (days)", value: data.avgAge, key: "avgAge", sub: "Open bugs", color: "border-t-[#f97316] text-[#f97316]" },
          ].map((card, i) => (
            <div
              key={i}
              className={`rounded-xl border border-border bg-card p-5 text-center shadow-sm border-t-4 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md ${card.color.split(" ")[0]}`}
            >
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
              <div className="mt-2 text-3xl font-extrabold tracking-tight">
                {isEditable ? (
                  <input
                    type="number"
                    step={card.key === "avgAge" ? "0.1" : "1"}
                    value={card.value}
                    onChange={(e) => handleKPIChange(card.key, e.target.value)}
                    className={`w-full bg-transparent border-0 text-center font-extrabold tracking-tight focus:ring-0 p-0 shadow-none text-3xl rounded-none focus:border-b focus:border-primary/40 hover:border-b hover:border-primary/20 cursor-text ${card.color.split(" ")[1]}`}
                    disabled={!onUpdateData}
                  />
                ) : (
                  <span className={`font-extrabold text-3xl select-all ${card.color.split(" ")[1]}`}>
                    {card.value}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Layout: Charts + Right Hand DDE Aging */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Bugs by Product */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative" data-chart-card>
          {onUpdateData && isEditable && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={() => setShowProductEditor(!showProductEditor)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                  showProductEditor
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Edit3 className="h-3 w-3" /> {showProductEditor ? "Close Editor" : "Edit Products"}
              </button>
            </div>
          )}
          <h3 className="mb-4 text-sm font-semibold text-foreground">Bugs by Product/Module</h3>
          {data.bugsByProduct.length > 0 ? (
            <ReactEChartsCore
              echarts={echarts}
              option={bugsByProductOption}
              style={{ height: 260 }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
              <p className="text-xs text-muted-foreground">No bug/product data available</p>
            </div>
          )}

          {/* Inline Product Editor */}
          {showProductEditor && isEditable && onUpdateData && (
            <div className="border-t border-border/40 pt-4 mt-4 space-y-3 animate-fade-in text-xs">
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                {data.bugsByProduct.map((prod, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={prod.product}
                      onChange={(e) => {
                        const copy = [...data.bugsByProduct];
                        copy[idx] = { ...copy[idx], product: e.target.value };
                        onUpdateData({ ...data, bugsByProduct: copy });
                      }}
                      className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                      placeholder="Product Name"
                    />
                    <input
                      type="number"
                      value={prod.count}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        const copy = [...data.bugsByProduct];
                        copy[idx] = { ...copy[idx], count: val };
                        onUpdateData({ ...data, bugsByProduct: copy });
                      }}
                      className="w-20 bg-transparent border border-border rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary/50"
                      placeholder="Count"
                    />
                    <button
                      onClick={() => {
                        const copy = data.bugsByProduct.filter((_, i) => i !== idx);
                        onUpdateData({ ...data, bugsByProduct: copy });
                      }}
                      className="text-muted-foreground hover:text-destructive p-1 shrink-0 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-start pt-1">
                <Button
                  onClick={() => {
                    const copy = [...data.bugsByProduct, { product: "New Product", count: 0 }];
                    onUpdateData({ ...data, bugsByProduct: copy });
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1 border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Product
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Middle Column: By Severity */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative" data-chart-card>
          {onUpdateData && isEditable && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={() => setShowSeverityEditor(!showSeverityEditor)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                  showSeverityEditor
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Edit3 className="h-3 w-3" /> {showSeverityEditor ? "Close Editor" : "Edit Severity"}
              </button>
            </div>
          )}
          <h3 className="mb-4 text-sm font-semibold text-foreground">By Severity</h3>
          {data.bySeverity.length > 0 ? (
            <ReactEChartsCore
              echarts={echarts}
              option={bySeverityOption}
              style={{ height: 260 }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
              <p className="text-xs text-muted-foreground">No severity breakdown data available</p>
            </div>
          )}

          {/* Inline Severity Editor */}
          {showSeverityEditor && isEditable && onUpdateData && (
            <div className="border-t border-border/40 pt-4 mt-4 space-y-2 animate-fade-in text-xs">
              {data.bySeverity.map((sev, idx) => (
                <div key={sev.name} className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{sev.name}</span>
                  <input
                    type="number"
                    value={sev.value}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      const copy = [...data.bySeverity];
                      copy[idx] = { ...copy[idx], value: val };
                      onUpdateData({ ...data, bySeverity: copy });
                    }}
                    className="w-24 bg-transparent border border-border rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: DDE & Defect Aging Panel */}
        <div className="space-y-6">
          {/* DDE Explanation Block */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 group relative">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Info className="h-4 w-4 text-primary" />
              DDE & Defect Aging
            </h3>
            <div className="rounded-lg bg-muted/30 p-3 text-xs border border-border/40">
              <p className="font-bold text-foreground">Defect Detection Efficiency (DDE)</p>
              <code className="block mt-1 p-1 bg-background rounded text-[10px] text-primary/90 font-mono">
                DDE = Bugs in QA / (QA + Prod) * 100
              </code>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span>DDE This Week:</span>
                <div className="flex items-center gap-0.5">
                  {isEditable ? (
                    <input
                      type="number"
                      value={data.ddeThisWeek}
                      onChange={(e) => {
                        if (!onUpdateData) return;
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        onUpdateData({ ...data, ddeThisWeek: val });
                      }}
                      className="w-12 bg-transparent border-0 text-right font-bold text-foreground text-xs p-0 focus:ring-0 rounded-none border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                    />
                  ) : (
                    <span className="font-bold text-foreground text-xs select-all">
                      {data.ddeThisWeek}
                    </span>
                  )}
                  <span>%</span>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span>Target:</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-muted-foreground font-medium mr-1">&gt;=</span>
                  {isEditable ? (
                    <input
                      type="number"
                      value={data.targetDde}
                      onChange={(e) => {
                        if (!onUpdateData) return;
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        onUpdateData({ ...data, targetDde: val });
                      }}
                      className="w-12 bg-transparent border-0 text-right font-medium text-foreground text-xs p-0 focus:ring-0 rounded-none border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                    />
                  ) : (
                    <span className="font-medium text-foreground text-xs select-all">
                      {data.targetDde}
                    </span>
                  )}
                  <span>%</span>
                </div>
              </div>
              <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full ${data.ddeThisWeek >= data.targetDde ? "bg-green-500" : "bg-cyan-500"}`}
                  style={{ width: `${data.ddeThisWeek}%` }}
                />
              </div>
            </div>
          </div>

          {/* Aging Summary Table */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
            <h4 className="mb-2 text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">Defect Aging Summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-2.5 font-semibold text-muted-foreground">Age Bucket</th>
                    <th className="p-2.5 font-semibold text-muted-foreground text-center">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agingSummary.length > 0 ? (
                    data.agingSummary.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="p-2.5 font-medium text-foreground">{row.age}</td>
                        <td className="p-2.5 text-center">
                          {isEditable ? (
                            <input
                              type="number"
                              value={row.count}
                              onChange={(e) => {
                                if (!onUpdateData) return;
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                const copy = [...data.agingSummary];
                                copy[idx] = { ...copy[idx], count: val };
                                onUpdateData({ ...data, agingSummary: copy });
                              }}
                              className="w-16 bg-transparent border-0 text-center font-semibold focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                            />
                          ) : (
                            <span className="text-center text-xs font-semibold text-foreground select-all w-16 block mx-auto">
                              {row.count === 0 ? "-" : row.count}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="p-6 text-center text-muted-foreground italic">
                        No defect aging data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
