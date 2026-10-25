import type { GeneralExcel, ExcelSheet, ExcelHeaderGroup } from "./excelBuilder.js";

// `import type` only — this file must stay exceljs-free since it runs in
// the browser (a chat interface may parse every model reply with it), same
// reasoning as lib/pdfDocExtract.ts for pdf-lib.

export interface ExtractedGeneralExcel {
  // Message content with the ```excel_doc fence removed, for the normal
  // markdown render — the raw JSON is never shown to the user.
  displayContent: string;
  workbook: GeneralExcel | null;
}

const OPEN_FENCE = "```excel_doc";
const CLOSED_FENCE_RE = /```excel_doc\s*([\s\S]*?)```/;

export function extractGeneralExcel(content: string): ExtractedGeneralExcel {
  const closed = content.match(CLOSED_FENCE_RE);
  if (closed && closed.index !== undefined) {
    const displayContent = (content.slice(0, closed.index) + content.slice(closed.index + closed[0].length)).trim();
    return { displayContent, workbook: parseGeneralExcelJson(closed[1].trim()) };
  }

  // No closing fence at all — either truncated by the package's token
  // budget, or (far more commonly) just still streaming in. Still attempt
  // the repair pass on whatever partial JSON exists, same as
  // lib/pdfDocExtract.ts, so the sheet count can drive a live progress
  // indicator instead of showing nothing until the whole workbook arrives.
  const openIdx = content.indexOf(OPEN_FENCE);
  if (openIdx === -1) return { displayContent: content, workbook: null };
  const raw = content.slice(openIdx + OPEN_FENCE.length).trim();
  const displayContent = content.slice(0, openIdx).trim();
  return { displayContent, workbook: parseGeneralExcelJson(raw) };
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

const HEX_RE = /^[0-9A-Fa-f]{6}$/;

function normalizeHeaderGroups(raw: unknown): ExcelHeaderGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const groups = raw
    .map((g): ExcelHeaderGroup | null => {
      if (!g || typeof g !== "object") return null;
      const o = g as Record<string, unknown>;
      const span = typeof o.span === "number" && Number.isInteger(o.span) && o.span > 0 ? o.span : null;
      if (typeof o.label !== "string" || !o.label.trim() || span === null) return null;
      return { label: o.label.trim(), span };
    })
    .filter((g): g is ExcelHeaderGroup => g !== null);
  return groups.length > 0 ? groups : undefined;
}

function normalizeSheet(raw: unknown, index: number): ExcelSheet | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;

  // Built in lockstep with rowColors/rowGroupLevels below (all three indexed
  // against the raw "rows" array before any is filtered) so a color/group
  // level still lines up with its own row even if an earlier raw row turns
  // out to be malformed and gets dropped.
  const rawRows = Array.isArray(s.rows) ? s.rows : [];
  const rawRowColors = Array.isArray(s.rowColors) ? s.rowColors : [];
  const rawRowGroupLevels = Array.isArray(s.rowGroupLevels) ? s.rowGroupLevels : [];
  const rows: string[][] = [];
  const rowColors: string[] = [];
  const rowGroupLevels: number[] = [];
  rawRows.forEach((row, i) => {
    if (!Array.isArray(row)) return;
    rows.push(row.filter((c): c is string => typeof c === "string"));
    const color = rawRowColors[i];
    rowColors.push(typeof color === "string" && HEX_RE.test(color) ? color : "");
    const level = rawRowGroupLevels[i];
    rowGroupLevels.push(typeof level === "number" && Number.isInteger(level) && level >= 0 ? Math.min(7, level) : 0);
  });

  const headers = stringArray(s.headers);
  if (rows.length === 0 && headers.length === 0) return null;
  const headerColor = typeof s.headerColor === "string" && HEX_RE.test(s.headerColor) ? s.headerColor : undefined;
  return {
    name: typeof s.name === "string" && s.name.trim() ? s.name.trim() : `Sheet ${index + 1}`,
    headerGroups: normalizeHeaderGroups(s.headerGroups),
    headers: headers.length > 0 ? headers : undefined,
    headerColor,
    rows,
    rowColors: rowColors.some((c) => c) ? rowColors : undefined,
    rowGroupLevels: rowGroupLevels.some((l) => l > 0) ? rowGroupLevels : undefined,
  };
}

function parseGeneralExcelJson(raw: string): GeneralExcel | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const repaired = repairExcelJson(raw);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired);
      } catch {
        parsed = null;
      }
    }
  }
  return normalizeGeneralExcel(parsed);
}

// Same technique as lib/pdfDocExtract.ts's repairPdfDocJson, keyed on
// "sheets" instead of "sections" — it's also the last field in this schema,
// so everything before it (just "title") is complete by the time the array
// starts streaming. Scans for complete top-level {...} sheet objects and
// rebuilds a valid, parseable JSON object from only those, discarding
// whatever partial sheet is still mid-stream.
function repairExcelJson(raw: string): string | null {
  const sheetsKeyIdx = raw.indexOf('"sheets"');
  if (sheetsKeyIdx === -1) return null;
  const arrStart = raw.indexOf("[", sheetsKeyIdx);
  if (arrStart === -1) return null;

  const head = raw.slice(0, sheetsKeyIdx).replace(/,\s*$/, "");
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
  return `${head}${needsComma ? "," : ""}"sheets":[${objects.join(",")}]}`;
}

// Exported separately from parseGeneralExcelJson so the export API route
// can re-validate a client-submitted payload through this exact same logic,
// rather than trusting its shape verbatim — same pattern as
// lib/pdfDocExtract.ts's normalizeGeneralPdf.
export function normalizeGeneralExcel(parsed: unknown): GeneralExcel | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.title !== "string" || !p.title.trim()) return null;

  const sheets = Array.isArray(p.sheets)
    ? p.sheets.map((s, i) => normalizeSheet(s, i)).filter((s): s is ExcelSheet => s !== null)
    : [];

  return {
    title: p.title.trim(),
    sheets: sheets.length > 0 ? sheets : undefined,
  };
}
