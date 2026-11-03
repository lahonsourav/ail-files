import { ILLUSTRATION_ICONS, IMAGE_PLACEMENTS, PHOTO_ARRANGEMENTS } from "../pptx/slideDeck.js";
import type { SlideContent, SlideDeck } from "../pptx/presentationBuilder.js";
import type { RecordedSlide } from "../pptx/pptRecorded.js";

// Pure helpers for the deck editor (app/(main)/deck/[id]): changing a deck without mutating it, adding and moving
// slides, starting a new slide from a template, an undo history, and what kind of control each field of a slide
// gets. No React and no browser APIs, so it is all covered by unit tests.

export type Path = (string | number)[];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function getAt(root: unknown, path: Path): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** A copy of `root` with `value` at `path` (the path may end at a key that does not exist yet). Everything off the path is shared, not copied. */
export function setAt<T>(root: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = root.slice();
    copy[head as number] = setAt(copy[head as number], rest, value);
    return copy as unknown as T;
  }
  const obj = (root !== null && typeof root === "object" ? root : {}) as Record<string, unknown>;
  return { ...obj, [head]: setAt(obj[head as string], rest, value) } as T;
}

/** A copy without the key, or without the array element, at `path`. */
export function removeAt<T>(root: T, path: Path): T {
  if (path.length === 0) return root;
  const parent = path.slice(0, -1);
  const last = path[path.length - 1];
  const holder = getAt(root, parent);
  if (Array.isArray(holder)) return setAt(root, parent, holder.filter((_, i) => i !== last));
  if (holder && typeof holder === "object") {
    const { [last as string]: _gone, ...rest } = holder as Record<string, unknown>; // eslint-disable-line @typescript-eslint/no-unused-vars
    return setAt(root, parent, rest);
  }
  return root;
}

export function insertAt<T>(root: T, arrayPath: Path, index: number, value: unknown): T {
  const list = getAt(root, arrayPath);
  if (!Array.isArray(list)) return root;
  const at = Math.max(0, Math.min(list.length, index));
  return setAt(root, arrayPath, [...list.slice(0, at), value, ...list.slice(at)]);
}

export function moveWithin<T>(root: T, arrayPath: Path, from: number, to: number): T {
  const list = getAt(root, arrayPath);
  if (!Array.isArray(list) || from < 0 || from >= list.length) return root;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return root;
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return setAt(root, arrayPath, next);
}

/** An empty copy shaped like `value`: "" for text, 0 for a number, false for a flag, empty lists, and the same keys on objects. For a new row in a list. */
export function blankLike(value: unknown): unknown {
  if (typeof value === "string") return "";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, blankLike(v)]));
  return value;
}

/** A new item for a list: shaped like its first item when there is one, else like `fallback`. A new row copies the first row's icon (a blank one would be rejected). */
export function newListItem(list: unknown[], fallback: unknown = ""): unknown {
  const first = list[0] ?? fallback;
  if (first && typeof first === "object" && !Array.isArray(first)) {
    return Object.fromEntries(Object.entries(first as Record<string, unknown>).map(([k, v]) => [k, k === "icon" || k === "image" || k === "type" || k === "status" ? v : blankLike(v)]));
  }
  return blankLike(first);
}

// ── Deck and slide operations ────────────────────────────────────────────────────────────────────────

export function updateSlide(deck: SlideDeck, index: number, slide: SlideContent): SlideDeck {
  return { ...deck, slides: deck.slides.map((s, i) => (i === index ? slide : s)) };
}

export function addSlide(deck: SlideDeck, slide: SlideContent, at: number = deck.slides.length): SlideDeck {
  const i = Math.max(0, Math.min(deck.slides.length, at));
  return { ...deck, slides: [...deck.slides.slice(0, i), slide, ...deck.slides.slice(i)] };
}

export function duplicateSlide(deck: SlideDeck, index: number): SlideDeck {
  const slide = deck.slides[index];
  if (!slide) return deck;
  return addSlide(deck, JSON.parse(JSON.stringify(slide)) as SlideContent, index + 1);
}

/** Removes a slide. A deck always keeps at least one. */
export function deleteSlide(deck: SlideDeck, index: number): SlideDeck {
  if (deck.slides.length <= 1 || index < 0 || index >= deck.slides.length) return deck;
  return { ...deck, slides: deck.slides.filter((_, i) => i !== index) };
}

export function moveSlide(deck: SlideDeck, from: number, to: number): SlideDeck {
  return moveWithin(deck, ["slides"], from, to);
}

// ── New slides ───────────────────────────────────────────────────────────────────────────────────────

interface Template {
  label: string;
  make: () => SlideContent;
}

