import { moveWithin } from "./deckEdit.js";

// Pure helpers for the document editor (Word and PDF): a document as the editor holds it, changing it without mutating it, adding and
// moving sections, starting a section from a template, a check that keeps what the person typed (empty fields included), the three
// way merge for two people editing the same document, and the clean-up that makes it ready for the export. No React and no browser
// APIs, so all of it is covered by unit tests. The undo history is the deck editor's (`createHistory`, `commit`, `undo`, `redo`).
//
// Word and PDF documents have one shape, so one editor serves both: a title, an optional subtitle, and sections. A section is any mix
// of a heading, paragraphs, pictures, bullets, a numbered list, a table, a chart, a callout and two columns, always drawn in that
// order. A Word document has no charts, callouts or columns, so for `kind: "docx"` those are left out.

export type DocKind = "pdf" | "docx";

export const PICTURE_ID = /^img[1-6]$/;
export const PICTURE_SIZES = ["small", "medium", "large"] as const;
export type DocPictureSize = (typeof PICTURE_SIZES)[number];
export const LOGO_PLACES = ["left", "center", "right"] as const;
export type DocLogoPlace = (typeof LOGO_PLACES)[number];
export const CALLOUT_KINDS = ["note", "warning", "important"] as const;
export type DocCalloutKind = (typeof CALLOUT_KINDS)[number];

export interface DocPicture {
  /** One of the person's pictures ("img1" to "img6"); "" is a place left to fill. */
  image: string;
  caption?: string;
  size?: DocPictureSize;
}

export interface DocTable {
  headers?: string[];
  rows: string[][];
}

export interface DocChart {
  type: "bar" | "pie";
  title?: string;
  data: { label: string; value: number }[];
}

export interface DocColumnBlock {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface DocSection {
  heading?: string;
  paragraphs?: string[];
  pictures?: DocPicture[];
  bullets?: string[];
  numbered?: string[];
  table?: DocTable;
  chart?: DocChart;
  callout?: { kind?: DocCalloutKind; text: string };
  columns?: { left: DocColumnBlock; right: DocColumnBlock };
  /** Starts this section on a new page (the very first section is already on the first page). */
  newPage?: boolean;
  /** Which section of the editor this is, set only when drawing a preview (`cleanForExport` with `anchors`), never saved. */
  anchor?: number;
}

export interface DocContent {
  title: string;
  subtitle?: string;
  /** Where the person's logo sits at the top of the first page; no logo when left out. */
  logo?: DocLogoPlace;
  /** Page numbers at the foot of every page; on unless this is false. */
  pageNumbers?: boolean;
  /** A thin frame round every page; off unless this is true. */
  border?: boolean;
  sections: DocSection[];
}

export const MAX_SECTIONS = 80;
export const MAX_ITEMS = 100;
export const MAX_TEXT = 12_000;
export const MAX_TABLE_ROWS = 100;
export const MAX_TABLE_COLUMNS = 8;
export const MAX_CHART_POINTS = 8;
export const MAX_PICTURES = 6;

/** The kinds of block a section can hold in each file type, in the order they are drawn. */
export const BLOCKS: Record<DocKind, readonly string[]> = {
  pdf: ["paragraphs", "pictures", "bullets", "numbered", "table", "chart", "callout", "columns"],
  docx: ["paragraphs", "pictures", "bullets", "numbered", "table"],
};

// ── Checking (keeps what is being typed) ───────────────────────────────────────────────────────────

const text = (v: unknown, max = MAX_TEXT): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined);

function strings(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string").slice(0, MAX_ITEMS).map((s) => s.slice(0, MAX_TEXT));
  return out.length > 0 ? out : undefined;
}

