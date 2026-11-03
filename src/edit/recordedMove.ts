import type { RecordedDeck, RecordedItem, RecordedSlide } from "../pptx/pptRecorded.js";
import type { Box } from "./deckEdit.js";

// While a part of a free-form slide is dragged or resized, the slide is drawn by the server (a round trip, after a short wait), so the
// picture behind the frame would only catch up when the drag pauses. This moves the drawn pieces that belong to the part at once, in the
// drawing the browser already has, and the server's exact drawing replaces it a moment later. Everything is in inches.

const TOLERANCE = 0.03;

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function boxOf(item: RecordedItem): Box | null {
  const x = num(item.opts.x);
  const y = num(item.opts.y);
  const w = num(item.opts.w);
  const h = num(item.opts.h);
  return x === undefined || y === undefined || w === undefined || h === undefined ? null : { x, y, w, h };
}

const same = (a: Box, b: Box) => Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.y - b.y) <= TOLERANCE && Math.abs(a.w - b.w) <= TOLERANCE && Math.abs(a.h - b.h) <= TOLERANCE;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - TOLERANCE && inner.y >= outer.y - TOLERANCE && inner.x + inner.w <= outer.x + outer.w + TOLERANCE && inner.y + inner.h <= outer.y + outer.h + TOLERANCE;

const round = (v: number) => Math.round(v * 10000) / 10000;

/** The pieces drawn for the part whose box was `from`: those with exactly that box, or, for a picture (drawn fitted inside its box, with its caption), what lies within it. */
function belongingTo(slide: RecordedSlide, kind: string, from: Box): Set<number> {
  const exact = new Set<number>();
  slide.items.forEach((item, i) => {
    const box = boxOf(item);
    if (box && same(box, from)) exact.add(i);
  });
  if (exact.size > 0 || (kind !== "picture" && kind !== "image")) return exact;
  const within = new Set<number>();
  slide.items.forEach((item, i) => {
    const box = boxOf(item);
    if ((item.kind === "image" || item.kind === "text") && box && inside(box, from)) within.add(i);
  });
  return within;
}

/** The drawing with the pieces of the part that went from box `from` to box `to` (on slide `slideIndex`) moved and scaled to match. The same object when nothing belongs to it. */
export function moveDrawn(drawn: RecordedDeck, slideIndex: number, kind: string, from: Box, to: Box): RecordedDeck {
  const slide = drawn.slides[slideIndex];
  if (!slide) return drawn;
  const hit = belongingTo(slide, kind, from);
  if (hit.size === 0) return drawn;
  const sx = from.w > 0 ? to.w / from.w : 1;
  const sy = from.h > 0 ? to.h / from.h : 1;
  const items = slide.items.map((item, i) => {
    if (!hit.has(i)) return item;
    const box = boxOf(item)!;
    const opts = { ...item.opts, x: round(to.x + (box.x - from.x) * sx), y: round(to.y + (box.y - from.y) * sy), w: round(box.w * sx), h: round(box.h * sy) };
    return { ...item, opts } as RecordedItem;
  });
  const slides = drawn.slides.slice();
  slides[slideIndex] = { ...slide, items };
  return { ...drawn, slides };
}
