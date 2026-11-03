import type { SlideDeck } from "../pptx/presentationBuilder.js";

// Two people (or two devices) editing the same deck: when a save finds the deck has moved on, this tries to keep both sets of
// changes instead of asking which one to throw away. It is a three way merge, slide by slide:
//   base   the deck as this editor last loaded or saved it
//   mine   the deck as it is in this editor now
//   theirs the deck as the server has it now (someone else saved first)
// A part that only one side changed takes that side's version; a part both changed to the same thing is kept once; a part both
// changed differently is a real conflict, and the caller then asks the person. Slides have no ids, so slides are matched by
// position, which is safe only while nobody added, removed or moved a slide on both sides: when the slide lists differ in
// length, the side that did not touch the list simply takes the other's.

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function mergeValue<T>(base: T, mine: T, theirs: T): { ok: true; value: T } | { ok: false } {
  if (same(mine, base)) return { ok: true, value: theirs };
  if (same(theirs, base) || same(mine, theirs)) return { ok: true, value: mine };
  return { ok: false };
}

/** The merged deck, or null when both sides changed the same part in different ways. */
export function mergeDecks(base: SlideDeck, mine: SlideDeck, theirs: SlideDeck): SlideDeck | null {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)]);
  for (const key of keys) {
    if (key === "slides") continue;
    const b = (base as unknown as Record<string, unknown>)[key];
    const m = (mine as unknown as Record<string, unknown>)[key];
    const t = (theirs as unknown as Record<string, unknown>)[key];
    const merged = mergeValue(b, m, t);
    if (!merged.ok) return null;
    if (merged.value !== undefined) out[key] = merged.value;
  }

  const slides = mergeSlides(base.slides as unknown[], mine.slides as unknown[], theirs.slides as unknown[]);
  if (!slides) return null;
  out.slides = slides;
  return out as unknown as SlideDeck;
}

function mergeSlides(base: unknown[], mine: unknown[], theirs: unknown[]): unknown[] | null {
  if (same(mine, base)) return theirs;
  if (same(theirs, base) || same(mine, theirs)) return mine;
  // Both changed something. Only a same-length list can be matched slide by slide.
  if (base.length !== mine.length || base.length !== theirs.length) return null;
  const out: unknown[] = [];
  for (let i = 0; i < base.length; i++) {
    const merged = mergeValue(base[i], mine[i], theirs[i]);
    if (!merged.ok) return null;
    out.push(merged.value);
  }
  return out;
}
