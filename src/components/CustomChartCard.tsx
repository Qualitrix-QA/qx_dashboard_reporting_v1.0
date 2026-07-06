import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Trash2, Plus, X, BarChart3, LineChart as LineIcon, PieChart as PieIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CustomChartDef } from "@/utils/dashboardMapper";

echarts.use([BarChart, LineChart, PieChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface CustomChartCardProps {
  chart: CustomChartDef;
  isEditable: boolean;
  theme?: "light" | "dark";
  onUpdate: (updated: CustomChartDef) => void;
  onDelete: () => void;
}

const CHART_COLORS = [
  "#0ea5e9", // Sky Blue
  "#8b5cf6", // Purple
  "#f97316", // Orange
  "#22c55e", // Green
  "#eab308", // Yellow
  "#ef4444", // Red
  "#ec4899", // Pink
  "#3b82f6", // Blue
];

export function CustomChartCard({ chart, isEditable, theme, onUpdate, onDelete }: CustomChartCardProps) {
  const isDark = theme !== "light";
  const colors = useMemo(() => ({
    text: isDark ? "#e2e8f0" : "#334155",
    subText: isDark ? "#94a3b8" : "#475569",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
  }), [isDark]);

  const total = useMemo(() => {
    return chart.data.reduce((s, v) => s + (Number(v.value) || 0), 0);
  }, [chart.data]);

  const option: echarts.EChartsCoreOption = useMemo(() => {
    const categories = chart.data.map(d => d.name || "Category");
    const values = chart.data.map(d => d.value);

    if (chart.type === "pie") {
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
        series: [
          {
            type: "pie",
            radius: ["38%", "68%"],
            center: ["50%", "50%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: isDark ? "#1e293b" : "#ffffff",
              borderWidth: 2,
            },
            label: {
              show: true,
              formatter: "{b}\n{c} ({d}%)",
              fontSize: 10,
              color: colors.subText,
            },
            data: chart.data.map(d => ({ name: d.name || "Category", value: d.value })),
          },
        ],
      };
    }

    if (chart.type === "line") {
      return {
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(15,15,20,0.95)",
          borderColor: "rgba(255,255,255,0.15)",
          textStyle: { color: "#e2e8f0", fontSize: 12 },
        },
        grid: { left: 45, right: 16, top: 20, bottom: 40 },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: categories,
          axisLabel: { fontSize: 10, color: colors.subText },
          axisLine: { lineStyle: { color: colors.line } },
        },
        yAxis: {
          type: "value",
          axisLabel: { fontSize: 10, color: colors.subText },
          splitLine: { lineStyle: { color: colors.grid, type: "dashed" } },
        },
        series: [
          {
            data: values,
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: { color: "#0ea5e9" },
            lineStyle: { color: "#0ea5e9", width: 3 },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(14,165,233,0.3)" },
                { offset: 1, color: "rgba(14,165,233,0.0)" },
              ]),
            },
          },
        ],
      };
    }

    // Default: Bar
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
      },
      grid: { left: 45, right: 16, top: 20, bottom: 40 },
      xAxis: {
        type: "category",
        data: categories,
        axisLabel: { fontSize: 10, color: colors.subText },
        axisLine: { lineStyle: { color: colors.line } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } },
      },
      series: [
        {
          type: "bar",
          data: values.map((val, i) => ({
            value: val,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: CHART_COLORS[i % CHART_COLORS.length] },
                { offset: 1, color: CHART_COLORS[i % CHART_COLORS.length] + "88" },
              ]),
              borderRadius: [4, 4, 0, 0],
            },
          })),
          label: {
            show: true,
            position: "top",
            fontSize: 10,
            color: colors.text,
            fontWeight: "bold",
          },
          barMaxWidth: 30,
        },
      ],
    };
  }, [chart.type, chart.data, colors, total, isDark]);

  const handleTitleChange = (val: string) => {
    onUpdate({ ...chart, title: val });
  };

  const handleTypeChange = (type: "bar" | "line" | "pie") => {
    onUpdate({ ...chart, type });
  };

  const handleDataChange = (index: number, field: "name" | "value", val: string) => {
    const newData = [...chart.data];
    if (field === "name") {
      newData[index] = { ...newData[index], name: val };
    } else {
      newData[index] = { ...newData[index], value: Math.max(0, Number(val) || 0) };
    }
    onUpdate({ ...chart, data: newData });
  };

  const handleAddRow = () => {
    const newData = [...chart.data, { name: `Category ${chart.data.length + 1}`, value: 10 }];
    onUpdate({ ...chart, data: newData });
  };

  const handleRemoveRow = (index: number) => {
    const newData = chart.data.filter((_, i) => i !== index);
    onUpdate({ ...chart, data: newData });
  };

  if (!isEditable) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm relative group animate-fade-in" data-chart-card>
        <h3 className="text-sm font-semibold text-foreground mb-1">{chart.title || "Custom Chart"}</h3>
        <p className="text-[11px] text-muted-foreground mb-3">{chart.data.length} categories · {total} total</p>
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

  const handleSave = () => {
    toast.success("Chart saved!", { description: `"${chart.title}" has been saved successfully.` });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-md animate-fade-in hover:shadow-lg transition-shadow overflow-hidden">
      <div className="p-5 relative">
        {/* Absolute delete button for entire chart card */}
        <button
          onClick={onDelete}
          className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg border border-border shadow-sm bg-background/50 hover:bg-background transition-all z-10"
          title="Delete Custom Chart"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Left column: Controls */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Chart Title</label>
              <Input
                value={chart.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Incident RCA Breakdown"
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Chart Type</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={chart.type === "bar" ? "default" : "outline"}
                  className="h-8 text-xs flex-1 gap-1"
                  onClick={() => handleTypeChange("bar")}
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Bar
                </Button>
                <Button
                  size="sm"
                  variant={chart.type === "line" ? "default" : "outline"}
                  className="h-8 text-xs flex-1 gap-1"
                  onClick={() => handleTypeChange("line")}
                >
                  <LineIcon className="h-3.5 w-3.5" /> Line
                </Button>
                <Button
                  size="sm"
                  variant={chart.type === "pie" ? "default" : "outline"}
                  className="h-8 text-xs flex-1 gap-1"
                  onClick={() => handleTypeChange("pie")}
                >
                  <PieIcon className="h-3.5 w-3.5" /> Pie
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Data Entries</label>
                <button
                  onClick={handleAddRow}
                  className="text-[10px] font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" /> Add Category
                </button>
              </div>

              <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2 border rounded-md p-2 bg-muted/20">
                {chart.data.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={row.name}
                      onChange={(e) => handleDataChange(idx, "name", e.target.value)}
                      placeholder="Category Name"
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      value={row.value}
                      onChange={(e) => handleDataChange(idx, "value", e.target.value)}
                      placeholder="Value"
                      className="h-7 text-xs w-20 text-right"
                    />
                    <button
                      onClick={() => handleRemoveRow(idx)}
                      disabled={chart.data.length <= 1}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-30 rounded transition-all"
                      title="Remove Data Point"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: live preview chart */}
          <div className="border border-border/80 rounded-xl bg-card/50 p-3 flex flex-col justify-between h-full min-h-[280px]">
            <div className="flex justify-between items-center px-1 border-b border-border/40 pb-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live Preview
              </span>
              <span className="text-[10px] text-muted-foreground">Total: {total}</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full">
                <ReactEChartsCore
                  echarts={echarts}
                  option={option}
                  style={{ height: 220 }}
                  notMerge
                  lazyUpdate
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Save Chart button */}
      <div className="border-t border-border px-5 py-3 flex justify-end bg-muted/10">
        <Button onClick={handleSave} className="h-9 px-6 text-sm font-semibold gap-2">
          Save Chart
        </Button>
      </div>
    </div>
  );
}
