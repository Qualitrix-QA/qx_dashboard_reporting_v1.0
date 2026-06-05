/**
 * Module Risk Engine — calculates risk scores per module for health map visualization.
 * Auto-detects module and risk columns, computes weighted risk scores, and normalizes them.
 */
import type {
  RawRow, DataAnalysis, DynamicAggregations, AISchema, ModuleRiskData, DetectedDataType,
} from "@/types/bug";
import { detectDataTypeHeuristic } from "./aiSchema";

const INTERNAL_COLUMNS = ["__sheet"];

// ─── Color palette ──────────────────────────────────────────────────────────

export const RISK_COLORS = {
  Critical: "#ef4444",  // Red — severe, release-blocking issues
  High: "#f97316",  // Orange — high impact, needs urgent attention
  Medium: "#eab308",  // Yellow — moderate, should be tracked
  Low: "#06b6d4",  // Cyan — minimal impact, low priority
  Safe: "#22c55e",  // Green — no significant issues detected
} as const;

// Severity/result → color mapping for consistent chart coloring
export const VALUE_COLORS: Record<string, string> = {
  // Severity
  critical: "#dc2626", blocker: "#dc2626",
  high: "#f97316",
  medium: "#eab308", major: "#eab308",
  low: "#22c55e", minor: "#22c55e",
  // Results
  pass: "#22c55e", passed: "#22c55e",
  fail: "#dc2626", failed: "#dc2626",
  blocked: "#f97316", block: "#f97316",
  "not executed": "#94a3b8", skipped: "#94a3b8", "n/a": "#94a3b8",
  // Status
  open: "#dc2626", new: "#dc2626", reopened: "#dc2626",
  closed: "#22c55e", fixed: "#22c55e", resolved: "#22c55e", done: "#22c55e",
  "in progress": "#f97316", active: "#f97316",
  // Priority
  p1: "#dc2626",
  p2: "#f97316",
  p3: "#eab308",
  p4: "#22c55e",
};

export function getValueColor(value: string): string {
  return VALUE_COLORS[value.toLowerCase()] || "#6b7280";
}

// ─── Module column detection ────────────────────────────────────────────────

const MODULE_KEYWORDS = /\b(module|component|feature|area|section|application|service|page|screen|subsystem|functionality)\b/i;

export function detectModuleColumn(
  analysis: DataAnalysis,
  aiSchema?: AISchema | null
): string | null {
  // AI schema takes priority
  if (aiSchema?.columnMap?.moduleColumn) {
    const col = analysis.columns.find(c => c.name === aiSchema.columnMap.moduleColumn);
    if (col && col.type === "categorical" && col.uniqueCount >= 2) return col.name;
  }

  // Heuristic detection
  const candidates = analysis.columns.filter(c =>
    c.type === "categorical" &&
    !INTERNAL_COLUMNS.includes(c.name) &&
    c.uniqueCount >= 2 &&
    c.uniqueCount <= 100 &&
    c.fillRate > 40 &&
    MODULE_KEYWORDS.test(c.name)
  );

  if (candidates.length > 0) {
    // Prefer the one with the most heuristic-friendly unique count
    return candidates.sort((a, b) => {
      const aScore = a.uniqueCount >= 3 && a.uniqueCount <= 30 ? 10 : 0;
      const bScore = b.uniqueCount >= 3 && b.uniqueCount <= 30 ? 10 : 0;
      return (bScore - aScore) || (b.fillRate - a.fillRate);
    })[0].name;
  }

  // Fallback to standard Jira/sheet grouping columns
  const fallbacks = analysis.columns.filter(c =>
    c.type === "categorical" &&
    !INTERNAL_COLUMNS.includes(c.name) &&
    c.uniqueCount >= 2 &&
    c.uniqueCount <= 100 &&
    c.fillRate > 20 &&
    /\b(project|components|labels|__sheet)\b/i.test(c.name)
  );

  if (fallbacks.length > 0) {
    return fallbacks.sort((a, b) => {
      const getPriority = (name: string) => {
        const ln = name.toLowerCase();
        if (ln === "project" || ln === "__sheet") return 4;
        if (ln === "components") return 3;
        if (ln === "labels") return 2;
        return 1;
      };
      return getPriority(b.name) - getPriority(a.name);
    })[0].name;
  }

  return null;
}

// ─── Risk column detection ──────────────────────────────────────────────────

type RiskColumnInfo = {
  column: string;
  type: "severity" | "priority" | "result" | "status";
};

