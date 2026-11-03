import { CANVAS_TEXT_SIZE_PT } from "../pptx/deckConstants.js";
import { blendHex, contrastingTextColor } from "../pptx/colorMath.js";
import type { ThemeColors } from "../pptx/presentationBuilder.js";
import type { CanvasElement, CanvasSlide, CanvasTextSize, ChartSeries, FillRole, SlideContent, TextRole } from "../pptx/presentationBuilder.js";
import type { RecordedDeck, RecordedItem, RecordedSlide } from "../pptx/pptRecorded.js";
import { slideOptionsOf, ILLUSTRATION_ICONS } from "../pptx/slideDeck.js";

const ICON_NAMES_FOR_CONVERSION = new Set<string>(ILLUSTRATION_ICONS);

// Turns a normal-layout slide into a free-form ("canvas") slide without asking the model: the slide as it was drawn (text, shapes,
// pictures, icons, charts and tables, each with its box in inches) is written out as free-form elements in the same places.
// What a free-form element can say is narrower than what a layout draws, so this is the closest match, not an exact copy:
//   - colours become the deck's roles (title, body, accent, card...), the nearest one;
//   - text sizes become the nearest of five (xl, lg, md, sm, xs), one style per text box (no mixed bold within one box);
//   - arrows, triangles and other shapes become plain rectangles or ellipses; lines keep being lines.
// A slide with a chart or table this cannot carry over is not converted (null), so nothing is silently lost.

const HEADER_H = 0.62;
const FOOTER_H = 0.26;
const SLIDE_W = 10;
const SLIDE_H = 5.625;

type Opts = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const hex = (v: unknown) => (typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v) ? v.replace("#", "").toUpperCase() : null);
const near = (a: number, b: number, tol = 0.06) => Math.abs(a - b) <= tol;

