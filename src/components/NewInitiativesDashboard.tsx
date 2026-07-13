import React, { useState, useEffect } from "react";
import { Plus, Trash2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface InitiativeItem {
  id: string;
  title: string;
  owner: string;
  target: string;
  status: "Planning" | "In Progress" | "On Hold" | "Completed";
  description: string;
}

export const defaultInitiatives: InitiativeItem[] = [
  {
    id: "init-1",
    title: "Initiative 1: [Title]",
    owner: "Owner",
    target: "DD/MM/YYYY",
    status: "In Progress",
    description: "Brief description of the initiative, its objectives and expected outcomes. Add key milestones or dependencies here."
  },
  {
    id: "init-2",
    title: "Initiative 2: [Title]",
    owner: "Owner",
    target: "DD/MM/YYYY",
    status: "Planning",
    description: "Brief description of the initiative, its objectives and expected outcomes. Add key milestones or dependencies here."
  },
  {
    id: "init-3",
    title: "Initiative 3: [Title]",
    owner: "Owner",
    target: "DD/MM/YYYY",
    status: "On Hold",
    description: "Brief description of the initiative, its objectives and expected outcomes. Add key milestones or dependencies here."
  },
  {
    id: "init-4",
    title: "Initiative 4: [Title]",
    owner: "Owner",
    target: "DD/MM/YYYY",
    status: "Completed",
    description: "Brief description of the initiative, its objectives and expected outcomes. Add key milestones or dependencies here."
  }
];

interface Props {
  onDelete?: () => void;
  isEditable?: boolean;
  data: InitiativeItem[];
  onUpdateData: (data: InitiativeItem[]) => void;
}

export function NewInitiativesDashboard({ onDelete, isEditable = false, data: initiatives = defaultInitiatives, onUpdateData }: Props) {
  const updateInitiative = (id: string, field: keyof InitiativeItem, value: string) => {
    onUpdateData(
      initiatives.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addInitiative = () => {
    const newId = `init-${Date.now()}`;
    const newItem: InitiativeItem = {
      id: newId,
      title: `Initiative ${initiatives.length + 1}: [Title]`,
      owner: "Owner",
      target: "DD/MM/YYYY",
      status: "Planning",
      description: "Brief description of the initiative, its objectives and expected outcomes."
    };
    onUpdateData([...initiatives, newItem]);
  };

  const deleteInitiative = (id: string) => {
    onUpdateData(initiatives.filter((item) => item.id !== id));
  };

  const resetToDefault = () => {
    if (window.confirm("Are you sure you want to reset all initiatives to placeholders?")) {
      onUpdateData(defaultInitiatives);
    }
  };

  const getStatusBadgeStyles = (status: InitiativeItem["status"]) => {
    switch (status) {
      case "Planning":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800";
      case "In Progress":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800";
      case "On Hold":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
      case "Completed":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800";
    }
  };

  const getCardBorderColor = (status: InitiativeItem["status"]) => {
    switch (status) {
      case "Planning":
        return "border-l-8 border-l-blue-500";
      case "In Progress":
        return "border-l-8 border-l-cyan-500";
      case "On Hold":
        return "border-l-8 border-l-amber-500";
      case "Completed":
        return "border-l-8 border-l-green-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 rounded-lg text-[#3b82f6]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">New Initiatives</h2>
              {isEditable && (
                <button
                  onClick={resetToDefault}
                  className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-[#3b82f6] rounded border border-blue-500/20 hover:bg-blue-500/20 transition-all font-semibold"
                  title="Reset initiatives to placeholders"
                >
                  Reset to Placeholders
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Upcoming projects, process improvements and strategic QA investments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <Button onClick={addInitiative} size="sm" className="gap-1.5 shadow-sm h-8 text-xs">
              <Plus className="h-4 w-4" /> Add Initiative
            </Button>
          )}
          {onDelete && isEditable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
              title="Delete this slide"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Grid Layout of Initiatives */}
      {initiatives.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
          <h3 className="font-semibold text-foreground">No Initiatives</h3>
          <p className="text-sm text-muted-foreground mt-1">Click the "Add Initiative" button to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {initiatives.map((init) => (
            <div
              key={init.id}
              className={`group relative rounded-2xl border border-border bg-card p-6 shadow-lg transition-all hover:shadow-xl ${getCardBorderColor(init.status)}`}
            >
              {/* Header Title & Status Badge */}
              <div className="flex items-start justify-between gap-4 mb-3">
                {isEditable ? (
                  <input
                    value={init.title}
                    onChange={(e) => updateInitiative(init.id, "title", e.target.value)}
                    className="h-7 text-base font-bold bg-transparent border-0 w-full shadow-none font-sans p-0 rounded-none focus:ring-0 focus:outline-none border-b border-transparent hover:border-border/50 focus:border-primary cursor-text"
                    placeholder="Initiative Title"
                  />
                ) : (
                  <span className="h-7 text-base font-bold select-all block truncate">
                    {init.title}
                  </span>
                )}
                
                {isEditable ? (
                  <Select
                    value={init.status}
                    onValueChange={(val: InitiativeItem["status"]) => updateInitiative(init.id, "status", val)}
                  >
                    <SelectTrigger className={`h-7 w-28 text-xs font-semibold px-2 py-0.5 rounded-full border shadow-none shrink-0 ${getStatusBadgeStyles(init.status)}`}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planning">Planning</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className={`h-7 w-28 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 text-center flex items-center justify-center ${getStatusBadgeStyles(init.status)}`}>
                    {init.status}
                  </div>
                )}
              </div>

              {/* Owner and Target details */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-4">
                <span className="font-medium text-muted-foreground/75">Owner:</span>
                {isEditable ? (
                  <input
                    value={init.owner}
                    onChange={(e) => updateInitiative(init.id, "owner", e.target.value)}
                    className="h-5 w-24 bg-transparent border-0 p-0 text-xs rounded-none shadow-none focus:ring-0 focus:outline-none border-b border-transparent hover:border-border/50 focus:border-primary cursor-text"
                    placeholder="Owner"
                  />
                ) : (
                  <span className="h-5 w-24 text-xs font-semibold text-foreground select-all inline-block truncate">
                    {init.owner}
                  </span>
                )}
                <span className="text-muted-foreground/30 px-0.5">|</span>
                <span className="font-medium text-muted-foreground/75">Target:</span>
                {isEditable ? (
                  <input
                    value={init.target}
                    onChange={(e) => updateInitiative(init.id, "target", e.target.value)}
                    className="h-5 w-28 bg-transparent border-0 p-0 text-xs rounded-none shadow-none focus:ring-0 focus:outline-none border-b border-transparent hover:border-border/50 focus:border-primary cursor-text"
                    placeholder="Target Date"
                  />
                ) : (
                  <span className="h-5 w-28 text-xs font-semibold text-foreground select-all inline-block truncate">
                    {init.target}
                  </span>
                )}
              </div>

              <Separator className="my-3 opacity-60" />

              {/* Description body */}
              {isEditable ? (
                <Textarea
                  value={init.description}
                  onChange={(e) => updateInitiative(init.id, "description", e.target.value)}
                  className="bg-transparent border-0 px-2 py-1.5 text-sm resize-none rounded-md min-h-[90px] w-full shadow-none text-muted-foreground focus:ring-0 focus:outline-none hover:bg-muted/10 hover:border hover:border-border/50 focus:bg-transparent focus:border-primary cursor-text"
                  placeholder="Brief description of the initiative, its objectives and expected outcomes. Add key milestones or dependencies here."
                />
              ) : (
                <div className="text-sm text-muted-foreground min-h-[90px] whitespace-pre-wrap select-all break-words py-1.5">
                  {init.description}
                </div>
              )}

              {/* Hover Delete Action */}
              {isEditable && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteInitiative(init.id)}
                  className="absolute bottom-4 right-4 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
