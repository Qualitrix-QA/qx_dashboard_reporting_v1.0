import { useMemo } from "react";
import { Sparkles, FileSpreadsheet, ShieldAlert, AlertCircle, RefreshCw } from "lucide-react";
import { type GeneratedReport } from "@/utils/reportGenerators";
import { HBarChart } from "@/components/charts/HBarChart";
import { VBarChart } from "@/components/charts/VBarChart";
import { SeverityPieChart } from "@/components/charts/SeverityPieChart";

interface Props {
  report: GeneratedReport;
  theme?: "light" | "dark";
  onNavigateToExplorer?: () => void;
}

const COLOR_MAP: Record<string, string> = {
  red: "border-t-[#ef4444] text-[#ef4444]",
  orange: "border-t-[#f97316] text-[#f97316]",
  yellow: "border-t-[#eab308] text-[#eab308]",
  green: "border-t-[#22c55e] text-[#22c55e]",
  blue: "border-t-[#3b82f6] text-[#3b82f6]",
  purple: "border-t-[#a855f7] text-[#a855f7]",
  gray: "border-t-[#64748b] text-[#64748b]",
};

export function GeneratedReportView({ report, theme, onNavigateToExplorer }: Props) {
  const isDark = theme !== "light";

  const confidenceBadgeColor = useMemo(() => {
    if (report.confidence >= 75) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (report.confidence >= 40) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }, [report.confidence]);

  const typeLabels: Record<string, string> = {
    bug_report: "Bug / Defect Report",
    test_execution: "Test Execution Report",
    test_case: "Test Case Sheet",
    requirement_task: "Requirement / Task Sheet",
    generic: "Generic Sheet",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Premium Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${confidenceBadgeColor}`}>
                {typeLabels[report.datasetType]} ({report.confidence}% Conf.)
              </span>
              {report.datasetType !== "generic" && (
                <span className="inline-flex items-center gap-1 text-[10px] text-primary/80 font-bold uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 animate-pulse" /> Auto-Generated Smart Report
                </span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{report.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{report.summary}</p>
          </div>

          {onNavigateToExplorer && (
            <button
              onClick={onNavigateToExplorer}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.01] active:scale-[0.99] self-start md:self-auto border border-primary/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Analyze in Report Explorer
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      {report.kpis.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {report.kpis.map((kpi) => {
            const colorClass = COLOR_MAP[kpi.color || "gray"] || "border-t-primary";
            return (
              <div
                key={kpi.id}
                className={`rounded-xl border border-border bg-card p-5 text-center shadow-sm border-t-4 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md relative ${colorClass}`}
              >
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate" title={kpi.label}>
                  {kpi.label}
                </p>
                <div className="mt-2 text-3xl font-extrabold tracking-tight">
                  {kpi.value.toLocaleString()}
                </div>
                {kpi.sub && (
                  <p className="mt-1 text-[10px] text-muted-foreground truncate" title={kpi.sub}>
                    {kpi.sub}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charts Grid */}
      {report.charts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {report.charts.map((chart) => {
            if (!chart.counts || Object.keys(chart.counts).length === 0) return null;
            if (chart.type === "pie") {
              return (
                <div key={chart.id} className="relative group">
                  <SeverityPieChart data={chart.counts} title={chart.title} theme={theme} />
                </div>
              );
            }
            if (chart.type === "hbar") {
              return (
                <div key={chart.id} className="relative group">
                  <HBarChart data={chart.counts} title={chart.title} theme={theme} />
                </div>
              );
            }
            return (
              <div key={chart.id} className="relative group">
                <VBarChart data={chart.counts} title={chart.title} theme={theme} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center bg-card/40">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No visual charts generated for this generic metadata.</p>
        </div>
      )}

      {/* Data Quality & Health Check Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Missing Values Assessment */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-4.5 w-4.5 text-warning" />
            Field Completeness & Quality check
          </h3>
          {report.missingValueCols.length > 0 ? (
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {report.missingValueCols.slice(0, 5).map((item) => (
                <div key={item.col} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground/90">{item.col}</span>
                    <span className="text-muted-foreground">
                      {item.missingCount} missing ({item.missingPercentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warning transition-all"
                      style={{ width: `${item.missingPercentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {report.missingValueCols.length > 5 && (
                <p className="text-[10px] text-muted-foreground italic">
                  + {report.missingValueCols.length - 5} more columns with missing entries
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border/60 rounded-lg bg-muted/5">
              <span className="text-xs text-green-500 font-bold mb-1">✓ 100% Completeness</span>
              <p className="text-[11px] text-muted-foreground">All rows contain valid data for every column header!</p>
            </div>
          )}
        </div>

        {/* Duplicate detection */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <AlertCircle className="h-4.5 w-4.5 text-primary" />
              Duplicate Row Analysis
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We scanned all columns (excluding source worksheet metadata) to identify repeating rows that might distort statistics.
            </p>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-muted/5 border border-border/40 flex items-center justify-between">
            <div>
              <div className="text-2xl font-extrabold text-foreground">{report.duplicateCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Duplicate Rows Identified</div>
            </div>
            {report.duplicateCount > 0 ? (
              <span className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 rounded-full font-bold">
                Action Recommended
              </span>
            ) : (
              <span className="text-xs bg-green-500/10 text-green-500 border border-green-500/20 px-2.5 py-1 rounded-full font-bold">
                Data Clean
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sample Records Table */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground">Sample Records (Top 10 Rows)</h3>
        <div className="overflow-x-auto border border-border/40 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                {report.tableHeaders.slice(0, 8).map((hdr) => (
                  <th key={hdr} className="p-3 font-semibold text-muted-foreground select-none">
                    {hdr}
                  </th>
                ))}
                {report.tableHeaders.length > 8 && (
                  <th className="p-3 font-semibold text-muted-foreground select-none">
                    +{report.tableHeaders.length - 8} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {report.sampleRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/10 transition-colors">
                  {report.tableHeaders.slice(0, 8).map((hdr) => (
                    <td key={hdr} className="p-3 font-medium text-foreground/90 truncate max-w-[180px]" title={row[hdr]}>
                      {row[hdr] || "—"}
                    </td>
                  ))}
                  {report.tableHeaders.length > 8 && (
                    <td className="p-3 text-muted-foreground italic">…</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
