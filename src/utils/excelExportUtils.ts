import ExcelJS from "exceljs";
import type {
  ProjectLevelData,
  ProdIssuesData,
  BugAnalyticsData,
  TestCoverageData,
  ManualExecutionData,
  AutomationExecutionData
} from "./dashboardMapper";

type NewInitiativesData = any[];
type RiskMitigationData = any[];

export interface SpecializedQAData {
  prodIssuesData?: ProdIssuesData;
  bugAnalyticsData?: BugAnalyticsData;
  testCoverageData?: TestCoverageData;
  manualExecutionData?: ManualExecutionData;
  automationExecutionData?: AutomationExecutionData;
  newInitiativesData?: NewInitiativesData;
  riskMitigationData?: RiskMitigationData;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scale factors exactly mirroring ProjectLevelDashboard.tsx logic
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCT_SCALES: Record<string, number> = {
  "CIB": 0.45,
  "Intuition": 0.35,
  "ODD": 0.20,
};
const SPRINT_SCALES: Record<string, number> = {
  "Peripheral System:": 0.12,
  "Regression": 0.32,
  "SIT": 0.22,
  "Sprint 1": 0.14,
  "Sprint 2": 0.16,
  "Sprint 3": 0.08,
};

/**
 * Builds the Project Level Dashboard worksheet using ExcelJS.
 * Embeds:
 *   - Product filter dropdown at B4
 *   - Sprint filter dropdown at B5
 *   - A hidden "ScaleFactors" reference table
 *   - Excel formulas for all KPIs/Charts that multiply base values by
 *     the active scale derived via VLOOKUP from the dropdown cells.
 */
async function buildProjectLevelWorksheet(
  ws: ExcelJS.Worksheet,
  data: ProjectLevelData
): Promise<void> {

  // ── Styling helpers ────────────────────────────────────────────────────────
  const style = {
    title: (cell: ExcelJS.Cell) => {
      cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0097A7" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    },
    sectionHeader: (cell: ExcelJS.Cell) => {
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    },
    colHeader: (cell: ExcelJS.Cell) => {
      cell.font = { bold: true, size: 9, color: { argb: "FF475569" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } }
      };
    },
    filterLabel: (cell: ExcelJS.Cell) => {
      cell.font = { bold: true, size: 10 };
    },
    filterCell: (cell: ExcelJS.Cell) => {
      cell.font = { bold: true, size: 10, color: { argb: "FF0097A7" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F7FA" } };
      cell.border = {
        top: { style: "medium", color: { argb: "FF0097A7" } },
        bottom: { style: "medium", color: { argb: "FF0097A7" } },
        left: { style: "medium", color: { argb: "FF0097A7" } },
        right: { style: "medium", color: { argb: "FF0097A7" } },
      };
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 0: Hidden Scale-Factor Reference Tables (columns H–K)
  // ─────────────────────────────────────────────────────────────────────────
  // Product scale table:  H1 = "Product", I1 = "Scale"
  // Sprint scale table:   J1 = "Sprint",  K1 = "Scale"
  // This lets the formulas VLOOKUP against named ranges.
  const products = data.projects || [];
  const sprints = data.sprints || [];

  // "All" → scale 1.0
  const productScaleRows = [["All", 1.0], ...products.map(p => [p, PRODUCT_SCALES[p] ?? 1.0])];
  const sprintScaleRows  = [["All", 1.0], ...sprints.map(s => [s, SPRINT_SCALES[s]  ?? 1.0])];

  // Write product scale table at H1:I(n)
  const prodTableStartRow = 1;
  productScaleRows.forEach((row, i) => {
    const r = prodTableStartRow + i;
    ws.getCell(`H${r}`).value = row[0];
    ws.getCell(`I${r}`).value = row[1];
    // hide by making font white on white
    [ws.getCell(`H${r}`), ws.getCell(`I${r}`)].forEach(c => {
      c.font = { color: { argb: "FFFFFFFF" }, size: 1 };
    });
  });

  // Write sprint scale table at J1:K(n)
  sprintScaleRows.forEach((row, i) => {
    const r = prodTableStartRow + i;
    ws.getCell(`J${r}`).value = row[0];
    ws.getCell(`K${r}`).value = row[1];
    [ws.getCell(`J${r}`), ws.getCell(`K${r}`)].forEach(c => {
      c.font = { color: { argb: "FFFFFFFF" }, size: 1 };
    });
  });

  const prodTableRange  = `H${prodTableStartRow}:I${prodTableStartRow + productScaleRows.length - 1}`;
  const sprintTableRange = `J${prodTableStartRow}:K${prodTableStartRow + sprintScaleRows.length - 1}`;

  // Named formula for the combined active scale:
  // ProductScale * SprintScale
  // We embed it inline in every formula for clarity.
  const productScaleFormula = `IFERROR(VLOOKUP($B$4,${prodTableRange},2,FALSE),1)`;
  const sprintScaleFormula  = `IFERROR(VLOOKUP($B$5,${sprintTableRange},2,FALSE),1)`;
  const scaleFormula        = `(${productScaleFormula})*(${sprintScaleFormula})`;

  // Helper: rounded scaled formula
  const sf = (base: number) =>
    `ROUND(${base}*${scaleFormula},0)`;
  // For percentages – multiply then clamp to 100
  const sfPct = (base: number) =>
    `MIN(ROUND(${base}*${scaleFormula},0),100)`;

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: Title
  // ─────────────────────────────────────────────────────────────────────────
  let row = 1;
  ws.mergeCells(`A${row}:G${row}`);
  const titleCell = ws.getCell(`A${row}`);
  titleCell.value = "PROJECT LEVEL DASHBOARD";
  style.title(titleCell);
  ws.getRow(row).height = 30;
  row++;

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: Global Filters
  // ─────────────────────────────────────────────────────────────────────────
  row++; // blank
  ws.mergeCells(`A${row}:G${row}`);
  const filterHeaderCell = ws.getCell(`A${row}`);
  filterHeaderCell.value = "GLOBAL FILTERS — Select a Product and / or Sprint to filter all metrics below";
  style.sectionHeader(filterHeaderCell);
  row++;

  // Product filter
  ws.getCell(`A${row}`).value = "Product Filter:";
  style.filterLabel(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = "All";
  style.filterCell(ws.getCell(`B${row}`));
  const productFilterRef = `B${row}`;

  // Product dropdown
  ws.getCell(`B${row}`).dataValidation = {
    type: "list",
    allowBlank: false,
    showDropDown: false,
    formulae: [`"All,${products.join(",")}"`],
    showErrorMessage: true,
    errorTitle: "Invalid Selection",
    error: "Please select a product from the list.",
  };
  row++;

  // Sprint filter
  ws.getCell(`A${row}`).value = "Sprint Filter:";
  style.filterLabel(ws.getCell(`A${row}`));
  ws.getCell(`B${row}`).value = "All";
  style.filterCell(ws.getCell(`B${row}`));

  // Sprint dropdown
  ws.getCell(`B${row}`).dataValidation = {
    type: "list",
    allowBlank: false,
    showDropDown: false,
    formulae: [`"All,${sprints.join(",")}"`],
    showErrorMessage: true,
    errorTitle: "Invalid Selection",
    error: "Please select a sprint from the list.",
  };
  row++;

  ws.getCell(`A${row}`).value = "ℹ️  Changing these dropdowns will update all KPIs, Charts and Data below automatically.";
  ws.getCell(`A${row}`).font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  ws.mergeCells(`A${row}:G${row}`);
  row += 2; // blank

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: KPIs — Execution
  // ─────────────────────────────────────────────────────────────────────────
  ws.mergeCells(`A${row}:G${row}`);
  ws.getCell(`A${row}`).value = "KEY PERFORMANCE INDICATORS — Execution";
  style.sectionHeader(ws.getCell(`A${row}`));
  row++;

  const execHeaders = [
    "Total Executable", "Total Executed %", "Total Pass %",
    "Total Fail %", "Total Blocked %", "Total NoRun %", "Execution Velocity %"
  ];
  execHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    style.colHeader(cell);
  });
  row++;

  // Base values
  const baseExec = [
    data.totalExecutable || 0,
    data.totalExecuted || 0,
    data.totalPass || 0,
    data.totalFail || 0,
    data.totalBlocked || 0,
    data.totalNoRun || 0,
    data.executionVelocity || 0,
  ];

  // totalExecutable is a count → scale it; percentages → sfPct
  const execFormulas = [
    sf(baseExec[0]),     // Total Executable (count)
    sfPct(baseExec[1]),  // Total Executed %
    sfPct(baseExec[2]),  // Total Pass %
    sfPct(baseExec[3]),  // Total Fail %
    sfPct(baseExec[4]),  // Total Blocked %
    sfPct(baseExec[5]),  // Total NoRun %
    sfPct(baseExec[6]),  // Execution Velocity %
  ];
  execFormulas.forEach((f, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = { formula: f, result: baseExec[i] };
    cell.numFmt = i === 0 ? "#,##0" : "0";
  });
  row += 2;

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: KPIs — Defects
  // ─────────────────────────────────────────────────────────────────────────
  ws.mergeCells(`A${row}:G${row}`);
  ws.getCell(`A${row}`).value = "KEY PERFORMANCE INDICATORS — Defects";
  style.sectionHeader(ws.getCell(`A${row}`));
  row++;

  const defectHeaders = [
    "Total Defects", "Total Open Defects", "Open Defects (High/Critical)",
    "Defect Density %", "Reopen Ratio %"
  ];
  defectHeaders.forEach((h, i) => {
    style.colHeader(ws.getCell(row, i + 1));
    ws.getCell(row, i + 1).value = h;
  });
  row++;

  const baseDefects = [
    data.totalDefects || 0,
    data.totalOpenDefects || 0,
    data.openDefectsHighCritical || 0,
    data.defectDensity || 0,
    data.reopenRatio || 0,
  ];
  const defectFormulas = baseDefects.map((v, i) =>
    i >= 3 ? sfPct(v) : sf(v)
  );
  defectFormulas.forEach((f, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = { formula: f, result: baseDefects[i] };
    cell.numFmt = i >= 3 ? "0" : "#,##0";
  });
  row += 2;

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 5: Custom KPIs (no filter scaling — they are user-defined values)
  // ─────────────────────────────────────────────────────────────────────────
  if (data.customKPIs && data.customKPIs.length > 0) {
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "CUSTOM KPIs";
    style.sectionHeader(ws.getCell(`A${row}`));
    row++;
    ["Label", "Value", "Subtitle"].forEach((h, i) => {
      style.colHeader(ws.getCell(row, i + 1));
      ws.getCell(row, i + 1).value = h;
    });
    row++;
    data.customKPIs.forEach((item: any) => {
      ws.getCell(row, 1).value = item.label;
      ws.getCell(row, 2).value = item.value;
      ws.getCell(row, 3).value = item.sub;
      row++;
    });
    row++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: Project Wise RAG
  // ─────────────────────────────────────────────────────────────────────────
  if (data.projectWiseRAG && data.projectWiseRAG.length > 0) {
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "PROJECT WISE RAG";
    style.sectionHeader(ws.getCell(`A${row}`));
    row++;
    ["Label", "Value"].forEach((h, i) => {
      style.colHeader(ws.getCell(row, i + 1));
      ws.getCell(row, i + 1).value = h;
    });
    row++;
    data.projectWiseRAG.forEach((item: any) => {
      ws.getCell(row, 1).value = item.name || item.project;
      const base = item.value as number;
      ws.getCell(row, 2).value = { formula: sf(base), result: base };
      row++;
    });
    row++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 7: Sprint Wise RAG
  // ─────────────────────────────────────────────────────────────────────────
  if (data.sprintWiseRAG && data.sprintWiseRAG.length > 0) {
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "SPRINT WISE RAG";
    style.sectionHeader(ws.getCell(`A${row}`));
    row++;
    ["Label", "Value"].forEach((h, i) => {
      style.colHeader(ws.getCell(row, i + 1));
      ws.getCell(row, i + 1).value = h;
    });
    row++;
    data.sprintWiseRAG.forEach((item: any) => {
      ws.getCell(row, 1).value = item.name || item.sprint;
      const base = item.value as number;
      ws.getCell(row, 2).value = { formula: sf(base), result: base };
      row++;
    });
    row++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 8: Defects Aging
  // ─────────────────────────────────────────────────────────────────────────
  if (data.defectsAging && data.defectsAging.length > 0) {
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "DEFECTS AGING";
    style.sectionHeader(ws.getCell(`A${row}`));
    row++;
    ["Age Bucket", "Critical", "High", "Medium", "Low"].forEach((h, i) => {
      style.colHeader(ws.getCell(row, i + 1));
      ws.getCell(row, i + 1).value = h;
    });
    row++;
    data.defectsAging.forEach((item: any) => {
      ws.getCell(row, 1).value = item.bucket;
      ws.getCell(row, 2).value = { formula: sf(item.critical || 0), result: item.critical || 0 };
      ws.getCell(row, 3).value = { formula: sf(item.high || 0), result: item.high || 0 };
      ws.getCell(row, 4).value = { formula: sf(item.medium || 0), result: item.medium || 0 };
      ws.getCell(row, 5).value = { formula: sf(item.low || 0), result: item.low || 0 };
      row++;
    });
    row++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 9: Defect Density Trend (sprint-specific — no global scale)
  // ─────────────────────────────────────────────────────────────────────────
  if (data.defectDensityTrend && data.defectDensityTrend.length > 0) {
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "DEFECT DENSITY TREND — [Total Defects] / [Total Executed TCs] %";
    style.sectionHeader(ws.getCell(`A${row}`));
    row++;
    ["Sprint / Project", "Density %"].forEach((h, i) => {
      style.colHeader(ws.getCell(row, i + 1));
      ws.getCell(row, i + 1).value = h;
    });
    row++;
    data.defectDensityTrend.forEach((item: any) => {
      ws.getCell(row, 1).value = item.name;
      ws.getCell(row, 2).value = item.rate;
      row++;
    });
    row++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 10: Execution Velocity Trend
  // ─────────────────────────────────────────────────────────────────────────
  if (data.executionVelocityTrend && data.executionVelocityTrend.length > 0) {
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "EXECUTION VELOCITY TREND — [Total Executed TCs] / [Total Planned TCs] %";
    style.sectionHeader(ws.getCell(`A${row}`));
    row++;
    ["Sprint / Project", "Velocity %"].forEach((h, i) => {
      style.colHeader(ws.getCell(row, i + 1));
      ws.getCell(row, i + 1).value = h;
    });
    row++;
    data.executionVelocityTrend.forEach((item: any) => {
      ws.getCell(row, 1).value = item.name;
      ws.getCell(row, 2).value = item.rate;
      row++;
    });
    row++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 11: Custom Tables & Charts
  // ─────────────────────────────────────────────────────────────────────────
  if (data.customTables && data.customTables.length > 0) {
    data.customTables.forEach((table: any) => {
      ws.getCell(`A${row}`).value = `Custom Table: ${table.title}`;
      style.sectionHeader(ws.getCell(`A${row}`));
      ws.mergeCells(`A${row}:G${row}`);
      row++;
      (table.columns || []).forEach((h: string, i: number) => {
        style.colHeader(ws.getCell(row, i + 1));
        ws.getCell(row, i + 1).value = h;
      });
      row++;
      (table.data || []).forEach((dataRow: any) => {
        (table.columns || []).forEach((col: string, i: number) => {
          ws.getCell(row, i + 1).value = dataRow[col];
        });
        row++;
      });
      row++;
    });
  }

  if (data.customCharts && data.customCharts.length > 0) {
    data.customCharts.forEach((chart: any) => {
      ws.getCell(`A${row}`).value = `Custom Chart Source: ${chart.title} (${chart.type})`;
      style.sectionHeader(ws.getCell(`A${row}`));
      ws.mergeCells(`A${row}:G${row}`);
      row++;
      ["Name", "Value"].forEach((h, i) => {
        style.colHeader(ws.getCell(row, i + 1));
        ws.getCell(row, i + 1).value = h;
      });
      row++;
      (chart.data || []).forEach((dp: any) => {
        ws.getCell(row, 1).value = dp.name;
        ws.getCell(row, 2).value = dp.value;
        row++;
      });
      row++;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Column widths
  // ─────────────────────────────────────────────────────────────────────────
  ws.getColumn(1).width = 35;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 18;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 18;
  // Hide scale-factor reference columns
  ws.getColumn(8).width = 0.1;
  ws.getColumn(9).width = 0.1;
  ws.getColumn(10).width = 0.1;
  ws.getColumn(11).width = 0.1;

  // suppress the unused variable warning
  void productFilterRef;
  void prodTableRange;
  void sprintTableRange;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Specialized QA sheet builder (unchanged data, no filtering)
// ─────────────────────────────────────────────────────────────────────────────
function createSpecializedQASheet(data: SpecializedQAData): any[][] {
  const sheet: any[][] = [];

  // Helper to append custom KPIs, charts, and tables for any dashboard
  const appendCustoms = (d: {
    customKPIs?: any[];
    customCharts?: any[];
    customTables?: any[];
  }) => {
    if (d.customKPIs && d.customKPIs.length > 0) {
      sheet.push(["Custom KPIs"]);
      sheet.push(["Label", "Value", "Subtitle"]);
      d.customKPIs.forEach((item: any) => sheet.push([item.label, item.value, item.sub]));
      sheet.push([]);
    }
    if (d.customCharts && d.customCharts.length > 0) {
      d.customCharts.forEach((chart: any) => {
        sheet.push([`Custom Chart: ${chart.title} (${chart.type})`]);
        sheet.push(["Name", "Value"]);
        (chart.data || []).forEach((dp: any) => sheet.push([dp.name, dp.value]));
        sheet.push([]);
      });
    }
    if (d.customTables && d.customTables.length > 0) {
      d.customTables.forEach((table: any) => {
        sheet.push([`Custom Table: ${table.title}`]);
        sheet.push(table.columns || []);
        (table.data || []).forEach((row: any) =>
          sheet.push((table.columns || []).map((col: string) => row[col]))
        );
        sheet.push([]);
      });
    }
  };

  sheet.push(["SPECIALIZED QA DASHBOARDS"]);
  sheet.push([]);

  if (data.prodIssuesData) {
    const d = data.prodIssuesData;
    sheet.push(["--- PRODUCTION ISSUES & ANALYTICS ---"]);
    sheet.push(["Total Prod Issues", "Critical / P1", "Resolved", "In Progress", "Carry Forward"]);
    sheet.push([d.totalProdIssues || 0, d.criticalP1 || 0, d.resolved || 0, d.inProgress || 0, d.carryForward || 0]);
    sheet.push([]);

    if (d.weeklyTrend && d.weeklyTrend.length > 0) {
      sheet.push(["Weekly Trend"]);
      sheet.push(["Day", "New Bugs", "Resolved"]);
      d.weeklyTrend.forEach(t => sheet.push([t.day, t.newBugs, t.resolved]));
      sheet.push([]);
    }

    if (d.bugAgeing && d.bugAgeing.length > 0) {
      sheet.push(["Bug Ageing"]);
      sheet.push(["Age", "P1", "P2", "P3", "Total"]);
      d.bugAgeing.forEach(a => sheet.push([a.age, a.p1, a.p2, a.p3, a.total]));
      sheet.push([]);
    }

    if (d.rcaSummary && d.rcaSummary.length > 0) {
      sheet.push(["RCA Summary"]);
      sheet.push(["Category", "Count", "Percentage %"]);
      d.rcaSummary.forEach(r => sheet.push([r.category, r.count, r.percentage]));
      sheet.push([]);
    }

    if (d.customKPIs && d.customKPIs.length > 0) {
      sheet.push(["Custom KPIs"]);
      sheet.push(["Label", "Value", "Subtitle"]);
      d.customKPIs.forEach(item => sheet.push([item.label, item.value, item.sub]));
      sheet.push([]);
    }
    appendCustoms(d);
  }

  if (data.bugAnalyticsData) {
    const d = data.bugAnalyticsData;
    sheet.push(["--- DEFECT METRICS & BUG ANALYTICS ---"]);
    sheet.push(["Total Bugs", "Open Bugs", "Closed Bugs", "DRE %", "Avg Age", "DDE This Week %", "Target DDE %"]);
    sheet.push([d.totalBugs || 0, d.openBugs || 0, d.closedBugs || 0, d.dde || 0, d.avgAge || 0, d.ddeThisWeek || 0, d.targetDde || 0]);
    sheet.push([]);

    if (d.bySeverity && d.bySeverity.length > 0) {
      sheet.push(["Severity Distribution"]);
      sheet.push(["Severity", "Value"]);
      d.bySeverity.forEach(s => sheet.push([s.name, s.value]));
      sheet.push([]);
    }

    if (d.bugsByProduct && d.bugsByProduct.length > 0) {
      sheet.push(["Bugs By Product"]);
      sheet.push(["Product", "Count"]);
      d.bugsByProduct.forEach(b => sheet.push([b.product, b.count]));
      sheet.push([]);
    }

    if (d.agingSummary && d.agingSummary.length > 0) {
      sheet.push(["Aging Summary"]);
      sheet.push(["Age", "Count"]);
      d.agingSummary.forEach(a => sheet.push([a.age, a.count]));
      sheet.push([]);
    }

    if (d.trend && d.trend.length > 0) {
      sheet.push(["Trend"]);
      sheet.push(["Month", "Open", "Closed"]);
      d.trend.forEach(t => sheet.push([t.month, t.open, t.closed]));
      sheet.push([]);
    }
    appendCustoms(d);
  }

  if (data.testCoverageData) {
    const d = data.testCoverageData;
    sheet.push(["--- TEST COVERAGE ---"]);
    sheet.push(["Total TCs", "Automated", "Manual", "Automation Coverage %", "Pass Rate %"]);
    sheet.push([d.totalTCs || 0, d.automated || 0, d.manual || 0, d.automationCoverage || 0, d.passRate || 0]);
    sheet.push([]);

    if (d.coverageByModule && d.coverageByModule.length > 0) {
      sheet.push(["Coverage By Module"]);
      sheet.push(["Module", "Coverage %"]);
      d.coverageByModule.forEach(m => sheet.push([m.module, m.coverage]));
      sheet.push([]);
    }
    appendCustoms(d);
  }

  if (data.manualExecutionData) {
    const d = data.manualExecutionData;
    sheet.push(["--- MANUAL EXECUTION ---"]);
    sheet.push(["Total TCs", "Executed", "Passed", "Failed", "Blocked", "Not Run", "Execution %"]);
    sheet.push([d.totalTCs || 0, d.executed || 0, d.passed || 0, d.failed || 0, d.blocked || 0, d.notRun || 0, d.executionPct || 0]);
    sheet.push([]);

    if (d.byModule && d.byModule.length > 0) {
      sheet.push(["By Module"]);
      sheet.push(["Module", "Total", "Executed", "Pass", "Fail", "Blocked"]);
      d.byModule.forEach((m: any) => sheet.push([m.module, m.total, m.executed, m.pass, m.fail, m.blocked]));
      sheet.push([]);
    }

    if (d.insights) {
      sheet.push(["Insights - Top Failing Modules"]);
      sheet.push(["Module", "Fails"]);
      (d.insights.topFailingModules || []).forEach((m: any) => sheet.push([m.module, m.fails]));
      sheet.push([]);

      sheet.push(["Insights - Blocked By"]);
      (d.insights.blockedBy || []).forEach((b: string) => sheet.push([b]));
      sheet.push([]);

      sheet.push(["Insights - Action Items"]);
      (d.insights.actionItems || []).forEach((a: string) => sheet.push([a]));
      sheet.push([]);
    }
    appendCustoms(d);
  }

  if (data.automationExecutionData) {
    const d = data.automationExecutionData;
    sheet.push(["--- AUTOMATION EXECUTION ---"]);
    sheet.push(["Total Auto TCs", "Executed", "Passed", "Failed", "Automation %"]);
    sheet.push([d.totalAutoTCs || 0, d.executed || 0, d.passed || 0, d.failed || 0, d.automationPct || 0]);
    sheet.push([]);

    if (d.runHistory && d.runHistory.length > 0) {
      sheet.push(["Run History"]);
      sheet.push(["Run", "Passed", "Failed"]);
      d.runHistory.forEach(r => sheet.push([r.run, r.pass, r.fail]));
      sheet.push([]);
    }

    if (d.insights) {
      sheet.push(["Insights - Stability"]);
      sheet.push(["Flaky", "Fixed", "New"]);
      sheet.push([d.insights.stability?.flaky || 0, d.insights.stability?.fixed || 0, d.insights.stability?.new || 0]);
      sheet.push([]);

      sheet.push(["Insights - Execution Time"]);
      sheet.push(["Avg", "Longest"]);
      sheet.push([d.insights.execTime?.avg || 0, d.insights.execTime?.longest || 0]);
      sheet.push([]);

      sheet.push(["Insights - CI/CD Health"]);
      sheet.push(["Status", "Last Run"]);
      sheet.push([d.insights.cicdHealth?.status || "", d.insights.cicdHealth?.lastRun || ""]);
      sheet.push([]);

      sheet.push(["Insights - Key Failures"]);
      sheet.push(["Test", "Reason"]);
      (d.insights.keyFailures || []).forEach((k: any) => sheet.push([k.test, k.reason]));
      sheet.push([]);
    }
    appendCustoms(d);
  }

  if (data.newInitiativesData && data.newInitiativesData.length > 0) {
    sheet.push(["--- NEW INITIATIVES ---"]);
    sheet.push(["Name", "Status", "Progress %", "Target Date"]);
    data.newInitiativesData.forEach(item => {
      sheet.push([item.name, item.status, item.progress, item.targetDate]);
    });
    sheet.push([]);
  }

  if (data.riskMitigationData && data.riskMitigationData.length > 0) {
    sheet.push(["--- RISK MITIGATION ---"]);
    sheet.push(["Risk", "Impact", "Status", "Mitigation Plan"]);
    data.riskMitigationData.forEach(item => {
      sheet.push([item.risk, item.impact, item.status, item.mitigation]);
    });
    sheet.push([]);
  }

  return sheet;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main export function
// ─────────────────────────────────────────────────────────────────────────────
export async function exportExcel(
  projectLevelData: ProjectLevelData | null | undefined,
  specializedQAData: SpecializedQAData | null | undefined,
  fileName: string = "export.xlsx"
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QX Dashboard";
  workbook.created = new Date();

  // ── Project Level Dashboard ────────────────────────────────────────────────
  const wsProject = workbook.addWorksheet("Project Level Dashboard");
  if (projectLevelData) {
    await buildProjectLevelWorksheet(wsProject, projectLevelData);
  } else {
    wsProject.addRow(["No Data Available"]);
  }

  // ── Specialized QA Dashboard ──────────────────────────────────────────────
  const wsQA = workbook.addWorksheet("Specialized QA Dashboard");
  const qaData = specializedQAData
    ? createSpecializedQASheet(specializedQAData)
    : [["No Data Available"]];
  wsQA.addRows(qaData);
  wsQA.getColumn(1).width = 30;
  wsQA.getColumn(2).width = 20;
  wsQA.getColumn(3).width = 20;

  // ── Trigger Browser Download ───────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
