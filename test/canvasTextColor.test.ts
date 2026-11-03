import { describe, it, expect } from "vitest";
import { recordDeck, type SlideDeck } from "../src/pptx/presentationBuilder.js";
import { normalizeDeck } from "../src/pptx/slideDeck.js";

// A canvas text element with its own "color" is drawn in that colour; without it, its role decides as before.
async function colourOf(el: Record<string, unknown>): Promise<string | undefined> {
  const deck = normalizeDeck({ title: "T", slides: [{ layout: "canvas", elements: [{ type: "text", x: 1, y: 1, w: 4, h: 1, text: "Hello there", ...el }] }] }, { editing: true }) as SlideDeck;
  const drawn = await recordDeck(deck, { pageNumbers: false });
  for (const slide of drawn.slides) {
    for (const item of slide.items) {
      if (item.kind === "text" && JSON.stringify(item.text).includes("Hello there")) return String(item.opts.color);
    }
  }
  return undefined;
}

describe("canvas text colour", () => {
  it("uses the element's own hex colour over its role", async () => {
    expect(await colourOf({ textRole: "body", color: "FFFFFF" })).toBe("FFFFFF");
    expect(await colourOf({ textRole: "accent", color: "ff00aa" })).toBe("FF00AA");
  });
  it("falls back to the role when there is no valid colour", async () => {
    const withRole = await colourOf({ textRole: "title" });
    expect(withRole).toMatch(/^[0-9A-F]{6}$/);
    expect(await colourOf({ textRole: "title", color: "white" })).toBe(withRole);
  });
});
