import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import sharp from "sharp";
import { buildPptx, recordDeck } from "../src/pptx/presentationBuilder.js";
import { normalizeDeck, slideOptionsOf } from "../src/pptx/slideDeck.js";
import { imageIdsInDeck, type PptImage } from "../src/pptx/pptImages.js";
import { prepareImages } from "../src/pptx/pptImagesPrepare.js";

// A slide's own look settings: background picture, background and accent colours, page number and logo.

const refImage = (id: string): PptImage => ({ data: `ref:${id}`, width: 1280, height: 720, label: id });
const refs = { img1: refImage("img1"), img2: refImage("img2") };

async function realImages() {
  const make = async (color: string) => `data:image/png;base64,${(await sharp({ create: { width: 1600, height: 900, channels: 3, background: color } }).png().toBuffer()).toString("base64")}`;
  return (await prepareImages({ img1: await make("#2a9d8f"), img2: await make("#e76f51") }))!;
}

// As the editor does (editing): a third bullets slide in a row stays a bullets slide.
const deckOf = (extra: object, slides: object[]) => normalizeDeck({ title: "Look", background: "FFFFFF", accent: "2563EB", ...extra, slides }, { editing: true })!;
const plain = { layout: "bullets", title: "One", bullets: ["a", "b"] };

async function xmls(file: Buffer) {
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]));
  return Promise.all(names.map((n) => zip.file(n)!.async("string")));
}

describe("slideOptionsOf and normalizeDeck", () => {
  it("keeps valid settings and drops anything else", () => {
    expect(slideOptionsOf({ backgroundImage: "img2", background: "#00aa11", accent: "ff0000", pageNumber: false, logo: false })).toEqual({ backgroundImage: "img2", background: "00AA11", accent: "FF0000", pageNumber: false, logo: false });
    expect(slideOptionsOf({ backgroundImage: "none" })).toEqual({ backgroundImage: "none" });
    expect(slideOptionsOf({ backgroundImage: "../x", background: "red", accent: 3, pageNumber: true, logo: "no" })).toEqual({});
    expect(slideOptionsOf(null)).toEqual({});
  });

  it("carries them through the deck on every layout, and leaves untouched slides without the fields", () => {
    const deck = deckOf({}, [{ ...plain, backgroundImage: "none", accent: "AA0000" }, { layout: "stat", value: "9", caption: "x", pageNumber: false }, plain]);
    expect(deck.slides[0]).toMatchObject({ backgroundImage: "none", accent: "AA0000" });
    expect(deck.slides[1]).toMatchObject({ pageNumber: false });
    expect(Object.keys(deck.slides[2])).not.toContain("backgroundImage");
    expect(Object.keys(deck.slides[2])).not.toContain("logo");
  });

  it("keeps them on a third bullets slide that becomes a divider", () => {
    const deck = normalizeDeck({ title: "Look", slides: [plain, plain, { ...plain, background: "112233" }] })!;
    expect(deck.slides[2]).toMatchObject({ layout: "section", background: "112233" });
  });
});

describe("imageIdsInDeck", () => {
  it("includes a picture a single slide uses as its background", () => {
    const deck = deckOf({}, [plain, { ...plain, backgroundImage: "img2" }, { ...plain, backgroundImage: "none" }]);
    expect(imageIdsInDeck(deck)).toEqual(["img2"]);
  });
});

