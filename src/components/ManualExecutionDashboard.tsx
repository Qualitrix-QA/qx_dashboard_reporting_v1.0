import { useMemo, useState } from "react";
import { Sparkles, Eye, AlertCircle, PlayCircle, ClipboardList, Edit3, Trash2, Plus } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { PieChart, LineChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow, DataAnalysis, AISchema } from "@/types/bug";
import { getManualExecutionData, type ManualExecutionData } from "@/utils/dashboardMapper";
import { Button } from "@/components/ui/button";

echarts.use([PieChart, LineChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  analysis: DataAnalysis;
  aiSchema?: AISchema | null;
  data?: ManualExecutionData;
  onUpdateData?: (newData: ManualExecutionData) => void;
  onReset?: () => void;
  hasOverrides?: boolean;
  isEditable?: boolean;
  theme?: "light" | "dark";
  onDelete?: () => void;
}

const RESULT_COLORS = ["#22c55e", "#ef4444", "#f97316", "#94a3b8"];

export function ManualExecutionDashboard({ rows, analysis, aiSchema, data: propData, onUpdateData, onReset, hasOverrides, isEditable = false, theme, onDelete }: Props) {
  const data = useMemo(() => propData ?? getManualExecutionData(rows, analysis, aiSchema), [rows, analysis, aiSchema, propData]);

  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [showTrendEditor, setShowTrendEditor] = useState(false);

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
    label: isDark ? "#e2e8f0" : "#475569"
  };

  const executionSplitOption: echarts.EChartsCoreOption = useMemo(() => {
    const total = data.executionSplit.reduce((sum, s) => sum + s.value, 0);
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
        itemWidth: 8,
        itemHeight: 8
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
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
            fontSize: 9,
            color: colors.subText
          },
          color: RESULT_COLORS,
          data: data.executionSplit
        }
      ]
    };
  }, [data.executionSplit, isDark]);

  const trendOption: echarts.EChartsCoreOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: any) => {
          return `Week: <b>${params[0].name}</b><br/>Pass Rate: <b>${params[0].value}%</b>`;
        }
      },
      grid: { left: 35, right: 15, top: 25, bottom: 25 },
      xAxis: {
        type: "category",
        data: data.passRateTrend.map(d => d.week),
        boundaryGap: false,
        axisLabel: { fontSize: 11, color: colors.subText },
        axisLine: { lineStyle: { color: colors.line } },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { formatter: "{value}%", fontSize: 10, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
      },
      series: [
        {
          type: "line",
          data: data.passRateTrend.map(d => d.rate),
          smooth: true,
          symbol: "circle",
          symbolSize: 8,
          itemStyle: { color: "#22c55e" },
          lineStyle: { color: "#22c55e", width: 3 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(34,197,94,0.3)" },
              { offset: 1, color: "rgba(34,197,94,0.0)" }
            ])
          },
          label: {
            show: true,
            position: "top",
            formatter: "{c}%",
            color: colors.label,
            fontSize: 9,
            fontWeight: "bold"
          }
        }
      ]
    };
  }, [data.passRateTrend, isDark]);

  const handleKPIChange = (key: string, val: string) => {
    if (!onUpdateData) return;
    const intVal = Math.max(0, parseInt(val) || 0);
    const updated = { ...data };
    if (key === "executed") updated.executed = intVal;
    else if (key === "passed") updated.passed = intVal;
    else if (key === "failed") updated.failed = intVal;
    else if (key === "blocked") updated.blocked = intVal;
    else if (key === "passRate") updated.passRate = intVal;
    onUpdateData(updated);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-[#6366f1]">
            <PlayCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Manual Test Execution</h2>
              {hasOverrides && onReset && isEditable && (
                <button
                  onClick={onReset}
                  className="px-2 py-0.5 text-[10px] bg-indigo-500/10 text-[#6366f1] rounded border border-indigo-500/20 hover:bg-indigo-500/20 transition-all font-semibold"
                  title="Reset custom overrides to Excel data values"
                >
                  Reset to Excel
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Manual test run status split, pass rate weekly trend, top failing modules, blockers, and action items</p>
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
              Showing <b>Demo Template</b>. Upload a sheet named <b>"Manual Execution"</b> or <b>"Execution"</b> to view your live execution records.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          {[
            { label: "Executed", value: data.executed, key: "executed", sub: "Test cases run", color: "border-t-[#1e3a8a] text-[#3b82f6]" },
            { label: "Passed", value: data.passed, key: "passed", sub: "Pass count", color: "border-t-[#22c55e] text-[#22c55e]" },
            { label: "Failed", value: data.failed, key: "failed", sub: "Fail count", color: "border-t-[#ef4444] text-[#ef4444]" },
            { label: "Blocked", value: data.blocked, key: "blocked", sub: "Blocked TCs", color: "border-t-[#f97316] text-[#f97316]" },
            { label: "Pass Rate", value: data.passRate, key: "passRate", sub: "This week", color: "border-t-[#06b6d4] text-[#06b6d4]" },
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

      {/* Main Dashboard Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Execution Split */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative" data-chart-card>
          {onUpdateData && isEditable && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={() => setShowSplitEditor(!showSplitEditor)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                  showSplitEditor
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Edit3 className="h-3 w-3" /> {showSplitEditor ? "Close Editor" : "Edit Split"}
              </button>
            </div>
          )}
          <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-1.5">
            <PlayCircle className="h-4 w-4 text-primary" />
            Execution Split
          </h3>
          {data.executionSplit.length > 0 ? (
            <ReactEChartsCore
              echarts={echarts}
              option={executionSplitOption}
              style={{ height: 260 }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
              <p className="text-xs text-muted-foreground">No execution split data available</p>
            </div>
          )}

          {/* Inline Split Editor */}
          {showSplitEditor && isEditable && onUpdateData && (
            <div className="border-t border-border/40 pt-4 mt-4 space-y-2 animate-fade-in text-xs">
              {data.executionSplit.map((split, idx) => (
                <div key={split.name} className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{split.name}</span>
                  <input
                    type="number"
                    value={split.value}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      const copy = [...data.executionSplit];
                      copy[idx] = { ...copy[idx], value: val };
                      onUpdateData({ ...data, executionSplit: copy });
                    }}
                    className="w-24 bg-transparent border border-border rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Middle Column: Pass Rate Trend */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative" data-chart-card>
          {onUpdateData && isEditable && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={() => setShowTrendEditor(!showTrendEditor)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                  showTrendEditor
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Edit3 className="h-3 w-3" /> {showTrendEditor ? "Close Editor" : "Edit Trend"}
              </button>
            </div>
          )}
          <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-primary" />
            Pass Rate Trend (%)
          </h3>
          {data.passRateTrend.length > 0 ? (
            <ReactEChartsCore
              echarts={echarts}
              option={trendOption}
              style={{ height: 260 }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
              <p className="text-xs text-muted-foreground">No pass rate trend available</p>
            </div>
          )}

          {/* Inline Trend Editor */}
          {showTrendEditor && isEditable && onUpdateData && (
            <div className="border-t border-border/40 pt-4 mt-4 space-y-3 animate-fade-in text-xs">
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                {data.passRateTrend.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={t.week}
                      onChange={(e) => {
                        const copy = [...data.passRateTrend];
                        copy[idx] = { ...copy[idx], week: e.target.value };
                        onUpdateData({ ...data, passRateTrend: copy });
                      }}
                      className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                      placeholder="Week"
                    />
                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <input
                        type="number"
                        value={t.rate}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                          const copy = [...data.passRateTrend];
                          copy[idx] = { ...copy[idx], rate: val };
                          onUpdateData({ ...data, passRateTrend: copy });
                        }}
                        className="w-full bg-transparent border border-border rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary/50"
                        placeholder="Pass Rate %"
                      />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                    <button
                      onClick={() => {
                        const copy = data.passRateTrend.filter((_, i) => i !== idx);
                        onUpdateData({ ...data, passRateTrend: copy });
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
                    const copy = [...data.passRateTrend, { week: "New Wk", rate: 80 }];
                    onUpdateData({ ...data, passRateTrend: copy });
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1 border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Trend Point
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Key Insights & Observations */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 group relative">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-primary" />
            Key Insights & Observations
          </h3>

          {/* Top Failing Modules */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              Top failing modules:
            </p>
            <div className="text-xs space-y-1.5 pl-2 text-muted-foreground">
              {data.insights.topFailingModules.length > 0 ? (
                data.insights.topFailingModules.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 group/row">
                    {isEditable ? (
                      <input
                        type="text"
                        value={m.module}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const copy = [...data.insights.topFailingModules];
                          copy[idx] = { ...copy[idx], module: e.target.value };
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, topFailingModules: copy }
                          });
                        }}
                        className="flex-1 bg-transparent border-0 p-0 focus:ring-0 rounded-none text-foreground font-bold text-xs border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                        placeholder="Module"
                      />
                    ) : (
                      <span className="flex-1 text-foreground font-bold text-xs select-all">
                        {m.module}
                      </span>
                    )}
                    <span className="text-muted-foreground shrink-0">–</span>
                    {isEditable ? (
                      <input
                        type="number"
                        value={m.fails}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const copy = [...data.insights.topFailingModules];
                          copy[idx] = { ...copy[idx], fails: val };
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, topFailingModules: copy }
                          });
                        }}
                        className="w-10 bg-transparent border-0 text-center font-semibold focus:ring-0 p-0 rounded-none text-foreground text-xs border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                        placeholder="Fails"
                      />
                    ) : (
                      <span className="w-10 text-center font-semibold text-foreground text-xs select-all">
                        {m.fails}
                      </span>
                    )}
                    <span className="text-muted-foreground shrink-0 text-[10px]">fails</span>
                    {onUpdateData && isEditable && (
                      <button
                        onClick={() => {
                          const copy = data.insights.topFailingModules.filter((_, i) => i !== idx);
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, topFailingModules: copy }
                          });
                        }}
                        className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive p-0.5 shrink-0 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="italic text-muted-foreground">No failing modules recorded.</p>
              )}
              {onUpdateData && isEditable && (
                <button
                  onClick={() => {
                    const copy = [...data.insights.topFailingModules, { module: "New Module", fails: 0 }];
                    onUpdateData({
                      ...data,
                      insights: { ...data.insights, topFailingModules: copy }
                    });
                  }}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-1 font-semibold"
                >
                  <Plus className="h-3 w-3" /> Add Module
                </button>
              )}
            </div>
          </div>

          {/* Blocked By */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-bold text-foreground">Blocked by:</p>
            <div className="text-xs space-y-1.5 pl-2 text-muted-foreground">
              {data.insights.blockedBy.length > 0 ? (
                data.insights.blockedBy.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 group/row">
                    <span className="text-muted-foreground shrink-0 select-none">•</span>
                    {isEditable ? (
                      <input
                        type="text"
                        value={b}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const copy = [...data.insights.blockedBy];
                          copy[idx] = e.target.value;
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, blockedBy: copy }
                          });
                        }}
                        className="flex-1 bg-transparent border-0 p-0 focus:ring-0 rounded-none text-muted-foreground focus:text-foreground text-xs border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                        placeholder="Blocker details"
                      />
                    ) : (
                      <span className="flex-1 text-muted-foreground text-xs select-all">
                        {b}
                      </span>
                    )}
                    {onUpdateData && isEditable && (
                      <button
                        onClick={() => {
                          const copy = data.insights.blockedBy.filter((_, i) => i !== idx);
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, blockedBy: copy }
                          });
                        }}
                        className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive p-0.5 shrink-0 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="italic text-muted-foreground">No blockers recorded.</p>
              )}
              {onUpdateData && isEditable && (
                <button
                  onClick={() => {
                    const copy = [...data.insights.blockedBy, "New Blocker"];
                    onUpdateData({
                      ...data,
                      insights: { ...data.insights, blockedBy: copy }
                    });
                  }}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-1 font-semibold"
                >
                  <Plus className="h-3 w-3" /> Add Blocker
                </button>
              )}
            </div>
          </div>

          {/* Action Items */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-bold text-foreground">Action Items:</p>
            <div className="text-xs space-y-1.5 pl-2 text-muted-foreground">
              {data.insights.actionItems.length > 0 ? (
                data.insights.actionItems.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 group/row">
                    <span className="text-muted-foreground shrink-0 select-none">•</span>
                    {isEditable ? (
                      <input
                        type="text"
                        value={a}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const copy = [...data.insights.actionItems];
                          copy[idx] = e.target.value;
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, actionItems: copy }
                          });
                        }}
                        className="flex-1 bg-transparent border-0 p-0 focus:ring-0 rounded-none text-muted-foreground focus:text-foreground text-xs border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                        placeholder="Action item details"
                      />
                    ) : (
                      <span className="flex-1 text-muted-foreground text-xs select-all">
                        {a}
                      </span>
                    )}
                    {onUpdateData && isEditable && (
                      <button
                        onClick={() => {
                          const copy = data.insights.actionItems.filter((_, i) => i !== idx);
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, actionItems: copy }
                          });
                        }}
                        className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive p-0.5 shrink-0 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="italic text-muted-foreground">No action items.</p>
              )}
              {onUpdateData && isEditable && (
                <button
                  onClick={() => {
                    const copy = [...data.insights.actionItems, "New Action Item"];
                    onUpdateData({
                      ...data,
                      insights: { ...data.insights, actionItems: copy }
                    });
                  }}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-1 font-semibold"
                >
                  <Plus className="h-3 w-3" /> Add Action Item
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
