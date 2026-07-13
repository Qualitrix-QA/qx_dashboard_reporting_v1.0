import { useState } from "react";
import { FileSpreadsheet, CheckSquare, Square, ChevronRight } from "lucide-react";
import type { SheetInfo } from "@/utils/excelParser";
import { detectDatasetType } from "@/utils/datasetDetector";

interface SheetSelectorProps {
  sheets: SheetInfo[];
  onSelect: (sheets: SheetInfo[]) => void;
  onCancel: () => void;
}

export function SheetSelector({ sheets, onSelect, onCancel }: SheetSelectorProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set([0]));

  const toggleSheet = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sheets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sheets.map((_, i) => i)));
    }
  };

  const allSelected = selected.size === sheets.length;
  const noneSelected = selected.size === 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-md rounded-lg border bg-card shadow-2xl animate-fade-in">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Select Sheets to Analyze</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This workbook contains {sheets.length} sheets. Select one or more to analyze together.
          </p>
        </div>

        {/* Select All */}
        <div className="border-b px-5 py-2.5">
          <button onClick={toggleAll} className="flex items-center gap-2.5 text-sm font-medium text-foreground hover:text-primary transition-colors w-full">
            {allSelected ? (
              <CheckSquare className="h-4.5 w-4.5 text-primary" />
            ) : (
              <Square className="h-4.5 w-4.5 text-muted-foreground" />
            )}
            Select All ({sheets.length} sheets)
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-3 py-3 space-y-1.5">
          {sheets.map((sheet, i) => {
            const isSelected = selected.has(i);
            return (
              <button
                key={sheet.name}
                onClick={() => toggleSheet(i)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${
                  isSelected
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted border border-transparent"
                }`}
              >
                {isSelected ? (
                  <CheckSquare className="h-4.5 w-4.5 shrink-0 text-primary" />
                ) : (
                  <Square className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                )}
                <FileSpreadsheet className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {sheet.name}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{sheet.rowCount} rows · {sheet.headers.length} columns</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <span className="font-semibold text-primary/95 text-[10px] tracking-wide uppercase">
                      {(() => {
                        const detection = detectDatasetType(sheet.headers, sheet.sampleRows);
                        const typeLabels: Record<string, string> = {
                          bug_report: "Bug Report",
                          test_execution: "Test Execution",
                          test_case: "Test Case",
                          requirement_task: "Requirement/Task",
                          generic: "Generic",
                        };
                        return typeLabels[detection.type];
                      })()}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {sheet.headers.slice(0, 5).join(", ")}{sheet.headers.length > 5 ? "…" : ""}
                  </p>
                </div>
                {isSelected && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {selected.size} of {sheets.length} selected
          </span>
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded-md border px-4 py-2 text-sm text-foreground hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={() => {
                const selectedSheets = Array.from(selected).sort().map(i => sheets[i]);
                if (selectedSheets.length > 0) onSelect(selectedSheets);
              }}
              disabled={noneSelected}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Analyze {selected.size > 1 ? `${selected.size} Sheets` : "Sheet"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
