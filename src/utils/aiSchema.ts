/**
 * AI Schema Engine — the brain of the intelligence layer.
 * When AI is enabled, generates a structured schema that tells the dashboard
 * exactly which KPIs and charts to render for this specific dataset.
 * Falls back to heuristic rules when AI is unavailable.
 */
import type {
  AIProvider, AISchema, AISchemaKPI, AISchemaChart, AISchemaColumnMap,
  DataAnalysis, DynamicAggregations, RawRow, DetectedDataType,
} from "@/types/bug";
import { callAI } from "./aiProviders";

const INTERNAL_COLUMNS = ["__sheet"];

// ─── Heuristic data type detection ──────────────────────────────────────────

const BUG_KEYWORDS = ["bug", "defect", "severity", "issue", "vulnerability", "incident"];
const EXEC_KEYWORDS = ["result", "pass", "fail", "blocked", "execution", "run", "executed"];
const TC_KEYWORDS = ["test case", "test objective", "precondition", "procedure", "test scenario"];

export function detectDataTypeHeuristic(analysis: DataAnalysis): DetectedDataType {
  const names = analysis.columns.map(c => c.name.toLowerCase());
  const joined = names.join(" ");

  // Check if it has a Key column indicating Jira-style issue keys (like project letters-dash-number)
  const keyCol = analysis.columns.find(c => c.name.toLowerCase() === "key");
  const hasJiraKeys = keyCol && keyCol.topValues.some(v => /^[A-Z\d]+-\d+$/i.test(v.value.trim()));

  if (hasJiraKeys || names.some(n => n.includes("jira") || n === "issue key" || n === "ticket key")) {
    return "bug_report";
  }

  // Check value content too
  const allValues = analysis.columns
    .filter(c => c.type === "categorical")
    .flatMap(c => c.topValues.map(v => v.value.toLowerCase()));

  const hasSeverity = names.some(n => n.includes("severity"));
  const hasBugKeyword = BUG_KEYWORDS.some(k => joined.includes(k));
  const hasResultValues = allValues.some(v => ["pass", "fail", "passed", "failed", "blocked"].includes(v));
  const hasExecKeyword = EXEC_KEYWORDS.some(k => joined.includes(k));
  const hasTCKeyword = TC_KEYWORDS.some(k => joined.includes(k));
  const hasPriorityCol = names.some(n => n.includes("priority"));

  // Bug report: has severity column or bug-related column names
  if (hasSeverity && (hasBugKeyword || names.some(n => n.includes("status")))) {
    return "bug_report";
  }

  // Test execution: has result column with pass/fail values
  if (hasResultValues || (hasExecKeyword && !hasSeverity)) {
    return "test_execution";
  }

  // Test case: has test case keywords without result values
  if (hasTCKeyword || (hasPriorityCol && !hasResultValues && !hasSeverity)) {
    return "test_case";
  }

  // Bug report: severity without explicit bug keyword
  if (hasSeverity) return "bug_report";

  // Jira standard fallback (if contains status/priority/assignee/reporter)
  if (names.includes("assignee") && names.includes("status") && names.includes("priority")) {
    return "bug_report";
  }

  return "generic";
}

// ─── Column mapping heuristics ──────────────────────────────────────────────

function detectColumnMap(analysis: DataAnalysis): AISchemaColumnMap {
  const map: AISchemaColumnMap = {};
  // Allow mapping regardless of whether it's categorized as "categorical" (to handle high cardinality assignees/reporters)
  const cols = analysis.columns.filter(c => !INTERNAL_COLUMNS.includes(c.name));

  for (const col of cols) {
    const n = col.name.toLowerCase();

    if (!map.moduleColumn && /\b(module|component|feature|area|section|application|service|page|screen)\b/i.test(n)) {
      if (col.uniqueCount >= 2 && col.uniqueCount <= 100 && col.fillRate > 40) {
        map.moduleColumn = col.name;
      }
    }
    if (!map.severityColumn && /\b(severity|sev)\b/i.test(n)) map.severityColumn = col.name;
    if (!map.priorityColumn && /\b(priority|pri)\b/i.test(n)) map.priorityColumn = col.name;
    if (!map.statusColumn && /\b(status|state)\b/i.test(n)) map.statusColumn = col.name;
    if (!map.resultColumn && /\b(result|outcome|verdict|pass|fail)\b/i.test(n)) map.resultColumn = col.name;
    if (!map.typeColumn && /\b(type|category|classification|kind)\b/i.test(n) && !n.includes("priority")) map.typeColumn = col.name;
    if (!map.assigneeColumn && /\b(assignee|assigned|owner|tester|developer|reporter)\b/i.test(n)) map.assigneeColumn = col.name;
    if (!map.releaseColumn && /\b(release|version|sprint|milestone|build)\b/i.test(n)) map.releaseColumn = col.name;
  }

  // Fallback for moduleColumn if none matched the keywords
  if (!map.moduleColumn) {
    const fallbackCol = cols.find(c => {
      const ln = c.name.toLowerCase();
      return (ln === "project" || ln === "components" || ln === "labels") && c.uniqueCount >= 2;
    });
    if (fallbackCol) {
      map.moduleColumn = fallbackCol.name;
    }
  }

  return map;
}