function table(v: unknown): DocTable | undefined {
  if (!v || typeof v !== "object") return undefined;
  const t = v as Record<string, unknown>;
  if (!Array.isArray(t.rows)) return undefined;
  const headers = Array.isArray(t.headers) ? t.headers.map((h) => (typeof h === "string" ? h : String(h ?? ""))).slice(0, MAX_TABLE_COLUMNS) : undefined;
  const width = headers?.length ?? Math.min(MAX_TABLE_COLUMNS, Math.max(1, ...t.rows.map((r) => (Array.isArray(r) ? r.length : 0))));
  const rows = t.rows
    .filter((r): r is unknown[] => Array.isArray(r))
    .slice(0, MAX_TABLE_ROWS)
    .map((r) => Array.from({ length: width }, (_, i) => (typeof r[i] === "string" ? (r[i] as string).slice(0, 2000) : r[i] == null ? "" : String(r[i]).slice(0, 2000))));
  return { ...(headers && headers.length > 0 ? { headers } : {}), rows };
}

function chart(v: unknown): DocChart | undefined {
  if (!v || typeof v !== "object") return undefined;
  const c = v as Record<string, unknown>;
  const type = oneOf(c.type, ["bar", "pie"] as const);
  if (!type || !Array.isArray(c.data)) return undefined;
  const data = c.data
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .slice(0, MAX_CHART_POINTS)
    .map((d) => ({ label: typeof d.label === "string" ? d.label.slice(0, 80) : "", value: typeof d.value === "number" && Number.isFinite(d.value) ? d.value : Number(d.value) || 0 }));
  return { type, ...(typeof c.title === "string" ? { title: c.title.slice(0, 200) } : {}), data };
}

function columnBlock(v: unknown): DocColumnBlock {
  const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const heading = text(b.heading, 200);
  const paragraphs = strings(b.paragraphs);
  const bullets = strings(b.bullets);
  return { ...(heading !== undefined ? { heading } : {}), ...(paragraphs ? { paragraphs } : {}), ...(bullets ? { bullets } : {}) };
}

function pictures(v: unknown): DocPicture[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .slice(0, MAX_PICTURES)
    .map((p) => {
      const image = typeof p.image === "string" && (p.image === "" || PICTURE_ID.test(p.image)) ? p.image : "";
      const caption = text(p.caption, 300);
      const size = oneOf(p.size, PICTURE_SIZES);
      return { image, ...(caption ? { caption } : {}), ...(size ? { size } : {}) };
    });
  return out.length > 0 ? out : undefined;
}

function section(raw: unknown, kind: DocKind): DocSection {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pdf = kind === "pdf";
  const heading = text(s.heading, 300);
  const callout = pdf && s.callout && typeof s.callout === "object" ? (s.callout as Record<string, unknown>) : null;
  const columns = pdf && s.columns && typeof s.columns === "object" ? (s.columns as Record<string, unknown>) : null;
  const out: DocSection = {};
  if (heading !== undefined) out.heading = heading;
  const paragraphs = strings(s.paragraphs);
  if (paragraphs) out.paragraphs = paragraphs;
  const pics = pictures(s.pictures);
  if (pics) out.pictures = pics;
  const bullets = strings(s.bullets);
  if (bullets) out.bullets = bullets;
  const numbered = strings(s.numbered);
  if (numbered) out.numbered = numbered;
  const t = table(s.table);
  if (t) out.table = t;
  const ch = pdf ? chart(s.chart) : undefined;
  if (ch) out.chart = ch;
  if (callout) out.callout = { ...(oneOf(callout.kind, CALLOUT_KINDS) ? { kind: oneOf(callout.kind, CALLOUT_KINDS) } : {}), text: text(callout.text) ?? "" };
  if (columns) out.columns = { left: columnBlock(columns.left), right: columnBlock(columns.right) };
  if (s.newPage === true) out.newPage = true;
  return out;
}

/**
 * Makes anything that was saved or sent into a document the editor can hold, or null when it is not one. It checks shapes and limits
 * but never throws away what was typed: empty paragraphs, a section with nothing in it yet, and a table row left blank all stay, so
 * saving while someone is in the middle of typing does not delete their place. `cleanForExport` takes the empty parts out.
 */
export function normalizeDoc(raw: unknown, kind: DocKind): DocContent | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.title !== "string") return null;
  const subtitle = text(d.subtitle, 300);
  const logo = oneOf(d.logo, LOGO_PLACES);
  const sections = (Array.isArray(d.sections) ? d.sections : []).slice(0, MAX_SECTIONS).map((s) => section(s, kind));
  return { title: d.title.slice(0, 300), ...(subtitle ? { subtitle } : {}), ...(logo ? { logo } : {}), ...(d.pageNumbers === false ? { pageNumbers: false } : {}), ...(d.border === true ? { border: true } : {}), sections };
}

