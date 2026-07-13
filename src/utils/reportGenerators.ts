import type { RawRow } from "@/types/bug";
import { type ExtendedDatasetType, type FieldMap } from "./datasetDetector";

export interface ReportKPI {
  id: string;
  label: string;
  value: string | number;
  sub?: string;
  color?: string; // red, orange, yellow, green, blue, purple, gray
}

export interface ReportChart {
  id: string;
  type: "pie" | "hbar" | "vbar" | "heatmap" | "stacked_bar" | "line";
  title: string;
  columns: string[];
  counts?: Record<string, number>;
}

export interface MissingValueInfo {
  col: string;
  missingCount: number;
  missingPercentage: number;
}

export interface GeneratedReport {
  datasetType: ExtendedDatasetType;
  title: string;
  summary: string;
  kpis: ReportKPI[];
  charts: ReportChart[];
  tableHeaders: string[];
  sampleRows: RawRow[];
  missingValueCols: MissingValueInfo[];
  duplicateCount: number;
  totalRows: number;
  confidence: number;
}

// Helper: Calculate counts for a column
function getColumnCounts(rows: RawRow[], colName?: string): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!colName) return counts;
  for (const row of rows) {
    const val = (row[colName] || "").trim();
    if (val) {
      counts[val] = (counts[val] || 0) + 1;
    }
  }
  return counts;
}

// Helper: Sum numeric values in a column across all rows
function sumColumn(rows: RawRow[], colName?: string): number {
  if (!colName) return 0;
  let total = 0;
  for (const row of rows) {
    const val = parseFloat(row[colName]);
    if (!isNaN(val)) total += val;
  }
  return total;
}

// Helper: Find the first column whose name contains any of the given keywords
function findColByKeywords(headers: string[], ...keywords: string[]): string | undefined {
  return headers.find(h => {
    const n = h.toLowerCase();
    return keywords.some(kw => n.includes(kw));
  });
}


// Helper: Calculate duplicate rows
function calculateDuplicates(rows: RawRow[], headers: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const cleanRow: Record<string, string> = {};
    for (const h of headers) {
      if (h !== "__sheet") {
        cleanRow[h] = row[h] || "";
      }
    }
    const str = JSON.stringify(cleanRow);
    if (seen.has(str)) {
      duplicates++;
    } else {
      seen.add(str);
    }
  }
  return duplicates;
}

// Helper: Calculate missing value info
function calculateMissingValues(rows: RawRow[], headers: string[]): MissingValueInfo[] {
  const list: MissingValueInfo[] = [];
  const total = rows.length;
  if (total === 0) return list;

  for (const h of headers) {
    if (h === "__sheet") continue;
    let missing = 0;
    for (const row of rows) {
      if (!(row[h] || "").trim()) {
        missing++;
      }
    }
    if (missing > 0) {
      list.push({
        col: h,
        missingCount: missing,
        missingPercentage: Math.round((missing / total) * 100),
      });
    }
  }

  return list.sort((a, b) => b.missingCount - a.missingCount);
}

// ─── Generators per type ──────────────────────────────────────────────────────