function rgb(h: string): [number, number, number] {
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}
/** A colour drawn over the slide background with some transparency (0 to 100), as it looks. */
function composite(color: string, transparency: number, background: string): string {
  return blendHex(background, color, Math.min(1, Math.max(0, 1 - transparency / 100)));
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
function boxOf(opts: Opts): Box | null {
  const [x, y, w, h] = [num(opts.x), num(opts.y), num(opts.w), num(opts.h)];
  return x === null || y === null || w === null || h === null ? null : { x, y, w, h };
}
const contains = (outer: Box, inner: Box) => inner.x >= outer.x - 0.03 && inner.y >= outer.y - 0.03 && inner.x + inner.w <= outer.x + outer.w + 0.03 && inner.y + inner.h <= outer.y + outer.h + 0.03;

// ── Roles ─────────────────────────────────────────────────────────────────────────

function textRoleOf(color: string | null, c: ThemeColors): TextRole {
  if (!color) return "body";
  const candidates: [TextRole, string][] = [["title", c.titleColor], ["body", c.bodyColor], ["accent", c.accent], ["onAccent", contrastingTextColor(c.accent)]];
  return candidates.reduce((best, cur) => (distance(color, cur[1]) < distance(color, best[1]) ? cur : best))[0];
}

function sizeOf(pt: number | null): CanvasTextSize {
  if (!pt) return "md";
  const tokens = Object.entries(CANVAS_TEXT_SIZE_PT) as [CanvasTextSize, number][];
  return tokens.reduce((best, cur) => (Math.abs(Math.log(cur[1] / pt)) < Math.abs(Math.log(best[1] / pt)) ? cur : best))[0];
}

function fillRoleOf(fill: unknown, c: ThemeColors): FillRole {
  if (!fill || typeof fill !== "object") return "none";
  const f = fill as { color?: unknown; transparency?: unknown };
  const color = hex(f.color);
  if (!color) return "none";
  const transparency = num(f.transparency) ?? 0;
  if (transparency >= 97) return "none";
  const seen = composite(color, transparency, c.background);
  const candidates: [FillRole, string][] = [
    ["accent", c.accent],
    ["accentSoft", composite(c.accent, 85, c.background)],
    ["card", blendHex(c.background, c.bodyColor, 0.06)],
    ["background", c.background],
  ];
  return candidates.reduce((best, cur) => (distance(seen, cur[1]) < distance(seen, best[1]) ? cur : best))[0];
}

function borderRoleOf(line: unknown, c: ThemeColors): "accent" | "body" | "none" {
  if (!line || typeof line !== "object") return "none";
  const l = line as { type?: unknown; color?: unknown };
  if (l.type === "none") return "none";
  const color = hex(l.color);
  if (!color) return "none";
  return distance(color, c.accent) <= distance(color, c.bodyColor) ? "accent" : "body";
}

// ── Items ──────────────────────────────────────────────────────────────────────────

function textOf(item: Extract<RecordedItem, { kind: "text" }>): string {
  if (typeof item.text === "string") return item.text;
  let out = "";
  let atStart = true;
  for (const run of item.text) {
    const o = (run.options ?? {}) as Opts;
    if (atStart && o.bullet) out += "• ";
    out += run.text;
    atStart = !!o.breakLine;
    if (o.breakLine) out += "\n";
  }
  return out.replace(/\n+$/, "");
}

function firstTextOptions(item: Extract<RecordedItem, { kind: "text" }>): Opts {
  const runOpts = Array.isArray(item.text) ? ((item.text.find((r) => r.options)?.options ?? {}) as Opts) : {};
  return { ...runOpts, ...item.opts };
}

/** The inset the text box had inside its frame (points in the options, else the pptx default). */
function insetOf(margin: unknown): { l: number; r: number; t: number; b: number } {
  if (typeof margin === "number") return { l: margin / 72, r: margin / 72, t: margin / 72, b: margin / 72 };
  if (Array.isArray(margin) && margin.length === 4 && margin.every((v) => typeof v === "number")) {
    const [l, r, b, t] = margin as number[]; // pptxgenjs order: left, right, bottom, top
    return { l: l / 72, r: r / 72, t: t / 72, b: b / 72 };
  }
  return { l: 0.1, r: 0.1, t: 0.05, b: 0.05 };
}

function valignOf(v: unknown): "top" | "middle" | "bottom" {
  return v === "top" ? "top" : v === "bottom" ? "bottom" : "middle"; // a text box with no valign is centred
}

function chartElement(item: Extract<RecordedItem, { kind: "chart" }>, box: Box): CanvasElement | null {
  const raw = item.chartType;
  const type = typeof raw === "string" ? raw : null;
  const data = Array.isArray(item.data) ? (item.data as { name?: unknown; labels?: unknown; values?: unknown }[]) : null;
  if (!type || !data || data.length === 0) return null;
  const title = typeof (item.opts as Opts).title === "string" ? ((item.opts as Opts).title as string) : undefined;
  if (type === "scatter") {
    // The first series is the shared x values, the second the y values.
    const [xs, ys] = [data[0]?.values, data[1]?.values];
    if (data.length !== 2 || !Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || ![...xs, ...ys].every((v) => typeof v === "number")) return null;
    return { type: "chart", ...box, chartType: "scatter", categories: (xs as number[]).map(String), values: ys as number[], title };
  }
  const grouping = (item.opts as Opts).barGrouping;
  const chartType = type === "bar" && grouping === "stacked" ? "bar-stacked" : type;
  if (!["bar", "bar-stacked", "line", "pie", "doughnut", "radar", "area"].includes(chartType)) return null;
  const categories = Array.isArray(data[0].labels) ? (data[0].labels as unknown[]).map(String) : [];
  const series: ChartSeries[] = [];
  for (const d of data) {
    if (!Array.isArray(d.values) || !(d.values as unknown[]).every((v) => typeof v === "number")) return null;
    series.push({ name: typeof d.name === "string" ? d.name : "", values: d.values as number[] });
  }
  if (categories.length === 0 || series.length === 0) return null;
  const seriesCapable = ["bar", "bar-stacked", "line", "pie", "doughnut"].includes(chartType);
  if (series.length > 1) {
    if (!seriesCapable) return null;
    return { type: "chart", ...box, chartType: chartType as "bar", categories, series, title };
  }
  return { type: "chart", ...box, chartType: chartType as "bar", categories, values: series[0].values, title };
}

function cellText(cell: unknown): string {
  if (typeof cell === "string") return cell;
  if (cell && typeof cell === "object") {
    const t = (cell as { text?: unknown }).text;
    if (typeof t === "string") return t;
    if (Array.isArray(t)) return t.map((r) => (r && typeof r === "object" ? String((r as { text?: unknown }).text ?? "") : String(r))).join("");
  }
  return "";
}

function tableElement(item: Extract<RecordedItem, { kind: "table" }>, box: Box): CanvasElement | null {
  if (!Array.isArray(item.rows) || item.rows.length < 2) return null;
  const rows = (item.rows as unknown[]).map((r) => (Array.isArray(r) ? r.map(cellText) : null));
  if (rows.some((r) => r === null)) return null;
  const [headers, ...body] = rows as string[][];
  if (headers.length === 0 || body.length === 0) return null;
  return { type: "table", ...box, headers, rows: body };
}

// ── The conversion ──────────────────────────────────────────────────────────────────

export interface FreeFormInput {
  /** The slide as it is now (its layout fields, notes, icon and look settings). */
  slide: SlideContent;
  /** The same slide as drawn (see recordDeck), and what the drawn deck knows about its icons. */
  drawn: RecordedSlide;
  icons: RecordedDeck["icons"];
  iconColors?: RecordedDeck["iconColors"];
  /** The colours and fonts the slide was drawn with (slidePalette). */
  palette: ThemeColors;
  /** The deck's logo was drawn on this slide (its two items come last and are left out). */
  logoDrawn: boolean;
}

/** The free-form version of a slide, or null when it has a chart or table that free-form cannot carry over exactly enough. */
export function slideToFreeForm({ slide, drawn, icons, iconColors, palette, logoDrawn }: FreeFormInput): SlideContent | null {
  let items = drawn.items.slice();
  if (logoDrawn) items = items.slice(0, Math.max(0, items.length - 2));

  // Pictures placed on the slide are carried over as they are (they are part of the slide's settings), so their drawn items are not repeated.
  const placed = (Array.isArray((slide as { pictures?: unknown }).pictures) ? ((slide as { pictures: Box[] }).pictures) : []).map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
  items = items.filter((it) => {
    if (it.kind !== "image" || !("ref" in it.src)) return true;
    const b = boxOf(it.opts);
    // A placed picture is drawn whole inside its box, so the drawn picture lies within the placed box.
    return !(b && placed.some((p) => contains(p, b)));
  });

  // The layout's own header bar, title, icon badge, footer bar and page number: a free-form slide draws these itself.
  const first = items.find((it) => it.kind === "shape");
  const firstBox = first ? boxOf(first.opts) : null;
  const hasChrome = !!firstBox && near(firstBox.x, 0) && near(firstBox.y, 0) && firstBox.w >= SLIDE_W - 0.1 && near(firstBox.h, HEADER_H);
  const headerBox: Box = { x: 0, y: 0, w: SLIDE_W, h: HEADER_H + 0.02 };
  const footerBox: Box = { x: 0, y: SLIDE_H - FOOTER_H - 0.02, w: SLIDE_W, h: FOOTER_H + 0.02 };
  let title: string | undefined = typeof (slide as { title?: unknown }).title === "string" ? (slide as { title: string }).title : undefined;

  const skip = new Set<number>();
  if (hasChrome) {
    items.forEach((it, i) => {
      const b = boxOf(it.opts);
      if (!b) return;
      if (contains(headerBox, b) || (b.y + b.h <= headerBox.h + 0.02 && b.y >= -0.02 && b.h <= HEADER_H + 0.02)) {
        if (it.kind === "text" && !title) title = textOf(it).trim() || undefined;
        skip.add(i);
      } else if (contains(footerBox, b)) {
        skip.add(i);
      }
    });
  }

  const elements: CanvasElement[] = [];
  for (let i = 0; i < items.length; i++) {
    if (skip.has(i)) continue;
    const item = items[i];
    const box = boxOf(item.opts) ?? (item.kind === "image" ? sizedBox(item.opts) : null);
    if (!box) continue;

    if (item.kind === "text") {
      const text = textOf(item).trim();
      if (!text) continue;
      const o = firstTextOptions(item);
      if (typeof o.transparency === "number" && o.transparency >= 90) continue;
      const inset = insetOf(item.opts.margin);
      const inner = { x: box.x + inset.l, y: box.y + inset.t, w: Math.max(0.3, box.w - inset.l - inset.r), h: Math.max(0.2, box.h - inset.t - inset.b) };
      const face = typeof o.fontFace === "string" ? o.fontFace : "";
      elements.push({
        type: "text", ...inner, text,
        fontRole: face && face === palette.headingFont && palette.headingFont !== palette.bodyFont ? "heading" : "body",
        textRole: textRoleOf(hex(o.color), palette),
        size: sizeOf(num(o.fontSize)),
        bold: o.bold === true, italic: o.italic === true,
        align: o.align === "center" || o.align === "right" ? o.align : "left",
        valign: valignOf(o.valign),
      });
    } else if (item.kind === "shape") {
      const shape = item.shape === "line" ? "line" : item.shape === "ellipse" ? "ellipse" : item.shape === "roundRect" ? "roundRect" : "rect";
      // A badge circle followed by its glyph becomes one icon element.
      const next = items[i + 1];
      const glyph = next && next.kind === "image" && "asset" in next.src ? icons?.[next.src.asset] : undefined;
      const glyphBox = next && next.kind === "image" ? boxOf(next.opts) : null;
      if (shape === "ellipse" && glyph && glyphBox && contains(box, glyphBox) && ICON_NAMES_FOR_CONVERSION.has(glyph)) {
        elements.push({ type: "icon", ...box, icon: glyph as never, badge: true, ...onAccentFlag(iconColors?.[(next as { src: { asset: string } }).src.asset], palette) });
        skip.add(i + 1);
        continue;
      }
      if (box.w < 0.02 && box.h < 0.02) continue;
      const isLine = shape === "line" || box.w < 0.03 || box.h < 0.03;
      elements.push({
        type: "shape", ...box, shape: isLine ? "line" : shape,
        ...(isLine ? {} : { fillRole: fillRoleOf(item.opts.fill, palette) }),
        borderRole: borderRoleOf(item.opts.line, palette),
      });
    } else if (item.kind === "image") {
      if ("asset" in item.src) {
        const icon = icons?.[item.src.asset];
        if (icon && ICON_NAMES_FOR_CONVERSION.has(icon)) {
          const size = Math.min(box.w, box.h) / 0.7;
          elements.push({ type: "icon", x: box.x + box.w / 2 - size / 2, y: box.y + box.h / 2 - size / 2, w: size, h: size, icon: icon as never, badge: false, ...onAccentFlag(iconColors?.[item.src.asset], palette) });
        }
      } else if (item.src.ref !== "logo") {
        // The box already has the picture's own proportions, so filling it shows the whole picture and writes no caption of its own.
        elements.push({ type: "image", ...box, image: item.src.ref, fit: "cover" });
      }
    } else if (item.kind === "chart") {
      const el = chartElement(item, box);
      if (!el) return null;
      elements.push(el);
    } else if (item.kind === "table") {
      const el = tableElement(item, box);
      if (!el) return null;
      elements.push(el);
    }
  }
  if (elements.length === 0) return null;

  const original = slide as unknown as Record<string, unknown>;
  const options = slideOptionsOf(original);
  // A slide that had no header bar fills its own background (a divider, a hero): keep that colour.
  const bg = hex(drawn.background.color);
  const ownBackground = bg && bg !== palette.background && !options.background ? { background: bg } : {};
  const canvas: CanvasSlide = {
    layout: "canvas",
    ...(hasChrome && title ? { title } : {}),
    fullBleed: !hasChrome,
    elements: elements.slice(0, 60),
    ...(typeof original.notes === "string" && original.notes ? { notes: original.notes } : {}),
    ...(original.icon && hasChrome ? { icon: original.icon as never } : {}),
    ...(original.tone === "contrast" ? { tone: "contrast" as const } : {}),
  };
  return { ...canvas, ...options, ...ownBackground } as SlideContent;
}

/** An icon drawn in the colour that reads on the accent colour is placed on an accent-filled shape: keep it readable there. */
function onAccentFlag(color: string | undefined, palette: ThemeColors): { onAccent?: true } {
  return color && color.toUpperCase() === contrastingTextColor(palette.accent).toUpperCase() && color.toUpperCase() !== palette.accent.toUpperCase() ? { onAccent: true } : {};
}

function sizedBox(opts: Opts): Box | null {
  const x = num(opts.x);
  const y = num(opts.y);
  const sizing = opts.sizing as { w?: unknown; h?: unknown } | undefined;
  const w = num(sizing?.w);
  const h = num(sizing?.h);
  return x === null || y === null || w === null || h === null ? null : { x, y, w, h };
}
