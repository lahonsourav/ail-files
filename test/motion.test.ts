import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MOTION, pressScaleFor, previewOrder } from "../src/editor/motion.js";
import SuccessTick from "../src/editor/SuccessTick.js";
import { moveSlide } from "../src/edit.js";

// The six motion behaviours the editor follows: a press sinks to 95%, a dragged slide lifts to 105% while the others slide out of the way,
// what opens eases out in 350 ms, and a success tick draws its circle first and then the tick, 470 ms in all.

describe("editor motion", () => {
  it("has the numbers", () => {
    expect(MOTION.pressScale).toBe(0.95);
    expect(MOTION.liftScale).toBe(1.05);
    expect(MOTION.expandMs).toBe(350);
    expect(MOTION.tickMs).toBe(470);
    expect(MOTION.tickCircleMs).toBeLessThan(MOTION.tickMs);
    expect(pressScaleFor(80, 30)).toBe(0.95);
    expect(pressScaleFor(500, 300)).toBe(MOTION.pressScaleLarge); // a big thing sinks less
  });

  it("shows the strip as it will be once the dragged slide is dropped", () => {
    expect(previewOrder(5, null, null)).toEqual([0, 1, 2, 3, 4]);
    expect(previewOrder(5, 1, 1)).toEqual([0, 1, 2, 3, 4]);
    expect(previewOrder(5, 1, 3)).toEqual([0, 2, 3, 1, 4]);
    expect(previewOrder(5, 3, 0)).toEqual([3, 0, 1, 2, 4]);
    expect(previewOrder(3, 9, 0)).toEqual([0, 1, 2]); // nonsense indexes change nothing
  });

  it("matches what dropping does to the deck", () => {
    const deck = { slides: ["a", "b", "c", "d", "e"].map((title) => ({ layout: "bullets", title, bullets: ["x"] })) } as never;
    for (const [from, to] of [[1, 3], [3, 0], [0, 4], [4, 2]]) {
      const moved = (moveSlide(deck, from, to) as { slides: { title: string }[] }).slides.map((s) => s.title);
      const preview = previewOrder(5, from, to).map((i) => ["a", "b", "c", "d", "e"][i]);
      expect(preview).toEqual(moved);
    }
  });

  it("success tick draws the circle first and the tick after it", () => {
    const html = renderToString(createElement(SuccessTick, {}));
    expect(html).toContain("<circle");
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/<animate /g)).toHaveLength(2); // one for the circle, one for the tick
    expect(html).toContain('begin="0.26s"'); // the tick starts when the circle has finished
  });
});