function generateBugReport(rows: RawRow[], fieldMap: FieldMap, headers: string[]): Partial<GeneratedReport> {
  const total = rows.length;
  const kpis: ReportKPI[] = [];

  // Total Defects
  kpis.push({ id: "total", label: "Total Defects", value: total, color: "blue", sub: "All logged defects" });

  // Status mapping
  const statusCol = fieldMap.statusCol;
  const statusCounts = getColumnCounts(rows, statusCol);
  let openCount = 0;
  let closedCount = 0;

  for (const [st, cnt] of Object.entries(statusCounts)) {
    const l = st.toLowerCase();
    if (["open", "new", "reopened", "to do", "todo", "in progress", "backlog"].some(kw => l.includes(kw))) {
      openCount += cnt;
    } else if (["closed", "fixed", "resolved", "done", "completed"].some(kw => l.includes(kw))) {
      closedCount += cnt;
    }
  }

  if (statusCol) {
    kpis.push({
      id: "open",
      label: "Open / Active",
      value: openCount,
      color: "red",
      sub: `${openCount} of ${total} (${total > 0 ? Math.round((openCount / total) * 100) : 0}%)`
    });
    kpis.push({
      id: "closed",
      label: "Closed / Resolved",
      value: closedCount,
      color: "green",
      sub: `${closedCount} of ${total} (${total > 0 ? Math.round((closedCount / total) * 100) : 0}%)`
    });
  }

  // Severity mapping
  const severityCol = fieldMap.severityCol;
  const severityCounts = getColumnCounts(rows, severityCol);
  let criticalCount = 0;

  for (const [sev, cnt] of Object.entries(severityCounts)) {
    const l = sev.toLowerCase();
    if (["critical", "blocker", "highest", "p1", "p0", "fatal"].some(kw => l.includes(kw))) {
      criticalCount += cnt;
    }
  }

  if (severityCol) {
    kpis.push({
      id: "critical",
      label: "Critical / Blocker",
      value: criticalCount,
      color: "orange",
      sub: `${criticalCount} high priority severity`
    });
  }

  // Charts
  const charts: ReportChart[] = [];
  if (severityCol && Object.keys(severityCounts).length > 0) {
    charts.push({
      id: "bug_severity",
      type: "pie",
      title: "Defect Severity Distribution",
      columns: [severityCol],
      counts: severityCounts,
    });
  }
  if (statusCol && Object.keys(statusCounts).length > 0) {
    charts.push({
      id: "bug_status",
      type: "vbar",
      title: "Defect Status Breakdown",
      columns: [statusCol],
      counts: statusCounts,
    });
  }
  const priorityCol = fieldMap.priorityCol;
  if (priorityCol) {
    charts.push({
      id: "bug_priority",
      type: "pie",
      title: "Priority Distribution",
      columns: [priorityCol],
      counts: getColumnCounts(rows, priorityCol),
    });
  }
  const assigneeCol = fieldMap.assigneeCol;
  if (assigneeCol) {
    charts.push({
      id: "bug_assignee",
      type: "hbar",
      title: "Assignee Distribution",
      columns: [assigneeCol],
      counts: getColumnCounts(rows, assigneeCol),
    });
  }

  return { kpis, charts };
}

