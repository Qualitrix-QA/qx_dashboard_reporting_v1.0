import type { RawRow, DataAnalysis, AISchema } from "@/types/bug";

// Helper to extract unique products and modules from rows (used by main explorer tab)
export function extractProductsAndModules(rows: RawRow[], analysis: DataAnalysis, aiSchema?: AISchema | null) {
  const products = new Set<string>();
  const modules = new Set<string>();

  // Find columns
  const productCols = analysis.columns.filter(c =>
    /\b(product|project|app|application)\b/i.test(c.name.toLowerCase())
  ).map(c => c.name);

  const moduleCol = aiSchema?.columnMap?.moduleColumn ||
    analysis.columns.find(c =>
      /\b(module|component|feature|area|section|screen|page)\b/i.test(c.name.toLowerCase())
    )?.name;

  for (const r of rows) {
    for (const pCol of productCols) {
      if (r[pCol]) products.add(r[pCol]);
    }
    if (moduleCol && r[moduleCol]) {
      modules.add(r[moduleCol]);
    }
  }

  return {
    products: products.size > 0 ? Array.from(products).slice(0, 5) : ["Product A", "Product B", "Product C", "Product D", "Product E"],
    modules: modules.size > 0 ? Array.from(modules).slice(0, 6) : ["Authentication", "Payment Gateway", "Dashboard", "Checkout", "Notification API", "Analytics Engine"]
  };
}

// ─── UTILITIES & HELPERS FOR SHEET PARTITIONING AND DATES ────────────────────

function parseExcelDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;

  // Handle Excel serial date if it's a number (or a string representing a number)
  const numVal = Number(dateVal);
  if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
    const date = new Date((numVal - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(dateVal).trim();
  if (!str) return null;

  // Format DD/MM/YYYY or D/M/YYYY or YYYY-MM-DD
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    if (parts[2].length === 4) {
      // DD/MM/YYYY
      year = parseInt(parts[2], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[0], 10);
    } else if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function getBugLogRows(rows: RawRow[]): RawRow[] {
  const bySheet = rows.filter(r =>
    r.__sheet && (
      r.__sheet.toLowerCase().includes("bug") ||
      r.__sheet.toLowerCase().includes("defect") ||
      r.__sheet.toLowerCase().includes("issue") ||
      r.__sheet.toLowerCase().includes("incident") ||
      r.__sheet.toLowerCase().includes("prod")
    )
  );
  if (bySheet.length > 0) return bySheet;

  // Fallback column-based check using regex
  return rows.filter(r => {
    const keys = Object.keys(r);
    return keys.some(k =>
      /\b(bug\s*id|bugid|rca\s*category|root\s*cause|rca|severity|priority)\b/i.test(k)
    );
  });
}

function getTestExecutionRows(rows: RawRow[]): RawRow[] {
  const bySheet = rows.filter(r =>
    r.__sheet && (
      r.__sheet.toLowerCase().includes("test execution") ||
      r.__sheet.toLowerCase().includes("execution log") ||
      r.__sheet.toLowerCase().includes("test log") ||
      r.__sheet.toLowerCase().includes("execution")
    )
  );
  if (bySheet.length > 0) return bySheet;

  // Fallback column-based check using regex
  return rows.filter(r => {
    const keys = Object.keys(r);
    return keys.some(k =>
      /\b(tc\s*id|tcid|test\s*case\s*id|execution\s*mode|execution)\b/i.test(k)
    );
  });
}

function getTimesheetRows(rows: RawRow[]): RawRow[] {
  const bySheet = rows.filter(r =>
    r.__sheet && (
      r.__sheet.toLowerCase().includes("timesheet") ||
      r.__sheet.toLowerCase().includes("time sheet") ||
      r.__sheet.toLowerCase().includes("worklog") ||
      r.__sheet.toLowerCase().includes("utilization")
    )
  );
  if (bySheet.length > 0) return bySheet;

  // Fallback column-based check using regex
  return rows.filter(r => {
    const keys = Object.keys(r);
    return keys.some(k =>
      /\b(entry\s*id|team\s*member|member|week|total\s*hours)\b/i.test(k)
    );
  });
}

function getColKeys(row: RawRow) {
  const keys = Object.keys(row);
  const findKey = (patterns: RegExp[], fallback: string) => {
    for (const pattern of patterns) {
      const found = keys.find(k => pattern.test(k));
      if (found) return found;
    }
    return fallback;
  };

  return {
    dateReported: findKey([
      /\b(date\s*reported|date\s*reporte|reported\s*date|reported|rep\s*date)\b/i,
      /reported/i
    ], "Date Reported"),

    dateResolved: findKey([
      /\b(date\s*resolved|date\s*resolve|resolved\s*date|resolved|date\s*resolv|res\s*date)\b/i,
      /resolved/i,
      /resolv/i
    ], "Date Resolved"),

    severity: findKey([
      /\b(severity|sev)\b/i
    ], "Severity"),

    priority: findKey([
      /\b(priority|prio)\b/i
    ], "Priority"),

    status: findKey([
      /\b(status|state)\b/i
    ], "Status"),

    age: findKey([
      /\b(age\s*\(days\)|age)\b/i
    ], "Age (Days)"),

    rca: findKey([
      /\b(rca\s*category|root\s*cause|rca|category)\b/i
    ], "RCA Category"),

    reporter: findKey([
      /\b(reporter|reported\s*by)\b/i
    ], "Reporter"),

    product: findKey([
      /\b(product|project|app|application)\b/i
    ], "Product"),

    module: findKey([
      /\b(module|component|feature|area)\b/i
    ], "Module")
  };
}

function getTestExecutionColKeys(row: RawRow) {
  const keys = Object.keys(row);
  const findKey = (patterns: RegExp[], fallback: string) => {
    for (const pattern of patterns) {
      const found = keys.find(k => pattern.test(k));
      if (found) return found;
    }
    return fallback;
  };

  return {
    tcId: findKey([
      /\b(tc\s*id|tcid|test\s*case\s*id)\b/i
    ], "TC ID"),

    dateExecuted: findKey([
      /\b(date\s*executed|date\s*exec|exec\s*date|execution\s*date)\b/i,
      /executed/i,
      /exec/i
    ], "Date Executed"),

    product: findKey([
      /\b(product|project|app|application)\b/i
    ], "Product"),

    module: findKey([
      /\b(module|component|feature|area)\b/i
    ], "Module"),

    status: findKey([
      /\b(status|state)\b/i
    ], "Status"),

    testType: findKey([
      /\b(test\s*type|type)\b/i
    ], "Test Type"),

    executionMode: findKey([
      /\b(execution\s*mode|exec\s*mode|mode)\b/i
    ], "Execution Mode"),

    buildNumber: findKey([
      /\b(build\s*number|buildno|build)\b/i
    ], "Build Number"),

    executionTime: findKey([
      /\b(execution\s*time|exec\s*time|time\s*\(min\))\b/i
    ], "Execution Time (min)"),

    testName: findKey([
      /\b(test\s*name|testcase\s*name|tc\s*name|name)\b/i
    ], "Test Name"),

    notes: findKey([
      /\b(notes|comments|notes\/comments|note|comment)\b/i
    ], "Notes")
  };
}

function getWeekRange(allDates: Date[]) {
  const actualToday = new Date();
  let today = actualToday;

  if (allDates.length > 0) {
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Check if the actual today's week has any activity (reported or resolved)
    const actualMonday = new Date(actualToday);
    const actualDay = actualToday.getDay();
    const actualDiff = actualDay === 0 ? -6 : 1 - actualDay;
    actualMonday.setDate(actualToday.getDate() + actualDiff);
    actualMonday.setHours(0, 0, 0, 0);

    const hasActivityThisWeek = allDates.some(d => d >= actualMonday && d <= actualToday);
    if (!hasActivityThisWeek) {
      today = maxDate;
    }
  }

  today.setHours(23, 59, 59, 999);

  const refDay = today.getDay();
  const diffToMonday = refDay === 0 ? -6 : 1 - refDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { today, monday, sunday };
}

// ─── 2. PRODUCTION ISSUES DASHBOARD MAPPER ──────────────────────────────────
export type ProdIssuesData = {
  isDemo: boolean;
  totalProdIssues: number;
  criticalP1: number;
  resolved: number;
  inProgress: number;
  carryForward: number;
  weeklyTrend: { day: string; newBugs: number; resolved: number }[];
  bugAgeing: { age: string; p1: number; p2: number; p3: number; total: number }[];
  rcaSummary: { category: string; count: number; percentage: number }[];
};

export function getProdIssuesData(rows: RawRow[], analysis: DataAnalysis, aiSchema?: AISchema | null): ProdIssuesData {
  const bugRows = getBugLogRows(rows);
  if (bugRows.length === 0) {
    return {
      isDemo: false,
      totalProdIssues: 0,
      criticalP1: 0,
      resolved: 0,
      inProgress: 0,
      carryForward: 0,
      weeklyTrend: [],
      bugAgeing: [],
      rcaSummary: []
    };
  }

  const activeProdRows = bugRows;
  const col = getColKeys(activeProdRows[0]);

  // Find all reported and resolved dates in activeProdRows
  const allDates: Date[] = [];
  activeProdRows.forEach(r => {
    const dRep = parseExcelDate(r[col.dateReported]);
    if (dRep) allDates.push(dRep);
    const dRes = parseExcelDate(r[col.dateResolved]);
    if (dRes) allDates.push(dRes);
  });

  const { today, monday, sunday } = getWeekRange(allDates);

  // Filter rows for this week (reported within current week, up to today)
  const weekRows = activeProdRows.filter(r => {
    const d = parseExcelDate(r[col.dateReported]);
    return d && d >= monday && d <= today;
  });

  const totalProdIssues = weekRows.length;

  // Critical/P1 in the current week (contains critical in Severity or p1 in Priority)
  const criticalP1 = weekRows.filter(r => {
    const sev = String(r[col.severity] || "").toLowerCase();
    const prio = String(r[col.priority] || "").toLowerCase();
    return sev.includes("critical") || prio.includes("p1");
  }).length;

  // Status resolved in the current week (based on Date Resolved <= today)
  // Evaluated exactly using the Excel formula condition: I2<>"" AND I2>=monday AND I2<=today
  const resolved = activeProdRows.filter(r => {
    const dResolved = parseExcelDate(r[col.dateResolved]);
    return dResolved && dResolved >= monday && dResolved <= today;
  }).length;

  // inProgress (all bugs across the entire sheet currently in progress)
  // Evaluated exactly using the Excel formula: =IF(G2="In Progress","In Progress","")
  const inProgress = activeProdRows.filter(r => {
    const status = String(r[col.status] || "").toLowerCase().trim();
    return status === "in progress" || status === "in-progress";
  }).length;

  // Carry Forward: bugs reported BEFORE monday that are currently unresolved (not Closed and not Resolved)
  // Evaluated exactly using the Excel formula: =AND(B2<TODAY()-WEEKDAY(TODAY(),2)+1,G2<>"Resolved",G2<>"Closed")
  const carryForward = activeProdRows.filter(r => {
    const dReported = parseExcelDate(r[col.dateReported]);
    if (!dReported || dReported >= monday) return false;

    const status = String(r[col.status] || "").toLowerCase().trim();
    return status !== "resolved" && status !== "closed";
  }).length;

  // Weekly Trend (Monday to Sunday)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyTrend = days.map((dayName, idx) => {
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + idx);

    const newBugs = activeProdRows.filter(r => {
      const d = parseExcelDate(r[col.dateReported]);
      return d && d.toDateString() === targetDate.toDateString();
    }).length;

    const resolvedBugs = activeProdRows.filter(r => {
      const d = parseExcelDate(r[col.dateResolved]);
      return d && d.toDateString() === targetDate.toDateString();
    }).length;

    return { day: dayName, newBugs, resolved: resolvedBugs };
  });

  // Bug Ageing: Consider all unresolved production bugs from activeProdRows
  const ageingBuckets = {
    under24: { p1: 0, p2: 0, p3: 0, total: 0 },
    oneToSeven: { p1: 0, p2: 0, p3: 0, total: 0 },
    overSeven: { p1: 0, p2: 0, p3: 0, total: 0 },
  };

  activeProdRows.forEach(r => {
    const status = String(r[col.status] || "").toLowerCase().trim();
    // Consider only unresolved production bugs: Open, In Progress, Reopened
    const isUnresolved = status === "open" || status === "in progress" || status === "in-progress" || status === "reopened";
    if (!isUnresolved) return;

    const dReported = parseExcelDate(r[col.dateReported]);
    let ageDays = 0;
    if (dReported) {
      // Calculate age dynamically from Date Reported and today (reference current system date)
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const reportedStart = new Date(dReported);
      reportedStart.setHours(0, 0, 0, 0);

      ageDays = Math.max(0, Math.floor((todayStart.getTime() - reportedStart.getTime()) / (86400 * 1000)));
    }

    const sev = String(r[col.severity] || "").toLowerCase();
    const prio = String(r[col.priority] || "").toLowerCase();
    const isP1 = prio.includes("p1") || sev.includes("critical");
    const isP2 = prio.includes("p2") || sev.includes("high");

    let bucket: keyof typeof ageingBuckets = "under24";
    if (ageDays > 7) {
      bucket = "overSeven";
    } else if (ageDays >= 1) {
      bucket = "oneToSeven";
    }

    if (isP1) {
      ageingBuckets[bucket].p1++;
    } else if (isP2) {
      ageingBuckets[bucket].p2++;
    } else {
      ageingBuckets[bucket].p3++;
    }
    ageingBuckets[bucket].total++;
  });

  const bugAgeing = [
    { age: "< 24 hours", ...ageingBuckets.under24 },
    { age: "1 - 7 days", ...ageingBuckets.oneToSeven },
    { age: "> 7 days", ...ageingBuckets.overSeven },
  ];

  // RCA Summary
  const rcaMap: Record<string, number> = {};
  weekRows.forEach(r => {
    const cat = String(r[col.rca] || "Unclassified").trim();
    rcaMap[cat] = (rcaMap[cat] || 0) + 1;
  });

  const rcaSummary = Object.entries(rcaMap).map(([category, count]) => {
    const percentage = totalProdIssues > 0 ? Math.round((count / totalProdIssues) * 100) : 0;
    return { category, count, percentage };
  }).sort((a, b) => b.count - a.count);

  return {
    isDemo: false,
    totalProdIssues,
    criticalP1,
    resolved,
    inProgress,
    carryForward,
    weeklyTrend,
    bugAgeing,
    rcaSummary
  };
}

