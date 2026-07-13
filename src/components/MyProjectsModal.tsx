import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FolderOpen,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  FolderSearch,
  Clock,
  Share2,
} from "lucide-react";
import {
  listUserProjects,
  loadProject,
  renameProject,
  deleteProject,
  getUserSharedProjects,
  markProjectNotificationsAsRead,
  getOrCreateRecipientCopy,
  type ProjectMetadata,
} from "@/firebase/projectService";
import { useProject } from "@/context/ProjectContext";
import { ShareProjectModal } from "@/components/ShareProjectModal";

interface MyProjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function MyProjectsModal({ open, onOpenChange, uid }: MyProjectsModalProps) {
  const {
    isDirty,
    deserializeProject,
    setCurrentProject,
    currentProjectId,
  } = useProject();

  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [sharedProjects, setSharedProjects] = useState<ProjectMetadata[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);
  const [sharingProjectName, setSharingProjectName] = useState<string>("");

  const fetchProjects = useCallback(async () => {
    setLoadingList(true);
    try {
      const [ownedList, sharedList] = await Promise.all([
        listUserProjects(uid),
        getUserSharedProjects(uid),
      ]);
      setProjects(ownedList);
      setSharedProjects(sharedList);
    } catch (e: any) {
      console.error("Failed to list projects:", e);
      const errorCode = e?.code;
      const errorMsg = e?.message || "Please check your connection and try again.";

      // Firestore composite index error
      if (errorCode === "failed-precondition" && errorMsg.includes("index")) {
        toast.error("Configuration required", {
          description: "Firestore index needs to be created. Check browser console for details.",
        });
      } else {
        toast.error("Could not load projects", {
          description: errorMsg,
        });
      }
    } finally {
      setLoadingList(false);
    }
  }, [uid]);

  useEffect(() => {
    if (open && uid) fetchProjects();
  }, [open, uid, fetchProjects]);