// ─── Fallback schema (no AI needed) ─────────────────────────────────────────

export function generateFallbackSchema(
  analysis: DataAnalysis,
  agg: DynamicAggregations,
  dataType?: DetectedDataType
): AISchema {
  const dt = dataType || detectDataTypeHeuristic(analysis);
  const colMap = detectColumnMap(analysis);
  const kpis: AISchemaKPI[] = [];
  const charts: AISchemaChart[] = [];
  let priority = 100;

  // Total records KPI — always first
  kpis.push({ id: "total", label: "Total Records", column: "__total", type: "count", color: "blue" });

  if (dt === "bug_report") {
    buildBugKPIs(kpis, colMap, agg);
    buildBugCharts(charts, colMap, analysis, priority);
  } else if (dt === "test_execution") {
    buildExecKPIs(kpis, colMap, agg);
    buildExecCharts(charts, colMap, analysis, priority);
  } else if (dt === "test_case") {
    buildTCKPIs(kpis, colMap, agg);
    buildTCCharts(charts, colMap, analysis, priority);
  } else {
    buildGenericKPIs(kpis, analysis, agg);
    buildGenericCharts(charts, analysis, priority);
  }

  return {
    dataType: dt,
    kpis,
    charts,
    columnMap: colMap,
    summary: generateSummary(dt, agg.total, analysis.columns.length),
  };
}

function buildBugKPIs(kpis: AISchemaKPI[], colMap: AISchemaColumnMap, agg: DynamicAggregations) {
  const sevCol = colMap.severityColumn || colMap.priorityColumn;
  if (sevCol) {
    const counts = agg.columnCounts[sevCol] || {};
    const sevValues = Object.keys(counts).map(k => k.toLowerCase());
    
    const critKws = ["critical", "blocker", "highest", "p1"];
    const highKws = ["high", "major", "p2"];
    const medKws = ["medium", "minor", "p3"];
    const lowKws = ["low", "trivial", "lowest", "p4"];

    if (sevValues.some(v => critKws.some(kw => v === kw || v.includes(kw))))
      kpis.push({ id: "critical", label: "Critical / P1", column: sevCol, value: findMatchingValue(counts, critKws), type: "count_value", color: "red" });
    if (sevValues.some(v => highKws.some(kw => v === kw || v.includes(kw))))
      kpis.push({ id: "high", label: "High / P2", column: sevCol, value: findMatchingValue(counts, highKws), type: "count_value", color: "orange" });
    if (sevValues.some(v => medKws.some(kw => v === kw || v.includes(kw))))
      kpis.push({ id: "medium", label: "Medium / P3", column: sevCol, value: findMatchingValue(counts, medKws), type: "count_value", color: "yellow" });
    if (sevValues.some(v => lowKws.some(kw => v === kw || v.includes(kw))))
      kpis.push({ id: "low", label: "Low / P4", column: sevCol, value: findMatchingValue(counts, lowKws), type: "count_value", color: "green" });
  }

  if (colMap.statusColumn) {
    const counts = agg.columnCounts[colMap.statusColumn] || {};
    const statValues = Object.keys(counts).map(k => k.toLowerCase());
    
    const openKeywords = ["open", "new", "reopened", "to do", "todo", "in progress", "backlog", "ready", "under review", "in review"];
    const closedKeywords = ["closed", "fixed", "resolved", "done", "ready for production", "production", "completed"];

    if (statValues.some(v => openKeywords.some(kw => v === kw || v.includes(kw)))) {
      kpis.push({ id: "open", label: "Open / In Progress", column: colMap.statusColumn, value: findMatchingValue(counts, openKeywords), type: "count_value", color: "red" });
    }
    if (statValues.some(v => closedKeywords.some(kw => v === kw || v.includes(kw)))) {
      kpis.push({ id: "closed", label: "Closed / Done", column: colMap.statusColumn, value: findMatchingValue(counts, closedKeywords), type: "count_value", color: "green" });
    }
  }
}

