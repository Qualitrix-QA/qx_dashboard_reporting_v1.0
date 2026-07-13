import * as XLSX from "xlsx";

export type SheetInfo = {
  name: string;
  rowCount: number;
  headers: string[];
  headerRowIndex: number;
  sampleRows: Record<string, string>[];
};

export const MAX_ROWS = 10000;

const DATA_KEYWORDS = [
  "jira", "defect", "bug", "severity", "priority", "component",
  "steps", "reproduce", "expected", "actual", "platform", "category",
  "issue", "summary", "ticket", "reproducibility",
  "test case", "test objective", "status", "precondition",
  "test procedure", "module", "feature", "pass", "fail",
];

function detectHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  let bestRow = 0;
  let bestScore = 0;

  // Pre-compute merge map: for each cell (r,c) → anchor cell value
  const mergeMap = new Map<string, string>();
  if (sheet["!merges"]) {
    for (const merge of sheet["!merges"]) {
      const anchor = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
      const anchorVal = anchor && anchor.v != null ? String(anchor.v) : "";
      for (let mr = merge.s.r; mr <= merge.e.r; mr++) {
        for (let mc = merge.s.c; mc <= merge.e.c; mc++) {
          mergeMap.set(`${mr}_${mc}`, anchorVal);
        }
      }
    }
  }

  const getVal = (r: number, c: number): string => {
    const key = `${r}_${c}`;
    if (mergeMap.has(key)) return mergeMap.get(key)!;
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    return cell && cell.v != null ? String(cell.v) : "";
  };

  const maxScan = Math.min(range.e.r, 10);
  for (let r = range.s.r; r <= maxScan; r++) {
    let score = 0;
    let nonEmpty = 0;
    let hasMergedGroup = false;

    // Detect wide horizontal merges on this row (strong signal of a group header row)
    if (sheet["!merges"]) {
      for (const merge of sheet["!merges"]) {
        if (merge.s.r === r && merge.e.r === r && merge.e.c - merge.s.c >= 2) {
          hasMergedGroup = true;
          score += 5; // bonus per wide merge group
        }
      }
    }

    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = getVal(r, c).toLowerCase();
      if (val) {
        nonEmpty++;
        for (const kw of DATA_KEYWORDS) {
          if (val.includes(kw)) { score += 2; break; }
        }
      }
    }

    if (nonEmpty >= 3) score += nonEmpty;

    // Penalise rows that look like pure sub-headers (all short tokens like P1/P2/Total)
    const shortCellRatio = [...Array(range.e.c - range.s.c + 1)].filter((_, i) => {
      const v = getVal(r, range.s.c + i);
      return v.length > 0 && v.length <= 3;
    }).length / (range.e.c - range.s.c + 1);
    if (!hasMergedGroup && shortCellRatio > 0.5) score -= 5;

    if (score > bestScore) { bestScore = score; bestRow = r; }
  }
  return bestRow;
}


function getMergedCellValue(sheet: XLSX.WorkSheet, r: number, c: number): string {
  if (sheet["!merges"]) {
    for (const merge of sheet["!merges"]) {
      if (r >= merge.s.r && r <= merge.e.r && c >= merge.s.c && c <= merge.e.c) {
        const cell = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
        return cell && cell.v != null ? String(cell.v).trim() : "";
      }
    }
  }
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  return cell && cell.v != null ? String(cell.v).trim() : "";
}

function resolveHeaders(sheet: XLSX.WorkSheet, headerRowIndex: number): { headers: string[]; dataStartRowIndex: number } {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const rStart = headerRowIndex;
  
  // Detect if there's a multi-level header (e.g. horizontal merge in headerRowIndex)
  let hasMultiLevelHeader = false;
  if (sheet["!merges"]) {
    for (const merge of sheet["!merges"]) {
      if (merge.s.r === rStart && merge.e.r === rStart && merge.e.c > merge.s.c) {
        hasMultiLevelHeader = true;
        break;
      }
    }
  }

  const rawHeaders: string[] = [];
  const dataStartRowIndex = hasMultiLevelHeader ? rStart + 2 : rStart + 1;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const val0 = getMergedCellValue(sheet, rStart, c);
    if (hasMultiLevelHeader && rStart + 1 <= range.e.r) {
      const val1 = getMergedCellValue(sheet, rStart + 1, c);
      if (val0 && val1 && val0 !== val1) {
        rawHeaders.push(`${val0} - ${val1}`);
      } else if (val0) {
        rawHeaders.push(val0);
      } else if (val1) {
        rawHeaders.push(val1);
      } else {
        rawHeaders.push(`Column_${c}`);
      }
    } else {
      rawHeaders.push(val0 || `Column_${c}`);
    }
  }

  // Deduplicate headers
  const seenHeaders = new Set<string>();
  const finalHeaders: string[] = [];
  for (const h of rawHeaders) {
    let name = h;
    let counter = 1;
    while (seenHeaders.has(name)) {
      name = `${h}_${counter}`;
      counter++;
    }
    seenHeaders.add(name);
    finalHeaders.push(name);
  }

  return { headers: finalHeaders, dataStartRowIndex };
}