export type BugAnalyticsData = {
  isDemo: boolean;
  totalBugs: number;
  openBugs: number;
  closedBugs: number;
  dde: number;
  avgAge: number;
  bugsByProduct: { product: string; count: number }[];
  bySeverity: { name: string; value: number }[];
  ddeThisWeek: number;
  targetDde: number;
  agingSummary: { age: string; count: number }[];
};

export function getBugAnalyticsData(rows: RawRow[], analysis: DataAnalysis, aiSchema?: AISchema | null): BugAnalyticsData {
  const bugRows = getBugLogRows(rows);
  if (bugRows.length === 0) {
    return {
      isDemo: false,
      totalBugs: 0,
      openBugs: 0,
      closedBugs: 0,
      dde: 0,
      avgAge: 0,
      bugsByProduct: [],
      bySeverity: [],
      ddeThisWeek: 0,
      targetDde: 90,
      agingSummary: []
    };
  }

  const totalBugs = bugRows.length;
  const col = getColKeys(bugRows[0]);

  const openBugsCount = bugRows.filter(r => {
    const status = String(r[col.status] || "").toLowerCase();
    return status === "open" || status === "in progress" || status === "reopened";
  }).length;

  const closedBugs = totalBugs - openBugsCount;

  const qaBugs = bugRows.filter(r => {
    const rep = String(r[col.reporter] || "").toLowerCase();
    return rep.includes("qa");
  }).length;

  const prodBugs = bugRows.filter(r => {
    const rep = String(r[col.reporter] || "").toLowerCase();
    return rep.includes("customer") || rep.includes("monitoring") || rep.includes("alert");
  }).length;

  const dde = (qaBugs + prodBugs) > 0 ? Math.round((qaBugs / (qaBugs + prodBugs)) * 100) : 88;

  const openBugs = bugRows.filter(r => {
    const status = String(r[col.status] || "").toLowerCase();
    return status === "open" || status === "in progress" || status === "reopened";
  });

  const dates = bugRows.map(r => parseExcelDate(r[col.dateReported])).filter((d): d is Date => d !== null);
  const allDates: Date[] = [];
  bugRows.forEach(r => {
    const dRep = parseExcelDate(r[col.dateReported]);
    if (dRep) allDates.push(dRep);
    const dRes = parseExcelDate(r[col.dateResolved]);
    if (dRes) allDates.push(dRes);
  });
  const { today, monday, sunday } = getWeekRange(allDates);

  let totalAge = 0;
  let ageCount = 0;
  openBugs.forEach(r => {
    const dReported = parseExcelDate(r[col.dateReported]);
    let ageDays = 0;
    if (dReported) {
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const reportedStart = new Date(dReported);
      reportedStart.setHours(0, 0, 0, 0);

      ageDays = Math.max(0, Math.floor((todayStart.getTime() - reportedStart.getTime()) / (86400 * 1000)));
    }
    totalAge += ageDays;
    ageCount++;
  });

  const avgAge = ageCount > 0 ? parseFloat((totalAge / ageCount).toFixed(1)) : 0;

  const productMap: Record<string, number> = {};
  bugRows.forEach(r => {
    const prod = String(r[col.product] || "").trim();
    const mod = String(r[col.module] || "").trim();
    let key = "Other";
    if (prod) {
      key = prod;
    } else if (mod) {
      key = mod;
    }
    productMap[key] = (productMap[key] || 0) + 1;
  });
  const bugsByProduct = Object.entries(productMap).map(([product, count]) => ({
    product,
    count
  })).sort((a, b) => b.count - a.count);

  const severityMap = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  bugRows.forEach(r => {
    const sev = String(r[col.severity] || "Medium").trim().toLowerCase();
    if (sev.includes("critical")) severityMap.Critical++;
    else if (sev.includes("high")) severityMap.High++;
    else if (sev.includes("low")) severityMap.Low++;
    else severityMap.Medium++;
  });
  const bySeverity = [
    { name: "Critical", value: severityMap.Critical },
    { name: "High", value: severityMap.High },
    { name: "Medium", value: severityMap.Medium },
    { name: "Low", value: severityMap.Low }
  ];

  let ddeThisWeek = dde;
  if (dates.length > 0) {
    const weekRows = bugRows.filter(r => {
      const d = parseExcelDate(r[col.dateReported]);
      return d && d >= monday && d <= today;
    });

    const qaWeek = weekRows.filter(r => {
      const rep = String(r[col.reporter] || "").toLowerCase();
      return rep.includes("qa");
    }).length;

    const prodWeek = weekRows.filter(r => {
      const rep = String(r[col.reporter] || "").toLowerCase();
      return rep.includes("customer") || rep.includes("monitoring") || rep.includes("alert");
    }).length;

    if (qaWeek + prodWeek > 0) {
      ddeThisWeek = Math.round((qaWeek / (qaWeek + prodWeek)) * 100);
    }
  }

  const agingBuckets = { underSeven: 0, sevenToFourteen: 0, fourteenToThirty: 0, overThirty: 0 };
  openBugs.forEach(r => {
    const dReported = parseExcelDate(r[col.dateReported]);
    let ageDays = 0;
    if (dReported) {
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const reportedStart = new Date(dReported);
      reportedStart.setHours(0, 0, 0, 0);

      ageDays = Math.max(0, Math.floor((todayStart.getTime() - reportedStart.getTime()) / (86400 * 1000)));
    }

    if (ageDays < 7) agingBuckets.underSeven++;
    else if (ageDays <= 14) agingBuckets.sevenToFourteen++;
    else if (ageDays <= 30) agingBuckets.fourteenToThirty++;
    else agingBuckets.overThirty++;
  });

  const agingSummary = [
    { age: "< 7 days", count: agingBuckets.underSeven },
    { age: "7 - 14 days", count: agingBuckets.sevenToFourteen },
    { age: "14 - 30 days", count: agingBuckets.fourteenToThirty },
    { age: "> 30 days", count: agingBuckets.overThirty }
  ];

  return {
    isDemo: false,
    totalBugs,
    openBugs: openBugsCount,
    closedBugs,
    dde,
    avgAge,
    bugsByProduct,
    bySeverity,
    ddeThisWeek,
    targetDde: 90,
    agingSummary
  };
}

