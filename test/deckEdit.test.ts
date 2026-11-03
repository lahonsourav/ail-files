import { describe, it, expect } from "vitest";
import { lockedParts, movableBoxes, moveBox, resizeBox, setBox, newCanvasElement, newSlidePicture, clampBox, type Box, getAt, setAt, removeAt, insertAt, moveWithin, blankLike, newListItem, updateSlide, addSlide, duplicateSlide, deleteSlide, moveSlide, newSlide, NEW_SLIDE_TEMPLATES, createHistory, commit, undo, redo, canUndo, canRedo, fieldSpec, optionalFields, humanize, HISTORY_LIMIT, COALESCE_MS, type Path } from "../src/edit/deckEdit.js";
import { normalizeDeck } from "../src/pptx/slideDeck.js";
import { EXAMPLE_DECK } from "../src/pptx/exampleDeck.js";
import type { SlideDeck, SlideContent } from "../src/pptx/presentationBuilder.js";

const deck = normalizeDeck({ title: "T", slides: [{ layout: "bullets", title: "A", bullets: ["a1", "a2"] }, { layout: "stat", value: "9", caption: "c" }, { layout: "section", title: "S" }] }) as SlideDeck;

describe("setAt, removeAt, insertAt, moveWithin", () => {
  it("changes a copy and leaves the original alone, sharing what it did not touch", () => {
    const next = setAt(deck, ["slides", 0, "bullets", 1], "changed") as SlideDeck;
    expect(getAt(next, ["slides", 0, "bullets", 1])).toBe("changed");
    expect(getAt(deck, ["slides", 0, "bullets", 1])).toBe("a2");
    expect(next.slides[1]).toBe(deck.slides[1]);
  });

  it("can set a key that is not there yet, and replace the whole thing", () => {
    expect(getAt(setAt(deck, ["slides", 2, "eyebrow"], "PART"), ["slides", 2, "eyebrow"])).toBe("PART");
    expect(setAt({ a: 1 }, [], { b: 2 })).toEqual({ b: 2 });
  });

  it("removes a key or a list element", () => {
    expect(getAt(removeAt(deck, ["slides", 0, "bullets", 0]), ["slides", 0, "bullets"])).toEqual(["a2"]);
    expect("caption" in (removeAt(deck, ["slides", 1, "caption"]).slides[1] as object)).toBe(false);
    expect(removeAt(deck, [])).toBe(deck);
  });

  it("inserts inside the list, clamping the position, and ignores a path that is not a list", () => {
    expect(getAt(insertAt(deck, ["slides", 0, "bullets"], 1, "new"), ["slides", 0, "bullets"])).toEqual(["a1", "new", "a2"]);
    expect(getAt(insertAt(deck, ["slides", 0, "bullets"], 99, "end"), ["slides", 0, "bullets"])).toEqual(["a1", "a2", "end"]);
    expect(insertAt(deck, ["title"], 0, "x")).toBe(deck);
  });

  it("moves an element, clamping the target, and does nothing for a no-op", () => {
    expect(getAt(moveWithin(deck, ["slides", 0, "bullets"], 0, 1), ["slides", 0, "bullets"])).toEqual(["a2", "a1"]);
    expect(getAt(moveWithin(deck, ["slides", 0, "bullets"], 0, 9), ["slides", 0, "bullets"])).toEqual(["a2", "a1"]);
    expect(moveWithin(deck, ["slides", 0, "bullets"], 0, 0)).toBe(deck);
    expect(moveWithin(deck, ["slides", 0, "bullets"], 5, 0)).toBe(deck);
  });
});

describe("blankLike and newListItem", () => {
  it("makes empty values of the same shape", () => {
    expect(blankLike({ a: "x", b: 3, c: true, d: ["q"], e: { f: "y" } })).toEqual({ a: "", b: 0, c: false, d: [], e: { f: "" } });
  });
  it("a new row copies what must not be empty (an icon), and blanks the text", () => {
    expect(newListItem([{ title: "T", description: "D", icon: "star" }])).toEqual({ title: "", description: "", icon: "star" });
    expect(newListItem(["x"])).toBe("");
    expect(newListItem([], "fallback")).toBe("");
  });
});