export type ParseResult = {
  sheets: SheetInfo[];
  truncated: boolean;
  totalRowsParsed: number;
};

export function parseWorkbook(data: ArrayBuffer): SheetInfo[] {
  const wb = XLSX.read(data, { type: "array" });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const headerRowIndex = detectHeaderRow(sheet);
    const { headers, dataStartRowIndex } = resolveHeaders(sheet, headerRowIndex);

    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const allRows: Record<string, string>[] = [];
    for (let r = dataStartRowIndex; r <= range.e.r; r++) {
      if (allRows.length >= MAX_ROWS) break;
      const row: Record<string, string> = {};
      let hasValue = false;
      let isTotalRow = false;
      for (let c = range.s.c; c <= Math.min(range.e.c, headers.length - 1 + range.s.c); c++) {
        const val = getMergedCellValue(sheet, r, c);
        const hdr = headers[c - range.s.c];
        row[hdr] = val;
        if (val) hasValue = true;

        const lowerHdr = hdr.toLowerCase();
        const lowerVal = val.toLowerCase();
        if ((lowerHdr.includes("module") || lowerHdr.includes("name") || lowerHdr.includes("title") || c === range.s.c || c === range.s.c + 1) && 
            (lowerVal === "total" || lowerVal === "totals" || lowerVal === "grand total" || lowerVal === "total count")) {
          isTotalRow = true;
        }
      }
      if (hasValue && !isTotalRow) allRows.push(row);
    }

    return {
      name,
      rowCount: allRows.length,
      headers,
      headerRowIndex,
      sampleRows: allRows,
    };
  });
}

export function parseWorkbookWithMeta(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { type: "array" });
  let truncated = false;
  let totalRowsParsed = 0;

  const sheets = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const headerRowIndex = detectHeaderRow(sheet);
    const { headers, dataStartRowIndex } = resolveHeaders(sheet, headerRowIndex);

    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const totalInSheet = range.e.r - dataStartRowIndex + 1;
    const allRows: Record<string, string>[] = [];

    for (let r = dataStartRowIndex; r <= range.e.r; r++) {
      if (allRows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
      const row: Record<string, string> = {};
      let hasValue = false;
      let isTotalRow = false;
      for (let c = range.s.c; c <= Math.min(range.e.c, headers.length - 1 + range.s.c); c++) {
        const val = getMergedCellValue(sheet, r, c);
        const hdr = headers[c - range.s.c];
        row[hdr] = val;
        if (val) hasValue = true;

        const lowerHdr = hdr.toLowerCase();
        const lowerVal = val.toLowerCase();
        if ((lowerHdr.includes("module") || lowerHdr.includes("name") || lowerHdr.includes("title") || c === range.s.c || c === range.s.c + 1) && 
            (lowerVal === "total" || lowerVal === "totals" || lowerVal === "grand total" || lowerVal === "total count")) {
          isTotalRow = true;
        }
      }
      if (hasValue && !isTotalRow) allRows.push(row);
    }

    totalRowsParsed += totalInSheet;

    return {
      name,
      rowCount: allRows.length,
      headers,
      headerRowIndex,
      sampleRows: allRows,
    };
  });

  return { sheets, truncated, totalRowsParsed };
}

import { detectDatasetType } from "./datasetDetector";

export function selectBestSheet(sheets: SheetInfo[]): SheetInfo {
  let best = sheets[0];
  let bestScore = -1;

  for (const s of sheets) {
    if (s.rowCount === 0) continue;
    const detection = detectDatasetType(s.headers, s.sampleRows);
    let score = detection.confidence;
    if (detection.type !== "generic") {
      score += 50; // extra boost for recognized formats
    }
    score += Math.min(50, s.rowCount / 100); // minor weight for row count
    
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}