// ─── 4. TEST COVERAGE – PRODUCT WISE MAPPER ──────────────────────────────────
export type TestCoverageData = {
  isDemo: boolean;
  totalTestCases: number;
  covered: number;
  notCovered: number;
  overallCoverage: number;
  newTcsAdded: number;
  coverageByProduct: { product: string; covered: number; gap: number }[];
  coverageByTestType: { type: string; total: number; coverage: number }[];
};

export function getTestCoverageData(rows: RawRow[], analysis: DataAnalysis, aiSchema?: AISchema | null): TestCoverageData {
  const tcRows = getTestExecutionRows(rows);
  if (tcRows.length === 0) {
    return {
      isDemo: false,
      totalTestCases: 0,
      covered: 0,
      notCovered: 0,
      overallCoverage: 0,
      newTcsAdded: 0,
      coverageByProduct: [],
      coverageByTestType: []
    };
  }

  const col = getTestExecutionColKeys(tcRows[0]);
  const tcIdCol = col.tcId;
  const uniqueTcs = Array.from(new Set(tcRows.map(r => String(r[tcIdCol] || "")).filter(Boolean)));
  const totalTestCases = uniqueTcs.length;

  if (totalTestCases === 0) {
    return {
      isDemo: false,
      totalTestCases: 0,
      covered: 0,
      notCovered: 0,
      overallCoverage: 0,
      newTcsAdded: 0,
      coverageByProduct: [],
      coverageByTestType: []
    };
  }

  const tcStatusMap: Record<string, string[]> = {};
  tcRows.forEach(r => {
    const tcId = String(r[tcIdCol] || "");
    if (!tcId) return;
    const status = String(r[col.status] || "").trim().toLowerCase();
    if (!tcStatusMap[tcId]) tcStatusMap[tcId] = [];
    tcStatusMap[tcId].push(status);
  });

  let coveredCount = 0;
  uniqueTcs.forEach(id => {
    const statuses = tcStatusMap[id] || [];
    if (statuses.includes("pass")) {
      coveredCount++;
    }
  });

  const notCovered = totalTestCases - coveredCount;
  const overallCoverage = Math.round((coveredCount / totalTestCases) * 100);

  // New TCs Added - defined as test cases added ONLY in the current/latest week
  const dates = tcRows.map(r => parseExcelDate(r[col.dateExecuted])).filter((d): d is Date => d !== null);
  let newTcsAdded = 0;
  if (dates.length > 0) {
    const { today, monday, sunday } = getWeekRange(dates);

    const tcFirstExecMap: Record<string, Date> = {};
    tcRows.forEach(r => {
      const tcId = String(r[tcIdCol] || "");
      if (!tcId) return;
      const d = parseExcelDate(r[col.dateExecuted]);
      if (d) {
        if (!tcFirstExecMap[tcId] || d < tcFirstExecMap[tcId]) {
          tcFirstExecMap[tcId] = d;
        }
      }
    });

    newTcsAdded = Object.values(tcFirstExecMap).filter(d => d >= monday && d <= today).length;
  }

  // Group by Product/Module
  const productTcsMap: Record<string, Set<string>> = {};
  const productPassedTcsMap: Record<string, Set<string>> = {};

  tcRows.forEach(r => {
    const tcId = String(r[tcIdCol] || "");
    if (!tcId) return;
    const prod = String(r[col.product] || "").trim();
    const mod = String(r[col.module] || "").trim();
    let key = "Other";
    if (prod) {
      key = prod;
    } else if (mod) {
      key = mod;
    }

    if (!productTcsMap[key]) productTcsMap[key] = new Set();
    if (!productPassedTcsMap[key]) productPassedTcsMap[key] = new Set();

    productTcsMap[key].add(tcId);
    if (String(r[col.status] || "").trim().toLowerCase() === "pass") {
      productPassedTcsMap[key].add(tcId);
    }
  });

  const coverageByProduct = Object.keys(productTcsMap).map(key => {
    const total = productTcsMap[key].size;
    const passed = productPassedTcsMap[key].size;
    const covered = total > 0 ? Math.round((passed / total) * 100) : 0;
    return {
      product: key,
      covered,
      gap: 100 - covered
    };
  }).sort((a, b) => b.covered - a.covered);

  const typeTcsMap: Record<string, Set<string>> = {};
  const typePassedTcsMap: Record<string, Set<string>> = {};

  tcRows.forEach(r => {
    const tcId = String(r[tcIdCol] || "");
    if (!tcId) return;
    const type = String(r[col.testType] || "Functional").trim();
    if (!typeTcsMap[type]) typeTcsMap[type] = new Set();
    if (!typePassedTcsMap[type]) typePassedTcsMap[type] = new Set();

    typeTcsMap[type].add(tcId);
    if (String(r[col.status] || "").trim().toLowerCase() === "pass") {
      typePassedTcsMap[type].add(tcId);
    }
  });

  const coverageByTestType = Object.keys(typeTcsMap).map(type => {
    const total = typeTcsMap[type].size;
    const passed = typePassedTcsMap[type].size;
    const coverage = total > 0 ? Math.round((passed / total) * 100) : 0;
    return {
      type,
      total,
      coverage
    };
  }).sort((a, b) => b.total - a.total);

  return {
    isDemo: false,
    totalTestCases,
    covered: coveredCount,
    notCovered,
    overallCoverage,
    newTcsAdded,
    coverageByProduct,
    coverageByTestType
  };
}

