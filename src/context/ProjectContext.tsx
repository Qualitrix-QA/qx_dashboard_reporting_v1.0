/**
 * ProjectContext — manages all project-specific, serializable state.
 *
 * Design principles:
 *  - Contains ONLY state that would need to be saved/restored for a "project".
 *  - Does NOT contain transient UI state (loading, modals, active tab, edit mode, etc.).
 *  - Does NOT contain connection credentials (googleConfig, jiraConfig).
 *  - Does NOT contain auth state — that lives in AuthContext.
 *  - All localStorage sync lives here (single responsibility).
 *  - clearProjectData() resets everything to defaults — called by disconnect/clear handlers in Index.tsx.
 *  - serializeProject() / deserializeProject() support Save/Load without additional refactoring.
 *  - isDirty tracks unsaved changes for prompting users before destructive actions.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import type { RawRow, AISchema } from "@/types/bug";
import {
  defaultInitiatives,
  type InitiativeItem,
} from "@/components/NewInitiativesDashboard";
import {
  defaultRisks,
  type RiskItem,
} from "@/components/RiskMitigationDashboard";
import {
  defaultProjectData,
  type ProjectLevelData,
} from "@/components/ProjectLevelDashboard";
import type { ProjectPayloadV1 } from "@/firebase/projectService";

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS_PROJECT_LEVEL  = "qualitylens_project_level_dashboard_data";
const LS_INITIATIVES    = "qualitylens_new_initiatives_data";
const LS_RISKS          = "qualitylens_risk_mitigation_data";
const LS_OVERRIDES      = "qualitylens_dashboard_overrides";
const LS_NOTES          = "qualitylens_dashboard_notes";
const LS_SHOW_PREFIX    = "qualitylens_show_"; // e.g. qualitylens_show_prod_issues

// ─── Slide-visibility keys ────────────────────────────────────────────────────
export type SlideId =
  | "prod_issues"
  | "bug_analytics"
  | "test_coverage"
  | "manual_execution"
  | "automation_execution"
  | "new_initiatives"
  | "risk_mitigation";

export const ALL_SLIDE_IDS: SlideId[] = [
  "prod_issues",
  "bug_analytics",
  "test_coverage",
  "manual_execution",
  "automation_execution",
  "new_initiatives",
  "risk_mitigation",
];

// ─── Project payload re-export (convenience alias) ────────────────────────────
export type ProjectPayload = ProjectPayloadV1;

// ─── Context shape ────────────────────────────────────────────────────────────
export interface ProjectState {
  // Dataset
  rows: RawRow[];
  filteredRows: RawRow[];
  fileName: string;
  truncationWarning: string;

  // AI
  aiSchema: AISchema | null;
  latestInsights: string | null;

  // Custom dashboard data
  projectLevelData: ProjectLevelData;
  newInitiativesData: InitiativeItem[];
  riskMitigationData: RiskItem[];

  // Per-dashboard metric overrides (editable KPI cells)
  dashboardOverrides: Record<string, any>;

  // Per-dashboard notes
  dashboardNotes: Record<string, string[]>;

  // Slide visibility (part of project layout)
  slideVisibility: Record<SlideId, boolean>;

  // Cloud project identity
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentProjectDescription: string | null;

  // Dirty tracking — true when state has changed since last save
  isDirty: boolean;
}

export interface ProjectContextValue extends ProjectState {
  // Setters for dataset (used by loaders in Index.tsx)
  setRows: (rows: RawRow[]) => void;
  setFilteredRows: (rows: RawRow[]) => void;
  setFileName: (name: string) => void;
  setTruncationWarning: (warning: string) => void;

  // Setters for AI
  setAiSchema: (schema: AISchema | null) => void;
  setLatestInsights: (insights: string | null) => void;

  // Setters for custom dashboard data
  setProjectLevelData: (data: ProjectLevelData) => void;
  setNewInitiativesData: (data: InitiativeItem[]) => void;
  setRiskMitigationData: (data: RiskItem[]) => void;

  // Dashboard override helpers
  updateDashboardOverride: (dashboardId: string, newData: any) => void;
  resetDashboardOverride: (dashboardId: string) => void;

  // Notes helpers
  handleAddNote: (dashboardId: string, noteText: string) => void;
  handleDeleteNote: (dashboardId: string, noteIndex: number) => void;

  // Slide visibility
  setSlideVisible: (slideId: SlideId, visible: boolean) => void;

  // Reset — clears all project data back to defaults
  clearProjectData: () => void;

  // ── Serialization ────────────────────────────────────────────────────────
  /** Returns a complete, serializable snapshot of the current project state. */
  serializeProject: () => ProjectPayload;
  /** Restores the full project state from a saved payload. */
  deserializeProject: (payload: ProjectPayload) => void;

  // ── Cloud project identity ───────────────────────────────────────────────
  /** Call after a successful cloud save to record which project is loaded. */
  setCurrentProject: (id: string, name: string, description: string) => void;
  /** Clears the cloud project identity (e.g. after Clear Cache). */
  clearCurrentProject: () => void;

  // ── Dirty tracking ───────────────────────────────────────────────────────
  /** Marks the project as clean (no unsaved changes) after a successful save. */
  markClean: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeParse<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readSlideVisibility(): Record<SlideId, boolean> {
  const result = {} as Record<SlideId, boolean>;
  for (const id of ALL_SLIDE_IDS) {
    result[id] = localStorage.getItem(`${LS_SHOW_PREFIX}${id}`) !== "false";
  }
  return result;
}

