import { describe, it, expect } from "vitest";
import { recordDeck, slidePalette, type SlideContent, type SlideDeck } from "../src/pptx/presentationBuilder.js";
import { normalizeDeck, ILLUSTRATION_ICONS } from "../src/pptx/slideDeck.js";
import { EXAMPLE_DECK } from "../src/pptx/exampleDeck.js";
import { slideToFreeForm } from "../src/edit/slideToFreeForm.js";
import type { RecordedSlide } from "../src/pptx/pptRecorded.js";

const deck = normalizeDeck(EXAMPLE_DECK, { editing: true }) as SlideDeck;
const refImage = (id: string) => ({ data: `ref:${id}`, width: 1600, height: 900, label: id });

async function convert(slide: SlideContent, base: SlideDeck = deck) {
  const mini = { ...base, title: undefined, subtitle: undefined, meta: undefined, slides: [slide] } as SlideDeck;
  const drawn = await recordDeck(mini, { pageNumbers: false, images: { img1: refImage("img1"), img2: refImage("img2") } });
  const converted = slideToFreeForm({ slide, drawn: drawn.slides[0], icons: drawn.icons, iconColors: drawn.iconColors, palette: slidePalette(mini, slide), logoDrawn: false });
  return { converted, drawn: drawn.slides[0] };
}

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
function drawnText(slide: RecordedSlide): string[] {
  return slide.items.flatMap((i) => (i.kind === "text" ? words(typeof i.text === "string" ? i.text : i.text.map((r) => r.text).join(" ")) : []));
}
function convertedText(slide: SlideContent): string {
  const s = slide as unknown as { title?: string; elements: Record<string, unknown>[] };
  const parts: string[] = [s.title ?? ""];
  for (const el of s.elements) {
    if (el.type === "text") parts.push(String(el.text));
    if (el.type === "table") parts.push((el.headers as string[]).join(" "), (el.rows as unknown[][]).map((r) => r.map((c) => (typeof c === "string" ? c : (c as { text: string }).text)).join(" ")).join(" "));
    if (el.type === "chart") parts.push(String(el.title ?? ""), (el.categories as string[]).join(" "), ((el.series as { name: string }[] | undefined) ?? []).map((x) => x.name).join(" "));
  }
  return parts.join(" ").toLowerCase();
}

