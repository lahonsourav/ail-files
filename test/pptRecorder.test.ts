import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildPptx, recordDeck, type SlideDeck } from "../src/pptx/presentationBuilder.js";
import { normalizeDeck } from "../src/pptx/slideDeck.js";
import { EXAMPLE_DECK } from "../src/pptx/exampleDeck.js";
import { SLIDE_H, SLIDE_W, type RecordedDeck } from "../src/pptx/pptRecorded.js";
import type { PptImage } from "../src/pptx/pptImages.js";

const refImage = (id: string, width = 1280, height = 720, label = id): PptImage => ({ data: `ref:${id}`, width, height, label });

// The example deck covers almost every layout; these add the picture ones.
const pictureDeck = normalizeDeck({
  title: "Pictures",
  background: "5B2A86",
  accent: "F6C915",
  slides: [
    { layout: "image", title: "Office", image: "img1", caption: "Our office", bullets: ["Open plan", "Two floors"], placement: "left" },
    { layout: "photos", title: "Team", arrangement: "trio", items: [{ image: "img1", caption: "One" }, { image: "img2", caption: "Two" }, { placeholder: "Team photo" }] },
    { layout: "before_after", title: "Change", before: { image: "img1", caption: "Before" }, after: { image: "img2", caption: "After" } },
    { layout: "bullets", title: "Plain", bullets: ["a", "b", "c"], notes: "Speaker notes here" },
  ],
})!;

const images = { img1: refImage("img1"), img2: refImage("img2", 800, 1000) };

async function slideXmls(file: Buffer) {
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]));
  return Promise.all(names.map((n) => zip.file(n)!.async("string")));
}
const count = (xml: string, re: RegExp) => (xml.match(re) ?? []).length;
const xmlTexts = (xml: string) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")).join("");
const cellText = (cell: unknown): string => (typeof cell === "string" ? cell : Array.isArray(cell) ? cell.map(cellText).join("") : cell && typeof cell === "object" ? cellText((cell as { text?: unknown }).text) : "");
const recordedText = (items: RecordedDeck["slides"][number]["items"]) =>
  items
    .map((i) => (i.kind === "text" ? (typeof i.text === "string" ? i.text : i.text.map((r) => r.text).join("")) : i.kind === "table" ? (i.rows as unknown[]).map((row) => (row as unknown[]).map(cellText).join("")).join("") : ""))
    .join("");

describe("recordDeck", () => {
  it("draws every slide of the example deck, and nothing falls off the slide", async () => {
    const recorded = await recordDeck(EXAMPLE_DECK as SlideDeck);
    const file = await buildPptx(EXAMPLE_DECK as SlideDeck);
    expect(recorded.slides.length).toBe((await slideXmls(file)).length);
    expect([recorded.width, recorded.height]).toEqual([SLIDE_W, SLIDE_H]);
    for (const [n, slide] of recorded.slides.entries()) {
      expect(slide.items.length, `slide ${n + 1} has items`).toBeGreaterThan(0);
      for (const item of slide.items) {
        const { x, y, w, h } = item.opts as { x?: number; y?: number; w?: number; h?: number };
        if (item.kind === "text" && typeof x === "number" && typeof w === "number") {
          expect(x, `slide ${n + 1} text x`).toBeGreaterThanOrEqual(-0.01);
          expect(x + w, `slide ${n + 1} text right edge`).toBeLessThanOrEqual(SLIDE_W + 0.01);
          if (typeof y === "number" && typeof h === "number") expect(y + h, `slide ${n + 1} text bottom`).toBeLessThanOrEqual(SLIDE_H + 0.05);
        }
      }
    }
  });

  it("matches the real file: the same number of text boxes and shapes, pictures and charts on every slide, and the same words", async () => {
    for (const deck of [EXAMPLE_DECK as SlideDeck, pictureDeck]) {
      const opts = { images };
      const recorded = await recordDeck(deck, opts);
      const xmls = await slideXmls(await buildPptx(deck, { images: Object.fromEntries(Object.entries(images).map(([id, i]) => [id, { ...i, data: "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }])) }));
      for (const [n, slide] of recorded.slides.entries()) {
        const xml = xmls[n];
        const drawn = slide.items.filter((i) => i.kind === "text" || i.kind === "shape").length;
        const actual = count(xml, /<p:sp>/g) + count(xml, /<p:cxnSp>/g);
        expect(drawn, `slide ${n + 1}: text boxes and shapes`).toBe(actual);
        expect(slide.items.filter((i) => i.kind === "image").length, `slide ${n + 1}: pictures`).toBe(count(xml, /<p:pic>/g));
        expect(slide.items.filter((i) => i.kind === "chart").length, `slide ${n + 1}: charts`).toBe(count(xml, /<p:graphicFrame>/g) - slide.items.filter((i) => i.kind === "table").length);
        expect(recordedText(slide.items).replace(/\s+/g, ""), `slide ${n + 1}: words`).toBe(xmlTexts(xml).replace(/\s+/g, ""));
      }
    }
  });

  it("leaves pictures to the client by reference, and stores icons once, by content", async () => {
    const recorded = await recordDeck(pictureDeck, { images });
    const refs = recorded.slides.flatMap((s) => s.items).flatMap((i) => (i.kind === "image" && "ref" in i.src ? [i.src.ref] : []));
    expect(new Set(refs)).toEqual(new Set(["img1", "img2"]));
    const exampleRecorded = await recordDeck(EXAMPLE_DECK as SlideDeck);
    const assetUses = exampleRecorded.slides.flatMap((s) => s.items).filter((i) => i.kind === "image" && "asset" in i.src).length;
    expect(assetUses).toBeGreaterThan(0);
    expect(Object.keys(exampleRecorded.assets).length).toBeLessThan(assetUses); // the same icon on several slides is stored once
    for (const url of Object.values(exampleRecorded.assets)) expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it("records notes and the background colour of each slide", async () => {
    const recorded = await recordDeck(pictureDeck, { images });
    expect(recorded.slides.some((s) => s.notes === "Speaker notes here")).toBe(true);
    expect(recorded.slides.every((s) => /^[0-9A-Fa-f]{6}$/.test(s.background.color ?? ""))).toBe(true);
  });

  it("records a deck background picture as a reference with the colour to wash it with, without needing its pixels", async () => {
    const deck = normalizeDeck({ title: "Backdrop", background: "5B2A86", accent: "F6C915", backgroundImage: "img1", slides: [{ layout: "bullets", title: "One", bullets: ["a"] }, { layout: "section", title: "Two" }] })!;
    const recorded = await recordDeck(deck, { images });
    expect(recorded.slides[0].background).toMatchObject({ image: "img1", color: "5B2A86" });
    expect(recorded.slides[0].background.scrim).toBeGreaterThan(0);
    expect(recorded.slides.find((s) => s.background.color === "F6C915")?.background.image).toBeUndefined(); // the accent slides stay solid
  });

  it("is JSON-safe: what the preview sends is what the browser gets", async () => {
    const recorded = await recordDeck(EXAMPLE_DECK as SlideDeck);
    expect(JSON.parse(JSON.stringify(recorded))).toEqual(recorded);
  });
});