function normalizeNotes(raw: any): Record<string, string[]> {
  const normalized: Record<string, string[]> = {};
  if (!raw || typeof raw !== "object") return normalized;
  for (const key of Object.keys(raw)) {
    if (Array.isArray(raw[key])) {
      normalized[key] = raw[key];
    } else if (typeof raw[key] === "string") {
      normalized[key] = raw[key]
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else {
      normalized[key] = [];
    }
  }
  return normalized;
}

const DEFAULT_SLIDE_VISIBILITY: Record<SlideId, boolean> = ALL_SLIDE_IDS.reduce(
  (acc, id) => ({ ...acc, [id]: true }),
  {} as Record<SlideId, boolean>
);

// ─── Context ──────────────────────────────────────────────────────────────────
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const prevUserUid = useRef<string | null>(null);

  // ── Dataset ──────────────────────────────────────────────────────────────
  const [rows, setRowsState] = useState<RawRow[]>([]);
  const [filteredRows, setFilteredRowsState] = useState<RawRow[]>([]);
  const [fileName, setFileNameState] = useState("");
  const [truncationWarning, setTruncationWarningState] = useState("");

  // ── AI ───────────────────────────────────────────────────────────────────
  const [aiSchema, setAiSchemaState] = useState<AISchema | null>(null);
  const [latestInsights, setLatestInsightsState] = useState<string | null>(null);

  // ── Custom dashboard data ─────────────────────────────────────────────────
  const [projectLevelData, setProjectLevelDataState] = useState<ProjectLevelData>(() =>
    safeParse(LS_PROJECT_LEVEL, defaultProjectData)
  );
  const [newInitiativesData, setNewInitiativesDataState] = useState<InitiativeItem[]>(() =>
    safeParse(LS_INITIATIVES, defaultInitiatives)
  );
  const [riskMitigationData, setRiskMitigationDataState] = useState<RiskItem[]>(() =>
    safeParse(LS_RISKS, defaultRisks)
  );

  // ── Dashboard overrides ───────────────────────────────────────────────────
  const [dashboardOverrides, setDashboardOverridesState] = useState<Record<string, any>>(() =>
    safeParse(LS_OVERRIDES, {})
  );

  // ── Dashboard notes ───────────────────────────────────────────────────────
  const [dashboardNotes, setDashboardNotesState] = useState<Record<string, string[]>>(() =>
    normalizeNotes(safeParse(LS_NOTES, {}))
  );

  // ── Slide visibility ──────────────────────────────────────────────────────
  const [slideVisibility, setSlideVisibility] = useState<Record<SlideId, boolean>>(
    readSlideVisibility
  );

  // ── Cloud project identity ────────────────────────────────────────────────
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
  const [currentProjectDescription, setCurrentProjectDescription] = useState<string | null>(null);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  // We use a ref to track whether we are in the middle of a bulk restore
  // (deserializeProject) to avoid false dirty flags.
  const isRestoringRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);

  /** Marks dirty ONLY when not in the middle of a bulk restore. */
  const markDirty = useCallback(() => {
    if (!isRestoringRef.current) setIsDirty(true);
  }, []);

  // ── Dirty-aware public setters ────────────────────────────────────────────
  // Wrap each raw setter so any mutation flips isDirty.
  const setRows = useCallback((v: RawRow[]) => { setRowsState(v); markDirty(); }, [markDirty]);
  const setFilteredRows = useCallback((v: RawRow[]) => { setFilteredRowsState(v); }, []);
  const setFileName = useCallback((v: string) => { setFileNameState(v); markDirty(); }, [markDirty]);
  const setTruncationWarning = useCallback((v: string) => { setTruncationWarningState(v); }, []);
  const setAiSchema = useCallback((v: AISchema | null) => { setAiSchemaState(v); markDirty(); }, [markDirty]);
  const setLatestInsights = useCallback((v: string | null) => { setLatestInsightsState(v); markDirty(); }, [markDirty]);
  const setProjectLevelData = useCallback((v: ProjectLevelData) => { setProjectLevelDataState(v); markDirty(); }, [markDirty]);
  const setNewInitiativesData = useCallback((v: InitiativeItem[]) => { setNewInitiativesDataState(v); markDirty(); }, [markDirty]);
  const setRiskMitigationData = useCallback((v: RiskItem[]) => { setRiskMitigationDataState(v); markDirty(); }, [markDirty]);

  // ── localStorage sync effects ─────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(LS_PROJECT_LEVEL, JSON.stringify(projectLevelData));
  }, [projectLevelData]);

  useEffect(() => {
    localStorage.setItem(LS_INITIATIVES, JSON.stringify(newInitiativesData));
  }, [newInitiativesData]);

  useEffect(() => {
    localStorage.setItem(LS_RISKS, JSON.stringify(riskMitigationData));
  }, [riskMitigationData]);

  useEffect(() => {
    localStorage.setItem(LS_OVERRIDES, JSON.stringify(dashboardOverrides));
  }, [dashboardOverrides]);

  useEffect(() => {
    localStorage.setItem(LS_NOTES, JSON.stringify(dashboardNotes));
  }, [dashboardNotes]);

  useEffect(() => {
    for (const id of ALL_SLIDE_IDS) {
      localStorage.setItem(`${LS_SHOW_PREFIX}${id}`, String(slideVisibility[id]));
    }
  }, [slideVisibility]);

  // ── Stable callbacks ──────────────────────────────────────────────────────
  const updateDashboardOverride = useCallback(
    (dashboardId: string, newData: any) => {
      setDashboardOverridesState(prev => ({ ...prev, [dashboardId]: newData }));
      markDirty();
    },
    [markDirty]
  );

  const resetDashboardOverride = useCallback((dashboardId: string) => {
    setDashboardOverridesState(prev => {
      const copy = { ...prev };
      delete copy[dashboardId];
      return copy;
    });
    markDirty();
  }, [markDirty]);

  const handleAddNote = useCallback((dashboardId: string, noteText: string) => {
    if (!noteText.trim()) return;
    setDashboardNotesState(prev => {
      const list = prev[dashboardId] || [];
      return { ...prev, [dashboardId]: [...list, noteText.trim()] };
    });
    markDirty();
  }, [markDirty]);

  const handleDeleteNote = useCallback(
    (dashboardId: string, noteIndex: number) => {
      setDashboardNotesState(prev => {
        const list = prev[dashboardId] || [];
        return {
          ...prev,
          [dashboardId]: list.filter((_, i) => i !== noteIndex),
        };
      });
      markDirty();
    },
    [markDirty]
  );

  const setSlideVisible = useCallback((slideId: SlideId, visible: boolean) => {
    setSlideVisibility(prev => ({ ...prev, [slideId]: visible }));
    markDirty();
  }, [markDirty]);

  /**
   * clearProjectData — resets ALL project state to defaults.
   * Called from Index.tsx when the user disconnects a data source or clears cache.
   * Does NOT clear googleConfig / jiraConfig — those are app-level credentials
   * managed in Index.tsx.
   */
  const clearProjectData = useCallback(() => {
    isRestoringRef.current = true;
    setRowsState([]);
    setFilteredRowsState([]);
    setFileNameState("");
    setTruncationWarningState("");
    setAiSchemaState(null);
    setLatestInsightsState(null);
    setProjectLevelDataState(defaultProjectData);
    setNewInitiativesDataState(defaultInitiatives);
    setRiskMitigationDataState(defaultRisks);
    setDashboardOverridesState({});
    setDashboardNotesState({});
    setSlideVisibility(DEFAULT_SLIDE_VISIBILITY);
    setCurrentProjectId(null);
    setCurrentProjectName(null);
    setCurrentProjectDescription(null);
    setIsDirty(false);
    // Use setTimeout to ensure all state updates dispatch before we re-enable
    // dirty tracking (avoids React batching race conditions).
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }, []);

  // ── Auth-aware clean up ────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.uid !== prevUserUid.current) {
      console.log("[Verification Log] Auth user changed. Clearing local project context data. Old UID:", prevUserUid.current, "New UID:", user?.uid);
      clearProjectData();
      prevUserUid.current = user?.uid ?? null;
    }
  }, [user?.uid, clearProjectData]);

  // ── Serialization ─────────────────────────────────────────────────────────

  /**
   * serializeProject — returns a complete, version-tagged snapshot of the
   * current project state. Call this just before uploading to Firebase Storage.
   */
  const serializeProject = useCallback((): ProjectPayload => {
    return {
      version: 1,
      savedAt: Date.now(),
      fileName,
      rows,
      aiSchema,
      latestInsights,
      projectLevelData,
      newInitiativesData,
      riskMitigationData,
      dashboardOverrides,
      dashboardNotes,
      slideVisibility,
    };
  }, [
    fileName, rows, aiSchema, latestInsights,
    projectLevelData, newInitiativesData, riskMitigationData,
    dashboardOverrides, dashboardNotes, slideVisibility,
  ]);

  /**
   * deserializeProject — restores all project state from a saved payload.
   * Supports future schema versions via the payload.version discriminant.
   * Marks the project as clean (no unsaved changes) after restore.
   */
  const deserializeProject = useCallback((payload: ProjectPayload) => {
    // Guard: only version 1 supported in this phase.
    if (payload.version !== 1) {
      throw new Error(`Unsupported project payload version: ${(payload as any).version}`);
    }

    isRestoringRef.current = true;
    setRowsState(payload.rows ?? []);
    setFilteredRowsState(payload.rows ?? []);
    setFileNameState(payload.fileName ?? "");
    setTruncationWarningState("");
    setAiSchemaState(payload.aiSchema ?? null);
    setLatestInsightsState(payload.latestInsights ?? null);
    setProjectLevelDataState(payload.projectLevelData ?? defaultProjectData);
    setNewInitiativesDataState(payload.newInitiativesData ?? defaultInitiatives);
    setRiskMitigationDataState(payload.riskMitigationData ?? defaultRisks);
    setDashboardOverridesState(payload.dashboardOverrides ?? {});
    setDashboardNotesState(normalizeNotes(payload.dashboardNotes ?? {}));
    // Merge saved visibility with defaults to handle new slide IDs added in
    // future versions without breaking older saved projects.
    setSlideVisibility({
      ...DEFAULT_SLIDE_VISIBILITY,
      ...(payload.slideVisibility ?? {}),
    } as Record<SlideId, boolean>);
    setIsDirty(false);
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }, []);

  // ── Cloud project identity ────────────────────────────────────────────────
  const setCurrentProject = useCallback(
    (id: string, name: string, description: string) => {
      setCurrentProjectId(id);
      setCurrentProjectName(name);
      setCurrentProjectDescription(description);
    },
    []
  );

  const clearCurrentProject = useCallback(() => {
    setCurrentProjectId(null);
    setCurrentProjectName(null);
    setCurrentProjectDescription(null);
  }, []);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value: ProjectContextValue = {
    // State
    rows,
    filteredRows,
    fileName,
    truncationWarning,
    aiSchema,
    latestInsights,
    projectLevelData,
    newInitiativesData,
    riskMitigationData,
    dashboardOverrides,
    dashboardNotes,
    slideVisibility,
    currentProjectId,
    currentProjectName,
    currentProjectDescription,
    isDirty,

    // Setters
    setRows,
    setFilteredRows,
    setFileName,
    setTruncationWarning,
    setAiSchema,
    setLatestInsights,
    setProjectLevelData,
    setNewInitiativesData,
    setRiskMitigationData,

    // Helpers
    updateDashboardOverride,
    resetDashboardOverride,
    handleAddNote,
    handleDeleteNote,
    setSlideVisible,
    clearProjectData,

    // Serialization
    serializeProject,
    deserializeProject,

    // Cloud identity
    setCurrentProject,
    clearCurrentProject,

    // Dirty tracking
    markClean,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used inside <ProjectProvider>");
  }
  return ctx;
}
