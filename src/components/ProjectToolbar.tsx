/**
 * ProjectToolbar — Save, Save As, and My Projects controls for the header.
 *
 * Behaviour:
 *  - Only visible when there is active data (rows.length > 0).
 *  - If the user is not authenticated, clicking Save/Save As opens AuthModal
 *    and retries the action after successful sign-in.
 *  - Save (re-save): silently overwrites the current cloud project.
 *  - Save As: always creates a new project, prompts for a name.
 *  - First-time Save: same as Save As — prompts for a name.
 *  - My Projects: opens MyProjectsModal (auth required).
 *  - Unsaved indicator: a subtle dot appears on the Save button when isDirty.
 */

import { useState, useCallback, useEffect } from "react";
import { Save, FolderOpen, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { AuthModal } from "@/components/AuthModal";
import { SaveProjectModal } from "@/components/SaveProjectModal";
import { MyProjectsModal } from "@/components/MyProjectsModal";
import {
  saveProject,
  updateProject,
} from "@/firebase/projectService";

export function ProjectToolbar() {
  const { user } = useAuth();
  const {
    rows,
    serializeProject,
    deserializeProject,
    setCurrentProject,
    currentProjectId,
    currentProjectName,
    currentProjectDescription,
    isDirty,
    markClean,
  } = useProject();

  const hasData = rows.length > 0;

  // ── Modal visibility state ────────────────────────────────────────────────
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [myProjectsOpen, setMyProjectsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pending action to retry after successful sign-in
  const [pendingAction, setPendingAction] = useState<"save" | "save-as" | "my-projects" | null>(null);

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const requireAuth = useCallback(
    (action: "save" | "save-as" | "my-projects", fn: () => void) => {
      if (user) {
        fn();
      } else {
        setPendingAction(action);
        setAuthModalOpen(true);
      }
    },
    [user]
  );

  // ── Save (silent re-save of existing project) ─────────────────────────────
  const triggerSave = useCallback(async () => {
    if (!user) return;
    // No existing cloud project yet → open Save As dialog
    if (!currentProjectId) {
      setSaveModalOpen(true);
      return;
    }

    console.log("[Verification Log] Recipient clicked Save. Project ID passed to updateProject():", currentProjectId);
    setIsSaving(true);
    try {
      const payload = serializeProject();
      await updateProject(currentProjectId, payload);
      markClean();
      toast.success("Project saved", { description: currentProjectName ?? "" });
    } catch (e: any) {
      console.error("Save failed:", e);
      toast.error("Save failed", { description: e.message || "An error occurred." });
    } finally {
      setIsSaving(false);
    }
  }, [user, currentProjectId, currentProjectName, serializeProject, markClean]);

  /**
   * Called after a successful sign-in — replays the pending action.
   * "save-as" / "my-projects" only need to open a modal, so they're safe to
   * run immediately. "save" is intentionally NOT handled here: AuthModal's
   * onSubmit closure is captured before sign-in completes, so `user` here can
   * still be the pre-auth `null` even though authentication just succeeded.
   * The effect below completes the save once this component actually
   * re-renders with the authenticated user.
   */
  const handleAuthSuccess = useCallback(() => {
    if (pendingAction === "save-as") { setSaveAsModalOpen(true); setPendingAction(null); }
    else if (pendingAction === "my-projects") { setMyProjectsOpen(true); setPendingAction(null); }
  }, [pendingAction]);

  // Completes a pending "Save" once `user` is reflected in this render.
  useEffect(() => {
    if (pendingAction === "save" && user) {
      triggerSave();
      setPendingAction(null);
    }
  }, [pendingAction, user, triggerSave]);

  const handleSaveClick = () => requireAuth("save", triggerSave);

  // ── Save As ───────────────────────────────────────────────────────────────
  const handleSaveAsClick = () =>
    requireAuth("save-as", () => setSaveAsModalOpen(true));

  // ── My Projects ───────────────────────────────────────────────────────────
  const handleMyProjectsClick = () =>
    requireAuth("my-projects", () => setMyProjectsOpen(true));

  // ── Core save logic ───────────────────────────────────────────────────────

  const performSaveAs = useCallback(
    async (name: string, description: string) => {
      if (!user) return;
      setIsSaving(true);
      setSaveModalOpen(false);
      setSaveAsModalOpen(false);
      try {
        const payload = serializeProject();
        const newId = await saveProject(user.uid, name, description, payload);
        setCurrentProject(newId, name, description);
        markClean();
        toast.success("Project saved", { description: name });
      } catch (e: any) {
        console.error("Save As failed:", e);
        toast.error("Save failed", { description: e.message || "An error occurred." });
      } finally {
        setIsSaving(false);
      }
    },
    [user, serializeProject, setCurrentProject, markClean]
  );

  /** Handles confirm from the "first Save" modal (no existing project). */
  const handleFirstSaveConfirm = (name: string, description: string) => {
    setSaveModalOpen(false);
    performSaveAs(name, description);
  };

  /** Handles confirm from the "Save As" modal. */
  const handleSaveAsConfirm = (name: string, description: string) => {
    setSaveAsModalOpen(false);
    performSaveAs(name, description);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Current project name badge */}
        {currentProjectName && (
          <span className="hidden sm:flex items-center max-w-[180px] truncate rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            title={currentProjectName}
          >
            {currentProjectName}
          </span>
        )}

        {hasData && (
          <>
            {/* Save button */}
            <Button
              variant="outline"
              size="sm"
              className="relative h-9 px-3 gap-1.5 text-xs font-semibold"
              onClick={handleSaveClick}
              disabled={isSaving}
              title={currentProjectId ? "Save project" : "Save project (first time)"}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
              {/* Unsaved indicator dot */}
              {isDirty && !isSaving && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 border border-card" />
              )}
            </Button>

            {/* Save As button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleSaveAsClick}
              disabled={isSaving}
              title="Save As new project"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* My Projects button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={handleMyProjectsClick}
          disabled={isSaving}
          title="My Projects"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Projects</span>
        </Button>
      </div>

      {/* Auth Modal — opens when user is not signed in */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSuccess={handleAuthSuccess}
      />

      {/* Save modal — first-time save (no existing project) */}
      <SaveProjectModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        mode="save"
        initialName={currentProjectName ?? ""}
        initialDescription={currentProjectDescription ?? ""}
        isSaving={isSaving}
        onConfirm={handleFirstSaveConfirm}
      />

      {/* Save As modal */}
      <SaveProjectModal
        open={saveAsModalOpen}
        onOpenChange={setSaveAsModalOpen}
        mode="save-as"
        isSaving={isSaving}
        onConfirm={handleSaveAsConfirm}
      />

      {/* My Projects modal */}
      {user && (
        <MyProjectsModal
          open={myProjectsOpen}
          onOpenChange={setMyProjectsOpen}
          uid={user.uid}
        />
      )}
    </>
  );
}