describe("slide operations", () => {
  it("replaces, adds, duplicates, moves and deletes", () => {
    expect(updateSlide(deck, 1, deck.slides[2]).slides[1]).toBe(deck.slides[2]);
    expect(addSlide(deck, deck.slides[2], 1).slides.length).toBe(4);
    const dup = duplicateSlide(deck, 0);
    expect(dup.slides.length).toBe(4);
    expect(dup.slides[1]).toEqual(dup.slides[0]);
    expect(dup.slides[1]).not.toBe(dup.slides[0]); // a copy, so editing one does not change the other
    expect(moveSlide(deck, 0, 2).slides.map((s) => s.layout)).toEqual(["stat", "section", "bullets"]);
    expect(deleteSlide(deck, 1).slides.map((s) => s.layout)).toEqual(["bullets", "section"]);
  });
  it("a deck always keeps at least one slide", () => {
    const one = deleteSlide(deleteSlide(deck, 0), 0);
    expect(one.slides.length).toBe(1);
    expect(deleteSlide(one, 0)).toBe(one);
  });
});

describe("new slides", () => {
  it("every template is a slide the normaliser accepts, in the layout it says", () => {
    for (const [layout, t] of Object.entries(NEW_SLIDE_TEMPLATES)) {
      const made = normalizeDeck({ title: "T", slides: [t.make()] });
      expect(made, layout).not.toBeNull();
      expect(made!.slides.some((s) => s.layout === layout), `${layout} survives normalising`).toBe(true);
    }
    expect(newSlide("nope")).toBeNull();
  });
});

describe("history", () => {
  it("undoes and redoes, and a new change drops what was undone", () => {
    let h = createHistory(1);
    h = commit(h, 2, { now: 0 });
    h = commit(h, 3, { now: 10_000 });
    expect([h.present, canUndo(h), canRedo(h)]).toEqual([3, true, false]);
    h = undo(h);
    expect([h.present, canRedo(h)]).toEqual([2, true]);
    h = redo(h);
    expect(h.present).toBe(3);
    h = undo(undo(h));
    expect(h.present).toBe(1);
    h = commit(h, 9, { now: 20_000 });
    expect(canRedo(h)).toBe(false);
    expect(undo(createHistory(1)).present).toBe(1);
  });

  it("typing in one field is one step; a different field, or a pause, is a new one", () => {
    let h = createHistory("");
    h = commit(h, "a", { key: "title", now: 0 });
    h = commit(h, "ab", { key: "title", now: 100 });
    h = commit(h, "abc", { key: "title", now: 200 });
    expect(h.past.length).toBe(1);
    expect(undo(h).present).toBe("");
    h = commit(h, "abcd", { key: "title", now: 200 + COALESCE_MS + 1 });
    expect(h.past.length).toBe(2);
    h = commit(h, "other", { key: "subtitle", now: 300 + COALESCE_MS + 1 });
    expect(h.past.length).toBe(3);
  });

  it("ignores a change that changes nothing, and never grows without limit", () => {
    const h = createHistory({ n: 0 });
    expect(commit(h, h.present)).toBe(h);
    let long = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) long = commit(long, i, { now: i * 10_000 });
    expect(long.past.length).toBe(HISTORY_LIMIT);
  });
});

describe("fieldSpec", () => {
  it("gives each kind of value its control", () => {
    expect(fieldSpec("title", "Hello").kind).toBe("text");
    expect(fieldSpec("notes", "x").kind).toBe("longtext");
    expect(fieldSpec("caption", "x").kind).toBe("longtext");
    expect(fieldSpec("value", "100").kind).toBe("text");
    expect(fieldSpec("currentIndex", 2).kind).toBe("number");
    expect(fieldSpec("highlight", true).kind).toBe("flag");
    expect(fieldSpec("bullets", ["a"]).kind).toBe("list");
    expect(fieldSpec("left", { heading: "x" }).kind).toBe("object");
    expect(fieldSpec("icon", "star")).toMatchObject({ kind: "icon" });
    expect(fieldSpec("image", "img1").kind).toBe("picture");
    expect(fieldSpec("placement", "left")).toMatchObject({ kind: "choice", options: expect.arrayContaining(["full", "background"]) });
    expect(fieldSpec("layout", "bullets").kind).toBe("hidden");
    expect(fieldSpec("position", { x: 1, y: 2 }).kind).toBe("hidden");
  });
  it("turns a key into a label", () => {
    expect(humanize("outcomeLabel")).toBe("Outcome label");
    expect(humanize("before_after")).toBe("Before after");
  });
  it("offers notes and tone on every slide, plus the optional fields of some layouts", () => {
    expect(optionalFields("bullets").map(([k]) => k)).toEqual(["notes", "tone"]);
    expect(optionalFields("hero").map(([k]) => k)).toEqual(["eyebrow", "subtitle", "notes", "tone"]);
  });
});