  // ── Open owned project ────────────────────────────────────────────────────
  const handleOpen = async (meta: ProjectMetadata) => {
    if (meta.id === currentProjectId) {
      onOpenChange(false);
      return;
    }

    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Opening another project will discard them. Continue?"
      );
      if (!ok) return;
    }

    setOpeningId(meta.id);
    try {
      const { payload } = await loadProject(meta.id);
      deserializeProject(payload);
      setCurrentProject(meta.id, meta.name, meta.description);

      // Mark notifications as read when the recipient opens or views the shared project.
      try {
        await markProjectNotificationsAsRead(uid, meta.id);
      } catch (err) {
        console.error("Failed to mark project notifications as read:", err);
      }

      toast.success("Project loaded", { description: meta.name });
      onOpenChange(false);
    } catch (e: any) {
      console.error("Failed to open project:", e);
      toast.error("Failed to open project", {
        description: e.message || "An error occurred.",
      });
    } finally {
      setOpeningId(null);
    }
  };

  // ── Open shared project (creates / reuses personal copy) ──────────────────
  const handleOpenShared = async (meta: ProjectMetadata) => {
    // meta.id is the OWNER's project document ID.
    // We never load or save to it directly — instead we get/create the
    // recipient's own copy and set currentProjectId to that copy's ID.
    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Opening another project will discard them. Continue?"
      );
      if (!ok) return;
    }

    console.log("[Verification Log] Recipient opening shared project. Original project ID:", meta.id);
    setOpeningId(meta.id);
    try {
      const { metadata: copyMeta, payload, copyId } =
        await getOrCreateRecipientCopy(meta.id, uid);

      console.log("[Verification Log] Shared project loaded. currentProjectId set to copy ID:", copyId);

      // If the recipient is already on this copy, just close.
      if (copyId === currentProjectId) {
        onOpenChange(false);
        return;
      }

      deserializeProject(payload);
      setCurrentProject(copyId, copyMeta.name, copyMeta.description);

      // Mark the share notification as read.
      try {
        await markProjectNotificationsAsRead(uid, meta.id);
      } catch (err) {
        console.error("Failed to mark project notifications as read:", err);
      }

      toast.success("Project loaded", { description: copyMeta.name });
      onOpenChange(false);
    } catch (e: any) {
      console.error("Failed to open shared project:", e);
      toast.error("Failed to open project", {
        description: e.message || "An error occurred.",
      });
    } finally {
      setOpeningId(null);
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────
  const startRename = (meta: ProjectMetadata) => {
    setRenamingId(meta.id);
    setRenameValue(meta.name);
    setDescValue(meta.description);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
    setDescValue("");
  };

  const commitRename = async (id: string) => {
    if (!renameValue.trim()) return;
    setSavingRename(true);
    try {
      await renameProject(id, renameValue.trim(), descValue.trim());
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, name: renameValue.trim(), description: descValue.trim() }
            : p
        )
      );
      toast.success("Project renamed");
      cancelRename();
    } catch (e: any) {
      toast.error("Rename failed", { description: e.message });
    } finally {
      setSavingRename(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (meta: ProjectMetadata) => {
    const ok = window.confirm(
      `Permanently delete "${meta.name}"? This cannot be undone.`
    );
    if (!ok) return;

    setDeletingId(meta.id);
    try {
      await deleteProject(meta.id);
      setProjects((prev) => prev.filter((p) => p.id !== meta.id));
      toast.success("Project deleted");
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[82vh] flex flex-col rounded-2xl border border-border bg-card p-0 shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              My Projects
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Open, rename, or delete your saved Quality Lens projects.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Loading projects…</span>
            </div>
          ) : projects.length === 0 && sharedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <FolderSearch className="h-10 w-10 text-muted-foreground/40" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">No saved projects</p>
                <p className="text-xs text-muted-foreground/70">
                  Use the Save button to save your current dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Owned Projects Section */}
              {projects.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                    My Projects ({projects.length})
                  </h3>
                  <div className="space-y-2">
                    {projects.map((meta) => {
                      const isRenaming = renamingId === meta.id;
                      const isOpening = openingId === meta.id;
                      const isDeleting = deletingId === meta.id;
                      const isCurrentProject = meta.id === currentProjectId;

                      return (
                        <div
                          key={meta.id}
                          className={`group relative rounded-xl border p-4 transition-colors ${
                            isCurrentProject
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          {isCurrentProject && (
                            <span className="absolute top-3 right-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Current
                            </span>
                          )}

                          {isRenaming ? (
                            /* Inline rename form */
                            <div className="space-y-2">
                              <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                placeholder="Project name"
                                className="h-8 text-sm"
                                autoFocus
                                maxLength={120}
                                disabled={savingRename}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitRename(meta.id);
                                  if (e.key === "Escape") cancelRename();
                                }}
                              />
                              <Input
                                value={descValue}
                                onChange={(e) => setDescValue(e.target.value)}
                                placeholder="Description (optional)"
                                className="h-8 text-xs"
                                maxLength={300}
                                disabled={savingRename}
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => commitRename(meta.id)}
                                  disabled={savingRename || !renameValue.trim()}
                                >
                                  {savingRename ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={cancelRename}
                                  disabled={savingRename}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* Normal project row */
                            <div className="flex items-start justify-between gap-3 min-w-0">
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="text-sm font-semibold text-foreground truncate pr-16">
                                  {meta.name}
                                </p>
                                {meta.description && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {meta.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 pt-0.5">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  {formatDate(meta.updatedAt)}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Open */}
                                <Button
                                  size="sm"
                                  variant={isCurrentProject ? "outline" : "default"}
                                  className="h-8 px-3 text-xs font-semibold gap-1.5"
                                  onClick={() => handleOpen(meta)}
                                  disabled={isOpening || isDeleting}
                                >
                                  {isOpening ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <FolderOpen className="h-3 w-3" />
                                  )}
                                  {isCurrentProject ? "Reload" : "Open"}
                                </Button>

                                {/* Share */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setSharingProjectId(meta.id);
                                    setSharingProjectName(meta.name);
                                    setShareModalOpen(true);
                                  }}
                                  disabled={isOpening || isDeleting}
                                  title="Share"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </Button>

                                {/* Rename */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => startRename(meta)}
                                  disabled={isOpening || isDeleting}
                                  title="Rename"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>

                                {/* Delete */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(meta)}
                                  disabled={isOpening || isDeleting}
                                  title="Delete"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shared With Me Section */}
              {sharedProjects.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                    Shared With Me ({sharedProjects.length})
                  </h3>
                  <div className="space-y-2">
                    {sharedProjects.map((meta) => {
                      const isOpening = openingId === meta.id;
                      // The personal copy (not the owner's doc) is what currentProjectId tracks.
                      // We can't cheaply know the copy ID here, so we just show "Open" always.
                      // Once the copy is loaded, the copy appears in "My Projects" as current.

                      return (
                        <div
                          key={meta.id}
                          className="group relative rounded-xl border border-border bg-card hover:bg-muted/40 p-4 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 min-w-0">
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="text-sm font-semibold text-foreground truncate pr-16">
                                {meta.name}
                              </p>
                              {meta.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {meta.description}
                                </p>
                              )}
                              {(meta.ownerName || meta.ownerEmail) && (
                                <p className="text-xs text-muted-foreground/80 font-medium truncate pt-0.5">
                                  Shared by: {meta.ownerName ? `${meta.ownerName} (${meta.ownerEmail})` : meta.ownerEmail}
                                </p>
                              )}
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 pt-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                {formatDate(meta.updatedAt)}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Open — always creates / reuses a personal copy */}
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 px-3 text-xs font-semibold gap-1.5"
                                onClick={() => handleOpenShared(meta)}
                                disabled={isOpening}
                              >
                                {isOpening ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <FolderOpen className="h-3 w-3" />
                                )}
                                Open
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-border/50 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Share Modal */}
      {sharingProjectId && (
        <ShareProjectModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          projectId={sharingProjectId}
          projectName={sharingProjectName}
        />
      )}
    </Dialog>
  );
}
