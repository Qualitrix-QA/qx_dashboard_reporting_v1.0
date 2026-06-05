import type { RawRow, ColumnAnalysis, ColumnType, ChartSuggestion, DataAnalysis } from "@/types/bug";

const URL_REGEX = /^https?:\/\//i;
const DATE_REGEX = /^\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{1,4}(\s|T|$)/;
const NUMBER_REGEX = /^-?\d+(\.\d+)?$/;
const CURRENCY_REGEX = /^[\$€£₹¥]?\s*-?\d[\d,]*(\.\d+)?$/;

// Internal columns to always skip
const INTERNAL_COLUMNS = ["__sheet"];

const PRIORITY_KEYWORDS = [
  "severity", "priority", "status", "type", "category", "module",
  "component", "platform", "environment", "result", "pass", "fail",
  "critical", "high", "medium", "low", "p1", "p2", "p3",
  "department", "region", "country", "state", "city",
  "gender", "age group", "segment", "tier", "level", "grade", "rating",
  "channel", "source", "method", "class", "group",
];

const ID_KEYWORDS = ["id", "no", "number", "sl", "sr", "#", "ticket", "jira", "key", "code", "index"];
const TEXT_KEYWORDS = [
  "description", "summary", "comment", "note", "step", "detail",
  "expected", "actual", "objective", "procedure", "precondition",
  "remarks", "feedback", "review", "body", "content", "message", "bio",
  "address", "url", "link", "path", "email",
];

function detectColumnType(name: string, values: string[]): ColumnType {
  const lowerName = name.toLowerCase().trim();
  const nonEmpty = values.filter(v => v && v.trim());

  if (nonEmpty.length === 0) return "text";

  if (ID_KEYWORDS.some(k => lowerName === k || lowerName.endsWith(" " + k) || lowerName.startsWith(k + " ") || lowerName.endsWith("_" + k))) {
    const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
    if (uniqueRatio > 0.7) return "id";
  }

  if (lowerName.includes("email") || lowerName.includes("url") || lowerName.includes("link") || lowerName.includes("website")) {
    return "url";
  }

  if (lowerName.includes("date") || lowerName.includes("time") || lowerName.includes("created") || lowerName.includes("updated") || lowerName.includes("timestamp")) {
    return "date";
  }

  const sample = nonEmpty.slice(0, 80);

  if (sample.every(v => URL_REGEX.test(v))) return "url";

  const dateMatches = sample.filter(v => DATE_REGEX.test(v.trim())).length;
  if (dateMatches > sample.length * 0.6) return "date";

  const numMatches = sample.filter(v => NUMBER_REGEX.test(v.trim()) || CURRENCY_REGEX.test(v.trim())).length;
  if (numMatches > sample.length * 0.6) return "numeric";

  const uniqueVals = Array.from(new Set(nonEmpty));
  const uniqueCount = uniqueVals.length;

  if (TEXT_KEYWORDS.some(k => lowerName.includes(k) || lowerName === k)) {
    // If a known text field has more than 15 unique entries, it is free-form.
    // E.g., if "Actual Result" has 41 unique entries, kill it here.
    if (uniqueCount > 15) return "text";
    
    // Otherwise check lengths
    const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
    if (avgLen > 25) return "text";
  }

  const rawAvgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
  // Unweighted average length prevents a single common short value (e.g. "Pass" repeated 500 times)
  // from hiding the fact that the other 40 values are 80-character sentences.
  const uniqueAvgLen = uniqueVals.reduce((s, v) => s + v.length, 0) / uniqueCount;

  if (uniqueCount <= 2 && nonEmpty.length >= 5) return "categorical";
  if (uniqueCount <= 15 && rawAvgLen < 60) return "categorical";
  if (uniqueCount <= 30 && uniqueCount < nonEmpty.length * 0.15 && rawAvgLen < 50) return "categorical";
  
  // High-cardinality charts mask bad categorization. If it averages > 30 chars uniquely, it's text.
  if (uniqueAvgLen > 30) return "text";

  if (uniqueCount <= 50 && uniqueCount < nonEmpty.length * 0.08 && rawAvgLen < 40) return "categorical";

  if (rawAvgLen > 50) return "text";

  if (uniqueCount > nonEmpty.length * 0.8) return "id";

  return uniqueCount < nonEmpty.length * 0.4 ? "categorical" : "text";
}

export function analyzeColumns(rows: RawRow[]): DataAnalysis {
  if (rows.length === 0) return { columns: [], chartSuggestions: [], kpiColumns: [], totalRows: 0 };

  const headers = Object.keys(rows[0]).filter(h => !INTERNAL_COLUMNS.includes(h));
  const columns: ColumnAnalysis[] = [];

  for (const header of headers) {
    const values = rows.map(r => r[header] || "");
    const nonEmpty = values.filter(v => v.trim());
    const type = detectColumnType(header, nonEmpty);

    const counts: Record<string, number> = {};
    const originalValues: Record<string, string> = {};
    for (const v of nonEmpty) {
      const val = v.trim();
      const valLower = val.toLowerCase();
      if (val) {
        counts[valLower] = (counts[valLower] || 0) + 1;
        if (!originalValues[valLower]) originalValues[valLower] = val;
      }
    }

    const topValues = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([key, count]) => ({ value: originalValues[key], count }));

    columns.push({
      name: header,
      type,
      uniqueCount: new Set(nonEmpty).size,
      totalCount: nonEmpty.length,
      topValues,
      fillRate: rows.length > 0 ? (nonEmpty.length / rows.length) * 100 : 0,
    });
  }

  const chartSuggestions = generateChartSuggestions(columns);
  const kpiColumns = pickKPIColumns(columns);

  return { columns, chartSuggestions, kpiColumns, totalRows: rows.length };
}