describe("buildPptx: a slide's own look", () => {
  it("gives a slide its own background and accent colour", async () => {
    const deck = deckOf({}, [plain, { ...plain, title: "Own", background: "102030", accent: "FFB703" }]);
    const [cover, one, own] = await xmls(await buildPptx(deck));
    expect(cover).toBeTruthy();
    expect(one).not.toMatch(/102030/i);
    expect(own).toMatch(/<p:bg>[\s\S]*102030/i);
    expect(own).toMatch(/FFB703/i);
    expect(own).not.toMatch(/2563EB/i);
    // The text follows the new background: light body text on a dark colour.
    expect(own).toMatch(/D1D5DB/i);
  });

  it("turns the deck's background picture off for one slide", async () => {
    const images = await realImages();
    const deck = deckOf({ backgroundImage: "img1" }, [plain, { ...plain, title: "Off", backgroundImage: "none" }]);
    const [cover, one, off] = await xmls(await buildPptx(deck, { images }));
    expect(cover).toMatch(/<p:bg>[\s\S]*<a:blip /);
    expect(one).toMatch(/<p:bg>[\s\S]*<a:blip /);
    expect(off).not.toMatch(/<p:bg>[\s\S]*<a:blip /);
  });

  it("gives one slide its own picture, even a divider the deck's picture would skip, and one slide a picture when the deck has none", async () => {
    const images = await realImages();
    const deck = deckOf({ backgroundImage: "img1" }, [plain, { layout: "section", title: "Part", backgroundImage: "img2" }, { layout: "section", title: "Plain part" }]);
    const [, , own, other] = await xmls(await buildPptx(deck, { images }));
    expect(own).toMatch(/<p:bg>[\s\S]*<a:blip /);
    expect(other).not.toMatch(/<p:bg>[\s\S]*<a:blip /);

    const noDeckPicture = deckOf({}, [plain, { ...plain, title: "Pic", backgroundImage: "img2" }]);
    const [, a, b] = await xmls(await buildPptx(noDeckPicture, { images }));
    expect(a).not.toMatch(/<p:bg>[\s\S]*<a:blip /);
    expect(b).toMatch(/<p:bg>[\s\S]*<a:blip /);
  });

  it("does not put the deck's picture over a slide that has a colour of its own", async () => {
    const images = await realImages();
    const deck = deckOf({ backgroundImage: "img1" }, [{ ...plain, background: "102030" }]);
    const [, own] = await xmls(await buildPptx(deck, { images }));
    expect(own).not.toMatch(/<p:bg>[\s\S]*<a:blip /);
    expect(own).toMatch(/102030/i);
  });

  it("hides the page number on one slide", async () => {
    const deck = deckOf({}, [plain, { ...plain, title: "Two", pageNumber: false }]);
    const [, one, two] = await xmls(await buildPptx(deck));
    expect(one).toContain("1 / 2");
    expect(two).not.toContain("2 / 2");
  });

  it("hides the logo on one slide", async () => {
    const deck = deckOf({}, [plain, { ...plain, title: "Two", logo: false }]);
    const png = `data:image/png;base64,${(await sharp({ create: { width: 200, height: 200, channels: 3, background: "#e76f51" } }).png().toBuffer()).toString("base64")}`;
    const logo = { data: png, width: 200, height: 200, corner: "top-right" as const };
    const [cover, one, two] = await xmls(await buildPptx(deck, { logo }));
    expect(cover).toMatch(/Logo/);
    expect(one).toMatch(/Logo/);
    expect(two).not.toMatch(/Logo/);
  });

  it("records the same as the export would draw: a picture reference with the slide's colour, or none", async () => {
    const deck = deckOf({ backgroundImage: "img1" }, [{ ...plain, title: "Own", backgroundImage: "img2" }, { ...plain, title: "Off", backgroundImage: "none" }, { ...plain, title: "Colour", background: "102030" }]);
    const recorded = await recordDeck(deck, { images: refs });
    const [cover, own, off, colour] = recorded.slides;
    expect(cover.background).toMatchObject({ image: "img1" });
    expect(own.background).toMatchObject({ image: "img2", color: "FFFFFF" });
    expect(off.background.image).toBeUndefined();
    expect(colour.background).toMatchObject({ color: "102030" });
    expect(colour.background.image).toBeUndefined();
  });
});