function generateTestCaseReport(rows: RawRow[], fieldMap: FieldMap, headers: string[]): Partial<GeneratedReport> {
  const total = rows.length;
  const kpis: ReportKPI[] = [];
  const charts: ReportChart[] = [];

  // ── Detect aggregated mode: sheet has numeric columns like "Total", "P1", "P2", "P3"
  // in column names (e.g. "Number of Test Case generated - Total")
  const totalTcCol = findColByKeywords(headers, "generated - total", "tc generated - total", "test case generated - total", "number of test case - total");
  const p1Col = findColByKeywords(headers, "generated - p1", "tc generated - p1");
  const p2Col = findColByKeywords(headers, "generated - p2", "tc generated - p2");
  const p3Col = findColByKeywords(headers, "generated - p3", "tc generated - p3");
  const passCol = findColByKeywords(headers, "execution status - pass", "pass", "individual execution status - pass");
  const failCol = findColByKeywords(headers, "execution status - fail", "fail", "individual execution status - fail");
  const scriptedCol = findColByKeywords(headers, "scripted - total", "scripted removing - total");
  const validTcCol = findColByKeywords(headers, "valid number - total", "valid number of test cases - total", "after review");
  const reviewStatusCol = findColByKeywords(headers, "review sign off", "sign off", "review");

  const isAggregatedFormat = !!(totalTcCol || p1Col || passCol || failCol);

  if (isAggregatedFormat) {
    // ── Aggregated mode: each row = one module with numeric counts ─────────────
    const totalTCs = sumColumn(rows, totalTcCol);
    const p1Count = sumColumn(rows, p1Col);
    const p2Count = sumColumn(rows, p2Col);
    const p3Count = sumColumn(rows, p3Col);
    const passCount = sumColumn(rows, passCol);
    const failCount = sumColumn(rows, failCol);
    const scriptedTotal = sumColumn(rows, scriptedCol);
    const validTCs = sumColumn(rows, validTcCol);
    const moduleCount = total;

    kpis.push({ id: "modules", label: "Modules Covered", value: moduleCount, color: "blue", sub: "Unique modules in scope" });

    if (totalTcCol) {
      kpis.push({ id: "total_tc", label: "Total Test Cases", value: totalTCs, color: "purple", sub: "Sum across all modules" });
    }
    if (p1Col) {
      kpis.push({ id: "p1", label: "P1 (Critical)", value: p1Count, color: "red", sub: `${totalTCs > 0 ? Math.round((p1Count / totalTCs) * 100) : 0}% of total TCs` });
    }
    if (p2Col) {
      kpis.push({ id: "p2", label: "P2 (High)", value: p2Count, color: "orange", sub: `${totalTCs > 0 ? Math.round((p2Count / totalTCs) * 100) : 0}% of total TCs` });
    }
    if (p3Col) {
      kpis.push({ id: "p3", label: "P3 (Medium)", value: p3Count, color: "yellow", sub: `${totalTCs > 0 ? Math.round((p3Count / totalTCs) * 100) : 0}% of total TCs` });
    }
    if (passCol) {
      kpis.push({ id: "pass", label: "Executed & Passed", value: passCount, color: "green", sub: `Pass rate: ${(passCount + failCount) > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0}%` });
    }
    if (failCol) {
      kpis.push({ id: "fail", label: "Executed & Failed", value: failCount, color: "red", sub: `Fail rate: ${(passCount + failCount) > 0 ? Math.round((failCount / (passCount + failCount)) * 100) : 0}%` });
    }
    if (validTcCol && validTCs > 0) {
      kpis.push({ id: "valid", label: "Valid After Review", value: validTCs, color: "green", sub: `${totalTCs > 0 ? Math.round((validTCs / totalTCs) * 100) : 0}% of generated TCs valid` });
    }
    if (scriptedCol && scriptedTotal > 0) {
      kpis.push({ id: "scripted", label: "Scripted Tests", value: scriptedTotal, color: "blue", sub: "Test cases scripted & automated" });
    }

    // Per-module bar chart using total TCs column
    const moduleCol = fieldMap.moduleCol;
    if (moduleCol && totalTcCol) {
      const moduleTcCounts: Record<string, number> = {};
      for (const row of rows) {
        const mod = (row[moduleCol] || "").trim();
        const tc = parseFloat(row[totalTcCol]);
        if (mod && !isNaN(tc)) moduleTcCounts[mod] = tc;
      }
      if (Object.keys(moduleTcCounts).length > 0) {
        charts.push({ id: "tc_module_bar", type: "hbar", title: "Test Cases per Module", columns: [moduleCol], counts: moduleTcCounts });
      }
    }

    // Pass / Fail pie chart
    if (passCol && failCol && (passCount + failCount) > 0) {
      charts.push({
        id: "tc_pass_fail",
        type: "pie",
        title: "Execution Status (Pass vs Fail)",
        columns: [passCol],
        counts: { "Pass": passCount, "Fail": failCount },
      });
    }

    // P1/P2/P3 distribution
    if (p1Col && p2Col && p3Col) {
      charts.push({
        id: "tc_priority",
        type: "vbar",
        title: "Priority Distribution (P1 / P2 / P3)",
        columns: [p1Col],
        counts: {
          ...(p1Count > 0 ? { "P1 (Critical)": p1Count } : {}),
          ...(p2Count > 0 ? { "P2 (High)": p2Count } : {}),
          ...(p3Count > 0 ? { "P3 (Medium)": p3Count } : {}),
        },
      });
    }

    // Review sign-off distribution
    if (reviewStatusCol) {
      const reviewCounts = getColumnCounts(rows, reviewStatusCol);
      if (Object.keys(reviewCounts).length > 0) {
        charts.push({ id: "tc_review", type: "pie", title: "Review Sign-off Status", columns: [reviewStatusCol], counts: reviewCounts });
      }
    }

  } else {
    // ── Per-row mode: each row = one test case ────────────────────────────────
    kpis.push({ id: "total", label: "Total Cases", value: total, color: "blue", sub: "Test cases designed" });

    const priorityCol = fieldMap.priorityCol;
    const prioCounts = getColumnCounts(rows, priorityCol);
    let highPrioCount = 0;
    for (const [prio, cnt] of Object.entries(prioCounts)) {
      if (["high", "p1", "critical"].some(kw => prio.toLowerCase().includes(kw))) highPrioCount += cnt;
    }
    if (priorityCol) {
      kpis.push({ id: "high_prio", label: "High Priority Cases", value: highPrioCount, color: "red", sub: `${highPrioCount} of ${total}` });
    }

    const moduleCol = fieldMap.moduleCol;
    const moduleCounts = getColumnCounts(rows, moduleCol);
    if (moduleCol) {
      kpis.push({ id: "modules", label: "Total Modules / Features", value: Object.keys(moduleCounts).length, color: "purple", sub: "Distinct components covered" });
    }

    const autoCol = fieldMap.automationCol;
    const autoCounts = getColumnCounts(rows, autoCol);
    let automatedCount = 0;
    for (const [mode, cnt] of Object.entries(autoCounts)) {
      if (["yes", "automated", "automation", "true", "auto"].some(kw => mode.toLowerCase().includes(kw))) automatedCount += cnt;
    }
    if (autoCol) {
      kpis.push({ id: "automated", label: "Automated Cases", value: automatedCount, color: "green", sub: `${total > 0 ? Math.round((automatedCount / total) * 100) : 0}% automation coverage` });
    }

    if (moduleCol && Object.keys(moduleCounts).length > 0) {
      charts.push({ id: "tc_module", type: "hbar", title: "Module Distribution", columns: [moduleCol], counts: moduleCounts });
    }
    if (priorityCol && Object.keys(prioCounts).length > 0) {
      charts.push({ id: "tc_priority", type: "pie", title: "Priority Distribution", columns: [priorityCol], counts: prioCounts });
    }
    if (autoCol && Object.keys(autoCounts).length > 0) {
      charts.push({ id: "tc_automation", type: "vbar", title: "Automation Status", columns: [autoCol], counts: autoCounts });
    }
  }

  return { kpis, charts };
}


