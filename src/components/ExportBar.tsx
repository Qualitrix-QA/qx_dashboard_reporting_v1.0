import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { exportCSV, exportPDF, exportLandscapePDF } from "@/utils/exportUtils";
import type { RawRow, DataAnalysis, DynamicAggregations, AISchema } from "@/types/bug";

interface ExportBarProps {
  bugs: RawRow[];
  fileName: string;
  analysis: DataAnalysis;
  agg: DynamicAggregations;
  visibleKPIs?: Set<number>;
  aiInsights?: string | null;
  aiSchema?: AISchema | null;
  activeTab: string;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  globalEditMode: boolean;
  setGlobalEditMode: (val: boolean) => void;
}

export function ExportBar({
  bugs,
  fileName,
  analysis,
  agg,
  visibleKPIs,
  aiInsights,
  aiSchema,
  activeTab,
  theme,
  setTheme,
  globalEditMode,
  setGlobalEditMode,
}: ExportBarProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [landscapePdfLoading, setLandscapePdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const baseName = fileName
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .trim() || "export";

  const handleCSV = () => {
    exportCSV(bugs, `${baseName}-export.csv`);
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    setPdfError("");

    const originalTheme = theme;
    const wasDark = originalTheme === "dark";
    const originalEditMode = globalEditMode;

    if (wasDark) {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
    if (originalEditMode) {
      setGlobalEditMode(false);
    }

    // Wait for React update and ECharts to re-render under light theme
    await new Promise((r) => setTimeout(r, 600));

    try {
      await exportPDF(`${baseName}-report.pdf`, {
        analysis,
        agg,
        rows: bugs,
        visibleKPIs,
        dataFileName: fileName,
        aiInsights,
        aiSchema,
      });
    } catch (e) {
      console.error("PDF export failed:", e);
      setPdfError("PDF failed. Try again.");
    } finally {
      // Restore initial state
      if (wasDark) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      }
      if (originalEditMode) {
        setGlobalEditMode(true);
      }
      setPdfLoading(false);
    }
  };

  const handleLandscapePDF = async () => {
    setLandscapePdfLoading(true);
    setPdfError("");

    const originalTheme = theme;
    const wasDark = originalTheme === "dark";
    const originalEditMode = globalEditMode;

    if (wasDark) {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
    if (originalEditMode) {
      setGlobalEditMode(false);
    }

    // Wait for React update and ECharts to re-render under light theme
    await new Promise((r) => setTimeout(r, 600));

    try {
      const suffixMap: Record<string, string> = {
        project_level: "project-level",
        report_explorer: "report-explorer",
        specialized_qa: "specialized-qa-dashboards",
      };
      const suffix = suffixMap[activeTab] || activeTab;
      await exportLandscapePDF(activeTab, `${baseName}-${suffix}-landscape.pdf`);
    } catch (e) {
      console.error("Landscape PDF export failed:", e);
      setPdfError("Landscape PDF failed. Try again.");
    } finally {
      // Restore initial state
      if (wasDark) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      }
      if (originalEditMode) {
        setGlobalEditMode(true);
      }
      setLandscapePdfLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {pdfError && (
        <span className="text-xs text-destructive">{pdfError}</span>
      )}
      <button
        onClick={handleCSV}
        className="flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        title="Export as CSV"
      >
        <Download className="h-3.5 w-3.5" />
        CSV
      </button>
      <button
        onClick={handlePDF}
        disabled={pdfLoading}
        className="flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
        title="Export as PDF report"
      >
        {pdfLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5" />
            PDF (Portrait)
          </>
        )}
      </button>
      <button
        onClick={handleLandscapePDF}
        disabled={landscapePdfLoading}
        className="flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
        title="Export current dashboard exactly as seen in landscape mode"
      >
        {landscapePdfLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating Landscape…
          </>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5" />
            PDF (Landscape)
          </>
        )}
      </button>
    </div>
  );
}