// ── Ready for the export ───────────────────────────────────────────────────────────────────────────

const filled = (list: string[] | undefined) => (list ?? []).map((s) => s.trim()).filter(Boolean);

/**
 * The document with every empty part taken out and every picture the person does not have left off (`knownImages`, when given), in the
 * shape the PDF and Word makers take. Sections with nothing left are dropped (with `anchors`, the ones kept carry their editor number). Never null: a document with no title is "Untitled document".
 */
export function cleanForExport(doc: DocContent, kind: DocKind, knownImages?: ReadonlySet<string>, opts: { anchors?: boolean } = {}): DocContent {
  const sections: DocSection[] = [];
  for (const [index, s] of doc.sections.entries()) {
    const out: DocSection = {};
    if (s.heading?.trim()) out.heading = s.heading.trim();
    const paragraphs = filled(s.paragraphs);
    if (paragraphs.length) out.paragraphs = paragraphs;
    const pics = (s.pictures ?? []).filter((p) => p.image && (!knownImages || knownImages.has(p.image)));
    if (pics.length) out.pictures = pics;
    const bullets = filled(s.bullets);
    if (bullets.length) out.bullets = bullets;
    const numbered = filled(s.numbered);
    if (numbered.length) out.numbered = numbered;
    if (s.table) {
      const rows = s.table.rows.filter((r) => r.some((c) => c.trim()));
      const headers = s.table.headers && s.table.headers.some((h) => h.trim()) ? s.table.headers : undefined;
      if (rows.length) out.table = { ...(headers ? { headers } : {}), rows };
    }
    if (kind === "pdf") {
      if (s.chart && s.chart.data.some((d) => d.label.trim())) out.chart = { ...s.chart, data: s.chart.data.filter((d) => d.label.trim()) };
      if (s.callout?.text.trim()) out.callout = { ...(s.callout.kind ? { kind: s.callout.kind } : {}), text: s.callout.text.trim() };
      if (s.columns) {
        const side = (b: DocColumnBlock): DocColumnBlock => ({ ...(b.heading?.trim() ? { heading: b.heading.trim() } : {}), ...(filled(b.paragraphs).length ? { paragraphs: filled(b.paragraphs) } : {}), ...(filled(b.bullets).length ? { bullets: filled(b.bullets) } : {}) });
        const left = side(s.columns.left);
        const right = side(s.columns.right);
        if (Object.keys(left).length > 0 && Object.keys(right).length > 0) out.columns = { left, right };
      }
    }
    if (Object.keys(out).length === 0) continue;
    if (s.newPage) out.newPage = true;
    // A preview keeps each section's own number, so the editor can find it even when empty sections before it are not drawn.
    if (opts.anchors) out.anchor = index;
    sections.push(out);
  }
  return { title: doc.title.trim() || "Untitled document", ...(doc.subtitle?.trim() ? { subtitle: doc.subtitle.trim() } : {}), ...(doc.logo ? { logo: doc.logo } : {}), ...(doc.pageNumbers === false ? { pageNumbers: false } : {}), ...(doc.border ? { border: true } : {}), sections };
}

// ── Sections ───────────────────────────────────────────────────────────────────────────────────────

export function updateSection(doc: DocContent, index: number, section: DocSection): DocContent {
  return { ...doc, sections: doc.sections.map((s, i) => (i === index ? section : s)) };
}

export function addSection(doc: DocContent, section: DocSection, at: number = doc.sections.length): DocContent {
  if (doc.sections.length >= MAX_SECTIONS) return doc;
  const i = Math.max(0, Math.min(doc.sections.length, at));
  return { ...doc, sections: [...doc.sections.slice(0, i), section, ...doc.sections.slice(i)] };
}

