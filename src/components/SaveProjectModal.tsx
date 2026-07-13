import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, FolderPlus } from "lucide-react";

export interface SaveProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "save" = overwrite existing (pre-fills name), "save-as" = always creates new */
  mode: "save" | "save-as";
  initialName?: string;
  initialDescription?: string;
  isSaving?: boolean;
  onConfirm: (name: string, description: string) => void;
}

export function SaveProjectModal({
  open,
  onOpenChange,
  mode,
  initialName = "",
  initialDescription = "",
  isSaving = false,
  onConfirm,
}: SaveProjectModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);

  // Sync external initial values when modal opens
  useEffect(() => {
    if (open) {
      setName(mode === "save-as" ? "" : initialName);
      setDescription(mode === "save-as" ? "" : initialDescription);
      setError(null);
    }
  }, [open, mode, initialName, initialDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a project name.");
      return;
    }
    setError(null);
    onConfirm(name.trim(), description.trim());
  };

  const isSaveAs = mode === "save-as";
  const Icon = isSaveAs ? FolderPlus : Save;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              {isSaveAs ? "Save As New Project" : "Save Project"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pl-0.5">
            {isSaveAs
              ? "Create a copy of the current project under a new name."
              : "Save the current dashboard state to your account."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive animate-fade-in">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="project-name"
              className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
            >
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-name"
              type="text"
              placeholder="e.g. Q3 QA Report — Portal"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              className="h-10 text-sm focus-visible:ring-primary"
              disabled={isSaving}
              autoFocus
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="project-description"
              className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
            >
              Description{" "}
              <span className="font-normal normal-case text-muted-foreground/70">
                (optional)
              </span>
            </Label>
            <Input
              id="project-description"
              type="text"
              placeholder="Brief note about this project…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-10 text-sm focus-visible:ring-primary"
              disabled={isSaving}
              maxLength={300}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 font-bold shadow-md"
              disabled={isSaving || !name.trim()}
            >
              <Icon className="h-3.5 w-3.5" />
              {isSaving ? "Saving…" : isSaveAs ? "Save As" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
