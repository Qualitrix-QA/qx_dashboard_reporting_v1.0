import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Trash2, Plus, X, BarChart3, LineChart as LineIcon, PieChart as PieIcon, GripVertical, TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CustomTableDef } from "@/utils/dashboardMapper";

echarts.use([BarChart, LineChart, PieChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface Props {
  table: CustomTableDef;
  isEditable: boolean;
  theme?: "light" | "dark";
  onUpdate: (table: CustomTableDef) => void;
  onDelete: () => void;
}

const CHART_COLORS = [
  "#0ea5e9", "#8b5cf6", "#f97316", "#22c55e",
  "#eab308", "#ef4444", "#ec4899", "#3b82f6",
];

export function CustomTableCard({ table, isEditable, theme, onUpdate, onDelete }: Props) {
  const isDark = theme !== "light";
  const colors = useMemo(() => ({
    text: isDark ? "#e2e8f0" : "#334155",
    subText: isDark ? "#94a3b8" : "#475569",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
  }), [isDark]);

  const chartType = table.chartType || "bar";

  // Auto-detect label and value columns — no manual dropdowns needed
  const xAxisKey = table.columns[0] || "";
  const yAxisKey = useMemo(() => {
    return (
      table.columns.find(col => {
        if (col === xAxisKey) return false;
        return table.data.some(row => !isNaN(Number(row[col])) && String(row[col]).trim() !== "");
      }) ||
      table.columns.find(col => col !== xAxisKey) ||
      table.columns[1] || ""
    );
  }, [table.columns, xAxisKey, table.data]);

  const chartData = useMemo(() =>
    table.data.map(row => ({
      name: String(row[xAxisKey] ?? ""),
      value: Number(row[yAxisKey]) || 0,
    })), [table.data, xAxisKey, yAxisKey]);

  const total = useMemo(() => chartData.reduce((s, v) => s + v.value, 0), [chartData]);
  const hasData = chartData.some(d => d.value > 0);

  const option: echarts.EChartsCoreOption = useMemo(() => {
    const categories = chartData.map(d => d.name || "Category");
    const values = chartData.map(d => d.value);

    if (chartType === "pie") {
      return {
        tooltip: {
          trigger: "item",
          backgroundColor: "rgba(15,15,20,0.95)",
          borderColor: "rgba(255,255,255,0.15)",
          textStyle: { color: "#e2e8f0", fontSize: 12 },
          formatter: (params: any) => {
            const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
            return `<b>${params.name}</b><br/>Value: <b>${params.value}</b><br/>Percentage: <b>${pct}%</b>`;
          },
        },
        color: CHART_COLORS,
        series: [{
          type: "pie", radius: ["38%", "68%"], center: ["50%", "50%"], avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: isDark ? "#1e293b" : "#ffffff", borderWidth: 2 },
          label: { show: true, formatter: "{b}\n{c} ({d}%)", fontSize: 10, color: colors.subText },
          data: chartData,
        }],
      };
    }
    if (chartType === "line") {
      return {
        tooltip: { trigger: "axis", backgroundColor: "rgba(15,15,20,0.95)", borderColor: "rgba(255,255,255,0.15)", textStyle: { color: "#e2e8f0", fontSize: 12 } },
        grid: { left: 45, right: 16, top: 20, bottom: 40 },
        xAxis: { type: "category", boundaryGap: false, data: categories, axisLabel: { fontSize: 10, color: colors.subText }, axisLine: { lineStyle: { color: colors.line } } },
        yAxis: { type: "value", axisLabel: { fontSize: 10, color: colors.subText }, splitLine: { lineStyle: { color: colors.grid, type: "dashed" } } },
        series: [{
          data: values, type: "line", smooth: true, symbol: "circle", symbolSize: 6,
          itemStyle: { color: "#0ea5e9" }, lineStyle: { color: "#0ea5e9", width: 3 },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(14,165,233,0.3)" }, { offset: 1, color: "rgba(14,165,233,0)" }]) },
        }],
      };
    }
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "rgba(15,15,20,0.95)", borderColor: "rgba(255,255,255,0.15)", textStyle: { color: "#e2e8f0", fontSize: 12 } },
      grid: { left: 45, right: 16, top: 20, bottom: 40 },
      xAxis: { type: "category", data: categories, axisLabel: { fontSize: 10, color: colors.subText }, axisLine: { lineStyle: { color: colors.line } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { fontSize: 10, color: colors.subText }, splitLine: { lineStyle: { color: colors.grid, type: "dashed" } } },
      series: [{
        type: "bar",
        data: values.map((val, i) => ({
          value: val,
          itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: CHART_COLORS[i % CHART_COLORS.length] }, { offset: 1, color: CHART_COLORS[i % CHART_COLORS.length] + "88" }]), borderRadius: [4, 4, 0, 0] },
        })),
        label: { show: true, position: "top", fontSize: 10, color: colors.text, fontWeight: "bold" },
        barMaxWidth: 30,
      }],
    };
  }, [chartType, chartData, colors, total, isDark]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleTitleChange = (val: string) => onUpdate({ ...table, title: val });
  const handleTypeChange = (type: "bar" | "line" | "pie") => onUpdate({ ...table, chartType: type });

  const handleAddColumn = () => {
    const newCol = `Column ${table.columns.length + 1}`;
    onUpdate({ ...table, columns: [...table.columns, newCol], data: table.data.map(r => ({ ...r, [newCol]: "" })) });
  };

  const handleAddRow = () => {
    const newRow: Record<string, string | number> = {};
    table.columns.forEach(col => { newRow[col] = ""; });
    onUpdate({ ...table, data: [...table.data, newRow] });
  };

  const handleCellChange = (rIdx: number, col: string, value: string) => {
    const newData = [...table.data];
    const parsed = value.trim() !== "" && !isNaN(Number(value)) ? Number(value) : value;
    newData[rIdx] = { ...newData[rIdx], [col]: parsed };
    onUpdate({ ...table, data: newData });
  };

  const handleColNameChange = (oldCol: string, newCol: string) => {
    if (!newCol || newCol === oldCol || table.columns.includes(newCol)) return;
    const newColumns = table.columns.map(c => c === oldCol ? newCol : c);
    const newData = table.data.map(row => {
      const r = { ...row }; r[newCol] = r[oldCol]; delete r[oldCol]; return r;
    });
    onUpdate({ ...table, columns: newColumns, data: newData });
  };

  const handleDeleteRow = (rIdx: number) =>
    onUpdate({ ...table, data: table.data.filter((_, i) => i !== rIdx) });

  const handleDeleteColumn = (col: string) => {
    const newColumns = table.columns.filter(c => c !== col);
    const newData = table.data.map(row => { const r = { ...row }; delete r[col]; return r; });
    onUpdate({ ...table, columns: newColumns, data: newData });
  };

  const handleSave = () => {
    toast.success("Table saved!", { description: `"${table.title}" has been saved successfully.` });
  };

  // ── Read-only view ──────────────────────────────────────────────────────────
  if (!isEditable) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-1">{table.title || "Custom Table"}</h3>
        <p className="text-[11px] text-muted-foreground mb-3">{table.data.length} rows · {table.columns.length} columns · Total: {total}</p>
        {hasData ? (
          <ReactEChartsCore echarts={echarts} option={option} style={{ height: 240 }} notMerge lazyUpdate />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-border">
              <thead>
                <tr className="bg-muted/30">
                  {table.columns.map(col => <th key={col} className="border border-border p-2 text-left font-semibold text-muted-foreground">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.data.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/10">
                    {table.columns.map(col => <td key={col} className="border border-border p-2 text-foreground">{String(row[col] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Edit mode — matches the screenshot design ───────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card shadow-md animate-fade-in hover:shadow-lg transition-shadow overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[420px]">

        {/* ── LEFT: Table editor ── */}
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-border/50 flex flex-col gap-4">
          {/* Table Title */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Table Title
            </label>
            <Input
              value={table.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Sprint Defect Summary"
              className="h-9 text-sm font-semibold"
            />
          </div>

          {/* Table Data */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Table Data
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddColumn}
                  className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Column
                </button>
                <button
                  onClick={handleAddRow}
                  className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Row
                </button>
              </div>
            </div>

            {/* Spreadsheet table */}
            <div className="border border-border rounded-lg overflow-hidden flex-1">
              <div className="overflow-auto max-h-[280px]">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted/40 border-b border-border">
                      {/* Drag handle column header */}
                      <th className="w-8 border-r border-border p-0" />
                      {/* Column headers */}
                      {table.columns.map((col) => (
                        <th key={col} className="border-r border-border p-0 min-w-[90px] group/col">
                          <div className="flex items-center">
                            <input
                              type="text"
                              defaultValue={col}
                              onBlur={(e) => handleColNameChange(col, e.target.value)}
                              className="w-full bg-transparent px-2 py-2 text-[11px] font-semibold text-foreground focus:outline-none focus:bg-primary/5"
                            />
                            <button
                              onClick={() => handleDeleteColumn(col)}
                              disabled={table.columns.length <= 1}
                              className="opacity-0 group-hover/col:opacity-100 disabled:!opacity-0 text-destructive hover:bg-destructive/10 p-1 shrink-0 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </th>
                      ))}
                      {/* Add column button */}
                      <th className="w-8 p-0">
                        <button
                          onClick={handleAddColumn}
                          className="w-full h-full flex items-center justify-center p-2 text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.data.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-border/50 last:border-0 hover:bg-muted/10 group/row">
                        {/* Row number + drag handle */}
                        <td className="border-r border-border/50 w-8">
                          <div className="flex items-center justify-center gap-0.5 py-1.5">
                            <GripVertical className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover/row:opacity-100" />
                            <span className="text-[10px] text-muted-foreground/60 w-4 text-center">{rIdx + 1}</span>
                          </div>
                        </td>
                        {/* Cells */}
                        {table.columns.map(col => (
                          <td key={col} className="border-r border-border/50 p-0">
                            <input
                              type="text"
                              value={row[col] ?? ""}
                              onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs text-foreground bg-transparent focus:outline-none focus:bg-primary/5 min-w-[80px]"
                              placeholder="—"
                            />
                          </td>
                        ))}
                        {/* Delete row */}
                        <td className="w-8 text-center">
                          <button
                            onClick={() => handleDeleteRow(rIdx)}
                            disabled={table.data.length <= 1}
                            className="p-1 text-muted-foreground/40 hover:text-destructive disabled:opacity-20 opacity-0 group-hover/row:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add Row link */}
            <button
              onClick={handleAddRow}
              className="mt-2 text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 self-start transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Row
            </button>
          </div>
        </div>

        {/* ── RIGHT: Live preview ── */}
        <div className="p-5 flex flex-col gap-4 bg-muted/5">
          {/* Header: Live Preview + stats + delete */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Live Preview
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground">
                Rows: {table.data.length} &nbsp;·&nbsp; Columns: {table.columns.length}
              </span>
              <button
                onClick={onDelete}
                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                title="Delete Table"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Visualization selector */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              Visualization <span className="text-muted-foreground/50 font-normal normal-case">(Optional)</span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant={chartType === "bar" ? "default" : "outline"} className="h-8 text-xs flex-1 gap-1" onClick={() => handleTypeChange("bar")}>
                <BarChart3 className="h-3.5 w-3.5" /> Bar
              </Button>
              <Button size="sm" variant={chartType === "line" ? "default" : "outline"} className="h-8 text-xs flex-1 gap-1" onClick={() => handleTypeChange("line")}>
                <LineIcon className="h-3.5 w-3.5" /> Line
              </Button>
              <Button size="sm" variant={chartType === "pie" ? "default" : "outline"} className="h-8 text-xs flex-1 gap-1" onClick={() => handleTypeChange("pie")}>
                <PieIcon className="h-3.5 w-3.5" /> Pie
              </Button>
            </div>
          </div>

          {/* Chart or Placeholder */}
          <div className="flex-1 border border-border/60 rounded-xl bg-card/50 flex flex-col items-center justify-center min-h-[200px] overflow-hidden">
            {hasData ? (
              <div className="w-full h-full p-2">
                <ReactEChartsCore
                  echarts={echarts}
                  option={option}
                  style={{ height: 200 }}
                  notMerge
                  lazyUpdate
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                {/* Table placeholder icon */}
                <div className="opacity-20">
                  <TableIcon className="h-14 w-14 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground/70">Your table will appear here</p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                    Add data to see a preview or choose a visualization to analyze your table.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer: Save button ── */}
      <div className="border-t border-border px-5 py-3 flex justify-end bg-muted/10">
        <Button onClick={handleSave} className="h-9 px-6 text-sm font-semibold gap-2">
          Save Table
        </Button>
      </div>
    </div>
  );
}
