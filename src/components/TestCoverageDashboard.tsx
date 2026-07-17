import { useMemo, useState } from "react";
import { Sparkles, BarChart2, Edit3, Trash2, Plus, X } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawRow, DataAnalysis, AISchema } from "@/types/bug";
import { getTestCoverageData, type TestCoverageData, type CustomKPIDef, type CustomChartDef, type CustomTableDef } from "@/utils/dashboardMapper";
import { Button } from "@/components/ui/button";
import { CustomChartCard } from "./CustomChartCard";
import { CustomTableCard } from "./CustomTableCard";

echarts.use([BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface Props {
  rows: RawRow[];
  analysis: DataAnalysis;
  aiSchema?: AISchema | null;
  data?: TestCoverageData;
  onUpdateData?: (newData: TestCoverageData) => void;
  onReset?: () => void;
  hasOverrides?: boolean;
  isEditable?: boolean;
  theme?: "light" | "dark";
  onDelete?: () => void;
}

const COVERED_COLORS = ["#3b82f6", "#06b6d4", "#6366f1", "#a855f7", "#ec4899", "#10b981", "#f59e0b"];

export function TestCoverageDashboard({ rows, analysis, aiSchema, data: propData, onUpdateData, onReset, hasOverrides, isEditable = false, theme, onDelete }: Props) {
  const data = useMemo(() => propData || getTestCoverageData(rows, analysis, aiSchema), [rows, analysis, aiSchema, propData]);
  
  const [showProductEditor, setShowProductEditor] = useState(false);
  // Local draft: stores the raw string the user is typing so backspace / spinners work
  const [kpiDraft, setKpiDraft] = useState<Record<string, string>>({});

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
    gapBg: isDark ? "#e2e8f01a" : "rgba(0,0,0,0.03)",
    gapBorder: isDark ? "#475569" : "#cbd5e1"
  };

  const coverageOption: echarts.EChartsCoreOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: any) => {
          const covered = params[0].value;
          const gap = params[1].value;
          return `<b>${params[0].name}</b><br/>Covered: <b>${covered}%</b><br/>Gap: <b>${gap}%</b>`;
        }
      },
      legend: {
        data: ["Covered %", "Gap %"],
        textStyle: { color: colors.subText, fontSize: 11 },
        bottom: 0
      },
      grid: { left: 80, right: 25, top: 15, bottom: 45 },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: { formatter: "{value}%", fontSize: 10, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
      },
      yAxis: {
        type: "category",
        data: data.coverageByProduct.map(d => d.product),
        axisLabel: { fontSize: 11, color: colors.subText },
        axisLine: { lineStyle: { color: colors.line } },
        axisTick: { show: false }
      },
      series: [
        {
          name: "Covered %",
          type: "bar",
          stack: "total",
          data: data.coverageByProduct.map((d, i) => ({
            value: d.covered,
            itemStyle: { color: COVERED_COLORS[i % COVERED_COLORS.length] }
          })),
          label: {
            show: true,
            position: "insideRight",
            formatter: "{c}%",
            color: "#ffffff",
            fontSize: 10,
            fontWeight: "bold"
          }
        },
        {
          name: "Gap %",
          type: "bar",
          stack: "total",
          data: data.coverageByProduct.map(d => d.gap),
          itemStyle: { color: colors.gapBg, borderColor: colors.gapBorder, borderWidth: 1 },
          label: {
            show: true,
            position: "insideRight",
            formatter: "{c}%",
            color: colors.subText,
            fontSize: 10
          }
        }
      ]
    };
  }, [data.coverageByProduct, isDark]);

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
    if (key === "totalTestCases") updated.totalTestCases = intVal;
    else if (key === "covered") updated.covered = intVal;
    else if (key === "notCovered") updated.notCovered = intVal;
    else if (key === "overallCoverage") updated.overallCoverage = intVal;
    else if (key === "newTcsAdded") updated.newTcsAdded = intVal;
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
    { label: "Total Test Cases", value: data.totalTestCases, key: "totalTestCases", sub: "All products", color: "border-t-[#1e3a8a] text-[#3b82f6]" },
    { label: "Covered", value: data.covered, key: "covered", sub: "With test cases", color: "border-t-[#22c55e] text-[#22c55e]" },
    { label: "Not Covered", value: data.notCovered, key: "notCovered", sub: "Gaps identified", color: "border-t-[#ef4444] text-[#ef4444]" },
    { label: "Overall Coverage", value: data.overallCoverage, key: "overallCoverage", sub: "Portfolio avg", color: "border-t-[#06b6d4] text-[#06b6d4]" },
    { label: "New TCs Added", value: data.newTcsAdded, key: "newTcsAdded", sub: "This week", color: "border-t-[#a855f7] text-[#a855f7]" },
  ];

  const visibleKPIs = kpiDefinitions.filter(kpi => !(data.hiddenKPIs || []).includes(kpi.key));
  const hiddenKPIsList = kpiDefinitions.filter(kpi => (data.hiddenKPIs || []).includes(kpi.key));

  const chartDefinitions = [
    { id: "coverageByProduct", label: "Coverage by Product Chart" },
    { id: "coverageByTestType", label: "Coverage by Test Type Table" }
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
          <div className="p-2 bg-sky-500/10 rounded-lg text-[#0ea5e9]">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Test Coverage & Requirement Analysis</h2>
              {hasOverrides && onReset && isEditable && (
                <button
                  onClick={onReset}
                  className="px-2 py-0.5 text-[10px] bg-sky-500/10 text-[#0ea5e9] rounded border border-sky-500/20 hover:bg-sky-500/20 transition-all font-semibold"
                  title="Reset custom overrides to Excel data values"
                >
                  Reset to Excel
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Test coverage details across components/requirements, product-wise gap analysis, and test type distribution</p>
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
              Showing <b>Demo Template</b>. Upload a sheet named <b>"Test Coverage"</b> to view your live requirement coverage lists.
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

      {/* Lower Layout Grid */}
      {(isChartVisible("coverageByProduct") || isChartVisible("coverageByTestType")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Horizontal Bar Chart */}
          {isChartVisible("coverageByProduct") && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative" data-chart-card>
              {onUpdateData && isEditable && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1.5">
                  <button
                    onClick={() => setShowProductEditor(!showProductEditor)}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                      showProductEditor
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Edit3 className="h-3 w-3" /> {showProductEditor ? "Close Editor" : "Edit Coverage"}
                  </button>
                  <button
                    onClick={() => handleHideChart("coverageByProduct")}
                    className="p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all"
                    title="Hide Section"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-primary" />
                Coverage % by Product/Module
              </h3>
              {data.coverageByProduct.length > 0 ? (
                <ReactEChartsCore
                  echarts={echarts}
                  option={coverageOption}
                  style={{ height: 280 }}
                  notMerge
                  lazyUpdate
                />
              ) : (
                <div className="flex h-[280px] flex-col items-center justify-center text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
                  <p className="text-xs text-muted-foreground">No product coverage data available</p>
                </div>
              )}

              {/* Inline Product Editor */}
              {showProductEditor && isEditable && onUpdateData && (
                <div className="border-t border-border/40 pt-4 mt-4 space-y-3 animate-fade-in text-xs">
                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                    {data.coverageByProduct.map((prod, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={prod.product}
                          onChange={(e) => {
                            const copy = [...data.coverageByProduct];
                            copy[idx] = { ...copy[idx], product: e.target.value };
                            onUpdateData({ ...data, coverageByProduct: copy });
                          }}
                          className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                          placeholder="Product Name"
                        />
                        <div className="flex items-center gap-1 w-24 shrink-0">
                          <input
                            type="number"
                            value={prod.covered}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                              const copy = [...data.coverageByProduct];
                              copy[idx] = { ...copy[idx], covered: val, gap: 100 - val };
                              onUpdateData({ ...data, coverageByProduct: copy });
                            }}
                            className="w-full bg-transparent border border-border rounded px-2 py-1 text-xs text-center text-foreground focus:outline-none focus:border-primary/50"
                            placeholder="Covered %"
                          />
                          <span className="text-[10px] text-muted-foreground">%</span>
                        </div>
                        <button
                          onClick={() => {
                            const copy = data.coverageByProduct.filter((_, i) => i !== idx);
                            onUpdateData({ ...data, coverageByProduct: copy });
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
                        const copy = [...data.coverageByProduct, { product: "New Product", covered: 0, gap: 100 }];
                        onUpdateData({ ...data, coverageByProduct: copy });
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
          )}

          {/* Right Column: Coverage by Test Type Table */}
          {isChartVisible("coverageByTestType") && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
              {isEditable && onUpdateData && (
                <button
                  onClick={() => handleHideChart("coverageByTestType")}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all z-10"
                  title="Hide Section"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <h3 className="mb-4 text-sm font-semibold text-foreground">Coverage by Test Type</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="p-3 font-semibold text-muted-foreground">Test Type</th>
                      <th className="p-3 font-semibold text-muted-foreground text-center">Total TCs</th>
                      <th className="p-3 font-semibold text-muted-foreground text-center">Coverage %</th>
                      {onUpdateData && isEditable && <th className="p-2 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.coverageByTestType.length > 0 ? (
                      data.coverageByTestType.map((row, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 group/row">
                          <td className="p-3 py-1.5">
                            {isEditable ? (
                              <input
                                type="text"
                                value={row.type}
                                onChange={(e) => {
                                  if (!onUpdateData) return;
                                  const copy = [...data.coverageByTestType];
                                  copy[idx] = { ...copy[idx], type: e.target.value };
                                  onUpdateData({ ...data, coverageByTestType: copy });
                                }}
                                className="w-full bg-transparent border-0 font-medium focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                                placeholder="Test Type"
                              />
                            ) : (
                              <span className="select-all font-medium block text-foreground py-0.5">
                                {row.type}
                              </span>
                            )}
                          </td>
                          <td className="p-3 py-1.5 text-center">
                            {isEditable ? (
                              <input
                                type="number"
                                value={row.total}
                                onChange={(e) => {
                                  if (!onUpdateData) return;
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  const copy = [...data.coverageByTestType];
                                  copy[idx] = { ...copy[idx], total: val };
                                  onUpdateData({ ...data, coverageByTestType: copy });
                                }}
                                className="w-16 bg-transparent border-0 text-center font-semibold focus:ring-0 p-0 shadow-none text-xs text-foreground rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                              />
                            ) : (
                              <span className="font-semibold select-all w-16 block mx-auto text-center py-0.5 text-foreground">
                                {row.total}
                              </span>
                            )}
                          </td>
                          <td className="p-3 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isEditable ? (
                                <input
                                  type="number"
                                  value={row.coverage}
                                  onChange={(e) => {
                                    if (!onUpdateData) return;
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    const copy = [...data.coverageByTestType];
                                    copy[idx] = { ...copy[idx], coverage: val };
                                    onUpdateData({ ...data, coverageByTestType: copy });
                                  }}
                                  className="w-12 bg-transparent border-0 text-center font-bold focus:ring-0 p-0 shadow-none text-xs text-primary rounded-none focus:border-b focus:border-primary/45 hover:border-b hover:border-primary/20 cursor-text"
                                />
                              ) : (
                                <span className="font-bold select-all w-12 block mx-auto text-center py-0.5 text-primary">
                                  {row.coverage}
                                </span>
                              )}
                              <span>%</span>
                            </div>
                          </td>
                          {onUpdateData && isEditable && (
                            <td className="p-2 py-1.5 text-center">
                              <button
                                onClick={() => {
                                  const copy = data.coverageByTestType.filter((_, i) => i !== idx);
                                  onUpdateData({ ...data, coverageByTestType: copy });
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
                        <td colSpan={onUpdateData && isEditable ? 4 : 3} className="p-6 text-center text-muted-foreground italic">
                          No coverage data available
                        </td>
                      </tr>
                    )}
                    {data.coverageByTestType.length > 0 && (
                      <tr className="bg-muted/10 font-bold border-t border-border">
                        <td className="p-3 text-foreground">TOTAL</td>
                        <td className="p-3 text-center text-foreground">
                          {String(data.coverageByTestType.reduce((sum, r) => sum + r.total, 0)).padStart(3, "0")}
                        </td>
                        <td className="p-3 text-center text-primary" colSpan={onUpdateData && isEditable ? 2 : 1}>
                          {data.overallCoverage}%
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {onUpdateData && isEditable && (
                <div className="p-3 flex justify-start border-t border-border/40 mt-2">
                  <Button
                    onClick={() => {
                      const copy = [...data.coverageByTestType, { type: "New Type", total: 0, coverage: 0 }];
                      onUpdateData({ ...data, coverageByTestType: copy });
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1 border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Test Type
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
