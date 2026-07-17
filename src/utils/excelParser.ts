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

  const maxScan = Math.min(range.e.r, 10);
  for (let r = range.s.r; r <= maxScan; r++) {
    let score = 0;
    let nonEmpty = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        nonEmpty++;
        const val = String(cell.v).toLowerCase();
        for (const kw of DATA_KEYWORDS) {
          if (val.includes(kw)) { score += 2; break; }
        }
      }
    }
    if (nonEmpty >= 3) score += nonEmpty;
    if (score > bestScore) { bestScore = score; bestRow = r; }
  }
  return bestRow;
}

function getHeaders(sheet: XLSX.WorkSheet, headerRow: number): string[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    headers.push(cell ? String(cell.v).trim() : `Column_${c}`);
  }
  return headers;
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
    const headers = getHeaders(sheet, headerRowIndex);

    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const allRows: Record<string, string>[] = [];
    for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
      if (allRows.length >= MAX_ROWS) break;
      const row: Record<string, string> = {};
      let hasValue = false;
      for (let c = range.s.c; c <= Math.min(range.e.c, headers.length - 1 + range.s.c); c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const hdr = headers[c - range.s.c];
        const val = cell ? String(cell.v).trim() : "";
        row[hdr] = val;
        if (val) hasValue = true;
      }
      if (hasValue) allRows.push(row);
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
    const headers = getHeaders(sheet, headerRowIndex);

    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const totalInSheet = range.e.r - headerRowIndex;
    const allRows: Record<string, string>[] = [];

    for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
      if (allRows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
      const row: Record<string, string> = {};
      let hasValue = false;
      for (let c = range.s.c; c <= Math.min(range.e.c, headers.length - 1 + range.s.c); c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const hdr = headers[c - range.s.c];
        const val = cell ? String(cell.v).trim() : "";
        row[hdr] = val;
        if (val) hasValue = true;
      }
      if (hasValue) allRows.push(row);
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

export function selectBestSheet(sheets: SheetInfo[]): SheetInfo {
  let best = sheets[0];
  let bestScore = 0;

  for (const s of sheets) {
    let score = s.rowCount;
    for (const h of s.headers) {
      const lower = h.toLowerCase();
      for (const kw of DATA_KEYWORDS) {
        if (lower.includes(kw)) { score += 10; break; }
      }
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}