// ─── 5. MANUAL TEST EXECUTION DASHBOARD MAPPER ───────────────────────────────
export type ManualExecutionData = {
  isDemo: boolean;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
  passRate: number;
  executionSplit: { name: string; value: number }[];
  passRateTrend: { week: string; rate: number }[];
  insights: {
    topFailingModules: { module: string; fails: number }[];
    blockedBy: string[];
    actionItems: string[];
  };
};

export function getManualExecutionData(rows: RawRow[], analysis: DataAnalysis, aiSchema?: AISchema | null): ManualExecutionData {
  const tcRows = getTestExecutionRows(rows);
  if (tcRows.length === 0) {
    return {
      isDemo: false,
      executed: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      passRate: 0,
      executionSplit: [],
      passRateTrend: [],
      insights: {
        topFailingModules: [],
        blockedBy: [],
        actionItems: []
      }
    };
  }

  const col = getTestExecutionColKeys(tcRows[0]);
  const manualRows = tcRows.filter(r => String(r[col.executionMode] || "").trim().toLowerCase() === "manual");

  if (manualRows.length === 0) {
    return {
      isDemo: false,
      executed: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      passRate: 0,
      executionSplit: [],
      passRateTrend: [],
      insights: {
        topFailingModules: [],
        blockedBy: [],
        actionItems: []
      }
    };
  }

  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let notRun = 0;

  manualRows.forEach(r => {
    const status = String(r[col.status] || "").trim().toLowerCase();
    if (status === "pass") passed++;
    else if (status === "fail") failed++;
    else if (status === "blocked") blocked++;
    else notRun++;
  });

  const executed = passed + failed + blocked;
  const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

  const executionSplit = [
    { name: "Pass", value: passed },
    { name: "Fail", value: failed },
    { name: "Blocked", value: blocked },
    { name: "Not Run", value: notRun }
  ];

  function getISOWeekString(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  const weeklyRuns: Record<string, { passed: number; executed: number }> = {};
  manualRows.forEach(r => {
    const d = parseExcelDate(r[col.dateExecuted]);
    if (!d) return;
    const weekStr = getISOWeekString(d);
    const status = String(r[col.status] || "").trim().toLowerCase();
    if (status === "not run") return;

    if (!weeklyRuns[weekStr]) weeklyRuns[weekStr] = { passed: 0, executed: 0 };
    weeklyRuns[weekStr].executed++;
    if (status === "pass") {
      weeklyRuns[weekStr].passed++;
    }
  });

  const passRateTrend = Object.entries(weeklyRuns).map(([week, data]) => {
    const cleanWeek = week.includes("-W") ? "Wk" + week.split("-W")[1] : week;
    return {
      week: cleanWeek,
      rate: data.executed > 0 ? Math.round((data.passed / data.executed) * 100) : 0,
      rawWeek: week
    };
  }).sort((a, b) => a.rawWeek.localeCompare(b.rawWeek)).map(w => ({
    week: w.week,
    rate: w.rate
  }));

  if (passRateTrend.length === 0) {
    passRateTrend.push({ week: "This Wk", rate: passRate });
  }

  const failedModules: Record<string, number> = {};
  manualRows.forEach(r => {
    const status = String(r[col.status] || "").trim().toLowerCase();
    if (status === "fail") {
      const mod = String(r[col.module] || "General").trim();
      failedModules[mod] = (failedModules[mod] || 0) + 1;
    }
  });
  const topFailingModules = Object.entries(failedModules).map(([module, fails]) => ({
    module,
    fails
  })).sort((a, b) => b.fails - a.fails).slice(0, 3);

  const blockedRows = manualRows.filter(r => String(r[col.status] || "").trim().toLowerCase() === "blocked");
  const blockedBy = blockedRows.map(r => {
    const testName = r[col.testName] || "Manual test";
    const notes = r[col.notes] || "no notes provided";
    return `Test "${testName}" blocked: ${notes}`;
  }).slice(0, 3);

  const actionItems: string[] = [];
  if (topFailingModules.length > 0) {
    topFailingModules.forEach(m => {
      actionItems.push(`Investigate and resolve ${m.fails} manual test failure(s) in the ${m.module} module.`);
    });
  } else {
    actionItems.push("Monitor newly deployed modules for any execution failures.");
  }

  if (blockedBy.length > 0) {
    actionItems.push(`Resolve environment or database blockers for the ${blockedRows.length} blocked test case(s).`);
  } else {
    actionItems.push("Ensure local and sandbox testing credentials remain valid throughout the testing cycle.");
  }

  return {
    isDemo: false,
    executed,
    passed,
    failed,
    blocked,
    passRate,
    executionSplit,
    passRateTrend,
    insights: {
      topFailingModules,
      blockedBy,
      actionItems
    }
  };
}

export type AutomationExecutionData = {
  isDemo: boolean;
  totalAutoTCs: number;
  executed: number;
  passed: number;
  failed: number;
  automationPct: number;
  runHistory: { run: string; pass: number; fail: number }[];
  insights: {
    stability: { flaky: number; fixed: number; new: number };
    execTime: { avg: number; longest: number };
    cicdHealth: { status: string; lastRun: string };
    keyFailures: { test: string; reason: string }[];
    nextTarget: number;
  };
};

export function getAutomationExecutionData(rows: RawRow[], analysis: DataAnalysis, aiSchema?: AISchema | null): AutomationExecutionData {
  const tcRows = getTestExecutionRows(rows);
  if (tcRows.length === 0) {
    return {
      isDemo: false,
      totalAutoTCs: 0,
      executed: 0,
      passed: 0,
      failed: 0,
      automationPct: 0,
      runHistory: [],
      insights: {
        stability: { flaky: 0, fixed: 0, new: 0 },
        execTime: { avg: 0, longest: 0 },
        cicdHealth: { status: "Green", lastRun: "N/A" },
        keyFailures: [],
        nextTarget: 65
      }
    };
  }

  const col = getTestExecutionColKeys(tcRows[0]);
  const autoRows = tcRows.filter(r => String(r[col.executionMode] || "").trim().toLowerCase() === "automation");

  if (autoRows.length === 0) {
    return {
      isDemo: false,
      totalAutoTCs: 0,
      executed: 0,
      passed: 0,
      failed: 0,
      automationPct: 0,
      runHistory: [],
      insights: {
        stability: { flaky: 0, fixed: 0, new: 0 },
        execTime: { avg: 0, longest: 0 },
        cicdHealth: { status: "Green", lastRun: "N/A" },
        keyFailures: [],
        nextTarget: 65
      }
    };
  }

  let passed = 0;
  let failed = 0;

  autoRows.forEach(r => {
    const status = String(r[col.status] || "").trim().toLowerCase();
    if (status === "pass") passed++;
    else if (status === "fail") failed++;
  });

  const executed = passed + failed;

  const tcIdCol = col.tcId;
  const uniqueAutoTcs = Array.from(new Set(autoRows.map(r => String(r[tcIdCol] || "")).filter(Boolean)));
  const totalAutoTCs = uniqueAutoTcs.length;

  const totalAllTcs = Array.from(new Set(tcRows.map(r => String(r[tcIdCol] || "")).filter(Boolean))).length;
  const automationPct = totalAllTcs > 0 ? Math.round((totalAutoTCs / totalAllTcs) * 100) : 56;

  const buildHistory: Record<string, { pass: number; fail: number }> = {};
  autoRows.forEach(r => {
    const build = String(r[col.buildNumber] || "Run-1").trim();
    if (!buildHistory[build]) buildHistory[build] = { pass: 0, fail: 0 };

    const status = String(r[col.status] || "").trim().toLowerCase();
    if (status === "pass") buildHistory[build].pass++;
    else if (status === "fail") buildHistory[build].fail++;
  });

  const runHistory = Object.entries(buildHistory).map(([run, data]) => ({
    run,
    pass: data.pass,
    fail: data.fail
  })).sort((a, b) => a.run.localeCompare(b.run, undefined, { numeric: true, sensitivity: 'base' })).slice(-5);

  // Group executions by test case ID (TC ID)
  const tcExecutionsMap: Record<string, { build: string; status: string; notes: string }[]> = {};
  autoRows.forEach(r => {
    const tcId = String(r[tcIdCol] || "").trim();
    if (!tcId) return;

    const build = String(r[col.buildNumber] || "Run-1").trim();
    const status = String(r[col.status] || "").trim().toLowerCase();
    const notes = String(r[col.notes] || "").trim().toLowerCase();

    if (!tcExecutionsMap[tcId]) {
      tcExecutionsMap[tcId] = [];
    }
    tcExecutionsMap[tcId].push({ build, status, notes });
  });

  // Identify builds and sort them to find previous and latest
  const allBuilds = Array.from(new Set(autoRows.map(r => String(r[col.buildNumber] || "Run-1").trim())));
  const sortedBuilds = allBuilds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const latestBuild = sortedBuilds[sortedBuilds.length - 1] || "";

  let flaky = 0;
  let fixed = 0;
  let newFailures = 0;

  Object.entries(tcExecutionsMap).forEach(([tcId, executions]) => {
    // 1. Flaky Test detection:
    // - Inconsistent results in history (contains both pass and fail)
    // - OR notes contain "flaky" in any run
    const statuses = executions.map(e => e.status);
    const hasPass = statuses.includes("pass");
    const hasFail = statuses.includes("fail");
    const hasFlakyNotes = executions.some(e => e.notes.includes("flaky"));

    const isFlaky = (hasPass && hasFail) || hasFlakyNotes;
    if (isFlaky) {
      flaky++;
    }

    // Latest build execution for this test case
    const latestExec = executions.find(e => e.build === latestBuild);

    // 2. Fixed Test detection:
    // Failed in a previous build and passed in the latest build
    if (latestExec && latestExec.status === "pass") {
      const failedInPrevious = executions.some(e => e.build !== latestBuild && e.status === "fail");
      if (failedInPrevious) {
        fixed++;
      }
    }

    // 3. New Failures detection:
    // Failed in the latest build but did not fail in any previous build
    if (latestExec && latestExec.status === "fail") {
      const failedInPrevious = executions.some(e => e.build !== latestBuild && e.status === "fail");
      if (!failedInPrevious) {
        newFailures++;
      }
    }
  });

  let totalTime = 0;
  let maxTime = 0;
  let timeCount = 0;

  autoRows.forEach(r => {
    const t = parseFloat(r[col.executionTime]);
    if (!isNaN(t)) {
      totalTime += t;
      maxTime = Math.max(maxTime, t);
      timeCount++;
    }
  });

  const avgTime = timeCount > 0 ? Math.round(totalTime / timeCount) : 38;
  const longestTime = timeCount > 0 ? Math.round(maxTime) : 72;

  let cicdStatus = "Green";
  let lastRunLabel = "N/A";
  if (runHistory.length > 0) {
    const latestRun = runHistory[runHistory.length - 1];
    cicdStatus = latestRun.fail > 0 ? "Red" : "Green";
    lastRunLabel = `${latestRun.run} completed`;
  }

  const failedRuns = autoRows.filter(r => String(r[col.status] || "").toLowerCase() === "fail");
  const keyFailures = failedRuns.map(r => {
    const testName = String(r[col.testName] || "Automation TC");
    const notes = String(r[col.notes] || "Assertion failed: expected value mismatch");
    return {
      test: testName,
      reason: notes
    };
  }).slice(0, 3);

  return {
    isDemo: false,
    totalAutoTCs,
    executed,
    passed,
    failed,
    automationPct,
    runHistory,
    insights: {
      stability: {
        flaky,
        fixed,
        new: newFailures
      },
      execTime: {
        avg: avgTime,
        longest: longestTime
      },
      cicdHealth: {
        status: cicdStatus,
        lastRun: lastRunLabel
      },
      keyFailures,
      nextTarget: 65
    }
  };
}