// Every field of every layout can be edited, and every list can grow, without the deck becoming invalid.
describe("editing the whole example deck", () => {
  const example = normalizeDeck(EXAMPLE_DECK) as SlideDeck;

  function leafStrings(value: unknown, path: Path, out: Path[]) {
    if (typeof value === "string") out.push(path);
    else if (Array.isArray(value)) value.forEach((v, i) => leafStrings(v, [...path, i], out));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) if (fieldSpec(k, v).kind !== "hidden") leafStrings(v, [...path, k], out);
  }
  function lists(value: unknown, path: Path, out: Path[]) {
    if (Array.isArray(value)) {
      out.push(path);
      value.forEach((v, i) => lists(v, [...path, i], out));
    } else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) lists(v, [...path, k], out);
  }

  it("changing any text keeps the deck valid, with the same slides", () => {
    for (const [i, slide] of example.slides.entries()) {
      const paths: Path[] = [];
      leafStrings(slide, ["slides", i], paths);
      for (const p of paths) {
        const key = String(p[p.length - 1]);
        if (key === "icon" || key === "image" || key === "layout" || key === "type" || key === "status" || key === "chartType" || key === "placement" || key === "arrangement" || key === "tone" || key === "id") continue;
        const edited = normalizeDeck(setAt(example, p, "Edited text"), { editing: true });
        expect(edited, `${slide.layout} ${p.join(".")}`).not.toBeNull();
        expect(edited!.slides.length).toBe(example.slides.length);
      }
    }
  });

  it("adding a row to any list keeps the deck valid", () => {
    for (const [i, slide] of example.slides.entries()) {
      const paths: Path[] = [];
      lists(slide, ["slides", i], paths);
      for (const p of paths) {
        const list = getAt(example, p) as unknown[];
        const grown = insertAt(example, p, list.length, newListItem(list));
        expect(normalizeDeck(grown, { editing: true }), `${slide.layout} ${p.join(".")}`).not.toBeNull();
        expect(normalizeDeck(grown, { editing: true })!.slides.length, `${slide.layout} ${p.join(".")} keeps its slide`).toBe(example.slides.length);
      }
    }
  });
});

