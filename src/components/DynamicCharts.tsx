import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { SeverityPieChart } from "@/components/charts/SeverityPieChart";
import { HBarChart } from "@/components/charts/HBarChart";
import { VBarChart } from "@/components/charts/VBarChart";
import { DynamicHeatmap } from "@/components/charts/DynamicHeatmap";
import { DynamicStackedBar } from "@/components/charts/DynamicStackedBar";
import { DynamicLineChart } from "@/components/charts/DynamicLineChart";
import type { RawRow, DataAnalysis, DynamicAggregations, AISchema, AISchemaChart } from "@/types/bug";
import { generateFallbackSchema, detectDataTypeHeuristic } from "@/utils/aiSchema";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

interface Props {
  rows: RawRow[];
  analysis: DataAnalysis;
  agg: DynamicAggregations;
  aiSchema?: AISchema | null;
  theme?: "light" | "dark";
}

export function DynamicCharts({ rows, analysis, agg, aiSchema, theme }: Props) {
  // Use AI schema charts or fallback schema charts
  const charts = useMemo(() => {
    if (aiSchema?.charts && aiSchema.charts.length > 0) {
      return aiSchema.charts.sort((a, b) => b.priority - a.priority).slice(0, 10);
    }
    const dt = detectDataTypeHeuristic(analysis);
    const fallback = generateFallbackSchema(analysis, agg, dt);
    return fallback.charts.sort((a, b) => b.priority - a.priority).slice(0, 10);
  }, [aiSchema, analysis, agg]);

  const renderChart = (chart: AISchemaChart, index: number) => {
    const colName = chart.columns[0];

    switch (chart.type) {
      case "pie": {
        const counts = agg.columnCounts[colName];
        if (!counts || Object.keys(counts).length === 0) return null;
        return (
          <div key={chart.id || index} data-chart-card>
            <SeverityPieChart data={counts} title={chart.title} theme={theme} />
          </div>
        );
      }
      case "vbar": {
        const counts = agg.columnCounts[colName];
        if (!counts || Object.keys(counts).length === 0) return null;
        return (
          <div key={chart.id || index} data-chart-card>
            <VBarChart data={counts} title={chart.title} color={CHART_COLORS[index % CHART_COLORS.length]} theme={theme} />
          </div>
        );
      }
      case "hbar": {
        const counts = agg.columnCounts[colName];
        if (!counts || Object.keys(counts).length === 0) return null;
        return (
          <div key={chart.id || index} data-chart-card>
            <HBarChart data={counts} title={chart.title} color={CHART_COLORS[index % CHART_COLORS.length]} theme={theme} />
          </div>
        );
      }
      case "line":
        return (
          <div key={chart.id || index} className="col-span-full md:col-span-2 lg:col-span-3" data-chart-card>
            <DynamicLineChart rows={rows} colName={chart.columns[0]} title={chart.title} theme={theme} />
          </div>
        );
      case "heatmap":
        if (chart.columns.length >= 2) {
          return (
            <div key={chart.id || index} data-chart-card>
              <DynamicHeatmap rows={rows} col1={chart.columns[0]} col2={chart.columns[1]} title={chart.title} theme={theme} />
            </div>
          );
        }
        return null;
      case "stacked_bar":
        if (chart.columns.length >= 2) {
          return (
            <div key={chart.id || index} data-chart-card>
              <DynamicStackedBar rows={rows} groupCol={chart.columns[0]} stackCol={chart.columns[1]} title={chart.title} theme={theme} />
            </div>
          );
        }
        return null;
      default:
        return null;
    }
  };

  const simpleCharts = charts.filter(c => c.type !== "heatmap" && c.type !== "stacked_bar" && c.type !== "line");
  const crossCharts = charts.filter(c => c.type === "heatmap" || c.type === "stacked_bar");
  const fullWidthCharts = charts.filter(c => c.type === "line");

  if (charts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center animate-fade-in">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No charts could be generated</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs mx-auto">
          Charts appear when your data has categorical columns (e.g. Status, Severity, Platform) with at least 2 distinct values.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {simpleCharts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {simpleCharts.map((chart, i) => renderChart(chart, i))}
        </div>
      )}
      {crossCharts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {crossCharts.map((chart, i) => renderChart(chart, i + simpleCharts.length))}
        </div>
      )}
      {fullWidthCharts.length > 0 && (
        <div className="grid gap-4">
          {fullWidthCharts.map((chart, i) => renderChart(chart, i + simpleCharts.length + crossCharts.length))}
        </div>
      )}
    </div>
  );
}