export function detectRiskColumn(
  analysis: DataAnalysis,
  aiSchema?: AISchema | null
): RiskColumnInfo | null {
  const cols = analysis.columns.filter(c =>
    c.type === "categorical" && !INTERNAL_COLUMNS.includes(c.name) && c.fillRate > 30
  );

  // Check AI schema first
  const isQA = aiSchema?.dataType === "test_case" || aiSchema?.dataType === "test_execution" ||
    cols.some(c => /\b(result|outcome|pass|fail)\b/i.test(c.name));

  if (aiSchema?.columnMap) {
    if (isQA && aiSchema.columnMap.resultColumn) {
      const c = cols.find(c => c.name === aiSchema.columnMap.resultColumn);
      if (c) return { column: c.name, type: "result" };
    }
    if (aiSchema.columnMap.severityColumn) {
      const c = cols.find(c => c.name === aiSchema.columnMap.severityColumn);
      if (c) return { column: c.name, type: "severity" };
    }
    if (!isQA && aiSchema.columnMap.resultColumn) {
      const c = cols.find(c => c.name === aiSchema.columnMap.resultColumn);
      if (c) return { column: c.name, type: "result" };
    }
    if (aiSchema.columnMap.priorityColumn) {
      const c = cols.find(c => c.name === aiSchema.columnMap.priorityColumn);
      if (c) return { column: c.name, type: "priority" };
    }
    if (aiSchema.columnMap.statusColumn) {
      const c = cols.find(c => c.name === aiSchema.columnMap.statusColumn);
      if (c) return { column: c.name, type: "status" };
    }
  }

  // Heuristic priorities based on inferred data type
  if (isQA) {
    for (const col of cols) {
      if (/\b(result|outcome|verdict|execution)\b/i.test(col.name)) return { column: col.name, type: "result" };
    }
    for (const col of cols) {
      if (/\b(severity|sev)\b/i.test(col.name)) return { column: col.name, type: "severity" };
    }
  } else {
    for (const col of cols) {
      if (/\b(severity|sev)\b/i.test(col.name)) return { column: col.name, type: "severity" };
    }
    for (const col of cols) {
      if (/\b(result|outcome|verdict)\b/i.test(col.name)) return { column: col.name, type: "result" };
    }
  }
  for (const col of cols) {
    const n = col.name.toLowerCase();
    if (/\b(priority|pri)\b/.test(n)) return { column: col.name, type: "priority" };
  }
  for (const col of cols) {
    const n = col.name.toLowerCase();
    if (/\b(status|state)\b/.test(n)) return { column: col.name, type: "status" };
  }

  return null;
}

// ─── Risk score calculation ─────────────────────────────────────────────────

export function getRiskLevel(score: number): ModuleRiskData["riskLevel"] {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  if (score >= 20) return "Low";
  return "Safe";
}

export function getRiskColor(score: number): string {
  if (score >= 80) return RISK_COLORS.Critical;
  if (score >= 60) return RISK_COLORS.High;
  if (score >= 40) return RISK_COLORS.Medium;
  if (score >= 20) return RISK_COLORS.Low;
  return RISK_COLORS.Safe;
}

// Map cell value to standard severity level based on risk column type
function mapValueToSeverity(
  val: string,
  riskType: "severity" | "priority" | "result" | "status"
): "Critical" | "High" | "Medium" | "Low" | "Safe" {
  const s = val.trim().toLowerCase();
  if (!s) return "Safe";

  if (riskType === "severity") {
    if (s.includes("critical") || s.includes("blocker")) return "Critical";
    if (s.includes("high")) return "High";
    if (s.includes("medium") || s.includes("major")) return "Medium";
    if (s.includes("low") || s.includes("minor")) return "Low";
    return "Safe";
  }

  if (riskType === "priority") {
    if (s.includes("p1") || s.includes("critical") || s.includes("highest")) return "Critical";
    if (s.includes("p2") || s.includes("high") || s.includes("medium")) return "High";
    if (s.includes("p3") || s.includes("low")) return "Medium";
    if (s.includes("p4") || s.includes("lowest")) return "Low";
    return "Safe";
  }

  if (riskType === "result") {
    if (s.includes("fail") || s.includes("failed")) return "Critical";
    if (s.includes("blocked") || s.includes("block")) return "High";
    if (s.includes("not executed") || s.includes("skipped") || s.includes("n/a") || s.includes("not run")) return "Medium";
    if (s.includes("pass") || s.includes("passed")) return "Safe";
  }

  if (riskType === "status") {
    if (s.includes("open") || s.includes("new") || s.includes("reopened") || s.includes("error") || s.includes("exception") || s.includes("timeout")) return "Critical";
    if (s.includes("in progress") || s.includes("active")) return "High";
    if (s.includes("closed") || s.includes("fixed") || s.includes("resolved") || s.includes("done") || s.includes("success") || s.includes("passed") || s.includes("pass") || s.includes("ok")) return "Safe";
  }

  // Heuristic for unstructured free text descriptions (e.g. observations)
  const FAIL_PHRASES = [
    "not able", "unable", "not display", "not work", "not function",
    "not show", "not load", "not save", "not submit", "not allow",
    "invalid", "incorrect", "error", "exception", "crash", "broken",
    "wrong", "missing", "issue", "problem", "bug", "defect",
    "allowing", "allows", "mismatch", "unexpected"
  ];
  const PASS_PHRASES = [
    "working", "as expected", "successfully", "correct", "valid",
    "pass", "ok ", " ok", "done", "good", "proper", "verified"
  ];

  if (FAIL_PHRASES.some(p => s.includes(p)) && !PASS_PHRASES.some(p => s.includes(p))) {
    return "Critical";
  }
  if (PASS_PHRASES.some(p => s.includes(p))) {
    return "Safe";
  }

  return "Low"; // unrecognized text defaults to Low risk instead of polluting higher states
}

