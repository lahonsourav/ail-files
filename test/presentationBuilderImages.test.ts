import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import sharp from "sharp";
import { buildPptx } from "../src/pptx/presentationBuilder.js";
import { prepareImages } from "../src/pptx/pptImagesPrepare.js";
import { normalizeDeck } from "../src/pptx/slideDeck.js";
import type { PptImage } from "../src/pptx/pptImages.js";

const EMU = 914400;

async function pictures(): Promise<Record<string, PptImage>> {
  const make = async (w: number, h: number) => {
    const buf = await sharp({ create: { width: w, height: h, channels: 3, background: "#2a9d8f" } }).png().toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
  };
  return (await prepareImages({ img1: await make(1600, 900), img2: await make(400, 800) }))!;
}

const deckOf = (slide: unknown) => normalizeDeck({ title: "Pictures", slides: [slide] })!;

async function slideXml(file: Buffer, n: number) {
  const zip = await JSZip.loadAsync(file);
  return zip.file(`ppt/slides/slide${n}.xml`)!.async("string");
}

/** Every picture on a slide as inches: x, y, w, h. */
function picBoxes(xml: string) {
  return [...xml.matchAll(/<p:pic>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"/g)].map((m) => ({ x: +m[1] / EMU, y: +m[2] / EMU, w: +m[3] / EMU, h: +m[4] / EMU }));
}

describe("a picture as the background of every slide", () => {
  const deckWithBackdrop = (extra: object = {}) =>
    normalizeDeck({ title: "Backdrop", background: "6B3FA0", accent: "F5C518", backgroundImage: "img1", slides: [{ layout: "bullets", title: "One", bullets: ["a", "b"] }, { layout: "section", title: "Two" }], ...extra })!;

  it("keeps a valid id on the deck and drops anything that is not a picture id", () => {
    expect(deckWithBackdrop().backgroundImage).toBe("img1");
    expect(deckWithBackdrop({ backgroundImage: "../etc/passwd" }).backgroundImage).toBeUndefined();
    expect(deckWithBackdrop({ backgroundImage: 3 }).backgroundImage).toBeUndefined();
  });

  it('keeps "none": the model saying on purpose that this deck has no background picture, which draws a plain deck', async () => {
    expect(deckWithBackdrop({ backgroundImage: "none" }).backgroundImage).toBe("none");
    const images = await pictures();
    const zip = await JSZip.loadAsync(await buildPptx(deckWithBackdrop({ backgroundImage: "none" }), { images }));
    expect(await zip.file("ppt/slides/slide2.xml")!.async("string")).not.toMatch(/<p:bg>[\s\S]*<a:blip /);
  });

  it("puts one picture behind the cover and the content slides, as the slide background", async () => {
    const images = await pictures();
    const file = await buildPptx(deckWithBackdrop({ slides: [{ layout: "bullets", title: "One", bullets: ["a", "b"] }, { layout: "stats_row", title: "Two", stats: [{ value: "1", label: "a" }, { value: "2", label: "b" }] }] }), { images });
    const zip = await JSZip.loadAsync(file);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides.length).toBe(3);
    for (const f of slides) expect(await zip.file(f)!.async("string")).toMatch(/<p:bg>[\s\S]*<a:blip /);
  });

  it("leaves slides filled with the accent colour (dividers, the closing slide) solid, and washes the rest in their own colour", async () => {
    const images = await pictures();
    const file = await buildPptx(deckWithBackdrop(), { images });
    const zip = await JSZip.loadAsync(file);
    const media = Object.keys(zip.files).filter((f) => f.startsWith("ppt/media/") && /\.jpe?g$/.test(f));
    expect(media.length).toBe(2); // the cover and the content slide each carry a copy, stored as real JPEGs
    const divider = await zip.file("ppt/slides/slide3.xml")!.async("string");
    expect(divider).not.toMatch(/<p:bg>[\s\S]*<a:blip /);
    expect(divider).toMatch(/<p:bg>[\s\S]*F5C518/i);
    const meta = await sharp(await zip.file(media[0])!.async("nodebuffer")).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1280, 720]);
  });

  it("leaves a deck without a usable picture exactly as it was (plain colour background)", async () => {
    const file = await buildPptx(deckWithBackdrop(), { images: {} });
    const zip = await JSZip.loadAsync(file);
    const xml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(xml).not.toMatch(/<p:bg>[\s\S]*<a:blip /);
  });
});