describe("pictures placed on a slide", () => {
  const placed = { image: "img1", x: 6, y: 1.5, w: 3, h: 2.4, caption: "Our office" };

  it("keeps valid pictures and keeps them inside the slide, dropping anything unusable", () => {
    const out = slideOptionsOf({ pictures: [placed, { image: "img2", x: 9.5, y: 5.4, w: 4, h: 4 }, { image: "nope", x: 1, y: 1, w: 1, h: 1 }, { image: "img1", x: "1", y: 1, w: 1, h: 1 }, { image: "img1", x: 1, y: 1, w: 0, h: 0 }] });
    expect(out.pictures).toHaveLength(3);
    expect(out.pictures![0]).toEqual(placed);
    expect(out.pictures![1]).toMatchObject({ x: 6, y: 1.625, w: 4, h: 4 });
    expect(out.pictures![2]).toMatchObject({ w: 0.3, h: 0.3 });
    expect(slideOptionsOf({ pictures: [] }).pictures).toBeUndefined();
    expect(slideOptionsOf({ pictures: "x" }).pictures).toBeUndefined();
  });

  it("limits how many a slide can carry", () => {
    const many = Array.from({ length: 20 }, () => placed);
    expect(slideOptionsOf({ pictures: many }).pictures).toHaveLength(8);
  });

  it("counts them as pictures the deck uses", () => {
    expect(imageIdsInDeck(deckOf({}, [{ ...plain, pictures: [placed] }]))).toEqual(["img1"]);
  });

  it("draws the picture on any layout, in its box, with the caption", async () => {
    const images = await realImages();
    const deck = deckOf({}, [{ ...plain, pictures: [placed] }, plain]);
    const [, withPic, without] = await xmls(await buildPptx(deck, { images }));
    const box = /<p:pic>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/>/.exec(withPic);
    expect(box).toBeTruthy();
    expect(without).not.toMatch(/<p:pic>/);
    expect(withPic).toContain("Our office");
  });

  it("records it for the preview as a picture reference in the same box", async () => {
    const deck = deckOf({}, [{ ...plain, pictures: [placed] }]);
    const recorded = await recordDeck(deck, { images: refs });
    const pics = recorded.slides[1].items.filter((i) => i.kind === "image");
    expect(pics).toHaveLength(1);
    expect(pics[0]).toMatchObject({ src: { ref: "img1" } });
    expect(JSON.stringify(recorded.slides[1].items)).toContain("Our office");
  });
});

describe("a slide's own font style and text size", () => {
  const sizes = (xml: string) => [...xml.matchAll(/sz="(\d+)"/g)].map((m) => +m[1]);

  it("keeps a valid font style and a text scale inside 0.7 to 1.5, and leaves 1 and nonsense out", () => {
    expect(slideOptionsOf({ fontPair: "classic", textScale: 1.2 })).toEqual({ fontPair: "classic", textScale: 1.2 });
    expect(slideOptionsOf({ textScale: 9 }).textScale).toBe(1.5);
    expect(slideOptionsOf({ textScale: 0.1 }).textScale).toBe(0.7);
    expect(slideOptionsOf({ textScale: 1 }).textScale).toBeUndefined();
    expect(slideOptionsOf({ fontPair: "comic", textScale: "big" })).toEqual({});
  });

  it("makes every text on one slide larger or smaller, and no other slide", async () => {
    const deck = deckOf({}, [plain, { ...plain, title: "Big", textScale: 1.5 }, { ...plain, title: "Small", textScale: 0.7 }]);
    const [, normal, big, small] = await xmls(await buildPptx(deck));
    expect(Math.max(...sizes(big))).toBeGreaterThan(Math.max(...sizes(normal)));
    expect(Math.min(...sizes(small))).toBeLessThan(Math.min(...sizes(normal)));
    const bodySize = (xml: string) => Math.max(...sizes(xml));
    expect(bodySize(big) / bodySize(normal)).toBeCloseTo(1.5, 1);
  });

  it("scales text in the preview the same way", async () => {
    const deck = deckOf({}, [plain, { ...plain, title: "Big", textScale: 1.5 }]);
    const recorded = await recordDeck(deck, { images: refs });
    const biggest = (i: number) => Math.max(...recorded.slides[i].items.flatMap((it) => (it.kind === "text" && typeof it.opts.fontSize === "number" ? [it.opts.fontSize] : [])));
    expect(biggest(2)).toBeGreaterThan(biggest(1));
  });

  it("uses another font style for one slide only", async () => {
    const deck = deckOf({ fontPair: "modern" }, [plain, { ...plain, title: "Serif", fontPair: "classic" }]);
    const [, normal, serif] = await xmls(await buildPptx(deck));
    expect(normal).toContain("Calibri");
    expect(normal).not.toContain("Georgia");
    expect(serif).toContain("Georgia");
  });
});
