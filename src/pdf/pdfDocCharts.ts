import type { PdfChartSeries } from "./pdfDocBuilder.js";

// Pure SVG geometry for the PDF Maker's chart section kind. Deliberately
// escaping-agnostic — callers pass in labels that are already
// escapeHtml()'d (see lib/pdfDocHtml.ts) — so every actual escaping call
// site stays in one file. No JS, no external assets: htmlToPdf.ts disables
// JavaScript and blocks every non-document request, so charts must be
// fully static inline SVG markup.

const BAR_CHART_W = 480;
const BAR_CHART_H = 220;
const BAR_CHART_PAD_TOP = 24; // room for the value label above the tallest bar
const BAR_CHART_PAD_BOTTOM = 28; // room for the category label
const BAR_FILL = "#333333";
const BAR_GAP_RATIO = 0.35; // gap width as a fraction of bar width

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

export function renderBarChartSvg(data: PdfChartSeries[]): string {
  const n = data.length;
  const plotH = BAR_CHART_H - BAR_CHART_PAD_TOP - BAR_CHART_PAD_BOTTOM;
  const maxValue = Math.max(1, ...data.map((d) => d.value));
  // n bars + (n+1) gaps of width barW*GAP_RATIO spanning the full chart width.
  const barW = BAR_CHART_W / (n + (n + 1) * BAR_GAP_RATIO);
  const gapW = barW * BAR_GAP_RATIO;

  const bars = data
    .map((d, i) => {
      const h = maxValue > 0 ? (d.value / maxValue) * plotH : 0;
      const x = gapW + i * (barW + gapW);
      const y = BAR_CHART_PAD_TOP + (plotH - h);
      const labelX = x + barW / 2;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" fill="${BAR_FILL}" />
<text x="${labelX.toFixed(2)}" y="${(y - 6).toFixed(2)}" font-size="11" text-anchor="middle" fill="#1a1a1a">${d.value}</text>
<text x="${labelX.toFixed(2)}" y="${(BAR_CHART_H - 10).toFixed(2)}" font-size="10" text-anchor="middle" fill="#666666">${truncateLabel(d.label)}</text>`;
    })
    .join("\n");

  return `<svg viewBox="0 0 ${BAR_CHART_W} ${BAR_CHART_H}" width="100%" role="img">
<line x1="0" y1="${(BAR_CHART_PAD_TOP + plotH).toFixed(2)}" x2="${BAR_CHART_W}" y2="${(BAR_CHART_PAD_TOP + plotH).toFixed(2)}" stroke="#bfbfbf" stroke-width="1" />
${bars}
</svg>`;
}

const PIE_SIZE = 240;
const PIE_CX = PIE_SIZE / 2;
const PIE_CY = PIE_SIZE / 2;
const PIE_R = 100;
const PIE_LABEL_THRESHOLD_DEG = 8;

// Alternating (not monotonic) grayscale ramp so adjacent slices are always
// maximally apart in lightness regardless of how many slices there are —
// a smooth light-to-dark ramp puts neighboring slices right next to each
// other in shade, which is illegible on a low-DPI print/photocopy.
export const PIE_PALETTE = ["#1a1a1a", "#bfbfbf", "#4d4d4d", "#e6e6e6", "#333333", "#999999", "#666666", "#d9d9d9"];

export function contrastingLabelColor(fillHex: string): string {
  const hex = fillHex.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
}

export interface PieSlice {
  label: string;
  value: number;
  percent: number; // 0-100
  startAngle: number; // degrees, 0 = top, clockwise
  angle: number; // degrees
  fill: string;
}

export function computePieSlices(data: PdfChartSeries[]): PieSlice[] {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  let cursor = 0;
  return data.map((d, i) => {
    const value = Math.max(0, d.value);
    const percent = total > 0 ? (value / total) * 100 : 0;
    const angle = total > 0 ? (value / total) * 360 : 0;
    const slice: PieSlice = {
      label: d.label,
      value,
      percent,
      startAngle: cursor,
      angle,
      fill: PIE_PALETTE[i % PIE_PALETTE.length],
    };
    cursor += angle;
    return slice;
  });
}

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  // 0deg = top (12 o'clock), clockwise.
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx},${cy} L ${start.x.toFixed(2)},${start.y.toFixed(2)} A ${r},${r} 0 ${largeArc},1 ${end.x.toFixed(2)},${end.y.toFixed(2)} Z`;
}

export function renderPieChartSvg(data: PdfChartSeries[]): string {
  const slices = computePieSlices(data);
  const single100 = slices.find((s) => s.percent >= 99.999);

  let shapes: string;
  if (single100) {
    shapes = `<circle cx="${PIE_CX}" cy="${PIE_CY}" r="${PIE_R}" fill="${single100.fill}" />`;
  } else {
    shapes = slices
      .filter((s) => s.angle > 0)
      .map((s) => {
        const path = arcPath(PIE_CX, PIE_CY, PIE_R, s.startAngle, s.startAngle + s.angle);
        let labelSvg = "";
        if (s.angle >= PIE_LABEL_THRESHOLD_DEG) {
          const mid = s.startAngle + s.angle / 2;
          const pos = polarToCartesian(PIE_CX, PIE_CY, PIE_R * 0.62, mid);
          const labelColor = contrastingLabelColor(s.fill);
          labelSvg = `<text x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="${labelColor}">${Math.round(s.percent)}%</text>`;
        }
        return `<path d="${path}" fill="${s.fill}" />\n${labelSvg}`;
      })
      .join("\n");
  }

  return `<svg viewBox="0 0 ${PIE_SIZE} ${PIE_SIZE}" width="100%" style="max-width:240px" role="img">
${shapes}
</svg>`;
}

export function renderPieLegend(data: PdfChartSeries[]): string {
  const slices = computePieSlices(data);
  const items = slices
    .map(
      (s) =>
        `<li><span class="chart-swatch" style="background:${s.fill}"></span>${s.label} — ${s.value} (${Math.round(s.percent)}%)</li>`
    )
    .join("\n");
  return `<ul class="chart-legend">\n${items}\n</ul>`;
}
