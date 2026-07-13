/**
 * datasetDetector.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Modular, confidence-scored dataset-type detector.
 *
 * Key design goals:
 *  1. Works purely from raw headers + sample rows — no AI required.
 *  2. Normalises column names so "Defect ID", "defect_id" and "DefectId" all
 *     resolve to "defect id" for synonym matching.
 *  3. Each detector is a pure function; adding a new dataset type means adding
 *     one entry to DETECTORS with its own scoring logic.
 *  4. Resolves a FieldMap (canonical → actual column name) for downstream
 *     report generators so they never need to re-scan headers.
 */

import type { RawRow } from "@/types/bug";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ExtendedDatasetType =
  | "bug_report"
  | "test_execution"
  | "test_case"
  | "requirement_task"
  | "generic";

export interface FieldMap {
  idCol?: string;
  titleCol?: string;
  statusCol?: string;
  severityCol?: string;
  priorityCol?: string;
  moduleCol?: string;
  assigneeCol?: string;
  dateCol?: string;
  resultCol?: string;
  automationCol?: string;
  storyPointsCol?: string;
  sprintCol?: string;
  rcaCol?: string;
  testTypeCol?: string;
  buildCol?: string;
}

export interface DetectedDatasetResult {
  type: ExtendedDatasetType;
  /** 0-100 confidence that this is the right type */
  confidence: number;
  /** resolved map of canonical field → actual column name in this dataset */
  fieldMap: FieldMap;
  /** human-readable one-liner */
  summary: string;
}

// ─── Column name normalisation ────────────────────────────────────────────────

/**
 * Normalise a raw column header to a compact lowercase string with single
 * spaces and no leading/trailing whitespace or special characters.
 * e.g. "Defect_ID (Jira)" → "defect id jira"
 */
export function normalizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\-\/\\|.]/g, " ")   // common separators → space
    .replace(/[^a-z0-9\s]/g, " ")   // strip special chars
    .replace(/\s+/g, " ")            // collapse multiple spaces
    .trim();
}

// ─── Synonym tables ───────────────────────────────────────────────────────────

const SYN: Record<string, RegExp> = {
  // Identifier columns
  id:           /\b(id|ids|no|num|number|#|sl|sr|seq|serial|ref|ticket|jira|key|code|index|issue)\b/,

  // Title / name
  title:        /\b(title|name|summary|subject|headline|description|desc|defect name|issue name|test name|scenario|case name)\b/,

  // Status
  status:       /\b(status|state|current status|issue status)\b/,

  // Severity
  severity:     /\b(severity|sev|impact|criticality)\b/,

  // Priority
  priority:     /\b(priority|prio|urgency|importance|rank)\b/,

  // Module / component
  module:       /\b(module|component|feature|area|section|application|service|page|screen|app|epic|system|subsystem)\b/,

  // Assignee
  assignee:     /\b(assignee|assigned to|owner|tester|developer|dev|qa engineer|responsible|handled by|reporter|created by)\b/,

  // Date columns (any date-like)
  date:         /\b(date|time|created|updated|opened|reported|closed|resolved|modified|logged|detected|submitted|executed|run date)\b/,

  // Test result
  result:       /\b(result|outcome|verdict|pass|fail|execution result|test result|status)\b/,

  // Automation
  automation:   /\b(automation|automated|automate|auto|execution mode|type|test type|manual|script)\b/,

  // Story points
  storypoints:  /\b(story points|story point|sp|points|effort|estimate|size|t-shirt|complexity)\b/,

  // Sprint / iteration
  sprint:       /\b(sprint|iteration|milestone|release|version|build|cycle)\b/,

  // Root cause
  rca:          /\b(rca|root cause|root cause category|rca category|defect category|cause|reason|failure reason)\b/,

  // Test type
  testtype:     /\b(test type|testing type|type of test|test category|kind)\b/,

  // Build
  build:        /\b(build|build no|build number|version|release)\b/,
};

function matchesSyn(normalized: string, syn: keyof typeof SYN): boolean {
  return SYN[syn].test(normalized);
}

// ─── Field map resolver ───────────────────────────────────────────────────────

export function resolveFieldMap(headers: string[]): FieldMap {
  const fm: FieldMap = {};

  for (const h of headers) {
    const n = normalizeColumnName(h);

    if (!fm.idCol       && matchesSyn(n, "id"))          fm.idCol         = h;
    if (!fm.titleCol    && matchesSyn(n, "title"))        fm.titleCol      = h;
    if (!fm.statusCol   && matchesSyn(n, "status"))       fm.statusCol     = h;
    if (!fm.severityCol && matchesSyn(n, "severity"))     fm.severityCol   = h;
    if (!fm.priorityCol && matchesSyn(n, "priority"))     fm.priorityCol   = h;
    if (!fm.moduleCol   && matchesSyn(n, "module"))       fm.moduleCol     = h;
    if (!fm.assigneeCol && matchesSyn(n, "assignee"))     fm.assigneeCol   = h;
    if (!fm.dateCol     && matchesSyn(n, "date"))         fm.dateCol       = h;
    if (!fm.resultCol   && matchesSyn(n, "result"))       fm.resultCol     = h;
    if (!fm.automationCol && matchesSyn(n, "automation")) fm.automationCol = h;
    if (!fm.storyPointsCol && matchesSyn(n, "storypoints")) fm.storyPointsCol = h;
    if (!fm.sprintCol   && matchesSyn(n, "sprint"))       fm.sprintCol     = h;
    if (!fm.rcaCol      && matchesSyn(n, "rca"))          fm.rcaCol        = h;
    if (!fm.testTypeCol && matchesSyn(n, "testtype"))     fm.testTypeCol   = h;
    if (!fm.buildCol    && matchesSyn(n, "build"))        fm.buildCol      = h;
  }

  return fm;
}

// ─── Value sniffers ───────────────────────────────────────────────────────────

/** Collect a deduplicated set of lowercase non-empty values from a column */
function sampleValues(rows: RawRow[], col: string, limit = 200): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < Math.min(rows.length, limit); i++) {
    const v = (rows[i][col] || "").trim().toLowerCase();
    if (v) out.add(v);
  }
  return out;
}