describe("slideToFreeForm: every layout of the example deck", () => {
  it("converts to a valid free-form slide that keeps its text and stays on the slide", async () => {
    const failures: string[] = [];
    for (const [i, slide] of deck.slides.entries()) {
      const layout = (slide as { layout?: string }).layout;
      const { converted, drawn } = await convert(slide);
      if (!converted) {
        failures.push(`${i} ${layout}: not converted`);
        continue;
      }
      const checked = normalizeDeck({ slides: [converted] }, { editing: true })?.slides[0] as unknown as { layout: string; elements: { x: number; y: number; w: number; h: number; type: string; icon?: string }[] } | undefined;
      if (!checked || checked.layout !== "canvas") {
        failures.push(`${i} ${layout}: not a valid free-form slide`);
        continue;
      }
      const all = convertedText(converted);
      const missing = [...new Set(drawnText(drawn))].filter((w) => !all.includes(w) && !/^\d+$/.test(w));
      // The header's own title and the page number are drawn by the free-form slide itself; anything else must still be there.
      if (missing.length > 0) failures.push(`${i} ${layout}: lost "${missing.slice(0, 5).join(", ")}"`);
      for (const el of checked.elements) {
        if (el.x < -0.001 || el.y < -0.001 || el.x + el.w > 10.001 || el.y + el.h > 5.626) failures.push(`${i} ${layout}: an element is off the slide`);
        if (el.type === "icon" && !ILLUSTRATION_ICONS.includes(el.icon as never)) failures.push(`${i} ${layout}: unknown icon ${el.icon}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("slideToFreeForm: what it keeps", () => {
  it("keeps the title in the free-form slide's header and the colours as roles", async () => {
    const { converted } = await convert({ layout: "bullets", title: "Why now", bullets: ["First", "Second"] } as SlideContent);
    const c = converted as unknown as { title: string; fullBleed: boolean; elements: { type: string; text?: string; textRole?: string; shape?: string }[] };
    expect(c.title).toBe("Why now");
    expect(c.fullBleed).toBe(false);
    expect(c.elements.some((e) => e.type === "text" && e.text === "First" && e.textRole === "body")).toBe(true);
    expect(c.elements.some((e) => e.type === "shape" && e.shape === "ellipse")).toBe(true); // the bullet dots
  });

  it("keeps a big number in the accent colour and large", async () => {
    const { converted } = await convert({ layout: "stat", value: "42%", caption: "Saved" } as SlideContent);
    const el = (converted as unknown as { elements: { text?: string; textRole?: string; size?: string }[] }).elements.find((e) => e.text === "42%")!;
    expect(el.textRole).toBe("accent");
    expect(["xl", "lg"]).toContain(el.size);
  });

  it("turns a divider into a full-bleed slide that keeps its own colour", async () => {
    const { converted } = await convert({ layout: "section", title: "Part two" } as SlideContent);
    const c = converted as unknown as { fullBleed: boolean; background?: string; elements: { text?: string }[] };
    expect(c.fullBleed).toBe(true);
    expect(c.background).toMatch(/^[0-9A-F]{6}$/);
    expect(c.elements.some((e) => e.text === "Part two")).toBe(true);
  });

  it("turns icon badges into icon elements", async () => {
    const slide = deck.slides.find((s) => (s as { layout?: string }).layout === "iconlist")!;
    const { converted } = await convert(slide);
    const icons = (converted as unknown as { elements: { type: string; icon?: string; badge?: boolean }[] }).elements.filter((e) => e.type === "icon");
    expect(icons.length).toBeGreaterThan(2);
    expect(icons.every((i) => ILLUSTRATION_ICONS.includes(i.icon as never))).toBe(true);
  });

  it("carries over notes, the contrast look, placed pictures and the slide's own settings, without drawing placed pictures twice", async () => {
    const slide = { layout: "bullets", title: "A", bullets: ["x"], notes: "Say hello", tone: "contrast", accent: "E11D48", textScale: 1.15, pictures: [{ image: "img1", x: 6, y: 1.5, w: 3, h: 1.7 }] } as unknown as SlideContent;
    const { converted } = await convert(slide);
    const c = converted as unknown as Record<string, unknown> & { elements: { type: string }[] };
    expect(c).toMatchObject({ notes: "Say hello", tone: "contrast", accent: "E11D48", textScale: 1.15 });
    expect(c.pictures).toHaveLength(1);
    expect(c.elements.filter((e) => e.type === "image")).toHaveLength(0);
  });

  it("keeps a picture a layout drew as a picture element showing the whole picture", async () => {
    const { converted } = await convert({ layout: "image", title: "Office", image: "img1", caption: "Our office", bullets: ["Open plan"], placement: "left" } as SlideContent);
    const image = (converted as unknown as { elements: { type: string; image?: string; fit?: string; w: number; h: number }[] }).elements.find((e) => e.type === "image")!;
    expect(image).toMatchObject({ image: "img1", fit: "cover" });
    expect(image.w / image.h).toBeCloseTo(1600 / 900, 1);
  });
});

describe("slideToFreeForm: icons on coloured shapes", () => {
  it("keeps an icon that was drawn on an accent colour readable (on-accent), and leaves other icons as they are", async () => {
    const slide = deck.slides.find((s) => (s as { layout?: string }).layout === "grid")!;
    const { converted } = await convert(slide);
    const icons = (converted as unknown as { elements: { type: string; onAccent?: boolean }[] }).elements.filter((e) => e.type === "icon");
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.some((i) => i.onAccent === true)).toBe(true);
    const plain = await convert(deck.slides.find((s) => (s as { layout?: string }).layout === "iconlist")!);
    const plainIcons = (plain.converted as unknown as { elements: { type: string; onAccent?: boolean }[] }).elements.filter((e) => e.type === "icon");
    expect(plainIcons.some((i) => i.onAccent !== true)).toBe(true);
  });
});

describe("slideToFreeForm: what it will not guess", () => {
  it("does not convert a slide with a chart it cannot carry over", () => {
    const drawn = { background: {}, items: [{ kind: "chart", chartType: ["bar", "line"], data: [], opts: { x: 1, y: 1, w: 4, h: 3 } }] } as unknown as RecordedSlide;
    const palette = slidePalette(deck, deck.slides[0]);
    expect(slideToFreeForm({ slide: deck.slides[0], drawn, icons: undefined, palette, logoDrawn: false })).toBeNull();
  });
});
