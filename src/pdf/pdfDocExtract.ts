import type { GeneralPdf, PdfCallout, PdfChart, PdfChartSeries, PdfColumnBlock, PdfColumns, PdfSection, PdfTable } from "./pdfDocBuilder.js";

// `import type` only — this file must stay pdf-lib-free since it runs in
// the browser (a chat interface may parse every model reply with it), same
// reasoning as lib/resumeDoc.ts for pdf-lib and lib/slideDeck.ts for pptxgenjs.

export interface ExtractedGeneralPdf {
  // Message content with the ```pdf_doc fence removed, for the normal
  // markdown render — the raw JSON is never shown to the user.
  displayContent: string;
  doc: GeneralPdf | null;
}

const OPEN_FENCE = "```pdf_doc";
const CLOSED_FENCE_RE = /```pdf_doc\s*([\s\S]*?)```/;

export function extractGeneralPdf(content: string): ExtractedGeneralPdf {
  const closed = content.match(CLOSED_FENCE_RE);
  if (closed && closed.index !== undefined) {
    const displayContent = (content.slice(0, closed.index) + content.slice(closed.index + closed[0].length)).trim();
    return { displayContent, doc: parseGeneralPdfJson(closed[1].trim()) };
  }

  // No closing fence at all — either truncated by the package's token
  // budget, or (far more commonly) just still streaming in. Still attempt
  // the repair pass on whatever partial JSON exists, same as
  // lib/slideDeck.ts does for a deck, so the section count can drive a
  // live progress indicator instead of showing nothing until the whole
  // document has arrived.
  const openIdx = content.indexOf(OPEN_FENCE);
  if (openIdx === -1) return { displayContent: content, doc: null };
  const raw = content.slice(openIdx + OPEN_FENCE.length).trim();
  const displayContent = content.slice(0, openIdx).trim();
  return { displayContent, doc: parseGeneralPdfJson(raw) };
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];
}

function normalizeTable(raw: unknown): PdfTable | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const rows = Array.isArray(t.rows)
    ? t.rows
        .map((row) => (Array.isArray(row) ? row.filter((c): c is string => typeof c === "string") : null))
        .filter((row): row is string[] => row !== null && row.length > 0)
    : [];
  if (rows.length === 0) return null;
  const headers = stringArray(t.headers);
  return { headers: headers.length > 0 ? headers : undefined, rows };
}

function normalizeChartDatum(raw: unknown): PdfChartSeries | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.label !== "string" || !d.label.trim()) return null;
  if (typeof d.value !== "number" || !Number.isFinite(d.value)) return null;
  return { label: d.label.trim(), value: d.value };
}

function normalizeChart(raw: unknown): PdfChart | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (c.type !== "bar" && c.type !== "pie") return null;
  const data = Array.isArray(c.data)
    ? c.data.map(normalizeChartDatum).filter((d): d is PdfChartSeries => d !== null).slice(0, 8)
    : [];
  if (data.length === 0) return null;
  return {
    type: c.type,
    title: typeof c.title === "string" && c.title.trim() ? c.title.trim() : undefined,
    data,
  };
}

const CALLOUT_KINDS = new Set(["note", "warning", "important"]);

function normalizeCallout(raw: unknown): PdfCallout | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.text !== "string" || !c.text.trim()) return null;
  const kind = typeof c.kind === "string" && CALLOUT_KINDS.has(c.kind) ? (c.kind as PdfCallout["kind"]) : undefined;
  return { kind, text: c.text.trim() };
}

function normalizeColumnBlock(raw: unknown): PdfColumnBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const heading = typeof b.heading === "string" && b.heading.trim() ? b.heading.trim() : undefined;
  const paragraphs = stringArray(b.paragraphs);
  const bullets = stringArray(b.bullets);
  if (!heading && paragraphs.length === 0 && bullets.length === 0) return null;
  return {
    heading,
    paragraphs: paragraphs.length > 0 ? paragraphs : undefined,
    bullets: bullets.length > 0 ? bullets : undefined,
  };
}