/** The layouts offered in "Add slide", with a starting slide each. Other layouts can still be edited; Ail makes those. */
export const NEW_SLIDE_TEMPLATES: Record<string, Template> = {
  bullets: { label: "Title and bullets", make: () => ({ layout: "bullets", title: "New slide", bullets: ["First point", "Second point", "Third point"] }) as SlideContent },
  columns: { label: "Two columns", make: () => ({ layout: "columns", title: "New slide", left: { heading: "Left", bullets: ["First point", "Second point"] }, right: { heading: "Right", bullets: ["First point", "Second point"] } }) as SlideContent },
  stat: { label: "Big number", make: () => ({ layout: "stat", value: "100", caption: "What this number means" }) as SlideContent },
  quote: { label: "Quote", make: () => ({ layout: "quote", quote: "A short quote goes here.", author: "Name" }) as SlideContent },
  section: { label: "Section divider", make: () => ({ layout: "section", title: "New section" }) as SlideContent },
  grid: { label: "Cards", make: () => ({ layout: "grid", title: "New slide", items: [{ title: "First", description: "Short description" }, { title: "Second", description: "Short description" }, { title: "Third", description: "Short description" }] }) as SlideContent },
  timeline: { label: "Timeline", make: () => ({ layout: "timeline", title: "New slide", steps: [{ label: "Step 1", detail: "What happens" }, { label: "Step 2", detail: "What happens" }, { label: "Step 3", detail: "What happens" }] }) as SlideContent },
  image: { label: "Picture", make: () => ({ layout: "image", title: "New slide", placeholder: "Add a picture here", placement: "full" }) as SlideContent },
  thank_you: { label: "Thank you", make: () => ({ layout: "thank_you", title: "Thank you", subtitle: "Questions?" }) as SlideContent },
};

export function newSlide(layout: string): SlideContent | null {
  return NEW_SLIDE_TEMPLATES[layout]?.make() ?? null;
}

// ── History (undo and redo) ──────────────────────────────────────────────────────────────────────────

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** What the last change was about, and when, so typing in one field is one undo step, not one per letter. */
  lastKey?: string;
  lastAt?: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 800;

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });
export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;

/** `next` becomes the present. A change with the same `key` as the last one, soon after it, replaces it instead of adding a step. */
export function commit<T>(h: History<T>, next: T, opts: { key?: string; now?: number } = {}): History<T> {
  if (next === h.present) return h;
  const now = opts.now ?? Date.now();
  const merge = opts.key !== undefined && opts.key === h.lastKey && h.lastAt !== undefined && now - h.lastAt < COALESCE_MS && h.past.length > 0;
  const past = merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: opts.key, lastAt: now };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastKey: undefined };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), lastKey: undefined };
}

// ── What control each field gets ─────────────────────────────────────────────────────────────────────

export type FieldKind = "text" | "longtext" | "number" | "flag" | "choice" | "icon" | "picture" | "list" | "object" | "hidden";

export interface FieldSpec {
  kind: FieldKind;
  label: string;
  options?: readonly string[];
}

const ENUMS: Record<string, readonly string[]> = {
  placement: IMAGE_PLACEMENTS,
  arrangement: PHOTO_ARRANGEMENTS,
  tone: ["base", "contrast"],
  chartType: ["bar", "line", "pie", "doughnut", "bar-stacked", "scatter", "bubble", "radar", "area"],
  type: ["start", "process", "decision", "end"],
  // Free-form (canvas) elements
  shape: ["rect", "roundRect", "ellipse", "line"],
  fillRole: ["accent", "accentSoft", "card", "background", "none"],
  borderRole: ["accent", "body", "none"],
  textRole: ["title", "body", "accent", "onAccent"],
  fontRole: ["heading", "body"],
  size: ["xl", "lg", "md", "sm", "xs"],
  align: ["left", "center", "right"],
  valign: ["top", "middle", "bottom"],
};

/** What a free-form element's "type" is: not a choice to make in the form (changing it would leave the wrong fields on the element). */
const CANVAS_ELEMENT_TYPES = new Set(["text", "shape", "icon", "image", "chart", "table"]);

const LONG_TEXT = new Set(["notes", "description", "detail", "text", "problem", "solution", "bio", "quote", "rationale", "outcomeDetail", "definition", "caption", "subtitle"]);

// Keys the form leaves alone: positions are set by dragging (later), ids tie a flowchart together.
const HIDDEN = new Set(["layout", "id", "position", "x", "y", "w", "h", "connections", "columnColors", "sortable", "filterable", "format", "numeric"]);