function buildExecKPIs(kpis: AISchemaKPI[], colMap: AISchemaColumnMap, agg: DynamicAggregations) {
  const resultCol = colMap.resultColumn;
  if (!resultCol) return;
  const counts = agg.columnCounts[resultCol] || {};
  const vals = Object.keys(counts).map(k => k.toLowerCase());

  if (vals.some(v => v.includes("pass")))
    kpis.push({ id: "pass", label: "Pass", column: resultCol, value: findMatchingValue(counts, ["pass", "passed"]), type: "count_value", color: "green", format: "with_pct" });
  if (vals.some(v => v.includes("fail")))
    kpis.push({ id: "fail", label: "Fail", column: resultCol, value: findMatchingValue(counts, ["fail", "failed"]), type: "count_value", color: "red", format: "with_pct" });
  if (vals.some(v => v.includes("block")))
    kpis.push({ id: "blocked", label: "Blocked", column: resultCol, value: findMatchingValue(counts, ["blocked", "block"]), type: "count_value", color: "orange" });
  if (vals.some(v => v.includes("not") || v.includes("skip") || v.includes("n/a")))
    kpis.push({ id: "not_exec", label: "Not Executed", column: resultCol, value: findMatchingValue(counts, ["not executed", "not run", "skipped", "n/a", "not applicable"]), type: "count_value", color: "gray" });
}

function buildTCKPIs(kpis: AISchemaKPI[], colMap: AISchemaColumnMap, agg: DynamicAggregations) {
  const prioCol = colMap.priorityColumn;
  if (prioCol) {
    const counts = agg.columnCounts[prioCol] || {};
    const vals = Object.keys(counts).map(k => k.toLowerCase());
    if (vals.some(v => v === "p1" || v === "high" || v === "critical"))
      kpis.push({ id: "p1", label: "P1", column: prioCol, value: findMatchingValue(counts, ["p1", "high", "critical"]), type: "count_value", color: "red" });
    if (vals.some(v => v === "p2" || v === "medium"))
      kpis.push({ id: "p2", label: "P2", column: prioCol, value: findMatchingValue(counts, ["p2", "medium"]), type: "count_value", color: "orange" });
    if (vals.some(v => v === "p3" || v === "low"))
      kpis.push({ id: "p3", label: "P3", column: prioCol, value: findMatchingValue(counts, ["p3", "low"]), type: "count_value", color: "yellow" });
  }
  if (colMap.moduleColumn) {
    const counts = agg.columnCounts[colMap.moduleColumn] || {};
    kpis.push({ id: "modules", label: "Total Modules", column: colMap.moduleColumn, type: "count", color: "blue" });
  }
}

function buildGenericKPIs(kpis: AISchemaKPI[], analysis: DataAnalysis, agg: DynamicAggregations) {
  // Pick top 3 most relevant categorical columns
  const categoricals = analysis.columns
    .filter(c => c.type === "categorical" && !INTERNAL_COLUMNS.includes(c.name) && c.uniqueCount >= 2 && c.uniqueCount <= 10 && c.fillRate > 40)
    .sort((a, b) => a.uniqueCount - b.uniqueCount)
    .slice(0, 3);

  for (const col of categoricals) {
    const counts = agg.columnCounts[col.name] || {};
    const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
    if (top) {
      kpis.push({
        id: `top_${col.name}`,
        label: `Top ${col.name}`,
        column: col.name,
        value: top[0],
        type: "count_value",
        color: "blue",
      });
    }
  }

  // Data quality
  const avgFill = analysis.columns.length > 0
    ? Math.round(analysis.columns.reduce((s, c) => s + c.fillRate, 0) / analysis.columns.length)
    : 0;
  kpis.push({ id: "quality", label: "Data Quality", column: "__quality", type: "count", color: avgFill >= 80 ? "green" : avgFill >= 60 ? "yellow" : "red" });
}

