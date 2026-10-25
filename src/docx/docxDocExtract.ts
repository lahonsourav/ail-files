import type { GeneralDocx, DocxSection, DocxTable } from "./docxDocBuilder.js";

// `import type` only — this file must stay docx-library-free since it runs
// in the browser (a chat interface may parse every model reply with it), same
// reasoning as lib/pdfDocExtract.ts for pdf-lib and lib/slideDeck.ts for
// pptxgenjs.

export interface ExtractedGeneralDocx {
  // Message content with the ```docx_doc fence removed, for the normal
  // markdown render — the raw JSON is never shown to the user.
  displayContent: string;
  doc: GeneralDocx | null;
}

const OPEN_FENCE = "```docx_doc";
const CLOSED_FENCE_RE = /```docx_doc\s*([\s\S]*?)```/;

export function extractGeneralDocx(content: string): ExtractedGeneralDocx {
  const closed = content.match(CLOSED_FENCE_RE);
  if (closed && closed.index !== undefined) {
    const displayContent = (content.slice(0, closed.index) + content.slice(closed.index + closed[0].length)).trim();
    return { displayContent, doc: parseGeneralDocxJson(closed[1].trim()) };
  }

  // No closing fence at all — either truncated by the package's token
  // budget, or (far more commonly) just still streaming in. Still attempt
  // the repair pass on whatever partial JSON exists, same as
  // lib/pdfDocExtract.ts, so the section count can drive a live progress
  // indicator instead of showing nothing until the whole document arrives.
  const openIdx = content.indexOf(OPEN_FENCE);
  if (openIdx === -1) return { displayContent: content, doc: null };
  const raw = content.slice(openIdx + OPEN_FENCE.length).trim();
  const displayContent = content.slice(0, openIdx).trim();
  return { displayContent, doc: parseGeneralDocxJson(raw) };
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];
}

function normalizeTable(raw: unknown): DocxTable | null {
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

function normalizeSection(raw: unknown): DocxSection | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const section: DocxSection = {
    heading: typeof s.heading === "string" && s.heading.trim() ? s.heading.trim() : undefined,
    paragraphs: stringArray(s.paragraphs),
    bullets: stringArray(s.bullets),
    numbered: stringArray(s.numbered),
    table: normalizeTable(s.table) ?? undefined,
    newPage: s.newPage === true ? true : undefined,
  };
  const hasContent =
    !!section.heading ||
    (section.paragraphs?.length ?? 0) > 0 ||
    (section.bullets?.length ?? 0) > 0 ||
    (section.numbered?.length ?? 0) > 0 ||
    !!section.table;
  if (!hasContent) return null;
  return {
    heading: section.heading,
    paragraphs: section.paragraphs && section.paragraphs.length > 0 ? section.paragraphs : undefined,
    bullets: section.bullets && section.bullets.length > 0 ? section.bullets : undefined,
    numbered: section.numbered && section.numbered.length > 0 ? section.numbered : undefined,
    table: section.table,
    newPage: section.newPage,
  };
}

function parseGeneralDocxJson(raw: string): GeneralDocx | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const repaired = repairDocxJson(raw);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired);
      } catch {
        parsed = null;
      }
    }
  }
  return normalizeGeneralDocx(parsed);
}

// Same technique as lib/pdfDocExtract.ts's repairPdfDocJson: "sections" is
// always the last field in the schema (after title/subtitle, which are
// short and arrive first), so everything before it is complete by the time
// the array starts streaming. Scans for complete top-level {...} section
// objects and rebuilds a valid, parseable JSON object from only those,
// discarding whatever partial section is still mid-stream.
function repairDocxJson(raw: string): string | null {
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

// Exported separately from parseGeneralDocxJson so the export API route can
// re-validate a client-submitted payload through this exact same logic,
// rather than trusting its shape verbatim — same pattern as
// lib/pdfDocExtract.ts's normalizeGeneralPdf.
export function normalizeGeneralDocx(parsed: unknown): GeneralDocx | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.title !== "string" || !p.title.trim()) return null;

  const sections = Array.isArray(p.sections)
    ? p.sections.map(normalizeSection).filter((s): s is DocxSection => s !== null)
    : [];

  return {
    title: p.title.trim(),
    subtitle: typeof p.subtitle === "string" && p.subtitle.trim() ? p.subtitle.trim() : undefined,
    sections: sections.length > 0 ? sections : undefined,
  };
}
