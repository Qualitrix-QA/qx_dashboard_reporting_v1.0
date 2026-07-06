import { useState } from "react";
import { Edit3, Trash2, X, Plus } from "lucide-react";
import type { CustomTableDef } from "@/utils/dashboardMapper";
import { Button } from "@/components/ui/button";

interface Props {
  table: CustomTableDef;
  isEditable: boolean;
  onUpdate: (table: CustomTableDef) => void;
  onDelete: () => void;
}

export function CustomTableCard({ table, isEditable, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...table, title: e.target.value });
  };

  const handleAddColumn = () => {
    const newCol = `Column ${table.columns.length + 1}`;
    const newColumns = [...table.columns, newCol];
    const newData = table.data.map(row => ({ ...row, [newCol]: "" }));
    onUpdate({ ...table, columns: newColumns, data: newData });
  };

  const handleAddRow = () => {
    const newRow: Record<string, string> = {};
    table.columns.forEach(col => { newRow[col] = ""; });
    onUpdate({ ...table, data: [...table.data, newRow] });
  };

  const handleCellChange = (rowIndex: number, col: string, value: string) => {
    const newData = [...table.data];
    newData[rowIndex] = { ...newData[rowIndex], [col]: value };
    onUpdate({ ...table, data: newData });
  };

  const handleColNameChange = (oldCol: string, newCol: string) => {
    if (!newCol || newCol === oldCol || table.columns.includes(newCol)) return;
    const newColumns = table.columns.map(c => c === oldCol ? newCol : c);
    const newData = table.data.map(row => {
      const newRow = { ...row };
      newRow[newCol] = newRow[oldCol];
      delete newRow[oldCol];
      return newRow;
    });
    onUpdate({ ...table, columns: newColumns, data: newData });
  };

  const handleDeleteRow = (rowIndex: number) => {
    const newData = table.data.filter((_, i) => i !== rowIndex);
    onUpdate({ ...table, data: newData });
  };

  const handleDeleteColumn = (col: string) => {
    const newColumns = table.columns.filter(c => c !== col);
    const newData = table.data.map(row => {
      const newRow = { ...row };
      delete newRow[col];
      return newRow;
    });
    onUpdate({ ...table, columns: newColumns, data: newData });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
      {isEditable && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1.5">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
              isEditing
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Edit3 className="h-3 w-3" /> {isEditing ? "Done" : "Edit Table"}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 bg-muted/90 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shadow transition-all"
            title="Delete Table"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {isEditing ? (
        <input
          type="text"
          value={table.title}
          onChange={handleTitleChange}
          className="mb-4 bg-transparent border-0 border-b border-border/40 text-sm font-semibold focus:ring-0 p-0 text-foreground w-full"
        />
      ) : (
        <h3 className="mb-4 text-sm font-semibold text-foreground">{table.title}</h3>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {table.columns.map(col => (
                <th key={col} className="p-2.5 font-semibold text-muted-foreground relative group/col min-w-[100px]">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        defaultValue={col}
                        onBlur={(e) => handleColNameChange(col, e.target.value)}
                        className="bg-transparent border border-border/50 rounded font-semibold focus:ring-0 p-1 text-xs text-foreground w-full"
                      />
                      <button onClick={() => handleDeleteColumn(col)} className="text-destructive hover:text-destructive/80 opacity-0 group-hover/col:opacity-100 p-1"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    col
                  )}
                </th>
              ))}
              {isEditing && (
                <th className="p-2.5 w-8">
                  <button onClick={handleAddColumn} className="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10"><Plus className="h-4 w-4" /></button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {table.data.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-border/50 hover:bg-muted/10 group/row">
                {table.columns.map(col => (
                  <td key={col} className="p-2.5 text-foreground">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row[col] || ""}
                        onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                        className="w-full bg-transparent border border-border/50 rounded focus:ring-0 p-1 text-xs text-foreground"
                      />
                    ) : (
                      row[col]
                    )}
                  </td>
                ))}
                {isEditing && (
                  <td className="p-2.5 w-8">
                    <button onClick={() => handleDeleteRow(rIdx)} className="text-destructive hover:text-destructive/80 opacity-0 group-hover/row:opacity-100 p-1 rounded hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </td>
                )}
              </tr>
            ))}
            {isEditing && (
              <tr>
                <td colSpan={table.columns.length + 1} className="p-2.5 text-center">
                  <Button onClick={handleAddRow} variant="ghost" size="sm" className="h-6 text-xs gap-1 w-full border border-dashed border-border"><Plus className="h-3 w-3" /> Add Row</Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