describe("normalizeDeck: image slides", () => {
  it("keeps an image slide with its caption, side text and placement", () => {
    const deck = deckOf({ layout: "image", title: "Our office", image: "img1", caption: "Pune, 2024", bullets: ["Open plan", "Two floors"], placement: "left" });
    expect(deck.slides.find((s) => s.layout === "image")).toMatchObject({ layout: "image", image: "img1", caption: "Pune, 2024", placement: "left", bullets: ["Open plan", "Two floors"] });
  });

  it("turns an image slide with an unusable id into a plain slide instead of dropping it", () => {
    const deck = deckOf({ layout: "image", title: "Bad", image: "../etc/passwd", bullets: ["still here"] });
    expect(deck.slides[0].layout).toBe("bullets");
  });

  it("keeps a gallery card that is only a picture", () => {
    const deck = deckOf({ layout: "gallery", title: "Work", items: [{ image: "img1" }, { image: "img2", title: "Two" }] });
    const gallery = deck.slides.find((s) => s.layout === "gallery");
    expect(gallery && gallery.layout === "gallery" && gallery.items.map((i) => i.image)).toEqual(["img1", "img2"]);
  });
});

describe("buildPptx: the user's own pictures", () => {
  it("draws a full image slide whole, centred, in proportion, inside the content area", async () => {
    const images = await pictures();
    const file = await buildPptx(deckOf({ layout: "image", title: "Office", image: "img1", caption: "Our office" }), { images });
    const [box] = picBoxes(await slideXml(file, 2));
    expect(box.w / box.h).toBeCloseTo(1600 / 900, 2);
    expect(box.y).toBeGreaterThanOrEqual(0.85 - 0.001);
    expect(box.y + box.h).toBeLessThanOrEqual(5.25);
    expect(box.x).toBeGreaterThanOrEqual(0.5 - 0.001);
    expect(box.x + box.w).toBeLessThanOrEqual(9.5 + 0.001);
  });

  it("puts the picture on the chosen side with the bullets on the other", async () => {
    const images = await pictures();
    const at = async (placement: "left" | "right") => {
      const file = await buildPptx(deckOf({ layout: "image", title: "T", image: "img2", bullets: ["First point", "Second point"], placement }), { images });
      const xml = await slideXml(file, 2);
      expect(xml).toContain("First point");
      return picBoxes(xml)[0];
    };
    const left = await at("left");
    const right = await at("right");
    expect(left.x + left.w).toBeLessThan(5.9);
    expect(right.x).toBeGreaterThan(3.8);
    expect(left.h).toBeCloseTo(right.h, 3);
  });

  it("draws gallery cards with pictures", async () => {
    const images = await pictures();
    const file = await buildPptx(deckOf({ layout: "gallery", title: "Work", items: [{ image: "img1", title: "One", caption: "first" }, { image: "img2", title: "Two" }] }), { images });
    expect(picBoxes(await slideXml(file, 2))).toHaveLength(2);
  });

  it("says so on the slide when the picture wasn't passed in, rather than leaving a silent gap", async () => {
    const file = await buildPptx(deckOf({ layout: "image", title: "Office", image: "img1" }));
    const xml = await slideXml(file, 2);
    expect(picBoxes(xml)).toHaveLength(0);
    expect(xml).toContain("Picture not available");
  });

  it("draws nothing extra for a deck without pictures", async () => {
    const file = await buildPptx(deckOf({ layout: "bullets", title: "Plain", bullets: ["a", "b"] }), { images: await pictures() });
    expect(picBoxes(await slideXml(file, 2))).toHaveLength(0);
  });

  it("works together with a logo", async () => {
    const images = await pictures();
    const file = await buildPptx(deckOf({ layout: "image", title: "Office", image: "img1" }), {
      images,
      logo: { data: images.img1.data, width: images.img1.width, height: images.img1.height, corner: "top-right" },
    });
    expect(picBoxes(await slideXml(file, 2)).length).toBe(2);
  });

  describe("a caption below every picture", () => {
    const texts = (xml: string) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);

    it("shows the slide's own caption below the picture", async () => {
      const images = await pictures();
      images.img1.label = "Office front";
      const file = await buildPptx(deckOf({ layout: "image", title: "T", image: "img1", caption: "Our Pune office, 2024" }), { images });
      const xml = await slideXml(file, 2);
      expect(texts(xml)).toContain("Our Pune office, 2024");
      expect(texts(xml)).not.toContain("Office front");
      const [pic] = picBoxes(xml);
      const captionShape = xml.split("<p:sp>").find((chunk) => chunk.includes("Our Pune office"))!;
      const captionY = Number(/<a:off x="\d+" y="(\d+)"/.exec(captionShape)![1]) / EMU;
      expect(captionY).toBeGreaterThanOrEqual(pic.y + pic.h - 0.001);
    });

    it("falls back to the name the user gave the picture when the slide has no caption", async () => {
      const images = await pictures();
      images.img1.label = "Office front";
      const file = await buildPptx(deckOf({ layout: "image", title: "T", image: "img1" }), { images });
      expect(texts(await slideXml(file, 2))).toContain("Office front");
    });

    it("does the same beside bullets and on gallery cards", async () => {
      const images = await pictures();
      images.img1.label = "Office front";
      images.img2.label = "Founder portrait";
      const side = await buildPptx(deckOf({ layout: "image", title: "T", image: "img2", bullets: ["a point"], placement: "right" }), { images });
      expect(texts(await slideXml(side, 2))).toContain("Founder portrait");
      const gallery = await buildPptx(deckOf({ layout: "gallery", title: "G", items: [{ image: "img1", title: "Front" }, { image: "img2", title: "Founder", caption: "Own caption" }] }), { images });
      const t = texts(await slideXml(gallery, 2));
      expect(t).toContain("Office front");
      expect(t).toContain("Own caption");
      expect(t).not.toContain("Founder portrait");
    });

    it("adds no caption when there is neither a caption nor a name", async () => {
      const file = await buildPptx(deckOf({ layout: "image", title: "OnlyTitle", image: "img1" }), { images: await pictures() });
      expect(texts(await slideXml(file, 2))).toEqual(["OnlyTitle", "1 / 1"]);
    });
  });

  describe("empty picture placeholders", () => {
    const texts = (xml: string) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);

    it("keeps an image slide with a placeholder and no picture, and drops one with neither", () => {
      const kept = deckOf({ layout: "image", title: "Team", placeholder: "Photo of the team", caption: "Our people" });
      expect(kept.slides[0]).toMatchObject({ layout: "image", placeholder: "Photo of the team", caption: "Our people" });
      expect(kept.slides[0]).not.toHaveProperty("image", expect.any(String));
      expect(deckOf({ layout: "image", title: "Nothing", bullets: ["still here"] }).slides[0].layout).toBe("bullets");
    });

    it("draws an empty labelled box with the caption below, and no picture", async () => {
      const file = await buildPptx(deckOf({ layout: "image", title: "Team", placeholder: "Photo of the team", caption: "Our people" }));
      const xml = await slideXml(file, 2);
      expect(picBoxes(xml)).toHaveLength(0);
      expect(texts(xml)).toContain("Photo of the team");
      expect(texts(xml)).toContain("Our people");
      expect(texts(xml)).not.toContain("Picture not available");
    });

    it("draws a placeholder beside bullets and on a gallery card", async () => {
      const side = await buildPptx(deckOf({ layout: "image", title: "T", placeholder: "Product shot", bullets: ["a point"], placement: "left" }));
      const sideTexts = texts(await slideXml(side, 2));
      expect(sideTexts).toContain("Product shot");
      expect(sideTexts).toContain("a point");
      const gallery = await buildPptx(deckOf({ layout: "gallery", title: "G", items: [{ placeholder: "Front of the shop", title: "Shop" }, { title: "Text only", description: "d" }] }));
      expect(texts(await slideXml(gallery, 2))).toContain("Front of the shop");
    });

    it("keeps a gallery card that is only a placeholder", () => {
      const deck = deckOf({ layout: "gallery", title: "G", items: [{ placeholder: "Front of the shop" }, { image: "img1" }] });
      const g = deck.slides.find((x) => x.layout === "gallery");
      expect(g && g.layout === "gallery" && g.items.map((i) => [i.image, i.placeholder])).toEqual([[undefined, "Front of the shop"], ["img1", undefined]]);
    });

    it("says something sensible when the placeholder has no text", async () => {
      const file = await buildPptx({ title: "P", slides: [{ layout: "image", title: "Empty", placeholder: "", caption: "c" } as never] });
      const t = texts(await slideXml(file, 2));
      expect(t).toContain("Add a picture here");
      expect(t).not.toContain("Picture not available");
    });
  });

  describe("more picture layouts", () => {
    const texts = (xml: string) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const labelled = async () => {
      const images = await pictures();
      images.img1.label = "First";
      images.img2.label = "Second";
      return images;
    };

    it("normalises photos and before_after, and turns a lone picture into an image slide", () => {
      const photos = deckOf({ layout: "photos", title: "P", items: [{ image: "img1", caption: "a" }, { placeholder: "Team" }, { nothing: true }, { image: "../x" }, { image: "img2" }, { image: "img1" }, { image: "img2" }], arrangement: "strip" });
      expect(photos.slides[0]).toMatchObject({ layout: "photos", arrangement: "strip" });
      expect(photos.slides[0].layout === "photos" && photos.slides[0].items).toHaveLength(4);
      expect(deckOf({ layout: "photos", items: [{ image: "img1" }] }).slides[0].layout).toBe("image");
      // nothing usable and no text: the slide is dropped, as for any empty slide
      expect(normalizeDeck({ title: "P", slides: [{ layout: "photos", items: [] }, { layout: "bullets", title: "Kept", bullets: ["x"] }] })!.slides).toHaveLength(1);
      const ba = deckOf({ layout: "before_after", before: { image: "img1" }, after: { placeholder: "Result" }, beforeLabel: "2019", afterLabel: "2024" });
      expect(ba.slides[0]).toMatchObject({ layout: "before_after", beforeLabel: "2019", afterLabel: "2024" });
      expect(deckOf({ layout: "before_after", before: { image: "img1" } }).slides[0].layout).toBe("image");
    });

    it("lays out photos: pair side by side, trio large + two stacked, quad 2x2, strip in a row", async () => {
      const images = await labelled();
      const boxesFor = async (items: object[], arrangement?: string) =>
        picBoxes(await slideXml(await buildPptx(deckOf({ layout: "photos", title: "T", items, arrangement }), { images }), 2));
      const one = { image: "img1" };
      const two = { image: "img2" };
      const pair = await boxesFor([one, one]);
      expect(pair).toHaveLength(2);
      expect(Math.abs(pair[0].y - pair[1].y) + Math.abs(pair[0].h - pair[1].h)).toBeLessThan(0.01); // same-shaped pictures sit at the same height
      expect(pair[1].x).toBeGreaterThan(pair[0].x + pair[0].w - 0.01);
      const trio = await boxesFor([one, two, one]);
      expect(trio).toHaveLength(3);
      expect(trio[1].x).toBeGreaterThan(trio[0].x + trio[0].w - 0.01);
      expect(trio[2].y).toBeGreaterThan(trio[1].y);
      const quad = await boxesFor([one, two, one, two]);
      expect(quad).toHaveLength(4);
      expect(quad[2].y).toBeGreaterThan(quad[0].y);
      expect(quad[1].x).toBeGreaterThan(quad[0].x);
      const strip = await boxesFor([one, two, one, two], "strip");
      expect(strip).toHaveLength(4);
      expect(new Set(strip.map((b) => Math.round(b.y * 100))).size).toBeLessThanOrEqual(2); // one row (tall and wide pictures sit at slightly different heights)
      for (const b of [...pair, ...trio, ...quad, ...strip]) {
        expect(b.x).toBeGreaterThanOrEqual(0.5 - 0.01);
        expect(b.x + b.w).toBeLessThanOrEqual(9.5 + 0.01);
        expect(b.y).toBeGreaterThanOrEqual(0.85 - 0.01);
        expect(b.y + b.h).toBeLessThanOrEqual(5.25 + 0.01);
      }
    });

    it("captions every photo (its own caption, else the picture's name) and boxes placeholders", async () => {
      const file = await buildPptx(deckOf({ layout: "photos", title: "T", items: [{ image: "img1" }, { image: "img2", caption: "Own words" }, { placeholder: "Product shot" }] }), { images: await labelled() });
      const t = texts(await slideXml(file, 2));
      expect(t).toContain("First");
      expect(t).toContain("Own words");
      expect(t).not.toContain("Second");
      expect(t).toContain("Product shot");
    });

    it("compares two pictures under Before and After chips, or the slide's own labels", async () => {
      const images = await labelled();
      const plain = await buildPptx(deckOf({ layout: "before_after", title: "T", before: { image: "img1" }, after: { image: "img2" } }), { images });
      const plainXml = await slideXml(plain, 2);
      expect(texts(plainXml)).toEqual(expect.arrayContaining(["BEFORE", "AFTER", "First", "Second"]));
      expect(picBoxes(plainXml)).toHaveLength(2);
      const custom = await buildPptx(deckOf({ layout: "before_after", title: "T", before: { image: "img1" }, after: { placeholder: "Result" }, beforeLabel: "2019", afterLabel: "2024" }), { images });
      const customTexts = texts(await slideXml(custom, 2));
      expect(customTexts).toEqual(expect.arrayContaining(["2019", "2024", "Result"]));
    });

    it("puts the picture above or below the points for top and bottom", async () => {
      const images = await labelled();
      const place = async (placement: "top" | "bottom") => {
        const xml = await slideXml(await buildPptx(deckOf({ layout: "image", title: "T", image: "img1", bullets: ["one point", "two points"], placement }), { images }), 2);
        const text = xml.split("<p:sp>").find((c) => c.includes("one point"))!;
        return { pic: picBoxes(xml)[0], textY: Number(/<a:off x="\d+" y="(\d+)"/.exec(text)![1]) / EMU, xml };
      };
      const top = await place("top");
      const bottom = await place("bottom");
      expect(top.pic.y + top.pic.h).toBeLessThanOrEqual(top.textY + 0.05);
      expect(bottom.pic.y).toBeGreaterThanOrEqual(bottom.textY);
      expect(top.pic.w).toBeGreaterThan(top.pic.h); // a wide band
    });

    it("fills the whole slide for background, with the text on a panel over it", async () => {
      const images = await labelled();
      const xml = await slideXml(await buildPptx(deckOf({ layout: "image", title: "Big title", image: "img1", bullets: ["a point"], placement: "background", caption: "A caption" }), { images }), 2);
      const [pic] = picBoxes(xml);
      expect(pic.x).toBeCloseTo(0, 1);
      expect(pic.y).toBeCloseTo(0, 1);
      expect(pic.w).toBeCloseTo(10, 1);
      expect(pic.h).toBeCloseTo(5.625, 1);
      expect(texts(xml)).toEqual(expect.arrayContaining(["Big title", "a point", "A caption"]));
      // the header bar is not drawn on a full-slide picture
      const empty = await slideXml(await buildPptx(deckOf({ layout: "image", title: "Big title", placeholder: "Photo of the shop", placement: "background" })), 2);
      expect(texts(empty)).toEqual(expect.arrayContaining(["Big title", "Photo of the shop"]));
      expect(picBoxes(empty)).toHaveLength(0);
    });
  });

  describe("pictures on canvas slides (dynamic layout)", () => {
    const texts = (xml: string) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const canvas = (elements: object[], fullBleed = false) => deckOf({ layout: "canvas", title: "Free form", fullBleed, elements });

    it("keeps an image element with a picture id or a placeholder, and drops one with neither", () => {
      const deck = canvas([
        { type: "image", x: 0.5, y: 1, w: 4, h: 3, image: "img1", caption: "Office" },
        { type: "image", x: 5, y: 1, w: 4, h: 3, placeholder: "Photo of the team" },
        { type: "image", x: 5, y: 4, w: 2, h: 1, image: "../etc/passwd" },
        { type: "image", x: 1, y: 4, w: 2, h: 1 },
        { type: "text", x: 0.5, y: 4.5, w: 3, h: 0.5, text: "Kept" },
      ]);
      const slide = deck.slides[0];
      const els = slide.layout === "canvas" ? slide.elements : [];
      expect(els.map((e) => e.type)).toEqual(["image", "image", "text"]);
      expect(els[0]).toMatchObject({ type: "image", image: "img1", caption: "Office" });
      expect(els[1]).toMatchObject({ type: "image", placeholder: "Photo of the team" });
    });

    it("draws the picture whole inside its box with the caption directly under it", async () => {
      const images = await pictures();
      const file = await buildPptx(canvas([{ type: "image", x: 1, y: 1.2, w: 4, h: 3.4, image: "img1", caption: "Our office" }]), { images });
      const xml = await slideXml(file, 2);
      const [pic] = picBoxes(xml);
      expect(pic.w / pic.h).toBeCloseTo(1600 / 900, 2);
      expect(pic.x).toBeGreaterThanOrEqual(1 - 0.01);
      expect(pic.x + pic.w).toBeLessThanOrEqual(5 + 0.01);
      expect(pic.y + pic.h).toBeLessThanOrEqual(1.2 + 3.4 + 0.01);
      expect(texts(xml)).toContain("Our office");
      const caption = xml.split("<p:sp>").find((c) => c.includes("Our office"))!;
      expect(Number(/<a:off x="\d+" y="(\d+)"/.exec(caption)![1]) / EMU).toBeGreaterThanOrEqual(pic.y + pic.h - 0.01);
    });

    it("falls back to the picture's name for the caption, and draws a labelled box for a placeholder", async () => {
      const images = await pictures();
      images.img2.label = "Founder portrait";
      const file = await buildPptx(canvas([
        { type: "image", x: 0.5, y: 1, w: 3, h: 3.5, image: "img2" },
        { type: "image", x: 4, y: 1, w: 5, h: 3.5, placeholder: "Product shot", caption: "The lantern" },
      ]), { images });
      const xml = await slideXml(file, 2);
      expect(picBoxes(xml)).toHaveLength(1);
      expect(texts(xml)).toEqual(expect.arrayContaining(["Founder portrait", "Product shot", "The lantern"]));
    });

    it("fills the box edge to edge for fit cover, with no caption", async () => {
      const images = await pictures();
      const file = await buildPptx(canvas([{ type: "image", x: 0, y: 0, w: 10, h: 5.625, image: "img2", caption: "never shown", fit: "cover" }], true), { images });
      const xml = await slideXml(file, 2);
      const [pic] = picBoxes(xml);
      expect(pic.x).toBeCloseTo(0, 1);
      expect(pic.y).toBeCloseTo(0, 1);
      expect(pic.w).toBeCloseTo(10, 1);
      expect(pic.h).toBeCloseTo(5.625, 1);
      expect(texts(xml)).not.toContain("never shown");
    });

    it("says so when a named picture wasn't passed in", async () => {
      const file = await buildPptx(canvas([{ type: "image", x: 1, y: 1.2, w: 4, h: 3, image: "img1" }]));
      expect(texts(await slideXml(file, 2))).toContain("Picture not available");
    });
  });
});