// ─── Chart builders ─────────────────────────────────────────────────────────

function buildBugCharts(charts: AISchemaChart[], colMap: AISchemaColumnMap, analysis: DataAnalysis, p: number) {
  const sevCol = colMap.severityColumn || colMap.priorityColumn;
  const modCol = colMap.moduleColumn || analysis.columns.find(c => ["project", "components", "__sheet"].includes(c.name.toLowerCase()))?.name;

  const getUniqueCount = (colName: string | undefined) => {
    if (!colName) return 0;
    return analysis.columns.find(c => c.name === colName)?.uniqueCount || 0;
  };

  const sevUnique = getUniqueCount(sevCol);
  const modUnique = getUniqueCount(modCol);

  if (sevCol && modCol && sevUnique >= 2 && modUnique >= 2) {
    charts.push({ id: "sev_mod_heat", type: "heatmap", title: `${sevCol} × ${modCol} Heatmap`, columns: [modCol, sevCol], priority: p-- });
  }
  if (sevCol && sevUnique >= 2) {
    charts.push({ id: "sev_dist", type: "pie", title: `${sevCol} Distribution`, columns: [sevCol], priority: p-- });
  }
  if (modCol && modUnique >= 2) {
    charts.push({ id: "mod_dist", type: "hbar", title: `${modCol}-wise Issue Distribution`, columns: [modCol], priority: p-- });
  }
  if (colMap.typeColumn && getUniqueCount(colMap.typeColumn) >= 2) {
    charts.push({ id: "type_dist", type: "vbar", title: "Type Distribution", columns: [colMap.typeColumn], priority: p-- });
  }
  if (colMap.statusColumn && getUniqueCount(colMap.statusColumn) >= 2) {
    charts.push({ id: "status_dist", type: "vbar", title: "Status Distribution", columns: [colMap.statusColumn], priority: p-- });
  }
  if (colMap.assigneeColumn && getUniqueCount(colMap.assigneeColumn) >= 2) {
    charts.push({ id: "assignee_dist", type: "hbar", title: "Assignee Distribution", columns: [colMap.assigneeColumn], priority: p-- });
  }

  // Fallback: add any remaining categoricals
  addFallbackCharts(charts, analysis, [sevCol, modCol, colMap.typeColumn, colMap.statusColumn, colMap.assigneeColumn].filter(Boolean) as string[], p);
}

function buildExecCharts(charts: AISchemaChart[], colMap: AISchemaColumnMap, analysis: DataAnalysis, p: number) {
  const getUniqueCount = (colName: string | undefined) => {
    if (!colName) return 0;
    return analysis.columns.find(c => c.name === colName)?.uniqueCount || 0;
  };

  const modUnique = getUniqueCount(colMap.moduleColumn);
  const resultUnique = getUniqueCount(colMap.resultColumn);
  const prioUnique = getUniqueCount(colMap.priorityColumn);

  if (colMap.moduleColumn && colMap.resultColumn && modUnique >= 2 && resultUnique >= 2) {
    charts.push({ id: "mod_result_heat", type: "heatmap", title: "Module × Result", columns: [colMap.moduleColumn, colMap.resultColumn], priority: p-- });
  }
  if (colMap.resultColumn && resultUnique >= 2) {
    charts.push({ id: "result_dist", type: "pie", title: "Result Distribution", columns: [colMap.resultColumn], priority: p-- });
  }
  if (colMap.moduleColumn && modUnique >= 2) {
    charts.push({ id: "mod_dist", type: "hbar", title: "Module-wise TC Distribution", columns: [colMap.moduleColumn], priority: p-- });
  }
  if (colMap.priorityColumn && colMap.resultColumn && prioUnique >= 2 && resultUnique >= 2) {
    charts.push({ id: "prio_result", type: "stacked_bar", title: "Priority × Result", columns: [colMap.priorityColumn, colMap.resultColumn], priority: p-- });
  }
  // Run column detection
  const runCol = analysis.columns.find(c =>
    c.type === "categorical" && /\b(run|cycle|sprint|iteration|batch|suite)\b/i.test(c.name.toLowerCase()) && c.uniqueCount >= 2 && c.uniqueCount <= 30
  );
  if (runCol) {
    charts.push({ id: "run_dist", type: "vbar", title: "Run-wise Distribution", columns: [runCol.name], priority: p-- });
  }
  addFallbackCharts(charts, analysis, [colMap.resultColumn, colMap.moduleColumn, colMap.priorityColumn, runCol?.name].filter(Boolean) as string[], p);
}