function generateChartSuggestions(columns: ColumnAnalysis[]): ChartSuggestion[] {
  const suggestions: ChartSuggestion[] = [];
  const categoricals = columns.filter(c => c.type === "categorical" && c.fillRate > 20 && c.uniqueCount >= 2);

  const sorted = [...categoricals].sort((a, b) => {
    const aPri = PRIORITY_KEYWORDS.some(k => a.name.toLowerCase().includes(k)) ? 1 : 0;
    const bPri = PRIORITY_KEYWORDS.some(k => b.name.toLowerCase().includes(k)) ? 1 : 0;
    if (bPri !== aPri) return bPri - aPri;
    return a.uniqueCount - b.uniqueCount;
  });

  let priority = 100;
  let pieCount = 0;

  for (const col of sorted.slice(0, 6)) {
    let type: "pie" | "vbar" | "hbar" = "vbar";
    if (col.uniqueCount <= 5 && pieCount < 2) {
      type = "pie";
      pieCount++;
    } else if (col.uniqueCount <= 10) {
      type = "vbar";
    } else {
      type = "hbar";
    }

    const title = type === "pie" 
      ? `${col.name} Distribution`
      : type === "vbar"
      ? `${col.name} Breakdown`
      : `Top ${col.name}`;

    suggestions.push({ type, columns: [col.name], title, priority: priority-- });
  }

  if (sorted.length >= 2) {
    const small = sorted.filter(c => c.uniqueCount <= 10);

    if (small.length >= 2) {
      suggestions.push({
        type: "heatmap",
        columns: [small[0].name, small[1].name],
        title: `${small[0].name} × ${small[1].name}`,
        priority: priority--,
      });
    }

    if (sorted.length >= 2) {
      const [col1, col2] = sorted.slice(0, 2);
      if (col1.uniqueCount <= 12 && col2.uniqueCount <= 8) {
        suggestions.push({
          type: "stacked_bar",
          columns: [col1.name, col2.name],
          title: `${col2.name} by ${col1.name}`,
          priority: priority--,
        });
      }
    }

    if (small.length >= 3) {
      suggestions.push({
        type: "stacked_bar",
        columns: [small[0].name, small[2].name],
        title: `${small[2].name} by ${small[0].name}`,
        priority: priority--,
      });
    }
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

function pickKPIColumns(columns: ColumnAnalysis[]): string[] {
  return columns
    .filter(c => c.type === "categorical" && c.uniqueCount >= 2 && c.uniqueCount <= 10 && c.fillRate > 40)
    .sort((a, b) => {
      const aPri = PRIORITY_KEYWORDS.some(k => a.name.toLowerCase().includes(k)) ? 100 : 0;
      const bPri = PRIORITY_KEYWORDS.some(k => b.name.toLowerCase().includes(k)) ? 100 : 0;
      return (bPri - aPri) || (a.uniqueCount - b.uniqueCount);
    })
    .slice(0, 3)
    .map(c => c.name);
}

function areSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (Math.abs(a.length - b.length) > 2) return false;

  const maxLen = Math.max(a.length, b.length);
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { matrix[i][j] = j; continue; }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const dist = matrix[a.length][b.length];
  return dist <= 2 && dist / maxLen < 0.4;
}

export function dynamicAggregate(rows: RawRow[], analysis: DataAnalysis) {
  const columnCounts: Record<string, Record<string, number>> = {};

  for (const col of analysis.columns) {
    if (col.type === "categorical") {
      const lowerToCanonical: Record<string, string> = {};
      const lowerCounts: Record<string, number> = {};
      const casingCounts: Record<string, Record<string, number>> = {};

      for (const row of rows) {
        const raw = (row[col.name] || "").trim();
        if (!raw) continue;
        const lower = raw.toLowerCase();
        lowerCounts[lower] = (lowerCounts[lower] || 0) + 1;
        if (!casingCounts[lower]) casingCounts[lower] = {};
        casingCounts[lower][raw] = (casingCounts[lower][raw] || 0) + 1;
      }

      const counts: Record<string, number> = {};
      for (const [lower, total] of Object.entries(lowerCounts)) {
        const casings = casingCounts[lower];
        const canonical = Object.entries(casings).sort(([, a], [, b]) => b - a)[0][0];
        counts[canonical] = total;
      }

      const keys = Object.keys(counts);
      const merged = new Set<string>();
      for (let i = 0; i < keys.length; i++) {
        if (merged.has(keys[i])) continue;
        for (let j = i + 1; j < keys.length; j++) {
          if (merged.has(keys[j])) continue;
          if (areSimilar(keys[i].toLowerCase(), keys[j].toLowerCase())) {
            if (counts[keys[i]] >= counts[keys[j]]) {
              counts[keys[i]] += counts[keys[j]];
              delete counts[keys[j]];
              merged.add(keys[j]);
            } else {
              counts[keys[j]] += counts[keys[i]];
              delete counts[keys[i]];
              merged.add(keys[i]);
              break;
            }
          }
        }
      }

      columnCounts[col.name] = counts;
    }
  }

  return { total: rows.length, columnCounts };
}