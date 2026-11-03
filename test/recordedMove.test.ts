import { describe, it, expect } from "vitest";
import { moveDrawn } from "../src/edit/recordedMove.js";
import type { RecordedDeck, RecordedItem } from "../src/pptx/pptRecorded.js";

const text = (x: number, y: number, w: number, h: number, t = "T"): RecordedItem => ({ kind: "text", text: t, opts: { x, y, w, h, fontSize: 12 } });
const shape = (x: number, y: number, w: number, h: number): RecordedItem => ({ kind: "shape", shape: "rect", opts: { x, y, w, h } });
const image = (x: number, y: number, w: number, h: number): RecordedItem => ({ kind: "image", src: { ref: "img1" }, opts: { x, y, w, h } });
const deckOf = (items: RecordedItem[]): RecordedDeck => ({ width: 10, height: 5.625, assets: {}, slides: [{ background: { color: "FFFFFF" }, items }] });
const optsOf = (d: RecordedDeck) => d.slides[0].items.map((i) => i.opts);

describe("moveDrawn", () => {
  it("moves the pieces drawn for the dragged part and leaves the rest", () => {
    const d = deckOf([text(1, 1, 4, 0.8), shape(1, 1, 4, 0.8), text(6, 3, 3, 1)]);
    const moved = moveDrawn(d, 0, "text", { x: 1, y: 1, w: 4, h: 0.8 }, { x: 2, y: 1.5, w: 4, h: 0.8 });
    expect(optsOf(moved)[0]).toMatchObject({ x: 2, y: 1.5, w: 4, h: 0.8, fontSize: 12 }); // other options kept
    expect(optsOf(moved)[1]).toMatchObject({ x: 2, y: 1.5 });
    expect(optsOf(moved)[2]).toMatchObject({ x: 6, y: 3, w: 3, h: 1 });
    expect(d.slides[0].items[0].opts.x).toBe(1); // the drawing it was given is not changed
  });

  it("scales a piece when the part is resized", () => {
    const d = deckOf([shape(1, 1, 4, 2)]);
    const resized = moveDrawn(d, 0, "shape", { x: 1, y: 1, w: 4, h: 2 }, { x: 1, y: 1, w: 2, h: 3 });
    expect(optsOf(resized)[0]).toMatchObject({ x: 1, y: 1, w: 2, h: 3 });
  });

  it("finds a picture drawn fitted inside its box, with its caption", () => {
    const box = { x: 1, y: 1, w: 4, h: 3 };
    const d = deckOf([image(1.5, 1, 3, 2.4), text(1, 3.5, 4, 0.5, "Caption"), text(7, 1, 2, 1, "Other")]);
    const moved = moveDrawn(d, 0, "picture", box, { x: 3, y: 2, w: 4, h: 3 });
    expect(optsOf(moved)[0]).toMatchObject({ x: 3.5, y: 2 });
    expect(optsOf(moved)[1]).toMatchObject({ x: 3, y: 4.5 });
    expect(optsOf(moved)[2]).toMatchObject({ x: 7, y: 1 }); // outside the picture's box
  });

  it("does not guess for other parts: no exact piece, nothing moves", () => {
    const d = deckOf([text(1.5, 1, 3, 0.5)]);
    expect(moveDrawn(d, 0, "text", { x: 1, y: 1, w: 4, h: 3 }, { x: 2, y: 2, w: 4, h: 3 })).toBe(d);
  });

  it("copes with a slide that is not there", () => {
    const d = deckOf([text(1, 1, 4, 1)]);
    expect(moveDrawn(d, 5, "text", { x: 1, y: 1, w: 4, h: 1 }, { x: 2, y: 1, w: 4, h: 1 })).toBe(d);
  });
});