export function duplicateSection(doc: DocContent, index: number): DocContent {
  const s = doc.sections[index];
  if (!s) return doc;
  return addSection(doc, JSON.parse(JSON.stringify(s)) as DocSection, index + 1);
}

/** Removes a section. A document may have none at all (only its title), so any section can go. */
export function deleteSection(doc: DocContent, index: number): DocContent {
  if (index < 0 || index >= doc.sections.length) return doc;
  return { ...doc, sections: doc.sections.filter((_, i) => i !== index) };
}

export function moveSection(doc: DocContent, from: number, to: number): DocContent {
  return moveWithin(doc, ["sections"], from, to);
}

interface Template {
  label: string;
  /** Only in PDF documents. */
  pdfOnly?: boolean;
  make: () => DocSection;
}

/** What "Add section" offers, with a starting section each. */
export const NEW_SECTION_TEMPLATES: Record<string, Template> = {
  text: { label: "Heading and text", make: () => ({ heading: "New section", paragraphs: [""] }) },
  bullets: { label: "Bullet list", make: () => ({ heading: "New section", bullets: ["", ""] }) },
  numbered: { label: "Numbered list", make: () => ({ heading: "New section", numbered: ["", ""] }) },
  table: { label: "Table", make: () => ({ heading: "New section", table: { headers: ["Column 1", "Column 2"], rows: [["", ""], ["", ""]] } }) },
  picture: { label: "Picture", make: () => ({ heading: "", pictures: [{ image: "", size: "medium" }] }) },
  callout: { label: "Callout", pdfOnly: true, make: () => ({ callout: { kind: "note", text: "" } }) },
  chart: { label: "Chart", pdfOnly: true, make: () => ({ heading: "New section", chart: { type: "bar", title: "", data: [{ label: "First", value: 1 }, { label: "Second", value: 2 }] } }) },
  columns: { label: "Two columns", pdfOnly: true, make: () => ({ columns: { left: { heading: "Left", paragraphs: [""] }, right: { heading: "Right", paragraphs: [""] } } }) },
};

/** The templates a file type offers: a Word document has no charts, callouts or columns. */
export function sectionTemplates(kind: DocKind): [string, Template][] {
  return Object.entries(NEW_SECTION_TEMPLATES).filter(([, t]) => kind === "pdf" || !t.pdfOnly);
}

export function newSection(key: string, kind: DocKind): DocSection | null {
  const t = NEW_SECTION_TEMPLATES[key];
  if (!t || (t.pdfOnly && kind !== "pdf")) return null;
  return t.make();
}

/** A new, empty document: just a title. */
export function blankDoc(title = "Untitled document"): DocContent {
  return { title, sections: [] };
}

/** What a section is called in the list: its heading, else its first words, else what kind of thing it holds. */
export function sectionLabel(s: DocSection | undefined): string {
  if (!s) return "Section";
  const heading = s.heading?.trim();
  if (heading) return heading;
  const first = [...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.numbered ?? []), s.callout?.text ?? "", s.columns?.left.heading ?? ""].map((t) => t.trim()).find(Boolean);
  if (first) return first.length > 40 ? `${first.slice(0, 37).trimEnd()}…` : first;
  if (s.table) return "Table";
  if (s.chart) return "Chart";
  if (s.pictures?.length) return "Picture";
  if (s.columns) return "Two columns";
  if (s.callout) return "Callout";
  return "Empty section";
}

/** A short sentence on what is in a section, for the list: "3 paragraphs, a table". */
export function sectionSummary(s: DocSection | undefined): string {
  if (!s) return "";
  const parts: string[] = [];
  const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
  if (s.paragraphs?.length) parts.push(n(s.paragraphs.length, "paragraph"));
  if (s.pictures?.length) parts.push(n(s.pictures.length, "picture"));
  if (s.bullets?.length) parts.push(n(s.bullets.length, "bullet"));
  if (s.numbered?.length) parts.push(n(s.numbered.length, "numbered item"));
  if (s.table) parts.push("a table");
  if (s.chart) parts.push("a chart");
  if (s.callout) parts.push("a callout");
  if (s.columns) parts.push("two columns");
  return parts.join(", ");
}

