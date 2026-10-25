import type { GeneralPdf, PdfCallout, PdfChart, PdfColumnBlock, PdfColumns, PdfSection, PdfTable } from "./pdfDocBuilder.js";
import { renderBarChartSvg, renderPieChartSvg, renderPieLegend } from "./pdfDocCharts.js";
import { escapeHtml, renderTextWithMath, getInlinedKatexCss } from "./pdfMath.js";

export { escapeHtml };

function renderTable(table: PdfTable): string {
  const headerRow = table.headers?.length
    ? `<thead><tr>${table.headers.map((h) => `<th>${renderTextWithMath(h)}</th>`).join("")}</tr></thead>`
    : "";
  const bodyRows = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderTextWithMath(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table>${headerRow}<tbody>${bodyRows}</tbody></table>`;
}

function renderChart(chart: PdfChart): string {
  // Data-point labels render inside an SVG <text> node (lib/pdfDocCharts.ts)
  // and stay plain-escaped — KaTeX's HTML output can't be hosted there. Only
  // the title, a normal HTML <p>, gets math support.
  const escapedData = chart.data.slice(0, 8).map((d) => ({ ...d, label: escapeHtml(d.label) }));
  const title = chart.title?.trim() ? `<p class="chart-title">${renderTextWithMath(chart.title.trim())}</p>` : "";
  const body =
    chart.type === "pie"
      ? `<div class="chart-pie-wrap">${renderPieChartSvg(escapedData)}${renderPieLegend(escapedData)}</div>`
      : renderBarChartSvg(escapedData);
  return `<div class="pdf-chart">${title}${body}</div>`;
}

const CALLOUT_LABELS: Record<NonNullable<PdfCallout["kind"]>, string> = {
  note: "Note",
  warning: "Warning",
  important: "Important",
};

function renderCallout(callout: PdfCallout): string {
  const kind = callout.kind ?? "note";
  return `<div class="callout callout-${kind}"><p class="callout-label">${CALLOUT_LABELS[kind]}</p><p>${renderTextWithMath(callout.text)}</p></div>`;
}

function renderColumnBlock(block: PdfColumnBlock): string {
  const parts: string[] = [];
  if (block.heading?.trim()) parts.push(`<h3>${renderTextWithMath(block.heading.trim())}</h3>`);
  for (const p of block.paragraphs ?? []) parts.push(`<p>${renderTextWithMath(p)}</p>`);
  if (block.bullets?.length) parts.push(`<ul>${block.bullets.map((b) => `<li>${renderTextWithMath(b)}</li>`).join("")}</ul>`);
  return `<div class="col">${parts.join("")}</div>`;
}

function renderColumns(columns: PdfColumns): string {
  return `<div class="pdf-columns">${renderColumnBlock(columns.left)}${renderColumnBlock(columns.right)}</div>`;
}

// isFirst suppresses the forced break on the very first section — there's
// no prior page to break away from, and Chromium can otherwise render a
// spurious blank leading page for a break-before on the first box in the
// document.
function renderSection(section: PdfSection, isFirst: boolean): string {
  const parts: string[] = [];
  if (section.heading?.trim()) parts.push(`<h2>${renderTextWithMath(section.heading.trim())}</h2>`);
  for (const p of section.paragraphs ?? []) parts.push(`<p>${renderTextWithMath(p)}</p>`);
  if (section.bullets?.length) parts.push(`<ul>${section.bullets.map((b) => `<li>${renderTextWithMath(b)}</li>`).join("")}</ul>`);
  if (section.numbered?.length) parts.push(`<ol>${section.numbered.map((n) => `<li>${renderTextWithMath(n)}</li>`).join("")}</ol>`);
  if (section.table && section.table.rows.length > 0) parts.push(renderTable(section.table));
  if (section.chart && section.chart.data.length > 0) parts.push(renderChart(section.chart));
  if (section.callout?.text) parts.push(renderCallout(section.callout));
  if (section.columns) parts.push(renderColumns(section.columns));
  const cls = section.newPage && !isFirst ? ' class="page-break"' : "";
  return `<section${cls}>${parts.join("")}</section>`;
}

export interface RenderGeneralPdfHtmlOptions {
  // Chromium's page.pdf() has no native page-border concept — drawn here
  // instead as a real CSS border+padding on <body> with
  // box-decoration-break: clone (see the .has-border rule below), which
  // makes the browser's own print pagination clone that border/padding
  // onto every page fragment rather than only the first/last. Page
  // numbers, by contrast, use Chromium's native footerTemplate and are
  // applied in lib/htmlToPdf.ts, not here.
  border?: boolean;
}

// General-purpose document renderer for the PDF Maker plugin/domain —
// distinct from lib/resumeBuilder.ts's fixed resume schema. Sections are a
// free-form mix of heading/paragraphs/bullets/numbered/table, covering
// letters, reports, proposals, meeting notes, and simple invoice-style
// sheets. Renders to self-contained HTML (no external requests) for
// lib/htmlToPdf.ts to print via headless Chromium. Content originates from
// Claude's output, so every interpolated field goes through escapeHtml() —
// prose fields go through renderTextWithMath() instead (lib/pdfMath.ts),
// which escapes everything except any $...$/$$...$$ math it renders via
// KaTeX, so the same escaping guarantee still holds for non-math text.
export function renderGeneralPdfHtml(data: GeneralPdf, opts: RenderGeneralPdfHtmlOptions = {}): string {
  const titleHtml = renderTextWithMath(data.title);
  const subtitle = data.subtitle?.trim() ? `<p class="subtitle">${renderTextWithMath(data.subtitle.trim())}</p>` : "";
  const sections = (data.sections ?? []).map((s, i) => renderSection(s, i === 0)).join("");
  const bodyClass = opts.border ? ' class="has-border"' : "";
  // KaTeX's CSS + inlined fonts (~1.6MB once base64-encoded, see
  // lib/pdfMath.ts) are only worth paying for on the documents that
  // actually contain rendered math — every katex.renderToString() output
  // is wrapped in a `class="katex"` root span, so this is a cheap, reliable
  // way to tell without threading a flag through every render* function above.
  const needsKatexCss = (titleHtml + subtitle + sections).includes('class="katex');
  const katexStyle = needsKatexCss ? `<style>${getInlinedKatexCss()}</style>` : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
    color: #1a1a1a;
    font-size: 10.5pt;
    line-height: 1.4;
    margin: 0;
    padding: 0;
  }
  h1.title { font-size: 20pt; font-weight: bold; margin: 0 0 4pt 0; }
  p.subtitle { font-size: 11pt; color: #666666; margin: 0 0 12pt 0; }
  h2 {
    font-size: 13pt;
    font-weight: bold;
    margin: 14pt 0 10pt 0;
    padding-bottom: 4pt;
    border-bottom: 1pt solid #bfbfbf;
    break-after: avoid;
  }
  p { margin: 0 0 6pt 0; text-align: justify; text-justify: inter-word; }
  ul, ol { margin: 0 0 6pt 0; padding-left: 20pt; }
  li { margin: 0 0 3pt 0; break-inside: avoid; }
  section { margin-bottom: 8pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 6pt; }
  th, td { text-align: left; padding: 4pt; border-bottom: 0.5pt solid #bfbfbf; break-inside: avoid; }
  th { font-weight: bold; }
  tr { break-inside: avoid; }
  /* A plain border+padding on <body> would, by default CSS fragmentation
     rules, only actually draw at the very start/end of the WHOLE document
     when body's box spans multiple printed pages — the border appears
     once at the top of page 1 and once at the bottom of the last page,
     with nothing on the pages between, and no repeating gap to the text
     on any of them (a fixed-position div had the opposite problem: it did
     repeat per page, but with no way to reserve matching space for body
     padding, since padding on a multi-page box has that same start/end-
     only behavior). box-decoration-break: clone changes that: the box's
     border AND padding are cloned onto every page fragment, exactly like
     Chromium already clones the box's own background per page. That gives
     a real, per-page gap on both sides at once — lib/htmlToPdf.ts's own
     page.pdf() margin is the outside gap (paper edge to border), and this
     padding is the inside gap (border to text) — with no page-specific
     positioning math required. */
  body.has-border {
    border: 1pt solid #bfbfbf;
    padding: 18pt;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .page-break { break-before: page; }
  .pdf-chart { margin: 6pt 0 10pt 0; break-inside: avoid; }
  .chart-title { font-size: 10.5pt; font-weight: bold; margin: 0 0 6pt 0; }
  .chart-pie-wrap { display: flex; align-items: center; gap: 16pt; flex-wrap: wrap; }
  .chart-pie-wrap svg { flex: 0 0 auto; }
  .chart-legend { list-style: none; margin: 0; padding: 0; font-size: 9.5pt; }
  .chart-legend li { margin: 0 0 3pt 0; display: flex; align-items: center; gap: 5pt; }
  .chart-swatch { display: inline-block; width: 9pt; height: 9pt; border: 0.5pt solid #999999; flex: 0 0 auto; }
  .callout {
    margin: 6pt 0 10pt 0;
    padding: 8pt 10pt;
    background: #f3f4f6;
    border-left: 3pt solid #666666;
    break-inside: avoid;
  }
  .callout-warning, .callout-important { border-left-color: #1a1a1a; }
  .callout-label { font-size: 9pt; font-weight: bold; text-transform: uppercase; margin: 0 0 3pt 0; letter-spacing: 0.5pt; }
  .callout p:last-child { margin-bottom: 0; }
  .pdf-columns { display: flex; gap: 16pt; margin: 6pt 0 10pt 0; break-inside: avoid; }
  .pdf-columns .col { flex: 1 1 50%; min-width: 0; }
  .pdf-columns .col:first-child { padding-right: 16pt; border-right: 0.5pt solid #bfbfbf; }
  .pdf-columns h3 { font-size: 11pt; font-weight: bold; margin: 0 0 6pt 0; }
</style>
${katexStyle}
</head>
<body${bodyClass}>
  <h1 class="title">${titleHtml}</h1>
  ${subtitle}
  ${sections}
</body>
</html>`;
}
