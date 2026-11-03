import { describe, it, expect } from "vitest";
import { DEFAULT_PICTURE_MODE, PICTURE_MODES, cleanPlaceholderText, deckHasPicturePlaceholders, parsePictureMode, IMAGE_LIMITS, PICTURE_PREVIEW_SPARKS, previewSparks, attachImagePreviews, cleanImageDescription, cleanImageLabel, describeShape, imageIdsInDeck, isImageId, parseImageMeta, nextImageId, parseImageHints, parseImageLabels, parseImagePreviews, parseImagesRequest } from "../src/pptx/pptImages.js";

describe("image ids and labels", () => {
  it("accepts only img1 to img99, nothing that looks like a path or a URL", () => {
    for (const ok of ["img1", "img6", "img12"]) expect(isImageId(ok)).toBe(true);
    for (const bad of ["img0", "img", "img100", "IMG1", "../img1", "https://x/img1", "img1 ", 1, null, undefined]) expect(isImageId(bad)).toBe(false);
  });

  it("cleans a file name into a plain label for the model's instructions", () => {
    expect(cleanImageLabel("Team photo 2024.JPG")).toBe("Team photo 2024");
    const messy = cleanImageLabel('"quote" <b>bold</b>\nnew line `code` {x}');
    expect(messy).not.toMatch(/["<>`{}\n]/);
    expect(messy).toContain("quote");
    expect(messy).toContain("new line");
    expect(cleanImageLabel("x".repeat(100)).length).toBe(IMAGE_LIMITS.labelChars);
    expect(cleanImageLabel(42)).toBe("");
    expect(cleanImageLabel("Café du monde")).toBe("Café du monde");
  });

  it("picks the next free id, or null when all six are taken", () => {
    expect(nextImageId([])).toBe("img1");
    expect(nextImageId(["img1", "img3"])).toBe("img2");
    expect(nextImageId(["img1", "img2", "img3", "img4", "img5", "img6"])).toBeNull();
  });

  it("describes a picture's shape", () => {
    expect(describeShape(1600, 900)).toBe("landscape");
    expect(describeShape(900, 1600)).toBe("portrait");
    expect(describeShape(1000, 1000)).toBe("square");
  });
});

describe("parseImageHints", () => {
  it("keeps valid pictures, drops bad or repeated ones, and caps the list", () => {
    const list = parseImageHints([
      { id: "img1", label: "Logo wall", width: 1600, height: 900 },
      { id: "img1", label: "again", width: 10, height: 10 },
      { id: "../x", label: "bad", width: 10, height: 10 },
      { id: "img2", label: "", width: 100.4, height: 50 },
      { id: "img3", label: "no size" },
      null,
    ]);
    expect(list).toEqual([
      { id: "img1", label: "Logo wall", width: 1600, height: 900 },
      { id: "img2", label: "img2", width: 100, height: 50 },
    ]);
    const many = Array.from({ length: 10 }, (_, n) => ({ id: `img${n + 1}`, label: "p", width: 10, height: 10 }));
    expect(parseImageHints(many)).toHaveLength(IMAGE_LIMITS.maxImages);
    expect(parseImageHints("nope")).toEqual([]);
    expect(parseImageHints(undefined)).toEqual([]);
  });
});

describe("parseImagesRequest", () => {
  const png = "data:image/png;base64,AAAA";
  it("accepts a map of picture ids to PNG, JPEG or WebP data URLs", () => {
    expect(parseImagesRequest({ img1: png, img2: "data:image/jpeg;base64,AAAA", img3: "data:image/webp;base64,AAAA" })).toHaveProperty("img3");
  });

  it("rejects anything else: SVG, URLs, bad ids, empty, too many, too large", () => {
    expect(parseImagesRequest({ img1: "data:image/svg+xml;base64,AAAA" })).toBeNull();
    expect(parseImagesRequest({ img1: "https://x.example/a.png" })).toBeNull();
    expect(parseImagesRequest({ nope: png })).toBeNull();
    expect(parseImagesRequest({})).toBeNull();
    expect(parseImagesRequest([png])).toBeNull();
    expect(parseImagesRequest(Object.fromEntries(Array.from({ length: 7 }, (_, n) => [`img${n + 1}`, png])))).toBeNull();
    const big = "A".repeat(Math.ceil((IMAGE_LIMITS.maxBytes * 4) / 3) + 8);
    expect(parseImagesRequest({ img1: `data:image/png;base64,${big}` })).toBeNull();
  });
});

describe("parseImageHints: the chosen background picture", () => {
  const hint = (id: string, extra: object = {}) => ({ id, label: id, width: 100, height: 100, ...extra });
  it("keeps the background flag, and only on the first picture that has it", () => {
    const hints = parseImageHints([hint("img1"), hint("img2", { background: true }), hint("img3", { background: true })]);
    expect(hints.map((h) => !!h.background)).toEqual([false, true, false]);
  });
  it("ignores a background flag that is not exactly true", () => {
    expect(parseImageHints([hint("img1", { background: "yes" }), hint("img2", { background: 1 })]).some((h) => h.background)).toBe(false);
  });
});

describe("parseImageMeta", () => {
  it("keeps sizes and names for valid picture ids, and drops anything else", () => {
    const meta = parseImageMeta({ img1: { width: 1280.4, height: 720, label: "Front.jpg" }, img2: { width: 0, height: 5 }, "../x": { width: 5, height: 5 }, img3: { width: 30000, height: 5 }, img4: "no" });
    expect(meta).toEqual({ img1: { width: 1280, height: 720, label: "Front" } });
    expect(parseImageMeta(null)).toEqual({});
    expect(parseImageMeta([1])).toEqual({});
  });
});

describe("imageIdsInDeck", () => {
  it("finds the pictures named by image slides and gallery cards, once each", () => {
    const deck = {
      slides: [
        { layout: "bullets", bullets: ["a"] },
        { layout: "image", image: "img1" },
        { layout: "gallery", items: [{ image: "img2" }, { title: "text only" }, { image: "img1" }, { image: "../bad" }] },
        { layout: "image", image: "img9" },
      ],
    };
    expect(imageIdsInDeck(deck).sort()).toEqual(["img1", "img2", "img9"]);
    expect(imageIdsInDeck(null)).toEqual([]);
    expect(imageIdsInDeck({ slides: "x" })).toEqual([]);
  });

  it("counts the deck's background picture, so it is sent with the download", () => {
    expect(imageIdsInDeck({ backgroundImage: "img3", slides: [{ layout: "image", image: "img1" }] }).sort()).toEqual(["img1", "img3"]);
    expect(imageIdsInDeck({ backgroundImage: "../bad", slides: [] })).toEqual([]);
    expect(imageIdsInDeck({ backgroundImage: "none", slides: [] })).toEqual([]); // "none" is not a picture to send
  });
});

describe("descriptions", () => {
  it("cleans a description to plain words, a little longer than a label", () => {
    expect(cleanImageDescription("Six people standing in front of a glass office, smiling")).toBe("Six people standing in front of a glass office, smiling");
    const messy = cleanImageDescription('A "chart" <script>alert(1)</script>\n`x` {y}');
    expect(messy).not.toMatch(/["<>`{}\n]/);
    expect(cleanImageDescription("w".repeat(500)).length).toBe(IMAGE_LIMITS.descriptionChars);
    expect(cleanImageDescription(7)).toBe("");
  });

  it("keeps a description on a hint, and leaves it off when there is none", () => {
    const [a, b] = parseImageHints([
      { id: "img1", label: "Office", description: "Glass office at dusk", width: 10, height: 10 },
      { id: "img2", label: "Plain", width: 10, height: 10 },
    ]);
    expect(a.description).toBe("Glass office at dusk");
    expect(b).not.toHaveProperty("description");
  });
});

describe("previews the model may look at", () => {
  const known = [
    { id: "img1", label: "Office", width: 10, height: 10 },
    { id: "img2", label: "Founder", width: 10, height: 10 },
  ];
  const jpeg = "data:image/jpeg;base64,AAAA";

  it("keeps small pictures for known ids and drops everything else", () => {
    const big = `data:image/jpeg;base64,${"A".repeat(Math.ceil((IMAGE_LIMITS.previewBytes * 4) / 3) + 8)}`;
    const out = parseImagePreviews({ img1: jpeg, img2: big, img3: jpeg, img4: "https://x.example/a.jpg" }, known);
    expect(out).toEqual({ img1: jpeg });
    expect(parseImagePreviews({ img1: "data:image/svg+xml;base64,AAAA" }, known)).toEqual({});
    expect(parseImagePreviews(null, known)).toEqual({});
    expect(parseImagePreviews([jpeg], known)).toEqual({});
  });

  it("attaches each preview to the last user turn after a line naming its id", () => {
    const history: { role: string; content: unknown }[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "use my pictures" },
    ];
    attachImagePreviews(history, known, { img1: jpeg, img2: "data:image/png;base64,BBBB" });
    expect(history[0].content).toBe("first");
    const content = history[2].content as { type: string; text?: string; source?: { media_type: string; data: string } }[];
    expect(content.map((b) => b.type)).toEqual(["text", "image", "text", "image", "text"]);
    expect(content[0].text).toBe('img1 ("Office"):');
    expect(content[1].source).toEqual({ type: "base64", media_type: "image/jpeg", data: "AAAA" });
    expect(content[3].source?.media_type).toBe("image/png");
    expect(content[4].text).toBe("use my pictures");
  });

  it("keeps the turn's own blocks (an attached document) and does nothing without previews", () => {
    const history = [{ role: "user", content: [{ type: "document" }, { type: "text", text: "go" }] }];
    attachImagePreviews(history, known, { img1: jpeg });
    expect((history[0].content as { type: string }[]).map((b) => b.type)).toEqual(["text", "image", "document", "text"]);
    const untouched = [{ role: "user", content: "hi" }];
    attachImagePreviews(untouched, known, {});
    expect(untouched[0].content).toBe("hi");
    expect(() => attachImagePreviews([], known, { img1: jpeg })).not.toThrow();
  });
});

describe("the Sparks charge for letting Ail see the pictures", () => {
  it("is a flat amount per picture shown, never negative", () => {
    expect(PICTURE_PREVIEW_SPARKS).toBe(50);
    expect(previewSparks(0)).toBe(0);
    expect(previewSparks(1)).toBe(50);
    expect(previewSparks(6)).toBe(300);
    expect(previewSparks(-2)).toBe(0);
    expect(previewSparks(2.9)).toBe(100);
  });
});

describe("parseImageLabels", () => {
  it("keeps cleaned names for valid ids and drops the rest", () => {
    expect(parseImageLabels({ img1: "Office front", img2: "", "../x": "bad", img3: 5 })).toEqual({ img1: "Office front" });
    expect(parseImageLabels(null)).toEqual({});
    expect(parseImageLabels(["a"])).toEqual({});
  });
});

describe("pictures attached to the message", () => {
  it("keeps the attached flag on a hint only when it is exactly true", () => {
    const [a, b, c] = parseImageHints([
      { id: "img1", label: "Photo", width: 10, height: 10, attached: true },
      { id: "img2", label: "Other", width: 10, height: 10, attached: "yes" },
      { id: "img3", label: "Plain", width: 10, height: 10 },
    ]);
    expect(a.attached).toBe(true);
    expect(b).not.toHaveProperty("attached");
    expect(c).not.toHaveProperty("attached");
  });
});

describe("pictures on slides: mode and placeholders", () => {
  it("reads the mode, and anything unknown means the default (my pictures)", () => {
    expect(PICTURE_MODES).toEqual(["use", "placeholders", "none"]);
    expect(DEFAULT_PICTURE_MODE).toBe("use");
    expect(parsePictureMode("placeholders")).toBe("placeholders");
    expect(parsePictureMode("none")).toBe("none");
    for (const bad of ["", "NONE", "all", 3, null, undefined]) expect(parsePictureMode(bad)).toBe("use");
  });

  it("cleans a placeholder text to a short plain phrase", () => {
    expect(cleanPlaceholderText("Photo of the team")).toBe("Photo of the team");
    expect(cleanPlaceholderText('"<b>Team</b>" photo')).not.toMatch(/["<>]/);
    expect(cleanPlaceholderText("w".repeat(200)).length).toBe(60);
    expect(cleanPlaceholderText(undefined)).toBe("");
  });

  it("knows when a deck has an empty picture box", () => {
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "image", placeholder: "Team photo" }] })).toBe(true);
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "gallery", items: [{ image: "img1" }, { placeholder: "Product shot" }] }] })).toBe(true);
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "image", image: "img1" }] })).toBe(false);
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "gallery", items: [{ image: "img1", placeholder: "ignored" }] }] })).toBe(false);
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "bullets" }] })).toBe(false);
    expect(deckHasPicturePlaceholders(null)).toBe(false);
  });
});