function hasPassFailValues(rows: RawRow[], col: string): boolean {
  const vals = sampleValues(rows, col);
  return [...vals].some(v =>
    ["pass", "passed", "fail", "failed", "blocked", "skipped", "not executed", "not run", "n/a"].some(kw => v.includes(kw))
  );
}

// ─── Individual detectors ─────────────────────────────────────────────────────

interface DetectorResult { score: number; reasons: string[] }

function detectBugReport(normNames: string[], fieldMap: FieldMap, rows: RawRow[]): DetectorResult {
  let score = 0;
  const reasons: string[] = [];

  // Strong signals
  if (fieldMap.severityCol)      { score += 30; reasons.push("has severity column"); }
  if (fieldMap.rcaCol)           { score += 25; reasons.push("has RCA/root-cause column"); }

  // Medium signals
  if (normNames.some(n => /\b(bug|defect|incident|vulnerability)\b/.test(n))) {
    score += 20; reasons.push("bug/defect keyword in column name");
  }
  if (fieldMap.statusCol && fieldMap.assigneeCol) { score += 15; reasons.push("has status + assignee"); }
  if (fieldMap.priorityCol && fieldMap.severityCol) { score += 10; reasons.push("has priority + severity"); }

  // Jira-style key column
  if (normNames.some(n => /^(key|issue key|ticket key|jira key)$/.test(n))) {
    score += 20; reasons.push("Jira-style key column");
  }

  // Value signals — look in status col for open/closed/resolved
  if (fieldMap.statusCol) {
    const vals = sampleValues(rows, fieldMap.statusCol);
    const bugStatuses = ["open", "closed", "resolved", "reopened", "in progress", "fixed", "wont fix", "duplicate"];
    if ([...vals].some(v => bugStatuses.some(kw => v.includes(kw)))) {
      score += 10; reasons.push("bug-like status values");
    }
  }

  return { score, reasons };
}

function detectTestExecution(normNames: string[], fieldMap: FieldMap, rows: RawRow[]): DetectorResult {
  let score = 0;
  const reasons: string[] = [];

  // Strong: result/status column with pass/fail values
  const resultLike = fieldMap.resultCol || fieldMap.statusCol;
  if (resultLike && hasPassFailValues(rows, resultLike)) {
    score += 35; reasons.push("pass/fail values in result/status column");
  }

  // Column name signals
  if (normNames.some(n => /\b(executed|execution|result|pass|fail|verdict)\b/.test(n))) {
    score += 15; reasons.push("execution-related column names");
  }
  if (fieldMap.buildCol)   { score += 10; reasons.push("has build column"); }
  if (fieldMap.testTypeCol){ score += 10; reasons.push("has test type column"); }
  if (fieldMap.automationCol) { score += 10; reasons.push("has automation column"); }

  // TC ID column is a strong signal when combined with pass/fail
  if (normNames.some(n => /\b(tc id|tc no|test case id|testcase id)\b/.test(n))) {
    score += 15; reasons.push("TC ID column");
  }

  return { score, reasons };
}