// ── Describing a change, aloud ─────────────────────────────────────────────────────────────────────

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const SECTION_THINGS: [keyof DocSection, string][] = [
  ["heading", "the heading"],
  ["paragraphs", "the text"],
  ["pictures", "the pictures"],
  ["bullets", "the bullets"],
  ["numbered", "the numbered list"],
  ["table", "the table"],
  ["chart", "the chart"],
  ["callout", "the callout"],
  ["columns", "the columns"],
  ["newPage", "the page break"],
];

function say(things: string[], none: string): string {
  if (things.length === 0) return none;
  const shown = things.slice(0, 3);
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return `Done. I changed ${list}.`;
}

/** "Done. I changed the heading and the bullets." for one section, safe to say aloud. */
export function describeSectionChange(before: DocSection, after: DocSection): string {
  return say(SECTION_THINGS.filter(([k]) => !same(before[k], after[k])).map(([, label]) => label), "I didn't change anything in this section.");
}

/** The same for a whole document: the title, the subtitle, and how many sections were added, removed or changed. */
export function describeDocChange(before: DocContent, after: DocContent): string {
  const things: string[] = [];
  if (before.title !== after.title) things.push("the title");
  if ((before.subtitle ?? "") !== (after.subtitle ?? "")) things.push("the subtitle");
  const added = after.sections.length - before.sections.length;
  if (added > 0) things.push(added === 1 ? "one new section" : `${added} new sections`);
  else if (added < 0) things.push(added === -1 ? "one section removed" : `${-added} sections removed`);
  else {
    const changed = after.sections.filter((s, i) => !same(s, before.sections[i])).length;
    if (changed > 0) things.push(changed === 1 ? "one section" : `${changed} sections`);
  }
  return say(things, "I didn't change anything in the document.");
}

/** The words of a document, one line per piece, for a model to read (long documents are cut). */
export function docOutline(doc: DocContent, maxChars = 6000): string {
  const lines = [`Title: ${doc.title}`];
  if (doc.subtitle) lines.push(`Subtitle: ${doc.subtitle}`);
  doc.sections.forEach((s, i) => {
    const bits = [sectionLabel(s)];
    const summary = sectionSummary(s);
    if (summary) bits.push(`(${summary})`);
    lines.push(`${i + 1}. ${bits.join(" ")}`);
  });
  const out = lines.join("\n");
  return out.length > maxChars ? `${out.slice(0, maxChars)}…` : out;
}

// ── Two people editing the same document ───────────────────────────────────────────────────────────

function mergeValue<T>(base: T, mine: T, theirs: T): { ok: true; value: T } | { ok: false } {
  if (same(mine, base)) return { ok: true, value: theirs };
  if (same(theirs, base) || same(mine, theirs)) return { ok: true, value: mine };
  return { ok: false };
}

/**
 * Keeps both sets of changes when two people edited the same document, like `mergeDecks`: a part only one side changed takes that
 * side's version, and sections are matched by position, which is safe only while nobody added, removed or moved a section on both
 * sides. Returns null when both changed the same part differently.
 */
export function mergeDocs(base: DocContent, mine: DocContent, theirs: DocContent): DocContent | null {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)]);
  for (const key of keys) {
    if (key === "sections") continue;
    const merged = mergeValue((base as unknown as Record<string, unknown>)[key], (mine as unknown as Record<string, unknown>)[key], (theirs as unknown as Record<string, unknown>)[key]);
    if (!merged.ok) return null;
    if (merged.value !== undefined) out[key] = merged.value;
  }
  const b = base.sections;
  const m = mine.sections;
  const t = theirs.sections;
  let sections: DocSection[] | null;
  if (same(m, b)) sections = t;
  else if (same(t, b) || same(m, t)) sections = m;
  else if (b.length !== m.length || b.length !== t.length) sections = null;
  else {
    sections = [];
    for (let i = 0; i < b.length && sections; i++) {
      const merged = mergeValue(b[i], m[i], t[i]);
      if (!merged.ok) sections = null;
      else sections.push(merged.value);
    }
  }
  if (!sections) return null;
  out.sections = sections;
  return out as unknown as DocContent;
}