function buildTCCharts(charts: AISchemaChart[], colMap: AISchemaColumnMap, analysis: DataAnalysis, p: number) {
  const getUniqueCount = (colName: string | undefined) => {
    if (!colName) return 0;
    return analysis.columns.find(c => c.name === colName)?.uniqueCount || 0;
  };

  const prioUnique = getUniqueCount(colMap.priorityColumn);
  const modUnique = getUniqueCount(colMap.moduleColumn);
  const statusUnique = getUniqueCount(colMap.statusColumn);

  if (colMap.priorityColumn && prioUnique >= 2) {
    charts.push({ id: "prio_dist", type: "pie", title: "Priority Distribution", columns: [colMap.priorityColumn], priority: p-- });
  }
  if (colMap.moduleColumn && modUnique >= 2) {
    charts.push({ id: "mod_dist", type: "hbar", title: "Module-wise TC Distribution", columns: [colMap.moduleColumn], priority: p-- });
  }
  if (colMap.priorityColumn && colMap.statusColumn && prioUnique >= 2 && statusUnique >= 2) {
    charts.push({ id: "prio_status", type: "stacked_bar", title: "Priority × Status", columns: [colMap.priorityColumn, colMap.statusColumn], priority: p-- });
  }
  if (colMap.statusColumn && statusUnique >= 2) {
    charts.push({ id: "status_dist", type: "vbar", title: "Status Distribution", columns: [colMap.statusColumn], priority: p-- });
  }
  addFallbackCharts(charts, analysis, [colMap.priorityColumn, colMap.moduleColumn, colMap.statusColumn].filter(Boolean) as string[], p);
}

function buildGenericCharts(charts: AISchemaChart[], analysis: DataAnalysis, p: number) {
  addFallbackCharts(charts, analysis, [], p);
}

function addFallbackCharts(charts: AISchemaChart[], analysis: DataAnalysis, exclude: string[], p: number) {
  const existingCols = new Set(charts.flatMap(c => c.columns));
  exclude.forEach(e => existingCols.add(e));

  const categoricals = analysis.columns
    .filter(c => c.type === "categorical" && !INTERNAL_COLUMNS.includes(c.name) && !existingCols.has(c.name) && c.fillRate > 20 && c.uniqueCount >= 2)
    .sort((a, b) => a.uniqueCount - b.uniqueCount)
    .slice(0, Math.max(0, 8 - charts.length));

  let pieCount = charts.filter(c => c.type === "pie").length;

  for (const col of categoricals) {
    let type: "pie" | "vbar" | "hbar" = "vbar";
    if (col.uniqueCount <= 5 && pieCount < 2) {
      type = "pie";
      pieCount++;
    } else if (col.uniqueCount <= 10) {
      type = "vbar";
    } else {
      type = "hbar";
    }
    charts.push({ id: `auto_${col.name}`, type, title: `${col.name} Distribution`, columns: [col.name], priority: p-- });
  }
}

// ─── Helper: find the actual casing of a value that matches a keyword ────────
function findMatchingValue(counts: Record<string, number>, keywords: string[]): string {
  for (const [val] of Object.entries(counts).sort(([, a], [, b]) => b - a)) {
    for (const kw of keywords) {
      if (val.toLowerCase() === kw || val.toLowerCase().includes(kw)) return val;
    }
  }
  return keywords[0];
}

function generateSummary(dt: DetectedDataType, total: number, colCount: number): string {
  const types: Record<DetectedDataType, string> = {
    bug_report: "Bug/Defect Report",
    test_execution: "Test Execution Report",
    test_case: "Test Case Repository",
    generic: "Data Analysis",
  };
  return `${types[dt]} — ${total.toLocaleString()} records across ${colCount} columns`;
}

