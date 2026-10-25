import { describe, it, expect, afterEach } from "vitest";
import JSZip from "jszip";
import { defineLayout, registerLayout, getLayout, listLayouts, clearLayoutsForTests, BUILTIN_LAYOUT_NAMES } from "../src/pptx/layoutRegistry.js";
import { normalizeDeck } from "../src/pptx/slideDeck.js";
import { buildPptx } from "../src/pptx/presentationBuilder.js";
import { COMMUNITY_LAYOUTS, registerCommunityLayouts } from "../src/layouts/index.js";

const simple = (name: string) =>
  defineLayout<{ text: string }>({
    name,
    description: "test",
    normalize: (raw) => (typeof raw.text === "string" ? { text: raw.text } : null),
    render: ({ slide, helpers, colors }, data) => {
      helpers.chrome("Custom");
      slide.addText(helpers.clean(data.text), { x: 1, y: 2, w: 5, h: 1, color: colors.bodyColor, isTextBox: true });
    },
    example: { layout: name, text: "hi" },
  });

describe("layout registry", () => {
  afterEach(() => {
    clearLayoutsForTests();
    registerCommunityLayouts();
  });

  it("rejects bad names and built-in names", () => {
    expect(() => registerLayout(simple("Bad Name"))).toThrow(/lowercase/);
    expect(() => registerLayout(simple("x"))).toThrow(/lowercase/);
    for (const n of ["bullets", "table", "custom", "thank_you"]) expect(() => registerLayout(simple(n))).toThrow(/built-in/);
  });

  it("lists every built-in name the engine handles", () => {
    expect(BUILTIN_LAYOUT_NAMES).toContain("advanced_table");
    expect(new Set(BUILTIN_LAYOUT_NAMES).size).toBe(BUILTIN_LAYOUT_NAMES.length);
  });

  it("accepts the same layout twice but not a different one with the same name", () => {
    const a = simple("demo_layout");
    registerLayout(a);
    registerLayout(a);
    expect(getLayout("demo_layout")).toBeDefined();
    expect(() => registerLayout(simple("demo_layout"))).toThrow(/already registered/);
  });

  it("normalizes a custom slide and draws it into a real .pptx", async () => {
    registerLayout(simple("note_card"));
    const deck = normalizeDeck({ slides: [{ layout: "note_card", text: "**Hello** world", notes: "n" }] });
    expect(deck?.slides[0]).toMatchObject({ layout: "custom", custom: "note_card" });
    const bytes = await buildPptx(deck!);
    const zip = await JSZip.loadAsync(bytes);
    const slide = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slide).toContain("Hello world");
    expect(slide).not.toContain("**");
  });

  it("falls back to bullets when the layout refuses the slide", () => {
    registerLayout(simple("note_card"));
    const deck = normalizeDeck({ slides: [{ layout: "note_card", title: "T", bullets: ["a"] }] });
    expect(deck?.slides[0].layout).not.toBe("custom");
  });

  it("does not let a throwing normalize or render take the deck down", async () => {
    registerLayout(
      defineLayout({
        name: "explodes",
        description: "test",
        normalize: (raw) => {
          if (raw.mode === "normalize") throw new Error("boom");
          return { ok: true };
        },
        render: () => {
          throw new Error("boom");
        },
        example: { layout: "explodes" },
      }),
    );
    const deck = normalizeDeck({ slides: [{ layout: "explodes", mode: "normalize", title: "T", bullets: ["a"] }, { layout: "explodes" }] });
    expect(deck?.slides).toHaveLength(2);
    const bytes = await buildPptx(deck!);
    expect((await JSZip.loadAsync(bytes)).file("ppt/slides/slide2.xml")).toBeTruthy();
  });
});

describe("community layouts", () => {
  it("are registered on import of the package entry", async () => {
    registerCommunityLayouts();
    expect(listLayouts().map((l) => l.name)).toEqual(expect.arrayContaining(COMMUNITY_LAYOUTS.map((l) => l.name)));
  });

  it("every community layout normalizes its own example and renders it", async () => {
    clearLayoutsForTests();
    for (const layout of COMMUNITY_LAYOUTS) registerLayout(layout);
    for (const layout of COMMUNITY_LAYOUTS) {
      expect(layout.description.length).toBeGreaterThan(10);
      const deck = normalizeDeck({ slides: [layout.example] });
      expect(deck?.slides[0], layout.name).toMatchObject({ layout: "custom", custom: layout.name });
      const bytes = await buildPptx(deck!);
      expect(bytes.byteLength).toBeGreaterThan(5000);
    }
  });

  it("pricing drops bad plans and limits the rest", () => {
    clearLayoutsForTests();
    registerCommunityLayouts();
    const pricing = COMMUNITY_LAYOUTS.find((l) => l.name === "pricing")!;
    expect(pricing.normalize({ plans: "nope" })).toBeNull();
    expect(pricing.normalize({ plans: [{ name: "", price: "$1" }, null, 3] })).toBeNull();
    const out = pricing.normalize({
      plans: Array.from({ length: 9 }, (_, i) => ({ name: `P${i}`, price: "$1", features: Array.from({ length: 20 }, () => "f") })),
    }) as { plans: { features: string[] }[] };
    expect(out.plans).toHaveLength(4);
    expect(out.plans[0].features).toHaveLength(6);
  });
});