// ─── Main calculation ───────────────────────────────────────────────────────

export function calculateModuleRisks(
  rows: RawRow[],
  moduleCol: string,
  riskCol: string,
  riskType: "severity" | "priority" | "result" | "status"
): ModuleRiskData[] {
  const moduleData: Record<string, {
    total: number;
    breakdown: Record<string, number>;
    counts: Record<"Critical" | "High" | "Medium" | "Low" | "Safe", number>;
  }> = {};

  const moduleCanonical: Record<string, string> = {};
  const riskCanonical: Record<string, string> = {};

  // Single pass aggregation
  for (const row of rows) {
    const mod = (row[moduleCol] || "").trim();
    const risk = (row[riskCol] || "").trim();
    if (!mod) continue;

    const modLower = mod.toLowerCase();
    if (!moduleCanonical[modLower]) moduleCanonical[modLower] = mod;
    const canonical = moduleCanonical[modLower];

    if (!moduleData[canonical]) {
      moduleData[canonical] = {
        total: 0,
        breakdown: {},
        counts: { Critical: 0, High: 0, Medium: 0, Low: 0, Safe: 0 },
      };
    }

    const data = moduleData[canonical];
    data.total++;

    if (risk) {
      const riskLower = risk.toLowerCase();
      if (!riskCanonical[riskLower]) riskCanonical[riskLower] = risk;
      const canonicalRisk = riskCanonical[riskLower];

      // Track breakdown counts for tooltip representation
      data.breakdown[canonicalRisk] = (data.breakdown[canonicalRisk] || 0) + 1;

      // Classify the value into a standard severity
      const severity = mapValueToSeverity(risk, riskType);
      data.counts[severity]++;
    } else {
      // Empty value treated as safe/no issues
      data.counts["Safe"]++;
    }
  }

  // Calculate scores and format return objects
  return Object.entries(moduleData).map(([name, data]) => {
    const { Critical, High, Medium, Low } = data.counts;

    let finalScore = 5; // Perfect health baseline

    // Base score is set by the worst severity, plus small increments for each additional bug
    if (Critical > 0) {
      finalScore = 80 + 4 * (Critical - 1) + 2 * High + 1 * Medium + 0.5 * Low;
      if (finalScore > 100) finalScore = 100;
    } else if (High > 0) {
      finalScore = 60 + 3 * (High - 1) + 1 * Medium + 0.5 * Low;
      if (finalScore > 79) finalScore = 79;
    } else if (Medium > 0) {
      finalScore = 40 + 2 * (Medium - 1) + 0.5 * Low;
      if (finalScore > 59) finalScore = 59;
    } else if (Low > 0) {
      finalScore = 20 + 1 * (Low - 1);
      if (finalScore > 39) finalScore = 39;
    }

    const roundedScore = Math.round(finalScore);

    return {
      module: name,
      total: data.total,
      riskScore: roundedScore,
      riskLevel: getRiskLevel(roundedScore),
      breakdown: data.breakdown,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

// ─── Summary stats for the legend ───────────────────────────────────────────

export function getRiskLevelCounts(modules: ModuleRiskData[]): Record<ModuleRiskData["riskLevel"], number> {
  const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Safe: 0 };
  for (const m of modules) {
    counts[m.riskLevel] = (counts[m.riskLevel] || 0) + 1;
  }
  return counts as Record<ModuleRiskData["riskLevel"], number>;
}


// ─── Build treemap data structure ───────────────────────────────────────────

export function buildTreemapData(modules: ModuleRiskData[]) {
  return modules.map(m => ({
    name: m.module,
    value: m.total,
    riskScore: m.riskScore,
    riskLevel: m.riskLevel,
    breakdown: m.breakdown,
    itemStyle: {
      color: getRiskColor(m.riskScore),
      borderColor: "rgba(255,255,255,0.15)",
      borderWidth: 2,
    },
  }));
}