describe("pictures in the multi-picture layouts", () => {
  it("finds ids on photos items and before/after sides, and placeholders there", () => {
    const deck = {
      slides: [
        { layout: "photos", items: [{ image: "img1" }, { placeholder: "Team" }, { image: "img3" }] },
        { layout: "before_after", before: { image: "img2" }, after: { placeholder: "Result" } },
        { layout: "image", image: "img1" },
      ],
    };
    expect(imageIdsInDeck(deck).sort()).toEqual(["img1", "img2", "img3"]);
    expect(deckHasPicturePlaceholders(deck)).toBe(true);
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "photos", items: [{ image: "img1" }, { image: "img2" }] }] })).toBe(false);
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "before_after", before: { image: "img1" }, after: { placeholder: "Result" } }] })).toBe(true);
  });
});

describe("pictures on canvas slides", () => {
  it("counts the image elements of canvas slides, by id and as placeholders", () => {
    const deck = {
      slides: [
        { layout: "canvas", elements: [{ type: "text", text: "x" }, { type: "image", image: "img2" }, { type: "image", placeholder: "Team photo" }, { type: "icon" }] },
        { layout: "bullets" },
      ],
    };
    expect(imageIdsInDeck(deck)).toEqual(["img2"]);
    expect(deckHasPicturePlaceholders(deck)).toBe(true);
    expect(deckHasPicturePlaceholders({ slides: [{ layout: "canvas", elements: [{ type: "image", image: "img1" }, { type: "shape" }] }] })).toBe(false);
    expect(imageIdsInDeck({ slides: [{ layout: "canvas", elements: "nope" }] })).toEqual([]);
  });
});