function detectTestCase(normNames: string[], fieldMap: FieldMap, rows: RawRow[]): DetectorResult {
  let score = 0;
  const reasons: string[] = [];

  // Strong column-name signals
  if (normNames.some(n => /\b(precondition|pre condition|pre requisite)\b/.test(n))) {
    score += 30; reasons.push("precondition column");
  }
  if (normNames.some(n => /\b(test objective|objective|expected result|expected outcome)\b/.test(n))) {
    score += 25; reasons.push("test objective/expected result column");
  }
  if (normNames.some(n => /\b(test steps|steps|test procedure|procedure|test scenario|scenario)\b/.test(n))) {
    score += 20; reasons.push("test steps/scenario column");
  }

  // TC ID without strong pass/fail → more likely test case repository than execution log
  if (normNames.some(n => /\b(tc id|tc no|test case id|testcase id)\b/.test(n))) {
    score += 15; reasons.push("TC ID column");
    // Penalise if we see pass/fail (that's execution, not design)
    const resultLike = fieldMap.resultCol || fieldMap.statusCol;
    if (resultLike && hasPassFailValues(rows, resultLike)) {
      score -= 10; reasons.push("(−) has pass/fail values → more like execution");
    }
  }

  if (fieldMap.priorityCol && fieldMap.moduleCol) { score += 15; reasons.push("has priority + module"); }
  if (fieldMap.automationCol)                     { score += 10; reasons.push("has automation status column"); }

  return { score, reasons };
}

function detectRequirementTask(normNames: string[], fieldMap: FieldMap, rows: RawRow[]): DetectorResult {
  let score = 0;
  const reasons: string[] = [];

  if (fieldMap.storyPointsCol) { score += 35; reasons.push("story points column"); }
  if (normNames.some(n => /\b(user story|story|acceptance criteria|acceptance|feature request)\b/.test(n))) {
    score += 30; reasons.push("user story / acceptance criteria column");
  }
  if (fieldMap.sprintCol) { score += 20; reasons.push("sprint / milestone column"); }
  if (normNames.some(n => /\b(requirement|req|task|backlog|to do|todo|epic)\b/.test(n))) {
    score += 15; reasons.push("requirement/task keyword in column name");
  }

  return { score, reasons };
}

// ─── Main exported detector ───────────────────────────────────────────────────

const TYPE_LABELS: Record<ExtendedDatasetType, string> = {
  bug_report:        "Bug / Defect Report",
  test_execution:    "Test Execution Report",
  test_case:         "Test Case Repository",
  requirement_task:  "Requirement / Task Sheet",
  generic:           "Generic Dataset",
};

export function detectDatasetType(
  headers: string[],
  rows: RawRow[]
): DetectedDatasetResult {
  const normNames = headers.map(normalizeColumnName);
  const fieldMap  = resolveFieldMap(headers);

  const scores: { type: ExtendedDatasetType; score: number }[] = [
    { type: "bug_report",       score: detectBugReport(normNames, fieldMap, rows).score       },
    { type: "test_execution",   score: detectTestExecution(normNames, fieldMap, rows).score   },
    { type: "test_case",        score: detectTestCase(normNames, fieldMap, rows).score        },
    { type: "requirement_task", score: detectRequirementTask(normNames, fieldMap, rows).score },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // Only claim a specific type if it scored meaningfully (≥ 20); else → generic
  const THRESHOLD = 20;
  const type: ExtendedDatasetType = best.score >= THRESHOLD ? best.type : "generic";
  const confidence = Math.min(100, Math.round(best.score));

  const totalRows = rows.length;
  const colCount  = headers.length;
  const summary   = `${TYPE_LABELS[type]} — ${totalRows.toLocaleString()} rows × ${colCount} columns`;

  return { type, confidence, fieldMap, summary };
}
