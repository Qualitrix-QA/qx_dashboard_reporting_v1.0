import { useMemo, useState } from "react";
import { AlertTriangle, TrendingUp, Calendar, Zap, ShieldAlert, Sparkles, Edit3, Trash2, Plus, X } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow, DataAnalysis, AISchema } from "@/types/bug";
import { getProdIssuesData, type ProdIssuesData, type CustomKPIDef, type CustomChartDef, type CustomTableDef } from "@/utils/dashboardMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomChartCard } from "./CustomChartCard";
import { CustomTableCard } from "./CustomTableCard";

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

  const handleAddCustomKPI = () => {
    if (!onUpdateData) return;
    const newKpis = [...(data.customKPIs || [])];
    newKpis.push({
      id: `custom_kpi_${Date.now()}`,
      label: "Custom Metric",
      value: "0",
      sub: "Description",
      color: "border-t-[#3b82f6] text-[#3b82f6]"
    });
    onUpdateData({ ...data, customKPIs: newKpis });
  };

  const handleUpdateCustomKPI = (id: string, updatedFields: Partial<CustomKPIDef>) => {
    if (!onUpdateData) return;
    const updatedKpis = (data.customKPIs || []).map(kpi =>
      kpi.id === id ? { ...kpi, ...updatedFields } : kpi
    );
    onUpdateData({ ...data, customKPIs: updatedKpis });
  };

  const handleDeleteCustomKPI = (id: string) => {
    if (!onUpdateData) return;
    const updatedKpis = (data.customKPIs || []).filter(kpi => kpi.id !== id);
    onUpdateData({ ...data, customKPIs: updatedKpis });
  };

  const handleAddCustomChart = () => {
    if (!onUpdateData) return;
    const newCharts = [...(data.customCharts || [])];
    newCharts.push({
      id: `custom_chart_${Date.now()}`,
      title: "New Custom Chart",
      type: "bar",
      data: [
        { name: "Category A", value: 10 },
        { name: "Category B", value: 20 },
        { name: "Category C", value: 15 }
      ]
    });
    onUpdateData({ ...data, customCharts: newCharts });
  };

  const handleUpdateCustomChart = (id: string, updatedChart: CustomChartDef) => {
    if (!onUpdateData) return;
    const updatedCharts = (data.customCharts || []).map(chart =>
      chart.id === id ? updatedChart : chart
    );
    onUpdateData({ ...data, customCharts: updatedCharts });
  };

  const handleDeleteCustomChart = (id: string) => {
    if (!onUpdateData) return;
    const updatedCharts = (data.customCharts || []).filter(chart => chart.id !== id);
    onUpdateData({ ...data, customCharts: updatedCharts });
  };

  const handleAddCustomTable = () => {
    if (!onUpdateData) return;
    const newTables = [...(data.customTables || [])];
    newTables.push({
      id: `custom_table_${Date.now()}`,
      title: "New Custom Table",
      columns: ["Column 1", "Column 2"],
      data: [
        { "Column 1": "Row 1", "Column 2": "Data A" },
        { "Column 1": "Row 2", "Column 2": "Data B" }
      ]
    });
    onUpdateData({ ...data, customTables: newTables });
  };

  const handleUpdateCustomTable = (id: string, updatedTable: CustomTableDef) => {
    if (!onUpdateData) return;
    const updatedTables = (data.customTables || []).map(table =>
      table.id === id ? updatedTable : table
    );
    onUpdateData({ ...data, customTables: updatedTables });
  };

  const handleDeleteCustomTable = (id: string) => {
    if (!onUpdateData) return;
    const updatedTables = (data.customTables || []).filter(table => table.id !== id);
    onUpdateData({ ...data, customTables: updatedTables });
  };

  const kpiDefinitions = [
    { label: "Total Prod Issues", value: data.totalProdIssues, key: "totalProdIssues", sub: "This week", color: "border-t-[#ef4444] text-[#ef4444]" },
    { label: "Critical / P1", value: data.criticalP1, key: "criticalP1", sub: "Sev 1 incidents", color: "border-t-[#f97316] text-[#f97316]" },
    { label: "Resolved", value: data.resolved, key: "resolved", sub: "Fixed this week", color: "border-t-[#22c55e] text-[#22c55e]" },
    { label: "In Progress", value: data.inProgress, key: "inProgress", sub: "Being worked on", color: "border-t-[#3b82f6] text-[#3b82f6]" },
    { label: "Carry Forward", value: data.carryForward, key: "carryForward", sub: "Unresolved prev wk", color: "border-t-[#a855f7] text-[#a855f7]" },
  ];

  const visibleKPIs = kpiDefinitions.filter(kpi => !(data.hiddenKPIs || []).includes(kpi.key));
  const hiddenKPIsList = kpiDefinitions.filter(kpi => (data.hiddenKPIs || []).includes(kpi.key));

  const chartDefinitions = [
    { id: "weeklyTrend", label: "Weekly Prod Bug Trend" },
    { id: "bugAgeing", label: "Prod Bug Ageing Table" },
    { id: "rcaSummary", label: "Root Cause Analysis Summary Table" }
  ];

  const isChartVisible = (chartId: string) => !(data.hiddenCharts || []).includes(chartId);
  const hiddenChartsList = chartDefinitions.filter(c => (data.hiddenCharts || []).includes(c.id));

  const handleHideKPI = (kpiKey: string) => {
    if (!onUpdateData) return;
    const currentHidden = data.hiddenKPIs || [];
    if (!currentHidden.includes(kpiKey)) {
      onUpdateData({
        ...data,
        hiddenKPIs: [...currentHidden, kpiKey]
      });
    }
  };

  const handleRestoreKPI = (kpiKey: string) => {
    if (!onUpdateData) return;
    const currentHidden = data.hiddenKPIs || [];
    onUpdateData({
      ...data,
      hiddenKPIs: currentHidden.filter(k => k !== kpiKey)
    });
  };

  const handleHideChart = (chartId: string) => {
    if (!onUpdateData) return;
    const currentHidden = data.hiddenCharts || [];
    if (!currentHidden.includes(chartId)) {
      onUpdateData({
        ...data,
        hiddenCharts: [...currentHidden, chartId]
      });
    }
  };

  const handleRestoreChart = (chartId: string) => {
    if (!onUpdateData) return;
    const currentHidden = data.hiddenCharts || [];
    onUpdateData({
      ...data,
      hiddenCharts: currentHidden.filter(c => c !== chartId)
    });
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
          {visibleKPIs.map((card) => (
            <div
              key={card.key}
              className={`rounded-xl border border-border bg-card p-5 text-center shadow-sm border-t-4 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md relative group/kpi ${card.color.split(" ")[0]}`}
            >
              {isEditable && onUpdateData && (
                <button
                  onClick={() => handleHideKPI(card.key)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover/kpi:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-all z-10"
                  title="Hide KPI"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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

          {(data.customKPIs || []).map((kpi) => (
            <div
              key={kpi.id}
              className={`rounded-xl border border-border bg-card p-5 text-center shadow-sm border-t-4 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md relative group/kpi ${kpi.color.split(" ")[0] || "border-t-primary"}`}
            >
              {isEditable && onUpdateData && (
                <button
                  onClick={() => handleDeleteCustomKPI(kpi.id)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover/kpi:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-all z-10"
                  title="Delete Custom KPI"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {isEditable ? (
                <div className="space-y-1.5 relative">
                  <input
                    type="text"
                    value={kpi.label}
                    onChange={(e) => handleUpdateCustomKPI(kpi.id, { label: e.target.value })}
                    placeholder="KPI Title"
                    className="w-full bg-transparent border-0 border-b border-border/40 text-center text-[10px] font-bold uppercase tracking-wider focus:ring-0 p-0 hover:border-border cursor-text text-muted-foreground focus:border-primary"
                  />
                  <input
                    type="text"
                    value={kpi.value}
                    onChange={(e) => handleUpdateCustomKPI(kpi.id, { value: e.target.value })}
                    placeholder="Value"
                    className={`w-full bg-transparent border-0 border-b border-border/40 text-center text-2xl font-extrabold focus:ring-0 p-0 hover:border-border cursor-text focus:border-primary ${kpi.color.split(" ")[1] || "text-primary"}`}
                  />
                  <input
                    type="text"
                    value={kpi.sub}
                    onChange={(e) => handleUpdateCustomKPI(kpi.id, { sub: e.target.value })}
                    placeholder="Subtext"
                    className="w-full bg-transparent border-0 border-b border-border/40 text-center text-[10px] focus:ring-0 p-0 hover:border-border cursor-text text-muted-foreground focus:border-primary"
                  />
                  <div className="flex justify-center gap-1 pt-1.5">
                    {[
                      { name: "Red", value: "border-t-[#ef4444] text-[#ef4444]", bg: "bg-[#ef4444]" },
                      { name: "Orange", value: "border-t-[#f97316] text-[#f97316]", bg: "bg-[#f97316]" },
                      { name: "Yellow", value: "border-t-[#eab308] text-[#eab308]", bg: "bg-[#eab308]" },
                      { name: "Green", value: "border-t-[#22c55e] text-[#22c55e]", bg: "bg-[#22c55e]" },
                      { name: "Blue", value: "border-t-[#3b82f6] text-[#3b82f6]", bg: "bg-[#3b82f6]" },
                      { name: "Purple", value: "border-t-[#a855f7] text-[#a855f7]", bg: "bg-[#a855f7]" },
                      { name: "Gray", value: "border-t-[#64748b] text-[#64748b]", bg: "bg-[#64748b]" },
                    ].map(c => (
                      <button
                        key={c.name}
                        onClick={() => handleUpdateCustomKPI(kpi.id, { color: c.value })}
                        className={`h-2.5 w-2.5 rounded-full hover:scale-110 transition-transform ${c.bg} ${kpi.color === c.value ? "ring-1 ring-offset-1 ring-primary" : ""}`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  <div className={`mt-2 text-3xl font-extrabold tracking-tight select-all ${kpi.color.split(" ")[1] || "text-primary"}`}>
                    {kpi.value}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{kpi.sub}</p>
                </>
              )}
            </div>
          ))}

          {isEditable && onUpdateData && (
            <button
              onClick={handleAddCustomKPI}
              className="rounded-xl border border-dashed border-primary/40 hover:border-primary/80 bg-primary/5 hover:bg-primary/10 p-5 flex flex-col items-center justify-center text-center shadow-sm min-h-[110px] space-y-1.5 transition-all group cursor-pointer"
            >
              <Plus className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-primary">Add Custom KPI</span>
            </button>
          )}

          {isEditable && onUpdateData && hiddenKPIsList.length > 0 && (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/5 p-4 flex flex-col items-center justify-center text-center shadow-sm min-h-[110px] space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hidden KPIs</span>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-[160px]">
                {hiddenKPIsList.map(k => (
                  <button
                    key={k.key}
                    onClick={() => handleRestoreKPI(k.key)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary/10 text-primary hover:bg-primary/20 rounded font-semibold border border-primary/20 transition-all"
                    title="Click to restore KPI"
                  >
                    <Plus className="h-2.5 w-2.5" /> {k.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lower Dashboard Layout */}
      {(isChartVisible("weeklyTrend") || isChartVisible("bugAgeing") || isChartVisible("rcaSummary")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Weekly Trend & Ageing */}
          {(isChartVisible("weeklyTrend") || isChartVisible("bugAgeing")) && (
            <div className="space-y-6">
              {isChartVisible("weeklyTrend") && (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative" data-chart-card>
                  {onUpdateData && isEditable && (
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1.5">
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
                      <button
                        onClick={() => handleHideChart("weeklyTrend")}
                        className="p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all"
                        title="Hide Section"
                      >
                        <X className="h-3 w-3" />
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
              )}

              {isChartVisible("bugAgeing") && (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
                  {isEditable && onUpdateData && (
                    <button
                      onClick={() => handleHideChart("bugAgeing")}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all z-10"
                      title="Hide Section"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
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
              )}
            </div>
          )}

          {/* Right Column: RCA Table */}
          {isChartVisible("rcaSummary") && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
              {isEditable && onUpdateData && (
                <button
                  onClick={() => handleHideChart("rcaSummary")}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all z-10"
                  title="Hide Section"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
          )}
        </div>
      )}

      {/* Restore Section Panel */}
      {isEditable && onUpdateData && hiddenChartsList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 p-3.5 rounded-xl border border-dashed border-border bg-muted/5 text-xs">
          <span className="font-bold text-muted-foreground flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Restore Section:
          </span>
          {hiddenChartsList.map(c => (
            <Button
              key={c.id}
              onClick={() => handleRestoreChart(c.id)}
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 px-2.5 font-semibold"
            >
              Add {c.label}
            </Button>
          ))}
        </div>
      )}

      {/* Custom Charts & Tables Grid */}
      {((data.customCharts && data.customCharts.length > 0) || (data.customTables && data.customTables.length > 0) || (isEditable && onUpdateData)) && (
        <div className="border-t border-border/60 pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Custom Insights & Charts
            </h3>
            {isEditable && onUpdateData && (
              <div className="flex gap-2">
                <Button
                  onClick={handleAddCustomChart}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Custom Chart
                </Button>
                <Button
                  onClick={handleAddCustomTable}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Custom Table
                </Button>
              </div>
            )}
          </div>
          
          {data.customCharts && data.customCharts.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {data.customCharts.map((chart) => (
                <CustomChartCard
                  key={chart.id}
                  chart={chart}
                  isEditable={isEditable}
                  theme={theme}
                  onUpdate={(updatedChart) => handleUpdateCustomChart(chart.id, updatedChart)}
                  onDelete={() => handleDeleteCustomChart(chart.id)}
                />
              ))}
            </div>
          )}

          {data.customTables && data.customTables.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              {data.customTables.map((table) => (
                <CustomTableCard
                  key={table.id}
                  table={table}
                  isEditable={isEditable}
                  onUpdate={(updatedTable) => handleUpdateCustomTable(table.id, updatedTable)}
                  onDelete={() => handleDeleteCustomTable(table.id)}
                />
              ))}
            </div>
          )}

          {(!data.customCharts || data.customCharts.length === 0) && (!data.customTables || data.customTables.length === 0) && isEditable && onUpdateData && (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border/60 rounded-xl bg-muted/5">
              <p className="text-xs text-muted-foreground mb-2">No custom charts or tables added yet</p>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddCustomChart}
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Chart
                </Button>
                <Button
                  onClick={handleAddCustomTable}
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Table
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