/** "outcomeLabel" becomes "Outcome label". */
export function humanize(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function fieldSpec(key: string, value: unknown): FieldSpec {
  const label = humanize(key);
  if (HIDDEN.has(key)) return { kind: "hidden", label };
  if (key === "type" && typeof value === "string" && CANVAS_ELEMENT_TYPES.has(value)) return { kind: "hidden", label };
  if (key === "icon") return { kind: "icon", label: "Icon", options: ILLUSTRATION_ICONS };
  if (key === "image") return { kind: "picture", label: "Picture" };
  if (ENUMS[key]) return { kind: "choice", label, options: ENUMS[key] };
  if (Array.isArray(value)) return { kind: "list", label };
  if (typeof value === "boolean") return { kind: "flag", label };
  if (typeof value === "number") return { kind: "number", label };
  if (value && typeof value === "object") return { kind: "object", label };
  return { kind: LONG_TEXT.has(key) || (typeof value === "string" && value.length > 60) ? "longtext" : "text", label };
}

/** Fields a slide may have that are often not there yet, so the form can offer them: [path within the slide, starting value]. */
const OPTIONAL: Record<string, [string, unknown][]> = {
  _all: [["notes", ""], ["tone", "base"]],
  image: [["caption", ""]],
  section: [["eyebrow", ""]],
  hero: [["eyebrow", ""], ["subtitle", ""]],
  process: [["caption", ""]],
  quote: [["author", ""]],
  thank_you: [["title", "Thank you"], ["subtitle", ""]],
  stat: [["caption", ""]],
};

export function optionalFields(layout: string): [string, unknown][] {
  return [...(OPTIONAL[layout] ?? []), ...OPTIONAL._all];
}

/** The layout of a slide; a plain bullets slide may not name one. */
export const layoutOf = (slide: SlideContent): string => (slide as { layout?: string }).layout ?? "bullets";

export const LAYOUT_LABELS: Record<string, string> = {
  bullets: "Bullets", stat: "Big number", comparison: "Comparison", quote: "Quote", section: "Section", table: "Table", chart: "Chart", grid: "Cards", ranked: "Ranked list",
  timeline: "Timeline", columns: "Two columns", problem_solution: "Problem and solution", team: "Team", iconlist: "Icon list", funnel: "Funnel", stats_row: "Numbers", process: "Process",
  recommendation: "Recommendation", thank_you: "Thank you", presenter: "Presenters", hero: "Hero", tiers: "Tiers", recap: "Recap", glossary: "Glossary", roadmap: "Roadmap", matrix: "Matrix",
  flowchart: "Flowchart", calendar: "Calendar", gallery: "Gallery", image: "Picture", photos: "Photos", before_after: "Before and after", quote_carousel: "Quotes", advanced_table: "Table", canvas: "Free-form",
};

export type { Json };

// ── Positions ──────────────────────────────────────────────────────────────────────
// Boxes on a slide the person can move and resize: a free-form slide's elements and the pictures placed on any slide.
// All in inches on the 10 x 5.625 slide, snapped to a tenth of an inch.

export const SLIDE_WIDTH = 10;
export const SLIDE_HEIGHT = 5.625;
export const MIN_BOX = 0.3;
export const SNAP = 0.1;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type BoxList = "elements" | "pictures";
export interface MovableBox {
  list: BoxList;
  index: number;
  box: Box;
  /** "text", "picture", "chart"...: for labels. */
  kind: string;
}
export type Corner = "nw" | "ne" | "sw" | "se";

const isBox = (v: unknown): v is Box => !!v && typeof v === "object" && ["x", "y", "w", "h"].every((k) => typeof (v as Record<string, unknown>)[k] === "number" && Number.isFinite((v as Record<string, unknown>)[k]));

/** Every box on the slide that can be moved. */
export function movableBoxes(slide: SlideContent): MovableBox[] {
  const s = slide as unknown as { layout?: string; elements?: unknown; pictures?: unknown };
  const out: MovableBox[] = [];
  if (s.layout === "canvas" && Array.isArray(s.elements)) {
    s.elements.forEach((el, index) => {
      if (isBox(el)) out.push({ list: "elements", index, box: { x: el.x, y: el.y, w: el.w, h: el.h }, kind: String((el as unknown as { type?: string }).type ?? "element") });
    });
  }
  if (Array.isArray(s.pictures)) {
    s.pictures.forEach((p, index) => {
      if (isBox(p)) out.push({ list: "pictures", index, box: { x: p.x, y: p.y, w: p.w, h: p.h }, kind: "picture" });
    });
  }
  return out;
}

export const snapTo = (v: number) => Math.round(v / SNAP) * SNAP;
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Keeps a box on the slide and at least MIN_BOX in size (the size wins over the position). */
export function clampBox(b: Box): Box {
  const w = Math.min(SLIDE_WIDTH, Math.max(MIN_BOX, b.w));
  const h = Math.min(SLIDE_HEIGHT, Math.max(MIN_BOX, b.h));
  return { x: round(Math.min(Math.max(0, b.x), SLIDE_WIDTH - w)), y: round(Math.min(Math.max(0, b.y), SLIDE_HEIGHT - h)), w: round(w), h: round(h) };
}

/** The box moved by dx, dy inches (snapped, kept on the slide). */
export function moveBox(b: Box, dx: number, dy: number): Box {
  return clampBox({ ...b, x: snapTo(b.x + dx), y: snapTo(b.y + dy) });
}

/** The box with one corner dragged by dx, dy inches; the opposite corner stays where it is. */
export function resizeBox(b: Box, corner: Corner, dx: number, dy: number): Box {
  let left = b.x;
  let top = b.y;
  let right = b.x + b.w;
  let bottom = b.y + b.h;
  if (corner === "nw" || corner === "sw") left = Math.min(snapTo(left + dx), right - MIN_BOX);
  if (corner === "ne" || corner === "se") right = Math.max(snapTo(right + dx), left + MIN_BOX);
  if (corner === "nw" || corner === "ne") top = Math.min(snapTo(top + dy), bottom - MIN_BOX);
  if (corner === "sw" || corner === "se") bottom = Math.max(snapTo(bottom + dy), top + MIN_BOX);
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(SLIDE_WIDTH, right);
  bottom = Math.min(SLIDE_HEIGHT, bottom);
  return clampBox({ x: left, y: top, w: right - left, h: bottom - top });
}

/** The slide with the box at `list[index]` set to `box`. */
export function setBox(slide: SlideContent, list: BoxList, index: number, box: Box): SlideContent {
  let next = slide;
  for (const k of ["x", "y", "w", "h"] as const) next = setAt(next, [list, index, k], box[k]);
  return next;
}

/** What a new element on a free-form slide starts as, placed in a free-ish spot. */
export function newCanvasElement(kind: "text" | "shape" | "icon" | "image", pictureId?: string): unknown {
  switch (kind) {
    case "text":
      return { type: "text", x: 1, y: 1.6, w: 4, h: 0.8, text: "New text", textRole: "body", size: "md" };
    case "shape":
      return { type: "shape", x: 1, y: 2.6, w: 2, h: 1.2, shape: "roundRect", fillRole: "accentSoft", borderRole: "none" };
    case "icon":
      return { type: "icon", x: 4, y: 2.6, w: 1, h: 1, icon: "idea", badge: true };
    default:
      return pictureId ? { type: "image", x: 5.2, y: 1.4, w: 4, h: 3.2, image: pictureId } : { type: "image", x: 5.2, y: 1.4, w: 4, h: 3.2, placeholder: "Add a picture here" };
  }
}

/** A picture placed on the slide, in the lower right, in proportion to the picture. */
export function newSlidePicture(id: string, width: number, height: number): { image: string } & Box {
  const ratio = width > 0 && height > 0 ? width / height : 1.5;
  const w = Math.min(3.6, 2.4 * Math.max(1, ratio));
  const h = Math.min(3, w / ratio);
  return { image: id, ...clampBox({ x: SLIDE_WIDTH - w - 0.4, y: SLIDE_HEIGHT - h - 0.5, w, h }) };
}

// ── Parts a layout places itself ─────────────────────────────────────────────────────
// A normal (non free-form) slide cannot have its own parts moved; the editor shows them as locked frames so the person can see
// what is fixed and is told to turn on free-form to move them. They are found from what was drawn.

export interface LockedPart extends Box {
  kind: string;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The text, charts, tables and pictures a layout drew, as boxes in inches; `skip` are boxes that can already be moved (placed pictures). */
export function lockedParts(slide: RecordedSlide | undefined, skip: Box[] = []): LockedPart[] {
  if (!slide) return [];
  const same = (a: Box, b: Box) => ["x", "y", "w", "h"].every((k) => Math.abs(a[k as keyof Box] - b[k as keyof Box]) < 0.02);
  const out: LockedPart[] = [];
  for (const item of slide.items) {
    if (item.kind === "shape") continue;
    const [x, y, w, h] = [num(item.opts.x), num(item.opts.y), num(item.opts.w), num(item.opts.h)];
    if (x === null || y === null || w === null || h === null || w < 0.3 || h < 0.25) continue;
    if (item.kind === "text") {
      const text = typeof item.text === "string" ? item.text : item.text.map((r) => r.text).join("");
      if (!text.trim() || /^\d+\s*\/\s*\d+$/.test(text.trim())) continue; // empty, or the page number
    }
    if (item.kind === "image" && "ref" in item.src && item.src.ref === "logo") continue;
    const box = { x, y, w, h };
    if (skip.some((s) => same(s, box))) continue;
    out.push({ ...box, kind: item.kind === "text" ? "text" : item.kind });
  }
  return out.slice(0, 60);
}