describe("positions", () => {
  const canvas = { layout: "canvas", title: "T", elements: [{ type: "text", x: 1, y: 1, w: 4, h: 1, text: "Hi" }, { type: "shape", shape: "rect", x: 6, y: 2, w: 2, h: 1 }], pictures: [{ image: "img1", x: 7, y: 3, w: 2, h: 1.5 }] } as unknown as SlideContent;

  it("lists the boxes that can be moved: a free-form slide's elements and the slide's pictures", () => {
    const boxes = movableBoxes(canvas);
    expect(boxes.map((b) => `${b.list}.${b.index}.${b.kind}`)).toEqual(["elements.0.text", "elements.1.shape", "pictures.0.picture"]);
    expect(movableBoxes({ layout: "bullets", title: "a", bullets: [] } as unknown as SlideContent)).toEqual([]);
    expect(movableBoxes({ layout: "bullets", title: "a", bullets: [], pictures: [{ image: "img1", x: 1, y: 1, w: 2, h: 2 }] } as unknown as SlideContent)).toHaveLength(1);
  });

  it("moves in tenths of an inch and stays on the slide", () => {
    expect(moveBox({ x: 1, y: 1, w: 2, h: 1 }, 0.34, -0.26)).toEqual({ x: 1.3, y: 0.7, w: 2, h: 1 });
    expect(moveBox({ x: 1, y: 1, w: 2, h: 1 }, -5, -5)).toMatchObject({ x: 0, y: 0 });
    expect(moveBox({ x: 1, y: 1, w: 2, h: 1 }, 50, 50)).toMatchObject({ x: 8, y: 4.625 });
  });

  it("resizes from a corner while the opposite corner stays, with a minimum size", () => {
    expect(resizeBox({ x: 1, y: 1, w: 2, h: 1 }, "se", 1, 0.5)).toEqual({ x: 1, y: 1, w: 3, h: 1.5 });
    expect(resizeBox({ x: 1, y: 1, w: 2, h: 1 }, "nw", -0.5, -0.5)).toEqual({ x: 0.5, y: 0.5, w: 2.5, h: 1.5 });
    const tiny = resizeBox({ x: 1, y: 1, w: 2, h: 1 }, "se", -9, -9);
    expect(tiny.w).toBeCloseTo(0.3);
    expect(tiny.h).toBeCloseTo(0.3);
    expect(tiny.x).toBe(1);
    expect(resizeBox({ x: 8, y: 4, w: 1, h: 1 }, "se", 5, 5)).toMatchObject({ w: 2, h: 1.625 });
  });

  it("writes a box back into the slide", () => {
    const next = setBox(canvas, "pictures", 0, { x: 1, y: 2, w: 3, h: 2 }) as unknown as { pictures: Box[] };
    expect(next.pictures[0]).toMatchObject({ image: "img1", x: 1, y: 2, w: 3, h: 2 });
    expect((canvas as unknown as { pictures: Box[] }).pictures[0].x).toBe(7); // the original is untouched
  });

  it("starts new elements and pictures inside the slide", () => {
    for (const k of ["text", "shape", "icon", "image"] as const) {
      const el = newCanvasElement(k) as Box;
      expect(clampBox(el)).toEqual({ x: el.x, y: el.y, w: el.w, h: el.h });
    }
    expect((newCanvasElement("image", "img2") as { image: string }).image).toBe("img2");
    const wide = newSlidePicture("img1", 1600, 900);
    expect(wide.x + wide.w).toBeLessThanOrEqual(10);
    expect(wide.y + wide.h).toBeLessThanOrEqual(5.625);
    expect(wide.w / wide.h).toBeCloseTo(1600 / 900, 0);
  });
});

describe("fieldSpec for free-form elements", () => {
  it("does not offer a free-form element's type as a choice, and offers its roles and shapes", () => {
    expect(fieldSpec("type", "text").kind).toBe("hidden");
    expect(fieldSpec("type", "image").kind).toBe("hidden");
    expect(fieldSpec("type", "decision").kind).toBe("choice"); // a flowchart node's
    expect(fieldSpec("shape", "rect")).toMatchObject({ kind: "choice" });
    expect(fieldSpec("fillRole", "card").options).toContain("accentSoft");
    expect(fieldSpec("size", "md").options).toEqual(["xl", "lg", "md", "sm", "xs"]);
  });
});

describe("lockedParts", () => {
  const item = (kind: string, opts: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ kind, opts, ...extra }) as never;
  const slide = {
    background: {},
    items: [
      item("shape", { x: 0, y: 0, w: 10, h: 0.6 }),
      item("text", { x: 0.5, y: 0, w: 8, h: 0.6 }, { text: "Title" }),
      item("text", { x: 0.5, y: 1.5, w: 4, h: 2 }, { text: [{ text: "One" }, { text: " two" }] }),
      item("text", { x: 8.5, y: 5.3, w: 1, h: 0.3 }, { text: "2 / 5" }),
      item("text", { x: 1, y: 1, w: 3, h: 1 }, { text: "   " }),
      item("chart", { x: 5, y: 1.5, w: 4, h: 3 }),
      item("image", { x: 6, y: 1.5, w: 3, h: 2 }, { src: { ref: "img1" } }),
      item("image", { x: 9, y: 0.1, w: 0.7, h: 0.7 }, { src: { ref: "logo" } }),
      item("text", { x: 1, y: 1, w: 0.1, h: 0.1 }, { text: "tiny" }),
    ],
  } as unknown as Parameters<typeof lockedParts>[0];

  it("lists what the layout drew as boxes, without decoration, the page number, empty text, the logo or tiny things", () => {
    const parts = lockedParts(slide, [{ x: 6, y: 1.5, w: 3, h: 2 }]);
    expect(parts.map((p) => p.kind)).toEqual(["text", "text", "chart"]);
    expect(parts[1]).toMatchObject({ x: 0.5, y: 1.5, w: 4, h: 2 });
  });

  it("leaves out pictures that can already be moved, and handles no slide", () => {
    expect(lockedParts(slide).map((p) => p.kind)).toContain("image");
    expect(lockedParts(undefined)).toEqual([]);
  });
});
