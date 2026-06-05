import type { RawRow, DataAnalysis, DynamicAggregations, AISchema } from "@/types/bug";

const INTERNAL_COLUMNS = ["__sheet"];

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error(`Failed to fetch image from ${url}:`, err);
    return "";
  }
}



export function exportCSV(rows: RawRow[], fileName: string = "export.csv") {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]).filter(h => !INTERNAL_COLUMNS.includes(h));

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] || "")).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Professional PDF Report Generator
 * - Forces light mode on chart capture so no dark backgrounds bleed into the PDF
 * - Multi-page with automatic pagination
 * - Includes Executive Summary, KPIs, Charts, Module Health Map, AI Insights
 */
export async function exportPDF(
  fileName: string = "report.pdf",
  options: {
    analysis: DataAnalysis;
    agg: DynamicAggregations;
    rows: RawRow[];
    visibleKPIs?: Set<number>;
    dataFileName?: string;
    aiInsights?: string | null;
    aiSchema?: AISchema | null;
  }
) {
  const { jsPDF } = await import("jspdf");
  const { analysis, agg, visibleKPIs, dataFileName, aiInsights, aiSchema } = options;

  const logoBase64 = await fetchImageAsBase64("/qualitrixLogo.jpg");

  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Colour palette ──────────────────────────────────────────────────────────
  const C = {
    primary:   [14,  165, 233] as [number, number, number],
    accent:    [139,  92, 246] as [number, number, number],
    success:   [34,  197,  94] as [number, number, number],
    warning:   [234, 179,   8] as [number, number, number],
    danger:    [239,  68,  68] as [number, number, number],
    dark:      [15,   23,  42] as [number, number, number],
    bodyText:  [30,   41,  59] as [number, number, number],
    muted:     [100, 116, 139] as [number, number, number],
    light:     [241, 245, 249] as [number, number, number],
    lightBlue: [224, 242, 254] as [number, number, number],
    border:    [203, 213, 225] as [number, number, number],
    white:     [255, 255, 255] as [number, number, number],
    headerBg:  [15,   23,  42] as [number, number, number],
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const checkPage = (needed: number) => {
    if (y + needed > pageH - 16) {
      pdf.addPage();
      y = margin;
    }
  };

  const sectionTitle = (title: string, accentColor: [number, number, number] = C.primary) => {
    checkPage(16);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...C.dark);
    pdf.text(title, margin, y);
    y += 4;
    pdf.setDrawColor(...accentColor);
    pdf.setLineWidth(0.8);
    pdf.line(margin, y, margin + contentW, y);
    y += 6;
  };

  const pill = (
    x: number, py: number, w: number, h: number,
    bgColor: [number, number, number], text: string,
    textColor: [number, number, number] = C.white
  ) => {
    pdf.setFillColor(...bgColor);
    pdf.roundedRect(x, py, w, h, h / 2, h / 2, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...textColor);
    pdf.text(text, x + w / 2, py + h / 2 + 2.5, { align: "center" });
  };

  // ── Force light mode for chart capture ────────────────────────────────────
  const wasDark = document.documentElement.classList.contains("dark");
  if (wasDark) {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
    // Let ECharts re-render with light theme
    await new Promise(r => setTimeout(r, 300));
  }

  // ── PAGE 1 HEADER ────────────────────────────────────────────────────────────
  // Dark header bar
  pdf.setFillColor(...C.headerBg);
  pdf.rect(0, 0, pageW, 42, "F");

  // Accent stripe
  pdf.setFillColor(...C.primary);
  pdf.rect(0, 42, pageW, 2.5, "F");

  // Logo area
  pdf.setFillColor(...C.primary);
  pdf.roundedRect(margin, 9, 22, 22, 3, 3, "F");
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...C.white);
  pdf.text("BL", margin + 11, 23, { align: "center" });

  // Title
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...C.white);
  pdf.text("QualityLens Analytics Report", margin + 26, 18);

  // Subtitle — use AI schema summary if available
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(148, 163, 184);
  const subtitle = aiSchema?.summary
    || ((dataFileName || "Dataset").length > 55
      ? (dataFileName || "Dataset").slice(0, 52) + "…"
      : `Source: ${dataFileName || "Dataset"}`);
  pdf.text(subtitle, margin + 26, 26);

  // Right-side meta
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pageW - margin, 18, { align: "right" }
  );
  pdf.text(`${agg.total.toLocaleString()} records · ${analysis.columns.length} columns`, pageW - margin, 26, { align: "right" });

  y = 52;

  // avgFill is used later for KPI computation
  const avgFill = analysis.columns.length > 0
    ? Math.round(analysis.columns.reduce((s, c) => s + c.fillRate, 0) / analysis.columns.length)
    : 0;

  // ── KEY METRICS (KPI cards from AI schema) ────────────────────────────────
  const kpis: { label: string; value: string; sub?: string; color: [number, number, number] }[] = [];
  const kpiColors: [number, number, number][] = [C.primary, C.danger, C.warning, C.success, C.accent, [236, 72, 153]];

  const kpiColorMap: Record<string, [number, number, number]> = {
    red: C.danger, orange: C.warning, yellow: [234, 179, 8], green: C.success,
    blue: C.primary, purple: C.accent, gray: C.muted,
  };

  if (aiSchema?.kpis) {
    // Use AI schema KPIs
    for (const kpiDef of aiSchema.kpis) {
      const color = kpiDef.color ? (kpiColorMap[kpiDef.color] || C.primary) : kpiColors[kpis.length % kpiColors.length];
      // Compute value inline
      let value = "—";
      let sub: string | undefined;
      if (kpiDef.column === "__total") {
        value = agg.total.toLocaleString();
      } else if (kpiDef.column === "__quality") {
        value = `${avgFill}%`;
        sub = `${analysis.columns.length} columns`;
      } else {
        const counts = agg.columnCounts[kpiDef.column] || {};
        if (kpiDef.type === "count_value" && kpiDef.value) {
          let matchCount = 0;
          for (const [val, cnt] of Object.entries(counts)) {
            if (val.toLowerCase().includes(kpiDef.value.toLowerCase())) matchCount += cnt;
          }
          value = matchCount.toLocaleString();
          const pct = agg.total > 0 ? ((matchCount / agg.total) * 100).toFixed(1) : "0";
          sub = `${pct}% of total`;
        } else if (kpiDef.type === "count") {
          value = String(Object.keys(counts).length);
        }
      }
      kpis.push({ label: kpiDef.label, value, sub, color });
    }
  } else {
    // Fallback: use column analysis
    kpis.push({ label: "Total Records", value: agg.total.toLocaleString(), color: C.primary });
    let kpiIdx = 0;
    for (const colName of analysis.kpiColumns) {
      const counts = agg.columnCounts[colName];
      if (!counts) continue;
      const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
      if (entries.length === 0) continue;
      const [topValue, topCount] = entries[0];
      const pct = agg.total > 0 ? Math.round((topCount / agg.total) * 100) : 0;
      const color = kpiColors[kpis.length % kpiColors.length];
      if (!visibleKPIs || visibleKPIs.has(kpiIdx + 1)) {
        kpis.push({ label: `Top ${colName}`, value: topValue.length > 18 ? topValue.slice(0, 16) + "…" : topValue, sub: `${topCount.toLocaleString()} (${pct}%)`, color });
      }
      kpiIdx++;
    }
  }

  if (kpis.length > 1) {
    checkPage(20);
    sectionTitle("Key Metrics", C.accent);

    const cols = Math.min(kpis.length, 4);
    const kpiBoxW = (contentW - (cols - 1) * 3) / cols;

    kpis.slice(0, 12).forEach((kpi, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      if (col === 0 && row > 0) y += 28;
      checkPage(28);

      const bx = margin + col * (kpiBoxW + 3);
      pdf.setFillColor(...C.white);
      pdf.roundedRect(bx, y, kpiBoxW, 24, 2, 2, "F");
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(bx, y, kpiBoxW, 24, 2, 2, "S");
      // top accent bar
      pdf.setFillColor(...kpi.color);
      pdf.roundedRect(bx, y, kpiBoxW, 2, 1, 1, "F");

      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...C.muted);
      pdf.text(kpi.label.toUpperCase(), bx + 4, y + 9);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...C.dark);
      pdf.text(kpi.value, bx + 4, y + 17);

      if (kpi.sub) {
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...C.muted);
        const subTrunc = kpi.sub.length > 28 ? kpi.sub.slice(0, 26) + "…" : kpi.sub;
        pdf.text(subTrunc, bx + 4, y + 22);
      }
    });
    y += 32;
  }

  // ── DATA BREAKDOWN TABLE ─────────────────────────────────────────────────────
  const breakdownColumns = aiSchema?.columnMap
    ? [aiSchema.columnMap.severityColumn, aiSchema.columnMap.priorityColumn, aiSchema.columnMap.statusColumn, aiSchema.columnMap.resultColumn].filter(Boolean) as string[]
    : analysis.kpiColumns.slice(0, 3);

  if (breakdownColumns.length > 0) {
    checkPage(20);
    sectionTitle("Data Distribution Summary", C.primary);

    for (const colName of breakdownColumns.slice(0, 3)) {
      const counts = agg.columnCounts[colName];
      if (!counts) continue;
      const entries = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 8);
      if (entries.length === 0) continue;

      checkPage(12 + entries.length * 8);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...C.bodyText);
      pdf.text(colName, margin, y);
      y += 5;

      // Table header
      pdf.setFillColor(...C.dark);
      pdf.roundedRect(margin, y, contentW, 7, 1, 1, "F");
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...C.white);
      pdf.text("VALUE", margin + 4, y + 5);
      pdf.text("COUNT", margin + contentW * 0.55, y + 5);
      pdf.text("% OF TOTAL", margin + contentW * 0.72, y + 5);
      pdf.text("BAR", margin + contentW * 0.88, y + 5);
      y += 7;

      const total = entries.reduce((s, [, v]) => s + v, 0);
      const maxCount = entries[0][1];

      entries.forEach(([val, count], rowI) => {
        const rowH = 7;
        if (rowI % 2 === 0) {
          pdf.setFillColor(...C.light);
          pdf.rect(margin, y, contentW, rowH, "F");
        }

        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
        const barW = maxCount > 0 ? ((count / maxCount) * (contentW * 0.1)) : 0;

        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...C.bodyText);
        const valDisplay = val.length > 32 ? val.slice(0, 30) + "…" : val;
        pdf.text(valDisplay, margin + 4, y + 5);
        pdf.text(count.toLocaleString(), margin + contentW * 0.55, y + 5);
        pdf.text(`${pct}%`, margin + contentW * 0.72, y + 5);

        pdf.setFillColor(...C.primary);
        pdf.roundedRect(margin + contentW * 0.88, y + 2, Math.max(barW, 1), 3.5, 1, 1, "F");

        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.1);
        pdf.line(margin, y + rowH, margin + contentW, y + rowH);

        y += rowH;
      });

      y += 6;
    }
  }

  // ── CHARTS — Native ECharts HD rendering ─────────────────────────────────
  const chartCards = document.querySelectorAll("[data-chart-card]");
  if (chartCards.length > 0) {
    checkPage(20);
    sectionTitle("Visual Analytics", C.primary);

    const note = `${chartCards.length} chart${chartCards.length !== 1 ? "s" : ""} · Native high-fidelity render`;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...C.muted);
    pdf.text(note, margin, y);
    y += 6;

    await captureChartsNative(pdf, chartCards, margin, contentW, C, checkPage, () => y, (v: number) => { y = v; });
  }

  // ── MODULE HEALTH MAP — Native ECharts HD rendering ──────────────────────
  const healthmapCards = document.querySelectorAll("[data-healthmap-card]");
  if (healthmapCards.length > 0) {
    checkPage(20);
    sectionTitle("Module Health Map", [220, 38, 38]);

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...C.muted);
    pdf.text("Module risk visualization — size represents activity, color represents risk level", margin, y);
    y += 6;

    await captureChartsNative(pdf, healthmapCards, margin, contentW, C, checkPage, () => y, (v: number) => { y = v; });
  }

  // ── AI INSIGHTS ───────────────────────────────────────────────────────────────
  if (aiInsights) {
    checkPage(30);
    sectionTitle("AI-Powered Insights", C.accent);

    // Insights card background
    pdf.setFillColor(245, 243, 255);
    pdf.roundedRect(margin, y, contentW, 10, 2, 2, "F");
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(109, 40, 217);
    pdf.text("Generated by AI based on aggregated data patterns. Not raw data.", margin + 4, y + 6.5);
    y += 14;

    // ── Helper: sanitise a markdown line for safe PDF output ──────────────────
    // jsPDF only supports WinAnsiEncoding (Latin-1). Strip emoji and other
    // non-Latin characters, convert markdown bold/italic, fix bullet chars.
    const sanitize = (raw: string): string => {
      let s = raw;
      // Convert bold markers  **text** / __text__
      s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
      s = s.replace(/__([^_]+)__/g, "$1");
      // Convert italic markers  *text* / _text_ (but avoid already-stripped)
      s = s.replace(/(?<!\\)\*([^*]+)\*/g, "$1");
      s = s.replace(/(?<!\\)_([^_]+)_/g, "$1");
      // Remove leftover markdown chars
      s = s.replace(/[`~]/g, "");
      // Convert markdown-style links [text](url) → text
      s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      // Replace common unicode bullets/arrows with ASCII
      s = s.replace(/[\u2022\u25CF\u25CB\u25AA\u25AB]/g, "-");
      s = s.replace(/[\u2192\u2794\u27A4\u279C]/g, "->");
      s = s.replace(/[\u2713\u2714\u2705]/g, "[ok]");
      s = s.replace(/[\u2717\u2718\u274C]/g, "[x]");
      s = s.replace(/[\u26A0\uFE0F]/g, "(!)");
      // Strip emoji and other non-Latin1 codepoints (keep basic Latin + Latin-1 supplement)
      s = s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
      return s.trim();
    };

    const lines = aiInsights.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { y += 2; continue; }

      checkPage(10);

      // ── Heading level 1 (#)
      if (/^#\s+/.test(trimmed) && !trimmed.startsWith("##")) {
        y += 5;
        const heading = sanitize(trimmed.replace(/^#\s*/, ""));
        if (!heading) continue;
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...C.dark);
        pdf.text(heading, margin, y);
        y += 3;
        pdf.setDrawColor(...C.accent);
        pdf.setLineWidth(0.5);
        pdf.line(margin, y, margin + contentW * 0.6, y);
        y += 6;
      }
      // ── Heading level 2 (##)
      else if (trimmed.startsWith("## ")) {
        y += 4;
        const heading = sanitize(trimmed.replace(/^##\s*/, ""));
        if (!heading) continue;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...C.dark);
        pdf.text(heading, margin, y);
        y += 3;
        pdf.setDrawColor(...C.accent);
        pdf.setLineWidth(0.4);
        pdf.line(margin, y, margin + 40, y);
        y += 5;
      }
      // ── Heading level 3 (###)
      else if (trimmed.startsWith("### ")) {
        y += 2;
        const heading = sanitize(trimmed.replace(/^###\s*/, ""));
        if (!heading) continue;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...C.bodyText);
        pdf.text(heading, margin, y);
        y += 5;
      }
      // ── Sub-bullet (indented with 2+ spaces / tab before - or *)
      else if (/^\s{2,}[-*]\s/.test(line) || /^\t[-*]\s/.test(line)) {
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...C.bodyText);
        const bullet = sanitize(trimmed.replace(/^[-*]\s*/, ""));
        if (!bullet) continue;
        const wrapped = pdf.splitTextToSize("- " + bullet, contentW - 16);
        for (const wl of wrapped) {
          checkPage(5);
          pdf.text(wl, margin + 10, y);
          y += 4;
        }
      }
      // ── Top-level bullet
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...C.bodyText);
        const bullet = sanitize(trimmed.replace(/^[-*]\s*/, ""));
        if (!bullet) continue;
        const wrapped = pdf.splitTextToSize("- " + bullet, contentW - 8);
        for (const wl of wrapped) {
          checkPage(5);
          pdf.text(wl, margin + 4, y);
          y += 4.5;
        }
      }
      // ── Numbered list
      else if (/^\d+[.)\s]/.test(trimmed)) {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...C.bodyText);
        const clean = sanitize(trimmed);
        if (!clean) continue;
        const wrapped = pdf.splitTextToSize(clean, contentW - 8);
        for (const wl of wrapped) {
          checkPage(5);
          pdf.text(wl, margin + 4, y);
          y += 4.5;
        }
      }
      // ── Horizontal rule (--- or ***)
      else if (/^[-*_]{3,}$/.test(trimmed)) {
        y += 2;
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.2);
        pdf.line(margin, y, margin + contentW, y);
        y += 4;
      }
      // ── Regular paragraph text
      else {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...C.bodyText);
        const clean = sanitize(trimmed);
        if (!clean) continue;
        const wrapped = pdf.splitTextToSize(clean, contentW);
        for (const wl of wrapped) {
          checkPage(5);
          pdf.text(wl, margin, y);
          y += 4.5;
        }
      }
    }
  }

  // Column Analysis section removed per user request

  // ── Restore dark mode if needed ───────────────────────────────────────────
  if (wasDark) {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }

  // ── FOOTER on every page ──────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);

    // Draw Qualitrix logo at the top right of every page
    if (logoBase64) {
      const logoW = 28;
      const logoH = 9;
      // On page 1, draw logo inside the header bar, on subsequent pages draw at the top margin
      const logoY = p === 1 ? 14 : margin;
      pdf.addImage(logoBase64, "JPEG", pageW - margin - logoW, logoY, logoW, logoH);
    }

    // Draw dark blue footer strip at the bottom of every page
    pdf.setFillColor(15, 23, 42); // Navy background
    pdf.rect(0, pageH - 11, pageW, 11, "F");

    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(255, 255, 255); // White text
    pdf.text("Qualitrix | Weekly QA Report | Confidential", margin, pageH - 4.5);
    pdf.text(`© ${new Date().getFullYear()}`, pageW - margin, pageH - 4.5, { align: "right" });
  }

  pdf.save(fileName);
}

// ── Native ECharts HD chart capture (replaces html2canvas) ───────────────────
//
// Strategy:
//   For each [data-chart-card] element, find the inner <canvas> that ECharts rendered.
//   Call echarts.getInstanceByDom(canvas) to get the ECharts instance without re-rendering.
//   Ask it to emit getDataURL() at 3× device pixel ratio, forcing white background.
//   This bypasses the browser CSS/dark-mode paint engine entirely, giving us:
//     • Vibrant, correct colors (no blend-mode bleed)
//     • 300 DPI equivalent sharpness
//     • Instant extraction (no DOM crawl, no offscreen canvas)
//   Each chart is rendered full-width for a professional A4 print layout.
//
async function captureChartsNative(
  pdf: any,
  elements: NodeListOf<Element>,
  margin: number,
  contentW: number,
  C: any,
  checkPage: (n: number) => void,
  getY: () => number,
  setY: (v: number) => void
) {
  // Dynamically import echarts core to call getInstanceByDom
  const echarts = await import("echarts/core");

  for (let i = 0; i < elements.length; i++) {
    const card = elements[i] as HTMLElement;

    // Extract title from H3 inside the card
    const titleEl = card.querySelector("h3");
    const subtitleEl = card.querySelector("p");
    const chartTitle = titleEl?.textContent?.trim() || "Chart";
    const chartSubtitle = subtitleEl?.textContent?.trim() || "";

    // Find the ECharts container div (echarts-for-react wraps its canvas inside a div).
    // echarts.getInstanceByDom() must receive the container div, NOT the canvas.
    // We find every div inside the card, then pick the one that has an echarts instance.
    const canvas = card.querySelector("canvas") as HTMLCanvasElement | null;
    // The echarts container div is the direct parent of the canvas
    const echartsDiv = canvas?.parentElement as HTMLElement | null;

    let imgData: string | null = null;
    let aspectRatio = 9 / 16; // default fallback aspect

    if (echartsDiv) {
      try {
        // getInstanceByDom requires the div container echarts was initialized on
        const instance = echarts.getInstanceByDom(echartsDiv);
        if (instance) {
          imgData = instance.getDataURL({
            type: "png",
            pixelRatio: 3,
            backgroundColor: "#ffffff",
          });
          // Use the actual canvas dimensions for aspect ratio
          if (canvas) aspectRatio = canvas.height / canvas.width;
        }
      } catch (_) {
        // instance not found; will fall through to raw canvas fallback
      }
    }

    // Fallback: composite the raw canvas onto an offscreen canvas with white background.
    // This handles non-ECharts charts (Module Treemap, Mindmap, any custom SVG-to-canvas).
    if (!imgData && canvas && canvas.width > 0) {
      try {
        const offscreen = document.createElement("canvas");
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const ctx = offscreen.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
        ctx.drawImage(canvas, 0, 0);
        imgData = offscreen.toDataURL("image/png");
        aspectRatio = canvas.height / canvas.width;
      } catch (_) {
        // ignore — graceful degradation to text placeholder
      }
    }

    // Calculate chart height based on aspect ratio, capped per page
    const imgW = contentW;
    const imgH = Math.min(imgW * aspectRatio, 110); // max 110mm tall
    const cardH = imgH + 22; // room for title + subtitle above chart

    checkPage(cardH + 6);
    let y = getY();

    // Card background
    pdf.setFillColor(250, 251, 252);
    pdf.roundedRect(margin, y, contentW, cardH, 3, 3, "F");
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(margin, y, contentW, cardH, 3, 3, "S");

    // Left accent stripe  
    pdf.setFillColor(...C.primary);
    pdf.roundedRect(margin, y, 3, cardH, 1.5, 1.5, "F");

    // Title (vector font — stays crisp at any zoom)
    pdf.setFontSize(9.5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...C.dark);
    const titleTrunc = chartTitle.length > 60 ? chartTitle.slice(0, 58) + "…" : chartTitle;
    pdf.text(titleTrunc, margin + 7, y + 8);

    // Subtitle
    if (chartSubtitle) {
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...C.muted);
      const subTrunc = chartSubtitle.length > 80 ? chartSubtitle.slice(0, 78) + "…" : chartSubtitle;
      pdf.text(subTrunc, margin + 7, y + 14);
    }

    // Chart image
    if (imgData) {
      pdf.addImage(imgData, "PNG", margin + 2, y + 18, imgW - 4, imgH);
    } else {
      // Graceful fallback if canvas not found
      pdf.setFontSize(8);
      pdf.setTextColor(...C.muted);
      pdf.text("Chart image unavailable", margin + contentW / 2, y + cardH / 2, { align: "center" });
    }

    y += cardH + 5;
    setY(y);
  }
}

export async function exportLandscapePDF(
  activeTab: string,
  fileName: string = "dashboard-landscape.pdf"
) {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas")).default;

  const logoBase64 = await fetchImageAsBase64("/qualitrixLogo.jpg");

  // Find the active tab container
  const tabContainer = document.getElementById(`tab-${activeTab}`);
  if (!tabContainer) {
    console.error("Tab container not found");
    return;
  }

  // Find all elements with data-pdf-page="dashboard" inside the active tab
  let elements = Array.from(tabContainer.querySelectorAll('[data-pdf-page="dashboard"]'));

  // Fallback: if no specific pages are marked, capture the tab container itself
  if (elements.length === 0) {
    elements = [tabContainer];
  }

  const pdf = new jsPDF("l", "mm", "a4"); // Landscape, mm, A4
  const pdfWidth = 297;
  const pdfHeight = 210;
  const margin = 8; // 8mm margins
  const usableWidth = pdfWidth - margin * 2;
  const usableHeight = pdfHeight - margin - 11; // 191mm, leaves 11mm at the bottom for footer

  // Detect theme background color to fill the PDF page borders dynamically
  const computedBg = window.getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
  const rgbMatch = computedBg.match(/\d+/g);
  let r = 255, g = 255, b = 255;
  if (rgbMatch && rgbMatch.length >= 3) {
    r = parseInt(rgbMatch[0], 10);
    g = parseInt(rgbMatch[1], 10);
    b = parseInt(rgbMatch[2], 10);
  }

  let pageCount = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;

    // Capture element with html2canvas at scale 2 for crisp vector-like text and charts
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: computedBg, // dynamic theme fill
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    if (pageCount > 0) {
      pdf.addPage();
    }

    // Set background color of the PDF page
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

    // Calculate aspect ratio scaling to fit landscape A4
    let renderWidth = usableWidth;
    let renderHeight = (canvas.height * usableWidth) / canvas.width;
    let xOffset = margin;
    let yOffset = margin;

    if (renderHeight > usableHeight) {
      const ratio = usableHeight / renderHeight;
      renderHeight = usableHeight;
      renderWidth = renderWidth * ratio;
      xOffset = margin + (usableWidth - renderWidth) / 2;
    } else {
      yOffset = margin + (usableHeight - renderHeight) / 2;
    }

    pdf.addImage(imgData, "JPEG", xOffset, yOffset, renderWidth, renderHeight, undefined, "FAST");

    // Draw Qualitrix Logo at the top-right corner of the slide image (internal image)
    if (logoBase64) {
      const logoW = 38;
      const logoH = 12;
      pdf.addImage(logoBase64, "JPEG", xOffset + renderWidth - logoW - 2, yOffset + 2, logoW, logoH);
    }

    // Draw dark blue footer strip at the bottom of the page
    pdf.setFillColor(15, 23, 42); // Navy background
    pdf.rect(0, pdfHeight - 11, pdfWidth, 11, "F");

    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(255, 255, 255); // White text
    pdf.text("Qualitrix | Weekly QA Report | Confidential", margin, pdfHeight - 4.5);
    pdf.text(`© ${new Date().getFullYear()}`, pdfWidth - margin, pdfHeight - 4.5, { align: "right" });

    pageCount++;
  }

  pdf.save(fileName);
}