function normalizeColumns(raw: unknown): PdfColumns | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const left = normalizeColumnBlock(c.left);
  const right = normalizeColumnBlock(c.right);
  if (!left || !right) return null;
  return { left, right };
}

function normalizeSection(raw: unknown): PdfSection | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const section: PdfSection = {
    heading: typeof s.heading === "string" && s.heading.trim() ? s.heading.trim() : undefined,
    paragraphs: stringArray(s.paragraphs),
    bullets: stringArray(s.bullets),
    numbered: stringArray(s.numbered),
    table: normalizeTable(s.table) ?? undefined,
    chart: normalizeChart(s.chart) ?? undefined,
    callout: normalizeCallout(s.callout) ?? undefined,
    columns: normalizeColumns(s.columns) ?? undefined,
    newPage: s.newPage === true ? true : undefined,
  };
  const hasContent =
    !!section.heading ||
    (section.paragraphs?.length ?? 0) > 0 ||
    (section.bullets?.length ?? 0) > 0 ||
    (section.numbered?.length ?? 0) > 0 ||
    !!section.table ||
    !!section.chart ||
    !!section.callout ||
    !!section.columns;
  if (!hasContent) return null;
  return {
    heading: section.heading,
    paragraphs: section.paragraphs && section.paragraphs.length > 0 ? section.paragraphs : undefined,
    bullets: section.bullets && section.bullets.length > 0 ? section.bullets : undefined,
    numbered: section.numbered && section.numbered.length > 0 ? section.numbered : undefined,
    table: section.table,
    chart: section.chart,
    callout: section.callout,
    columns: section.columns,
    newPage: section.newPage,
  };
}

function parseGeneralPdfJson(raw: string): GeneralPdf | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const repaired = repairPdfDocJson(raw);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired);
      } catch {
        parsed = null;
      }
    }
  }
  return normalizeGeneralPdf(parsed);
}

// Same technique as lib/slideDeck.ts's repairSlidesJson: "sections" is
// always the last field in the schema (after title/subtitle, which are
// short and arrive first), so everything before it is complete by the time
// the array starts streaming. Scans for complete top-level {...} section
// objects and rebuilds a valid, parseable JSON object from only those,
// discarding whatever partial section is still mid-stream.
function repairPdfDocJson(raw: string): string | null {
  const sectionsKeyIdx = raw.indexOf('"sections"');
  if (sectionsKeyIdx === -1) return null;
  const arrStart = raw.indexOf("[", sectionsKeyIdx);
  if (arrStart === -1) return null;

  const head = raw.slice(0, sectionsKeyIdx).replace(/,\s*$/, "");
  const rest = raw.slice(arrStart + 1);

  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(rest.slice(start, i + 1));
        start = -1;
      }
    }
  }
  if (objects.length === 0) return null;

  const needsComma = head.trim() !== "{" && head.trim() !== "";
  return `${head}${needsComma ? "," : ""}"sections":[${objects.join(",")}]}`;
}

// Exported separately from parseGeneralPdfJson so the export API route can
// re-validate a client-submitted payload through this exact same logic,
// rather than trusting its shape verbatim — same pattern as
// lib/resumeDoc.ts's normalizeResume / lib/slideDeck.ts's normalizeDeck.
export function normalizeGeneralPdf(parsed: unknown): GeneralPdf | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.title !== "string" || !p.title.trim()) return null;

  const sections = Array.isArray(p.sections)
    ? p.sections.map(normalizeSection).filter((s): s is PdfSection => s !== null)
    : [];

  return {
    title: p.title.trim(),
    subtitle: typeof p.subtitle === "string" && p.subtitle.trim() ? p.subtitle.trim() : undefined,
    sections: sections.length > 0 ? sections : undefined,
  };
}
