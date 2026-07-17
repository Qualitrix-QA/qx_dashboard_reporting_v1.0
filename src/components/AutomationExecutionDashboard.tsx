import { useMemo, useState } from "react";
import { Sparkles, Activity, CheckCircle, XCircle, ShieldAlert, Cpu, Edit3, Trash2, Plus, X } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow, DataAnalysis, AISchema } from "@/types/bug";
import { getAutomationExecutionData, type AutomationExecutionData, type CustomKPIDef, type CustomChartDef, type CustomTableDef } from "@/utils/dashboardMapper";
import { Button } from "@/components/ui/button";
import { CustomChartCard } from "./CustomChartCard";
import { CustomTableCard } from "./CustomTableCard";

echarts.use([BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  analysis: DataAnalysis;
  aiSchema?: AISchema | null;
  data?: AutomationExecutionData;
  onUpdateData?: (newData: AutomationExecutionData) => void;
  onReset?: () => void;
  hasOverrides?: boolean;
  isEditable?: boolean;
  theme?: "light" | "dark";
  onDelete?: () => void;
}

export function AutomationExecutionDashboard({ rows, analysis, aiSchema, data: externalData, onUpdateData, onReset, hasOverrides, isEditable = false, theme, onDelete }: Props) {
  const data = useMemo(() => externalData ?? getAutomationExecutionData(rows, analysis, aiSchema), [rows, analysis, aiSchema, externalData]);

  const [showHistoryEditor, setShowHistoryEditor] = useState(false);
  // Local draft: stores the raw string the user is typing so backspace / spinners work
  const [kpiDraft, setKpiDraft] = useState<Record<string, string>>({});

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
    label: isDark ? "#e2e8f0" : "#475569"
  };

  const historyOption: echarts.EChartsCoreOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
      },
      legend: {
        data: ["Pass", "Fail"],
        textStyle: { color: colors.subText, fontSize: 11 },
        bottom: 0
      },
      grid: { left: 40, right: 15, top: 20, bottom: 45 },
      xAxis: {
        type: "category",
        data: data.runHistory.map(d => d.run),
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
          name: "Pass",
          type: "bar",
          data: data.runHistory.map(d => d.pass),
          itemStyle: { color: "#06b6d4", borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 20,
          label: {
            show: true,
            position: "top",
            color: colors.label,
            fontSize: 9,
            fontWeight: "bold"
          }
        },
        {
          name: "Fail",
          type: "bar",
          data: data.runHistory.map(d => d.fail),
          itemStyle: { color: "#ef4444", borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 20,
          label: {
            show: true,
            position: "top",
            color: colors.label,
            fontSize: 9,
            fontWeight: "bold"
          }
        }
      ]
    };
  }, [data.runHistory, isDark]);

  // Called on every keystroke — only updates local draft
  const handleKPIChangeRaw = (key: string, val: string) => {
    setKpiDraft(prev => ({ ...prev, [key]: val }));
  };

  // Called on blur — commits the parsed number to the data model
  const handleKPIChange = (key: string, val: string) => {
    if (!onUpdateData) return;
    setKpiDraft(prev => { const n = { ...prev }; delete n[key]; return n; });
    const intVal = Math.max(0, parseInt(val) || 0);
    const updated = { ...data };
    if (key === "totalAutoTCs") updated.totalAutoTCs = intVal;
    else if (key === "executed") updated.executed = intVal;
    else if (key === "passed") updated.passed = intVal;
    else if (key === "failed") updated.failed = intVal;
    else if (key === "automationPct") updated.automationPct = intVal;
    onUpdateData(updated);
  };

  const handleAddCustomKPI = () => {
    if (!onUpdateData) return;
    const newKpis = [...(data.customKPIs || [])];
    newKpis.push({
      id: `custom_kpi_${Date.now()}`,
      label: "Custom Metric",
      value: "0",
      sub: "",
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
      columns: ["Category", "Value"],
      data: [
        { "Category": "Category A", "Value": 10 },
        { "Category": "Category B", "Value": 20 }
      ],
      chartType: "bar",
      xAxisKey: "Category",
      yAxisKey: "Value",
      showChart: false
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
    { label: "Total Auto TCs", value: data.totalAutoTCs, key: "totalAutoTCs", sub: "In suite", color: "border-t-[#1e3a8a] text-[#3b82f6]" },
    { label: "Executed (Auto)", value: data.executed, key: "executed", sub: "This run", color: "border-t-[#06b6d4] text-[#06b6d4]" },
    { label: "Pass", value: data.passed, key: "passed", sub: "Passed auto", color: "border-t-[#22c55e] text-[#22c55e]" },
    { label: "Fail", value: data.failed, key: "failed", sub: "Failed auto", color: "border-t-[#ef4444] text-[#ef4444]" },
    { label: "Automation %", value: data.automationPct, key: "automationPct", sub: "vs manual total", color: "border-t-[#a855f7] text-[#a855f7]" },
  ];

  const visibleKPIs = kpiDefinitions.filter(kpi => !(data.hiddenKPIs || []).includes(kpi.key));
  const hiddenKPIsList = kpiDefinitions.filter(kpi => (data.hiddenKPIs || []).includes(kpi.key));

  const chartDefinitions = [
    { id: "runHistory", label: "Automation Run History Chart" },
    { id: "suiteHealth", label: "Suite Health & Insights Panel" }
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
          <div className="p-2 bg-violet-500/10 rounded-lg text-[#a855f7]">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Automation Test Execution</h2>
              {hasOverrides && onReset && isEditable && (
                <button
                  onClick={onReset}
                  className="px-2 py-0.5 text-[10px] bg-violet-500/10 text-[#a855f7] rounded border border-violet-500/20 hover:bg-violet-500/20 transition-all font-semibold"
                  title="Reset custom overrides to Excel data values"
                >
                  Reset to Excel
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Automated test run statistics, history trend, stability tracking, and CI/CD pipeline integration</p>
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
              Showing <b>Demo Template</b>. Upload a sheet named <b>"Automation Execution"</b> or <b>"Automation"</b> to view your live execution records.
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
                    value={kpiDraft[card.key] !== undefined ? kpiDraft[card.key] : card.value}
                    onChange={(e) => handleKPIChangeRaw(card.key, e.target.value)}
                    onBlur={(e) => handleKPIChange(card.key, e.target.value)}
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
                    onChange={(e) => {
                      const raw = e.target.value;
                      // If stored value is "0" and user typed a non-zero digit, replace entirely
                      const updated = kpi.value === "0" && raw.length > 1 && raw.startsWith("0")
                        ? raw.slice(1)
                        : raw;
                      handleUpdateCustomKPI(kpi.id, { value: updated });
                    }}
                    onBlur={() => {
                      if (kpi.value === "" || kpi.value === null || kpi.value === undefined) {
                        handleUpdateCustomKPI(kpi.id, { value: "0" });
                      }
                    }}
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
                  {kpi.sub && <p className="mt-1 text-[10px] text-muted-foreground">{kpi.sub}</p>}
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

      {/* Main Layout Grid */}
      {(isChartVisible("runHistory") || isChartVisible("suiteHealth")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Grouped Run History Chart */}
          {isChartVisible("runHistory") && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative" data-chart-card>
              {onUpdateData && isEditable && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1.5">
                  <button
                    onClick={() => setShowHistoryEditor(!showHistoryEditor)}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                      showHistoryEditor
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Edit3 className="h-3 w-3" /> {showHistoryEditor ? "Close Editor" : "Edit History"}
                  </button>
                  <button
                    onClick={() => handleHideChart("runHistory")}
                    className="p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all"
                    title="Hide Section"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-primary" />
                Automation Run History (Pass vs Fail)
              </h3>
              {data.runHistory.length > 0 ? (
                <ReactEChartsCore
                  echarts={echarts}
                  option={historyOption}
                  style={{ height: 280 }}
                  notMerge
                  lazyUpdate
                />
              ) : (
                <div className="flex h-[280px] flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
                  <p className="text-xs text-muted-foreground">No run history data available</p>
                </div>
              )}

              {/* Inline History Editor */}
              {showHistoryEditor && isEditable && onUpdateData && (
                <div className="border-t border-border/40 pt-4 mt-4 space-y-3 animate-fade-in text-xs">
                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                    {data.runHistory.map((run, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={run.run}
                          onChange={(e) => {
                            const copy = [...data.runHistory];
                            copy[idx] = { ...copy[idx], run: e.target.value };
                            onUpdateData({ ...data, runHistory: copy });
                          }}
                          className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                          placeholder="Run/Build label"
                        />
                        <input
                          type="number"
                          value={run.pass}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            const copy = [...data.runHistory];
                            copy[idx] = { ...copy[idx], pass: val };
                            onUpdateData({ ...data, runHistory: copy });
                          }}
                          className="w-16 bg-transparent border-border rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary/50"
                          placeholder="Pass"
                        />
                        <input
                          type="number"
                          value={run.fail}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            const copy = [...data.runHistory];
                            copy[idx] = { ...copy[idx], fail: val };
                            onUpdateData({ ...data, runHistory: copy });
                          }}
                          className="w-16 bg-transparent border-border rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary/50"
                          placeholder="Fail"
                        />
                        <button
                          onClick={() => {
                            const copy = data.runHistory.filter((_, i) => i !== idx);
                            onUpdateData({ ...data, runHistory: copy });
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
                        const copy = [...data.runHistory, { run: "Build-New", pass: 0, fail: 0 }];
                        onUpdateData({ ...data, runHistory: copy });
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1 border-dashed"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Build
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Column: Suite Health & Insights Panel */}
          {isChartVisible("suiteHealth") && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 group relative">
              {isEditable && onUpdateData && (
                <button
                  onClick={() => handleHideChart("suiteHealth")}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all z-10"
                  title="Hide Section"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" />
                Suite Health & Insights
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Stability */}
                <div className="rounded-lg bg-muted/30 p-3.5 border border-border/40 space-y-1">
                  <p className="text-xs font-bold text-foreground">Suite Stability:</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 gap-2">
                    <span>Flaky Tests:</span>
                    {isEditable ? (
                      <input
                        type="number"
                        value={data.insights.stability.flaky}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateData({
                            ...data,
                            insights: {
                              ...data.insights,
                              stability: { ...data.insights.stability, flaky: val }
                            }
                          });
                        }}
                        className="w-12 bg-transparent border-0 text-right font-semibold text-xs p-0 focus:ring-0 rounded-none text-orange-500 border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                      />
                    ) : (
                      <span className="font-semibold text-xs text-orange-500 select-all text-right w-12 block">
                        {data.insights.stability.flaky}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground gap-2">
                    <span>Fixed:</span>
                    {isEditable ? (
                      <input
                        type="number"
                        value={data.insights.stability.fixed}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateData({
                            ...data,
                            insights: {
                              ...data.insights,
                              stability: { ...data.insights.stability, fixed: val }
                            }
                          });
                        }}
                        className="w-12 bg-transparent border-0 text-right font-semibold text-xs p-0 focus:ring-0 rounded-none text-green-500 border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                      />
                    ) : (
                      <span className="font-semibold text-xs text-green-500 select-all text-right w-12 block">
                        {data.insights.stability.fixed}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground gap-2">
                    <span>New:</span>
                    {isEditable ? (
                      <input
                        type="number"
                        value={data.insights.stability.new}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateData({
                            ...data,
                            insights: {
                              ...data.insights,
                              stability: { ...data.insights.stability, new: val }
                            }
                          });
                        }}
                        className="w-12 bg-transparent border-0 text-right font-semibold text-xs p-0 focus:ring-0 rounded-none text-red-500 border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                      />
                    ) : (
                      <span className="font-semibold text-xs text-red-500 select-all text-right w-12 block">
                        {data.insights.stability.new}
                      </span>
                    )}
                  </div>
                </div>

                {/* Execution Time */}
                <div className="rounded-lg bg-muted/30 p-3.5 border border-border/40 space-y-1">
                  <p className="text-xs font-bold text-foreground">Execution Time:</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 gap-2">
                    <span>Avg Run Time:</span>
                    <div className="flex items-center justify-end gap-1">
                      {isEditable ? (
                        <input
                          type="number"
                          value={data.insights.execTime.avg}
                          onChange={(e) => {
                            if (!onUpdateData) return;
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            onUpdateData({
                              ...data,
                              insights: {
                                ...data.insights,
                                execTime: { ...data.insights.execTime, avg: val }
                              }
                            });
                          }}
                          className="w-10 bg-transparent border-0 text-right font-semibold text-foreground text-xs p-0 focus:ring-0 rounded-none border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                        />
                      ) : (
                        <span className="font-semibold text-foreground text-xs select-all text-right w-10 block">
                          {data.insights.execTime.avg}
                        </span>
                      )}
                      <span>min</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground gap-2">
                    <span>Longest Run:</span>
                    <div className="flex items-center justify-end gap-1">
                      {isEditable ? (
                        <input
                          type="number"
                          value={data.insights.execTime.longest}
                          onChange={(e) => {
                            if (!onUpdateData) return;
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            onUpdateData({
                              ...data,
                              insights: {
                                ...data.insights,
                                execTime: { ...data.insights.execTime, longest: val }
                              }
                            });
                          }}
                          className="w-10 bg-transparent border-0 text-right font-semibold text-foreground text-xs p-0 focus:ring-0 rounded-none border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                        />
                      ) : (
                        <span className="font-semibold text-foreground text-xs select-all text-right w-10 block">
                          {data.insights.execTime.longest}
                        </span>
                      )}
                      <span>min</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* CI/CD Health */}
                <div className="rounded-lg bg-muted/30 p-3.5 border border-border/40 space-y-1 flex flex-col justify-center">
                  <p className="text-xs font-bold text-foreground">CI/CD Health:</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 gap-2">
                    <span>Pipeline:</span>
                    {isEditable ? (
                      <select
                        value={data.insights.cicdHealth.status}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          onUpdateData({
                            ...data,
                            insights: {
                              ...data.insights,
                              cicdHealth: { ...data.insights.cicdHealth, status: e.target.value }
                            }
                          });
                        }}
                        className="bg-transparent border-0 border-b border-transparent hover:border-border/50 focus:border-primary/50 focus:ring-0 p-0 py-0.5 rounded-none font-bold text-xs select-none text-right appearance-none cursor-pointer outline-none text-foreground"
                        style={{ color: data.insights.cicdHealth.status === "Green" ? "#22c55e" : "#ef4444" }}
                      >
                        <option value="Green" className="bg-background text-green-500">Green</option>
                        <option value="Red" className="bg-background text-red-500">Red</option>
                      </select>
                    ) : (
                      <span
                        className="font-bold text-xs"
                        style={{ color: data.insights.cicdHealth.status === "Green" ? "#22c55e" : "#ef4444" }}
                      >
                        {data.insights.cicdHealth.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-1">
                    <span>Last run:</span>
                    {isEditable ? (
                      <input
                        type="text"
                        value={data.insights.cicdHealth.lastRun}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          onUpdateData({
                            ...data,
                            insights: {
                              ...data.insights,
                              cicdHealth: { ...data.insights.cicdHealth, lastRun: e.target.value }
                            }
                          });
                        }}
                        className="flex-1 bg-transparent border-0 p-0 focus:ring-0 rounded-none text-left text-[10px] text-muted-foreground/80 border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                      />
                    ) : (
                      <span className="flex-1 text-left text-[10px] text-muted-foreground/80 select-all">
                        {data.insights.cicdHealth.lastRun}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sprint Target */}
                <div className="rounded-lg bg-muted/30 p-3.5 border border-border/40 flex flex-col justify-center">
                  <p className="text-xs font-bold text-foreground">Target Coverage:</p>
                  <p className="text-xs text-muted-foreground pt-1">Next Sprint Target:</p>
                  <div className="text-lg font-extrabold text-primary flex items-center gap-0.5">
                    {isEditable ? (
                      <input
                        type="number"
                        value={data.insights.nextTarget}
                        onChange={(e) => {
                          if (!onUpdateData) return;
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateData({
                            ...data,
                            insights: { ...data.insights, nextTarget: val }
                          });
                        }}
                        className="w-12 bg-transparent border-0 text-left font-extrabold text-primary text-lg p-0 focus:ring-0 rounded-none border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                      />
                    ) : (
                      <span className="font-extrabold text-primary text-lg select-all">
                        {data.insights.nextTarget}
                      </span>
                    )}
                    <span>% automation</span>
                  </div>
                </div>
              </div>

              {/* Key Failures list */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                  Key Failures:
                </p>
                <div className="space-y-2">
                  {data.insights.keyFailures.length > 0 ? (
                    data.insights.keyFailures.map((f, idx) => (
                      <div key={idx} className="rounded bg-muted/40 p-2 text-xs border border-border/20 group/row relative space-y-1">
                        <div className="flex items-center gap-2">
                          {isEditable ? (
                            <input
                              type="text"
                              value={f.test}
                              onChange={(e) => {
                                if (!onUpdateData) return;
                                const copy = [...data.insights.keyFailures];
                                copy[idx] = { ...copy[idx], test: e.target.value };
                                onUpdateData({
                                  ...data,
                                  insights: { ...data.insights, keyFailures: copy }
                                });
                              }}
                              className="flex-1 bg-transparent border-0 p-0 focus:ring-0 rounded-none font-semibold text-foreground text-xs border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                              placeholder="Test name"
                            />
                          ) : (
                            <span className="flex-1 font-semibold text-foreground text-xs select-all">
                              {f.test}
                            </span>
                          )}
                          {onUpdateData && isEditable && (
                            <button
                              onClick={() => {
                                const copy = data.insights.keyFailures.filter((_, i) => i !== idx);
                                onUpdateData({
                                  ...data,
                                  insights: { ...data.insights, keyFailures: copy }
                                });
                              }}
                              className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive p-0.5 shrink-0 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {isEditable ? (
                          <input
                            type="text"
                            value={f.reason}
                            onChange={(e) => {
                              if (!onUpdateData) return;
                              const copy = [...data.insights.keyFailures];
                              copy[idx] = { ...copy[idx], reason: e.target.value };
                              onUpdateData({
                                ...data,
                                insights: { ...data.insights, keyFailures: copy }
                              });
                            }}
                            className="w-full bg-transparent border-0 p-0 focus:ring-0 rounded-none text-[10px] font-mono text-red-400 mt-0.5 border-b border-transparent hover:border-border/50 focus:border-primary/50 cursor-text"
                            placeholder="Failure reason"
                          />
                        ) : (
                          <span className="w-full text-[10px] font-mono text-red-400 block mt-0.5 select-all">
                            {f.reason}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No automation failures detected in this run.</p>
                  )}
                  {onUpdateData && isEditable && (
                    <button
                      onClick={() => {
                        const copy = [...data.insights.keyFailures, { test: "New Test", reason: "Failure reason description" }];
                        onUpdateData({
                          ...data,
                          insights: { ...data.insights, keyFailures: copy }
                        });
                      }}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-1 font-semibold"
                    >
                      <Plus className="h-3 w-3" /> Add Failure
                    </button>
                  )}
                </div>
              </div>
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
                  theme={theme}
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
