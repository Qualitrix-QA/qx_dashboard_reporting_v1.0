import { useMemo, useState } from "react";
import { AlertTriangle, TrendingUp, Calendar, Zap, ShieldAlert, Sparkles, Edit3, Trash2, Plus } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow, DataAnalysis, AISchema } from "@/types/bug";
import { getProdIssuesData, type ProdIssuesData } from "@/utils/dashboardMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

echarts.use([BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  analysis: DataAnalysis;
  aiSchema?: AISchema | null;
  data?: ProdIssuesData;
  onUpdateData?: (newData: ProdIssuesData) => void;
  onReset?: () => void;
  hasOverrides?: boolean;
  isEditable?: boolean;
  theme?: "light" | "dark";
  onDelete?: () => void;
}

export function ProdIssuesDashboard({ rows, analysis, aiSchema, data: propData, onUpdateData, onReset, hasOverrides, isEditable = false, theme, onDelete }: Props) {
  const data = useMemo(() => propData || getProdIssuesData(rows, analysis, aiSchema), [rows, analysis, aiSchema, propData]);
  const [showTrendEditor, setShowTrendEditor] = useState(false);

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
  };

  const weeklyTrendOption: echarts.EChartsCoreOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
      },
      legend: {
        data: ["New Bugs", "Resolved"],
        textStyle: { color: colors.subText, fontSize: 11 },
        right: 10,
        top: 0
      },
      grid: { left: 35, right: 15, top: 35, bottom: 25 },
      xAxis: {
        type: "category",
        data: data.weeklyTrend.map(d => d.day),
        axisLabel: { fontSize: 11, color: colors.subText },
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
          name: "New Bugs",
          type: "bar",
          data: data.weeklyTrend.map(d => d.newBugs),
          itemStyle: {
            color: "#ef4444",
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 16
        },
        {
          name: "Resolved",
          type: "bar",
          data: data.weeklyTrend.map(d => d.resolved),
          itemStyle: {
            color: "#22c55e",
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 16
        }
      ]
    };
  }, [data.weeklyTrend, isDark]);

  const handleKPIChange = (label: string, val: string) => {
    if (!onUpdateData) return;
    const numVal = Math.max(0, parseInt(val) || 0);
    const updated = { ...data };
    if (label === "Total Prod Issues") updated.totalProdIssues = numVal;
    else if (label === "Critical / P1") updated.criticalP1 = numVal;
    else if (label === "Resolved") updated.resolved = numVal;
    else if (label === "In Progress") updated.inProgress = numVal;
    else if (label === "Carry Forward") updated.carryForward = numVal;
    onUpdateData(updated);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-red-500/10 rounded-lg text-[#ef4444]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Production Issues & Analytics</h2>
              {hasOverrides && onReset && isEditable && (
                <button
                  onClick={onReset}
                  className="px-2 py-0.5 text-[10px] bg-red-500/10 text-[#ef4444] rounded border border-red-500/20 hover:bg-red-500/20 transition-all font-semibold"
                  title="Reset custom overrides to Excel data values"
                >
                  Reset to Excel
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Live environment incidents, RCA tracking and weekly trends</p>
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

      {/* Premium Preview Banner */}
      {data.isDemo && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary animate-pulse" />
            <span>
              Showing <b>Demo Template</b>. Upload a sheet named <b>"Production Issues"</b> to view your live incident statistics.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          {[
            { label: "Total Prod Issues", value: data.totalProdIssues, sub: "This week", color: "border-t-[#ef4444] text-[#ef4444]" },
            { label: "Critical / P1", value: data.criticalP1, sub: "Sev 1 incidents", color: "border-t-[#f97316] text-[#f97316]" },
            { label: "Resolved", value: data.resolved, sub: "Fixed this week", color: "border-t-[#22c55e] text-[#22c55e]" },
            { label: "In Progress", value: data.inProgress, sub: "Being worked on", color: "border-t-[#3b82f6] text-[#3b82f6]" },
            { label: "Carry Forward", value: data.carryForward, sub: "Unresolved prev wk", color: "border-t-[#a855f7] text-[#a855f7]" },
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
                    onChange={(e) => handleKPIChange(card.label, e.target.value)}
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

      {/* Lower Dashboard Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Weekly Trend & Ageing */}
        <div className="space-y-6">
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
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
                Weekly Prod Bug Trend (New vs Resolved)
              </h3>
            </div>
            {data.weeklyTrend.length > 0 ? (
              <ReactEChartsCore
                echarts={echarts}
                option={weeklyTrendOption}
                style={{ height: 260 }}
                notMerge
                lazyUpdate
              />
            ) : (
              <div className="flex h-[260px] flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
                <p className="text-xs text-muted-foreground">No weekly trend data available</p>
              </div>
            )}

            {/* Inline Trend Editor */}
            {showTrendEditor && isEditable && onUpdateData && (
              <div className="border-t border-border/40 pt-4 mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in">
                {data.weeklyTrend.map((d, i) => (
                  <div key={d.day} className="p-3 rounded-lg border border-border bg-card shadow-sm space-y-2">
                    <div className="text-xs font-bold text-center text-foreground">{d.day}</div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase block">New</span>
                      <Input
                        type="number"
                        value={d.newBugs}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const copy = [...data.weeklyTrend];
                          copy[i] = { ...copy[i], newBugs: val };
                          onUpdateData({ ...data, weeklyTrend: copy });
                        }}
                        className="h-7 text-xs bg-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase block">Resolved</span>
                      <Input
                        type="number"
                        value={d.resolved}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const copy = [...data.weeklyTrend];
                          copy[i] = { ...copy[i], resolved: val };
                          onUpdateData({ ...data, weeklyTrend: copy });
                        }}
                        className="h-7 text-xs bg-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
            <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Prod Bug Ageing
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 font-semibold text-muted-foreground">Age Bucket</th>
                    <th className="p-3 font-semibold text-muted-foreground text-center">P1 / Critical</th>
                    <th className="p-3 font-semibold text-muted-foreground text-center">P2 / High</th>
                    <th className="p-3 font-semibold text-muted-foreground text-center">P3 / Medium</th>
                    <th className="p-3 font-semibold text-muted-foreground text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bugAgeing.length > 0 ? (
                    data.bugAgeing.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="p-3 font-medium text-foreground">{row.age}</td>
                        <td className="p-3 text-center">
                          {isEditable ? (
                            <input
                              type="number"
                              value={row.p1}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                const copy = [...data.bugAgeing];
                                const updatedRow = { ...copy[idx], p1: val };
                                updatedRow.total = updatedRow.p1 + updatedRow.p2 + updatedRow.p3;
                                copy[idx] = updatedRow;
                                onUpdateData?.({ ...data, bugAgeing: copy });
                              }}
                              className="w-16 bg-transparent border-0 text-center font-semibold focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                            />
                          ) : (
                            <span className="text-center text-xs font-semibold text-foreground select-all w-16 block mx-auto">
                              {row.p1 === 0 ? "-" : row.p1}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isEditable ? (
                            <input
                              type="number"
                              value={row.p2}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                const copy = [...data.bugAgeing];
                                const updatedRow = { ...copy[idx], p2: val };
                                updatedRow.total = updatedRow.p1 + updatedRow.p2 + updatedRow.p3;
                                copy[idx] = updatedRow;
                                onUpdateData?.({ ...data, bugAgeing: copy });
                              }}
                              className="w-16 bg-transparent border-0 text-center focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                            />
                          ) : (
                            <span className="text-center text-xs text-foreground select-all w-16 block mx-auto">
                              {row.p2 === 0 ? "-" : row.p2}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isEditable ? (
                            <input
                              type="number"
                              value={row.p3}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                const copy = [...data.bugAgeing];
                                const updatedRow = { ...copy[idx], p3: val };
                                updatedRow.total = updatedRow.p1 + updatedRow.p2 + updatedRow.p3;
                                copy[idx] = updatedRow;
                                onUpdateData?.({ ...data, bugAgeing: copy });
                              }}
                              className="w-16 bg-transparent border-0 text-center focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                            />
                          ) : (
                            <span className="text-center text-xs text-foreground select-all w-16 block mx-auto">
                              {row.p3 === 0 ? "-" : row.p3}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-primary">{String(row.total).padStart(2, "0")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                        No ageing records available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: RCA Table */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Root Cause Analysis Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-3 font-semibold text-muted-foreground">Root Cause Category</th>
                  <th className="p-3 font-semibold text-muted-foreground text-center">Count</th>
                  <th className="p-3 font-semibold text-muted-foreground text-center">% Percentage</th>
                  {onUpdateData && isEditable && <th className="p-2 w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {data.rcaSummary.length > 0 ? (
                  data.rcaSummary.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 group/row">
                      <td className="p-3 py-1.5 font-medium text-foreground">
                        {isEditable ? (
                          <input
                            type="text"
                            value={row.category}
                            onChange={(e) => {
                              const copy = [...data.rcaSummary];
                              copy[idx] = { ...copy[idx], category: e.target.value };
                              onUpdateData?.({ ...data, rcaSummary: copy });
                            }}
                            className="w-full bg-transparent border-0 font-medium focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                            placeholder="Category"
                          />
                        ) : (
                          <span className="select-all block py-0.5">{row.category}</span>
                        )}
                      </td>
                      <td className="p-3 py-1.5 text-center">
                        {isEditable ? (
                          <input
                            type="number"
                            value={row.count}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const copy = [...data.rcaSummary];
                              copy[idx] = { ...copy[idx], count: val };
                              const total = copy.reduce((sum, r) => sum + r.count, 0);
                              const updated = copy.map(r => ({
                                ...r,
                                percentage: total > 0 ? Math.round((r.count / total) * 100) : 0
                              }));
                              onUpdateData?.({ ...data, rcaSummary: updated });
                            }}
                            className="w-16 bg-transparent border-0 text-center font-semibold focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                          />
                        ) : (
                          <span className="font-semibold select-all w-16 block mx-auto py-0.5">
                            {row.count === 0 ? "-" : row.count}
                          </span>
                        )}
                      </td>
                      <td className="p-3 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-semibold">{row.percentage}%</span>
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="bg-primary h-full"
                              style={{ width: `${row.percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {onUpdateData && isEditable && (
                        <td className="p-2 py-1.5 text-center">
                          <button
                            onClick={() => {
                              const copy = data.rcaSummary.filter((_, i) => i !== idx);
                              const total = copy.reduce((sum, r) => sum + r.count, 0);
                              const updated = copy.map(r => ({
                                ...r,
                                percentage: total > 0 ? Math.round((r.count / total) * 100) : 0
                              }));
                              onUpdateData({ ...data, rcaSummary: updated });
                            }}
                            className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={onUpdateData && isEditable ? 4 : 3} className="p-8 text-center text-muted-foreground italic">
                      No root cause data available
                    </td>
                  </tr>
                )}
                {data.rcaSummary.length > 0 && (
                  <tr className="bg-muted/10 font-bold border-t border-border">
                    <td className="p-3 text-foreground">TOTAL</td>
                    <td className="p-3 text-center text-foreground">
                      {String(data.rcaSummary.reduce((sum, r) => sum + r.count, 0)).padStart(2, "0")}
                    </td>
                    <td className="p-3 text-center text-primary" colSpan={onUpdateData && isEditable ? 2 : 1}>100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {onUpdateData && isEditable && (
            <div className="p-3 flex justify-start border-t border-border/40 mt-2">
              <Button
                onClick={() => {
                  const copy = [...data.rcaSummary, { category: "New Category", count: 0, percentage: 0 }];
                  onUpdateData({ ...data, rcaSummary: copy });
                }}
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1 border-dashed"
              >
                <Plus className="h-3.5 w-3.5" /> Add Root Cause
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