// ─── KPI value computation ──────────────────────────────────────────────────

export function computeKPIValue(
  kpi: AISchemaKPI,
  agg: DynamicAggregations,
  analysis: DataAnalysis
): { value: string | number; sub?: string } {
  // Special columns
  if (kpi.column === "__total") {
    return { value: agg.total.toLocaleString() };
  }
  if (kpi.column === "__quality") {
    const avgFill = analysis.columns.length > 0
      ? Math.round(analysis.columns.reduce((s, c) => s + c.fillRate, 0) / analysis.columns.length)
      : 0;
    return { value: `${avgFill}%`, sub: `${analysis.columns.length} columns` };
  }

  const counts = agg.columnCounts[kpi.column] || {};

  if (kpi.type === "count") {
    // Count unique values in this column
    const uniqueCount = Object.keys(counts).length;
    return { value: uniqueCount };
  }

  if (kpi.type === "count_value" && kpi.value) {
    // Count occurrences of a specific value (case-insensitive match)
    let matchCount = 0;
    const matchValues: string[] = [];
    for (const [val, cnt] of Object.entries(counts)) {
      if (val.toLowerCase() === kpi.value.toLowerCase() || val.toLowerCase().includes(kpi.value.toLowerCase())) {
        matchCount += cnt;
        matchValues.push(val);
      }
    }
    const pct = agg.total > 0 ? ((matchCount / agg.total) * 100).toFixed(1) : "0";
    const sub = kpi.format === "with_pct"
      ? `${matchCount.toLocaleString()} (${pct}%)`
      : `${matchCount.toLocaleString()} of ${agg.total.toLocaleString()}`;
    return { value: matchCount.toLocaleString(), sub };
  }

  if (kpi.type === "percentage" && kpi.value) {
    let matchCount = 0;
    for (const [val, cnt] of Object.entries(counts)) {
      if (val.toLowerCase().includes(kpi.value.toLowerCase())) matchCount += cnt;
    }
    const pct = agg.total > 0 ? ((matchCount / agg.total) * 100).toFixed(1) : "0";
    return { value: `${pct}%`, sub: `${matchCount} of ${agg.total}` };
  }

  // Default: show top value
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  if (sorted.length > 0) {
    const [topVal, topCount] = sorted[0];
    const pct = agg.total > 0 ? Math.round((topCount / agg.total) * 100) : 0;
    return { value: topVal, sub: `${topCount} (${pct}%)` };
  }

  return { value: "—" };
}

// ─── AI-powered schema generation ───────────────────────────────────────────