function generateTestExecutionReport(rows: RawRow[], fieldMap: FieldMap, headers: string[]): Partial<GeneratedReport> {
  const total = rows.length;
  const kpis: ReportKPI[] = [];

  const resultCol = fieldMap.resultCol || fieldMap.statusCol;
  const resCounts = getColumnCounts(rows, resultCol);

  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let skipped = 0;

  for (const [st, cnt] of Object.entries(resCounts)) {
    const l = st.toLowerCase();
    if (l === "pass" || l === "passed" || l === "success") passed += cnt;
    else if (l === "fail" || l === "failed" || l === "failure") failed += cnt;
    else if (l === "blocked" || l === "block") blocked += cnt;
    else if (l === "skipped" || l === "skip" || l === "not executed") skipped += cnt;
  }

  const executed = passed + failed + blocked;
  const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

  kpis.push({ id: "total", label: "Total Tests", value: total, color: "gray", sub: "All execution runs" });
  kpis.push({ id: "executed", label: "Executed", value: executed, color: "blue", sub: `${executed} run of ${total}` });
  kpis.push({ id: "passed", label: "Passed", value: passed, color: "green", sub: `Pass Rate: ${passRate}%` });
  kpis.push({ id: "failed", label: "Failed", value: failed, color: "red", sub: `Fail Rate: ${executed > 0 ? Math.round((failed / executed) * 100) : 0}%` });
  kpis.push({ id: "blocked", label: "Blocked", value: blocked, color: "orange", sub: "Blockers requiring fixes" });
  kpis.push({ id: "skipped", label: "Skipped", value: skipped, color: "yellow", sub: "Not executed" });

  const charts: ReportChart[] = [];
  if (resultCol && Object.keys(resCounts).length > 0) {
    charts.push({
      id: "exec_result",
      type: "pie",
      title: "Test Execution Results",
      columns: [resultCol],
      counts: resCounts,
    });
  }

  const moduleCol = fieldMap.moduleCol;
  if (moduleCol) {
    charts.push({
      id: "exec_module",
      type: "hbar",
      title: "Module Execution Distribution",
      columns: [moduleCol],
      counts: getColumnCounts(rows, moduleCol),
    });
  }

  return { kpis, charts };
}

function generateRequirementTaskReport(rows: RawRow[], fieldMap: FieldMap, headers: string[]): Partial<GeneratedReport> {
  const total = rows.length;
  const kpis: ReportKPI[] = [];

  kpis.push({ id: "total", label: "Total Tasks / Requirements", value: total, color: "blue", sub: "Backlog items" });

  const statusCol = fieldMap.statusCol;
  const statusCounts = getColumnCounts(rows, statusCol);

  const spCol = fieldMap.storyPointsCol;
  let totalSP = 0;
  if (spCol) {
    for (const r of rows) {
      const val = parseFloat(r[spCol]);
      if (!isNaN(val)) totalSP += val;
    }
    kpis.push({ id: "story_points", label: "Total Story Points", value: totalSP, color: "purple", sub: "Aggregated effort estimation" });
  }

  const priorityCol = fieldMap.priorityCol;
  const prioCounts = getColumnCounts(rows, priorityCol);

  const sprintCol = fieldMap.sprintCol;
  const sprintCounts = getColumnCounts(rows, sprintCol);

  // Charts
  const charts: ReportChart[] = [];
  if (statusCol && Object.keys(statusCounts).length > 0) {
    charts.push({
      id: "task_status",
      type: "pie",
      title: "Task Status Distribution",
      columns: [statusCol],
      counts: statusCounts,
    });
  }
  if (priorityCol && Object.keys(prioCounts).length > 0) {
    charts.push({
      id: "task_priority",
      type: "vbar",
      title: "Priority Distribution",
      columns: [priorityCol],
      counts: prioCounts,
    });
  }
  if (sprintCol && Object.keys(sprintCounts).length > 0) {
    charts.push({
      id: "task_sprint",
      type: "hbar",
      title: "Sprint / Release Breakdown",
      columns: [sprintCol],
      counts: sprintCounts,
    });
  }

  return { kpis, charts };
}

function generateGenericReport(rows: RawRow[], headers: string[]): Partial<GeneratedReport> {
  const total = rows.length;
  const kpis: ReportKPI[] = [];

  kpis.push({ id: "total_rows", label: "Row Count", value: total, color: "blue", sub: "Total records" });
  kpis.push({ id: "total_cols", label: "Column Count", value: headers.filter(h => h !== "__sheet").length, color: "purple", sub: "Total headers detected" });

  // Look for any 3 columns to count unique entries
  let count = 0;
  for (const h of headers) {
    if (h === "__sheet") continue;
    if (count >= 3) break;
    const counts = getColumnCounts(rows, h);
    const unique = Object.keys(counts).length;
    kpis.push({
      id: `generic_uniq_${h}`,
      label: `Unique ${h}`,
      value: unique,
      color: "gray",
      sub: `Values fill rate: ${total > 0 ? Math.round((Object.values(counts).reduce((a, b) => a + b, 0) / total) * 100) : 0}%`
    });
    count++;
  }

  // Create charts for top 3 categorical-looking columns
  const charts: ReportChart[] = [];
  let chartCount = 0;
  for (const h of headers) {
    if (h === "__sheet") continue;
    if (chartCount >= 3) break;
    const counts = getColumnCounts(rows, h);
    const unique = Object.keys(counts).length;
    // Guess if categorical: unique values count between 2 and 15
    if (unique >= 2 && unique <= 15) {
      charts.push({
        id: `generic_chart_${h}`,
        type: chartCount === 0 ? "pie" : "vbar",
        title: `${h} Breakdown`,
        columns: [h],
        counts,
      });
      chartCount++;
    }
  }

  return { kpis, charts };
}

// ─── Main exported orchestrator ────────────────────────────────────────────────

const TITLES: Record<ExtendedDatasetType, string> = {
  bug_report: "QA Bug Analytics & Defect Summary",
  test_execution: "Test Suite Run & Execution Report",
  test_case: "Test Case Design & Repository Analytics",
  requirement_task: "Sprint Backlog & Story Point Summary",
  generic: "Generic Tabular Data Report",
};

const SUMMARIES: Record<ExtendedDatasetType, string> = {
  bug_report: "Identified bug distribution trends, severity metrics, and resolution progress.",
  test_execution: "Monitored pass rates, failure logs, and overall test execution status across environments.",
  test_case: "Analyzed test suite module coverage, automation levels, and priority weights.",
  requirement_task: "Evaluated task statuses, story points distribution, and release milestones.",
  generic: "Provided structural column mapping, unique entry metrics, and data completeness analysis.",
};

export function generateReport(
  type: ExtendedDatasetType,
  confidence: number,
  fieldMap: FieldMap,
  headers: string[],
  rows: RawRow[]
): GeneratedReport {
  const defaultReport: GeneratedReport = {
    datasetType: type,
    title: TITLES[type],
    summary: SUMMARIES[type],
    kpis: [],
    charts: [],
    tableHeaders: headers.filter(h => h !== "__sheet"),
    sampleRows: rows.slice(0, 10),
    missingValueCols: calculateMissingValues(rows, headers),
    duplicateCount: calculateDuplicates(rows, headers),
    totalRows: rows.length,
    confidence,
  };

  let specific: Partial<GeneratedReport> = {};

  switch (type) {
    case "bug_report":
      specific = generateBugReport(rows, fieldMap, headers);
      break;
    case "test_case":
      specific = generateTestCaseReport(rows, fieldMap, headers);
      break;
    case "test_execution":
      specific = generateTestExecutionReport(rows, fieldMap, headers);
      break;
    case "requirement_task":
      specific = generateRequirementTaskReport(rows, fieldMap, headers);
      break;
    default:
      specific = generateGenericReport(rows, headers);
      break;
  }

  return {
    ...defaultReport,
    ...specific,
    kpis: specific.kpis || [],
    charts: specific.charts || [],
  };
}