export async function generateAISchema(
  apiKey: string,
  provider: AIProvider,
  model: string,
  analysis: DataAnalysis,
  rows: RawRow[]
): Promise<AISchema | null> {
  const columns = analysis.columns.filter(c => !INTERNAL_COLUMNS.includes(c.name));

  const columnDescriptions = columns.map(col => {
    const topVals = col.topValues.slice(0, 10).map(v =>
      `"${v.value}"(${v.count})`
    ).join(", ");
    return `- ${col.name} [${col.type}, ${col.uniqueCount} unique, ${Math.round(col.fillRate)}% filled]: ${topVals}`;
  }).join("\n");

  const sampleRows = rows.slice(0, 3).map(r => {
    const o: Record<string, string> = {};
    for (const col of columns) o[col.name] = (r[col.name] || "").slice(0, 60);
    return o;
  });

  const prompt = `You are a QA data analyst AI. Analyze these columns and return a JSON schema for the dashboard.

COLUMNS AND VALUE DISTRIBUTIONS:
${columnDescriptions}

SAMPLE ROWS:
${JSON.stringify(sampleRows, null, 1)}

Return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "dataType": "bug_report" | "test_execution" | "test_case" | "generic",
  "summary": "one-line description of the dataset",
  "columnMap": {
    "moduleColumn": "exact column name or null",
    "severityColumn": "exact column name or null",
    "priorityColumn": "exact column name or null",
    "statusColumn": "exact column name or null",
    "resultColumn": "exact column name or null",
    "typeColumn": "exact column name or null",
    "assigneeColumn": "exact column name or null",
    "releaseColumn": "exact column name or null"
  },
  "kpis": [
    { "id": "unique_id", "label": "Display Label", "column": "exact_column_name", "value": "value to count or null", "type": "count|count_value|percentage", "color": "red|orange|yellow|green|blue|purple|gray", "format": "with_pct or null" }
  ],
  "charts": [
    { "id": "unique_id", "type": "pie|hbar|vbar|heatmap|stacked_bar|line", "title": "Chart Title", "columns": ["col1", "col2_if_cross"], "priority": 100 }
  ]
}

RULES:
- Column names in the output MUST exactly match the input column names (case-sensitive)
- For BUG DATA KPIs: Total Bugs, then counts for each severity level (Critical/High/Medium/Low), Open count, Closed/Fixed count
- For TEST EXECUTION KPIs: Total TCs, Pass + pass rate %, Fail + fail rate %, Blocked count, Not Executed count
- For TEST CASE KPIs: Total TCs, P1/P2/P3 counts, total modules count
- **CRITICAL**: ONLY use categorical columns for charts (e.g., Status, Priority, Severity, Assignee, Environment). NEVER use free-text columns (like Comments, Descriptions, Titles, Steps, Actual Result) or unique ID columns.
- **CRITICAL**: You MUST include a "heatmap" chart for cross-analysis (e.g., Assignee × Severity, Status × Severity, Priority × Result, Environment × Severity, or Module × Status).
- **CRITICAL**: You MUST include a "line" chart if a Date column exists.
- **CRITICAL**: Limit the 'pie' chart type to a maximum of 2 charts. Prefer 'vbar' for status, priority, and categories with fewer than 10 options. Prefer 'hbar' for assignee, component, or categories with many options (to prevent labels from overlapping).
- For charts: prioritize domain-relevant distributions over generic ones. Ensure charts are logically sound and provide actionable insights.
- Use "count_value" type when counting specific values, "count" for total/unique counts
- Use "__total" as column for total records KPI
- Maximum 8 KPIs and 6 charts
- Charts priority: higher number = more important, start at 100`;

  try {
    const result = await callAI(apiKey, provider, model, [
      { role: "system", content: "You are a data analysis AI. Return ONLY valid JSON, no markdown formatting." },
      { role: "user", content: prompt },
    ], { temperature: 0.1, maxTokens: 1500, jsonMode: true });

    if (!result) return null;

    // Parse JSON — handle potential markdown code fences
    let cleaned = result.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned) as AISchema;

    // Validate required fields exist
    if (!parsed.dataType || !Array.isArray(parsed.kpis) || !Array.isArray(parsed.charts)) {
      console.warn("AI schema missing required fields, falling back");
      return null;
    }

    // Validate column names actually exist in the data
    const validColumns = new Set(columns.map(c => c.name));
    validColumns.add("__total");
    validColumns.add("__quality");

    // Post-process fallbacks for critical columns
    if (!parsed.columnMap) parsed.columnMap = {};
    if (!parsed.columnMap.severityColumn) {
      if (validColumns.has("Priority")) parsed.columnMap.severityColumn = "Priority";
      else if (validColumns.has("Severity")) parsed.columnMap.severityColumn = "Severity";
    }
    if (!parsed.columnMap.moduleColumn) {
      if (validColumns.has("Project")) parsed.columnMap.moduleColumn = "Project";
      else if (validColumns.has("Components")) parsed.columnMap.moduleColumn = "Components";
    }
    if (!parsed.columnMap.statusColumn && validColumns.has("Status")) {
      parsed.columnMap.statusColumn = "Status";
    }
    if (!parsed.columnMap.assigneeColumn && validColumns.has("Assignee")) {
      parsed.columnMap.assigneeColumn = "Assignee";
    }

    parsed.kpis = parsed.kpis.filter(k => validColumns.has(k.column));
    
    // ── STRICT STRUCTURAL FILTER: Block the AI from rendering garbage charts ──
    parsed.charts = parsed.charts.filter(c => {
      return c.columns.every(col => {
        if (col === "__total") return true;
        if (!validColumns.has(col)) return false;
        
        const colDef = columns.find(x => x.name === col);
        if (!colDef) return true;

        // Ban single-value columns (uniqueCount < 2)
        if (colDef.uniqueCount < 2) return false;

        // 1. Hard ban on known free-text columns
        if (colDef.type === "text") return false;
        
        // 2. Hard ban on lines of sentences (if top values average > 40 chars, it's text not categories)
        const avgLen = colDef.topValues.reduce((s, v) => s + String(v.value).length, 0) / (colDef.topValues.length || 1);
        if (avgLen > 35) return false;

        // 3. Reject high-cardinality noise for charts (unless it's a known structural ID like user/module)
        const isStructural = /assignee|user|owner|tester|module|component|environment|browser|platform|squad/i.test(col);
        if (colDef.uniqueCount > 25 && !isStructural) return false;

        // 4. Dates can only go to Line charts, Line charts can only use Dates
        if (c.type === "line" && colDef.type !== "date") return false;
        if (c.type !== "line" && colDef.type === "date") return false;

        return true;
      });
    });

    // --- Post-processing: Inject heatmap if AI forgot (avoiding module columns) ---
    const hasHeatmap = parsed.charts.some(c => c.type === "heatmap");
    if (!hasHeatmap) {
      const MODULE_KEYWORDS = ["module", "feature", "component", "screen", "area",
        "section", "epic", "page", "service", "team"];
      const isModuleCol = (col: string) =>
        MODULE_KEYWORDS.some(k => col.toLowerCase().includes(k));

      // Prefer Assignee/Status/Priority cross with Severity/Result
      const signalCols = columns
        .filter(c => c.type === "categorical" && c.uniqueCount <= 12 && c.fillRate > 20
          && !isModuleCol(c.name))
        .sort((a, b) => {
          const SIGNAL = ["assignee", "assign", "owner", "tester", "status", "state",
            "severity", "priority", "result", "type", "environment", "platform"];
          const ai = SIGNAL.findIndex(k => a.name.toLowerCase().includes(k));
          const bi = SIGNAL.findIndex(k => b.name.toLowerCase().includes(k));
          if (ai === -1 && bi === -1) return a.uniqueCount - b.uniqueCount;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

      if (signalCols.length >= 2) {
        parsed.charts.unshift({
          id: "inserted_heatmap",
          type: "heatmap",
          title: `${signalCols[0].name} × ${signalCols[1].name}`,
          columns: [signalCols[0].name, signalCols[1].name],
          priority: 200,
        });
      }
    }

    // --- Post-processing: Inject line chart if AI forgot ---
    const hasLine = parsed.charts.some(c => c.type === "line");
    if (!hasLine) {
      const dates = columns.filter(c => c.type === "date" && c.fillRate > 30);
      if (dates.length > 0) {
        const bestDate = dates.sort((a, b) => {
          const aPri = /\b(creat|submi|report|date)\b/i.test(a.name) ? 1 : 0;
          const bPri = /\b(creat|submi|report|date)\b/i.test(b.name) ? 1 : 0;
          return bPri - aPri;
        })[0];
        parsed.charts.push({
          id: "inserted_line",
          type: "line",
          title: `Trend over Time (${bestDate.name})`,
          columns: [bestDate.name],
          priority: 195,
        });
      }
    }

    // --- Post-processing: Backfill charts if AI didn't provide enough valid ones ---
    // This perfectly solves the "sometimes it generates nothing/too few" inconsistency
    if (parsed.charts.length < 6) {
      const existingCols = new Set(parsed.charts.map(c => c.columns[0]));
      const sortedSuggestions = [...analysis.chartSuggestions].sort((a, b) => b.priority - a.priority);

      for (const fallback of sortedSuggestions) {
        if (parsed.charts.length >= 6) break;
        const mainCol = fallback.columns[0];
        
        // Skip if already plotted
        if (existingCols.has(mainCol)) continue;

        parsed.charts.push({
          id: `backfill_${mainCol.replace(/[^a-zA-Z0-9]/g, "_")}`,
          type: fallback.type as any,
          title: fallback.title,
          columns: fallback.columns,
          priority: fallback.priority,
        });
        existingCols.add(mainCol);
      }
    }

    // Ensure total KPI exists
    if (!parsed.kpis.some(k => k.column === "__total")) {
      parsed.kpis.unshift({ id: "total", label: "Total Records", column: "__total", type: "count", color: "blue" });
    }

    return parsed;
  } catch (e) {
    console.error("Failed to generate AI schema:", e);
    return null;
  }
}
