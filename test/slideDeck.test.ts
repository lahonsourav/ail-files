import { describe, it, expect } from "vitest";
import { normalizeDeck, extractSlideDeck } from "../src/pptx/slideDeck.js";

function deckWithSlide(slide: unknown) {
  return { title: "Test deck", slides: [slide] };
}

describe("normalizeDeck — canvas layout", () => {
  it("accepts a canvas slide with one element of each type", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "canvas",
        title: "Overview",
        elements: [
          { type: "text", x: 0.5, y: 1, w: 4, h: 1, text: "Headline", fontRole: "heading", textRole: "accent", size: "lg" },
          { type: "shape", x: 0.5, y: 2, w: 3, h: 1.5, shape: "roundRect", fillRole: "card" },
          { type: "icon", x: 4, y: 1, w: 0.6, h: 0.6, icon: "rocket" },
          { type: "chart", x: 5, y: 1, w: 4, h: 3, chartType: "bar", categories: ["Q1", "Q2"], values: [10, 20] },
          { type: "table", x: 0.5, y: 3.5, w: 4, h: 1, headers: ["A", "B"], rows: [["1", "2"]] },
        ],
      })
    );
    expect(deck).not.toBeNull();
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("canvas");
    if (slide.layout !== "canvas") throw new Error("expected canvas");
    expect(slide.elements).toHaveLength(5);
    expect(slide.elements.map((e) => e.type)).toEqual(["text", "shape", "icon", "chart", "table"]);
  });

  it("clamps an out-of-range box into the canvas instead of dropping the element", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "canvas",
        elements: [{ type: "text", x: -5, y: -5, w: 100, h: 100, text: "Off canvas" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "canvas") throw new Error("expected canvas");
    expect(slide.elements).toHaveLength(1);
    const el = slide.elements[0];
    expect(el.x).toBeGreaterThanOrEqual(0);
    expect(el.y).toBeGreaterThanOrEqual(0);
    expect(el.x + el.w).toBeLessThanOrEqual(10);
    expect(el.y + el.h).toBeLessThanOrEqual(5.625);
  });

  it("drops one invalid element among valid ones without falling back to bullets", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "canvas",
        elements: [
          { type: "text", x: 0, y: 0, w: 2, h: 1, text: "Valid" },
          { type: "text", x: 0, y: 1, w: 2, h: 1 }, // missing required "text"
        ],
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("canvas");
    if (slide.layout !== "canvas") throw new Error("expected canvas");
    expect(slide.elements).toHaveLength(1);
  });

  it("falls back to bullets when every element is invalid but a title exists", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "canvas",
        title: "Fallback title",
        elements: [{ type: "bogus", x: 0, y: 0, w: 1, h: 1 }],
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });

  it("truncates more than 16 elements to the cap", () => {
    const elements = Array.from({ length: 20 }, () => ({ type: "icon", x: 0, y: 0, w: 0.5, h: 0.5, icon: "idea" }));
    const deck = normalizeDeck(deckWithSlide({ layout: "canvas", title: "Many", elements }));
    const slide = deck!.slides[0];
    if (slide.layout !== "canvas") throw new Error("expected canvas");
    expect(slide.elements).toHaveLength(16);
  });

  it("drops an element with an unknown type", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "canvas",
        title: "Has one good element",
        elements: [
          { type: "text", x: 0, y: 0, w: 2, h: 1, text: "Kept" },
          { type: "video", x: 0, y: 0, w: 1, h: 1, url: "https://example.com" },
        ],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "canvas") throw new Error("expected canvas");
    expect(slide.elements).toHaveLength(1);
    expect(slide.elements[0].type).toBe("text");
  });

  it("defaults an invalid enum value rather than passing it through or crashing", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "canvas",
        elements: [{ type: "shape", x: 0, y: 0, w: 1, h: 1, shape: "rect", fillRole: "neonpink" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "canvas") throw new Error("expected canvas");
    const el = slide.elements[0];
    expect(el.type).toBe("shape");
    if (el.type !== "shape") throw new Error("expected shape");
    expect(el.fillRole).toBeUndefined();
  });
});

describe("normalizeDeck — chart layout", () => {
  // Real bug: renderChartAt (presentationBuilder.ts) draws a named series
  // for "line" (and "bar"/"pie"/"doughnut") same as it does for
  // "bar-stacked", but this normalizer used to only ever look at `series`
  // for "bar-stacked" and required flat `values` for every other type. A
  // model emitting a perfectly valid series-shaped line chart (e.g. one
  // named trend line) fell through untouched and silently became a
  // title-only bullets slide with zero bullets — an empty-looking slide.
  it("accepts a series-shaped line chart, not just bar-stacked", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "chart",
        title: "Centuries over decades",
        chartType: "line",
        categories: ["2010s", "2020s"],
        series: [{ name: "Centuries", values: [20, 35] }],
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("chart");
    if (slide.layout !== "chart") throw new Error("expected chart");
    expect(slide.chartType).toBe("line");
    expect(slide.series).toEqual([{ name: "Centuries", values: [20, 35] }]);
  });

  it("still accepts flat values for a non-bar-stacked chart type", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "chart", title: "Revenue", chartType: "bar", categories: ["Q1", "Q2"], values: [10, 20] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "chart") throw new Error("expected chart");
    expect(slide.values).toEqual([10, 20]);
  });

  it("falls back to flat values for bar-stacked with no valid series (renders as a plain bar chart)", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "chart", title: "Stacked", chartType: "bar-stacked", categories: ["Q1", "Q2"], values: [10, 20] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "chart") throw new Error("expected chart");
    // No series to stack with, but renderChartAt's generic branch still
    // draws a usable chart from flat values (as plain "bar", not stacked) —
    // an incidental improvement from the same fix, not the main bug.
    expect(slide.values).toEqual([10, 20]);
  });

  it("falls back to bullets when a chart has neither series nor values", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "chart", title: "Nothing to plot", chartType: "line", categories: ["Q1", "Q2"] }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });

  it("rejects a series-shaped scatter chart (renderChartAt only reads flat values for scatter)", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "chart",
        title: "Scatter",
        chartType: "scatter",
        categories: ["1", "2"],
        series: [{ name: "Points", values: [10, 20] }],
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });

  it("accepts a series-shaped chart inside a canvas element too", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "canvas",
        elements: [
          {
            type: "chart", x: 0.5, y: 0.5, w: 4, h: 3, chartType: "line",
            categories: ["2010s", "2020s"], series: [{ name: "Centuries", values: [20, 35] }],
          },
        ],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "canvas") throw new Error("expected canvas");
    expect(slide.elements).toHaveLength(1);
    const el = slide.elements[0];
    expect(el.type).toBe("chart");
    if (el.type !== "chart") throw new Error("expected chart element");
    expect(el.series).toEqual([{ name: "Centuries", values: [20, 35] }]);
  });
});

describe("normalizeDeck — thank_you layout", () => {
  it("normalizes with no fields at all (title defaults at render time, not here)", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "thank_you" }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("thank_you");
    if (slide.layout !== "thank_you") throw new Error("expected thank_you");
    expect(slide.title).toBeUndefined();
  });

  it("keeps subtitle and strips non-string contact entries", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "thank_you", title: "Thanks!", subtitle: "Let's build something", contact: ["hello@ail.com", 42, "ailighthouse.in"] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "thank_you") throw new Error("expected thank_you");
    expect(slide.title).toBe("Thanks!");
    expect(slide.subtitle).toBe("Let's build something");
    expect(slide.contact).toEqual(["hello@ail.com", "ailighthouse.in"]);
  });
});

describe("normalizeDeck — presenter layout", () => {
  it("falls back to bullets (using the title) when name is missing", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "presenter", title: "About the speaker", role: "Founder" }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });

  it("is dropped entirely when neither name nor any fallback text exists", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "presenter", role: "Founder" }));
    expect(deck).toBeNull();
  });

  it("round-trips a fully populated presenter slide (old flat shape, backward-compat)", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "presenter",
        name: "Sourav Lahon",
        role: "Founder & CEO",
        company: "Ail",
        bio: "Building pay-per-task AI",
        contact: ["sourav@ail.com"],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "presenter") throw new Error("expected presenter");
    expect(slide.presenters[0].name).toBe("Sourav Lahon");
    expect(slide.presenters[0].role).toBe("Founder & CEO");
    expect(slide.presenters[0].company).toBe("Ail");
    expect(slide.presenters[0].bio).toBe("Building pay-per-task AI");
    expect(slide.presenters[0].contact).toEqual(["sourav@ail.com"]);
  });

  it("accepts a multi-presenter array (new shape)", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "presenter",
        presenters: [
          { name: "Sourav Lahon", role: "Founder & CEO" },
          { name: "Jane Doe", role: "CTO" },
          { name: "Sam Roe", role: "Head of Design" },
        ],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "presenter") throw new Error("expected presenter");
    expect(slide.presenters).toHaveLength(3);
    expect(slide.presenters.map((p) => p.name)).toEqual(["Sourav Lahon", "Jane Doe", "Sam Roe"]);
  });

  it("drops individual invalid entries from a mixed presenters array", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "presenter",
        presenters: [{ name: "Sourav Lahon" }, { role: "Missing name" }, { name: "Jane Doe" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "presenter") throw new Error("expected presenter");
    expect(slide.presenters).toHaveLength(2);
    expect(slide.presenters.map((p) => p.name)).toEqual(["Sourav Lahon", "Jane Doe"]);
  });

  it("falls through when every entry in the presenters array is invalid", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "presenter", presenters: [{ role: "Founder" }, { role: "CTO" }] }));
    expect(deck).toBeNull();
  });
});

describe("normalizeDeck — hero layout", () => {
  it("accepts a title-only hero slide", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "hero", title: "The Thesis" }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("hero");
    if (slide.layout !== "hero") throw new Error("expected hero");
    expect(slide.title).toBe("The Thesis");
    expect(slide.stats).toBeUndefined();
    expect(slide.pillars).toBeUndefined();
  });

  it("keeps eyebrow and subtitle", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "hero", eyebrow: "Strategic analysis", title: "Is It Real?", subtitle: "Stress-testing the venture" }));
    const slide = deck!.slides[0];
    if (slide.layout !== "hero") throw new Error("expected hero");
    expect(slide.eyebrow).toBe("Strategic analysis");
    expect(slide.subtitle).toBe("Stress-testing the venture");
  });

  it("normalizes a stats-only bottom row", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "hero", title: "Headline", stats: [{ value: "90%", label: "Recovery mandate" }, { value: "21-char", label: "Digital ID" }] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "hero") throw new Error("expected hero");
    expect(slide.stats).toHaveLength(2);
    expect(slide.pillars).toBeUndefined();
  });

  it("normalizes a pillars-only bottom row", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "hero", title: "Headline", pillars: [{ label: "REAL", description: "Market validation" }, { label: "WIN", description: "Defensibility" }] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "hero") throw new Error("expected hero");
    expect(slide.pillars).toHaveLength(2);
    expect(slide.stats).toBeUndefined();
  });

  it("keeps both stats and pillars when both are given (precedence is a render-time decision, not the normalizer's)", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "hero",
        title: "Headline",
        stats: [{ value: "90%", label: "Recovery" }],
        pillars: [{ label: "REAL", description: "Market validation" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "hero") throw new Error("expected hero");
    expect(slide.stats).toHaveLength(1);
    expect(slide.pillars).toHaveLength(1);
  });

  it("drops invalid stat/pillar entries individually", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "hero",
        title: "Headline",
        stats: [{ value: "90%", label: "Recovery" }, { value: "no label" }],
        pillars: [{ label: "REAL" }, { description: "missing label" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "hero") throw new Error("expected hero");
    expect(slide.stats).toHaveLength(1);
    expect(slide.pillars).toHaveLength(1);
  });

  it("falls back to bullets when title is missing but other text exists", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "hero", bullets: ["Some fallback text"] }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });
});

describe("normalizeDeck — tiers layout", () => {
  it("accepts a valid tiers slide", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "tiers",
        title: "State of Health",
        tiers: [
          { label: "> 80% SoH", description: "Continued vehicular use" },
          { label: "60-79% SoH", description: "Second-life: grid storage" },
          { label: "< 60% SoH", description: "Routed to recycling" },
        ],
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("tiers");
    if (slide.layout !== "tiers") throw new Error("expected tiers");
    expect(slide.tiers).toHaveLength(3);
    expect(slide.tiers[0].label).toBe("> 80% SoH");
  });

  it("drops invalid tier entries individually", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "tiers", tiers: [{ label: "Tier 1" }, { description: "missing label" }] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "tiers") throw new Error("expected tiers");
    expect(slide.tiers).toHaveLength(1);
  });

  it("falls back to bullets when every tier is invalid", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "tiers", title: "Fallback title", tiers: [{ description: "no label" }] }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });
});

describe("normalizeDeck — comparison layout with steps", () => {
  it("accepts steps on both columns", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "comparison",
        left: { heading: "Sovereign Data Exchange", steps: [{ label: "Request", detail: "Recycler requests BMCS" }, { label: "Authenticate" }] },
        right: { heading: "Privacy-Preserving Proof", steps: [{ label: "Generate proof" }, { label: "Verify" }] },
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("comparison");
    if (slide.layout !== "comparison") throw new Error("expected comparison");
    expect(slide.left.steps).toHaveLength(2);
    expect(slide.left.bullets).toBeUndefined();
    expect(slide.right.steps).toHaveLength(2);
  });

  it("steps win over bullets when a column has both", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "comparison",
        left: { heading: "Left", steps: [{ label: "Step one" }], bullets: ["Should be dropped"] },
        right: { heading: "Right", bullets: ["Plain bullet"] },
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "comparison") throw new Error("expected comparison");
    expect(slide.left.steps).toHaveLength(1);
    expect(slide.left.bullets).toBeUndefined();
  });

  it("still accepts a bullets-only column (existing behavior unaffected)", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "comparison",
        left: { heading: "Before", bullets: ["Old way"] },
        right: { heading: "After", bullets: ["New way"] },
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "comparison") throw new Error("expected comparison");
    expect(slide.left.bullets).toEqual(["Old way"]);
  });

  it("drops the whole slide when a column has neither steps nor bullets", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "comparison",
        left: { heading: "Left" },
        right: { heading: "Right", bullets: ["Something"] },
      })
    );
    expect(deck).toBeNull();
  });
});

describe("normalizeDeck — insight banners", () => {
  it("adds insights to a stats_row slide", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "stats_row",
        stats: [{ value: "90%", label: "Recovery" }],
        insights: [{ lead: "Named, reachable customers.", text: "Target segments are clearly identifiable." }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "stats_row") throw new Error("expected stats_row");
    expect(slide.insights).toHaveLength(1);
    expect(slide.insights![0].lead).toBe("Named, reachable customers.");
  });

  it("adds insights to a grid slide", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "grid",
        items: [{ title: "Item" }],
        insights: [{ text: "Our moat: neutrality plus cryptographic privacy." }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "grid") throw new Error("expected grid");
    expect(slide.insights).toHaveLength(1);
    expect(slide.insights![0].lead).toBeUndefined();
  });

  it("adds insights to a table slide", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "table",
        headers: ["A"],
        rows: [["1"]],
        insights: [{ text: "The verdict." }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "table") throw new Error("expected table");
    expect(slide.insights).toHaveLength(1);
  });

  it("drops invalid insight entries individually", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "stats_row",
        stats: [{ value: "90%", label: "Recovery" }],
        insights: [{ text: "Valid" }, { lead: "No text field" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "stats_row") throw new Error("expected stats_row");
    expect(slide.insights).toHaveLength(1);
  });

  it("does not truncate more than 2 valid insights at parse time (render-time cap only)", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "stats_row",
        stats: [{ value: "90%", label: "Recovery" }],
        insights: [{ text: "One" }, { text: "Two" }, { text: "Three" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "stats_row") throw new Error("expected stats_row");
    expect(slide.insights).toHaveLength(3);
  });

  it("omits the insights field entirely when none are given", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "grid", items: [{ title: "Item" }] }));
    const slide = deck!.slides[0];
    if (slide.layout !== "grid") throw new Error("expected grid");
    expect(slide.insights).toBeUndefined();
  });
});

describe("normalizeDeck — recap layout", () => {
  it("accepts a recap slide with an example", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "recap",
        title: "Section Recap",
        example: { heading: "Case in Point", text: "A concrete scenario." },
        takeaways: ["Point one", "Point two"],
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("recap");
    if (slide.layout !== "recap") throw new Error("expected recap");
    expect(slide.example?.heading).toBe("Case in Point");
    expect(slide.example?.text).toBe("A concrete scenario.");
    expect(slide.takeaways).toEqual(["Point one", "Point two"]);
  });

  it("accepts a recap-only slide with no example", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "recap", takeaways: ["Only point"] }));
    const slide = deck!.slides[0];
    if (slide.layout !== "recap") throw new Error("expected recap");
    expect(slide.example).toBeUndefined();
    expect(slide.takeaways).toEqual(["Only point"]);
  });

  it("defaults the example heading to undefined when omitted (renderer applies 'Case in Point')", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "recap", example: { text: "No heading given" }, takeaways: ["A"] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "recap") throw new Error("expected recap");
    expect(slide.example?.heading).toBeUndefined();
  });

  it("drops a malformed example (no text) but keeps the takeaways", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "recap", example: { heading: "No text" }, takeaways: ["A", "B"] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "recap") throw new Error("expected recap");
    expect(slide.example).toBeUndefined();
    expect(slide.takeaways).toEqual(["A", "B"]);
  });

  it("falls back to bullets when takeaways is empty", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "recap", title: "Fallback", takeaways: [] }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });
});

describe("normalizeDeck — glossary layout", () => {
  it("accepts valid term/definition pairs", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "glossary",
        title: "Key Terms",
        terms: [
          { term: "Globalization", definition: "Increasing interconnection across borders." },
          { term: "Hybrid Work", definition: "Blending in-person and virtual work." },
        ],
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("glossary");
    if (slide.layout !== "glossary") throw new Error("expected glossary");
    expect(slide.terms).toHaveLength(2);
    expect(slide.terms[0]).toEqual({ term: "Globalization", definition: "Increasing interconnection across borders." });
  });

  it("drops entries missing a term or definition individually", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "glossary",
        terms: [{ term: "Valid", definition: "Has both fields" }, { term: "Missing definition" }, { definition: "Missing term" }],
      })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "glossary") throw new Error("expected glossary");
    expect(slide.terms).toHaveLength(1);
  });

  it("falls back to bullets when every term is invalid", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "glossary", title: "Fallback", terms: [{ term: "No definition" }] }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });
});

describe("normalizeDeck — roadmap layout", () => {
  it("accepts valid steps with a currentIndex", () => {
    const deck = normalizeDeck(
      deckWithSlide({
        layout: "roadmap",
        title: "Where This Fits",
        steps: [
          { label: "Unit 1", description: "Foundations" },
          { label: "Unit 2", description: "Modern Workplace" },
          { label: "Unit 3", description: "This unit" },
        ],
        currentIndex: 2,
      })
    );
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("roadmap");
    if (slide.layout !== "roadmap") throw new Error("expected roadmap");
    expect(slide.steps).toHaveLength(3);
    expect(slide.currentIndex).toBe(2);
  });

  it("omits currentIndex when out of range", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "roadmap", steps: [{ label: "Only step" }], currentIndex: 5 })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "roadmap") throw new Error("expected roadmap");
    expect(slide.currentIndex).toBeUndefined();
  });

  it("omits currentIndex when not given", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "roadmap", steps: [{ label: "Step" }] }));
    const slide = deck!.slides[0];
    if (slide.layout !== "roadmap") throw new Error("expected roadmap");
    expect(slide.currentIndex).toBeUndefined();
  });

  it("drops invalid step entries individually", () => {
    const deck = normalizeDeck(
      deckWithSlide({ layout: "roadmap", steps: [{ label: "Valid" }, { description: "no label" }] })
    );
    const slide = deck!.slides[0];
    if (slide.layout !== "roadmap") throw new Error("expected roadmap");
    expect(slide.steps).toHaveLength(1);
  });

  it("falls back to bullets when every step is invalid", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "roadmap", title: "Fallback", steps: [{ description: "no label" }] }));
    const slide = deck!.slides[0];
    expect(slide.layout).toBe("bullets");
  });
});

describe("normalizeDeck — section layout eyebrow", () => {
  it("accepts an optional eyebrow", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "section", title: "Part Two", eyebrow: "3.1" }));
    const slide = deck!.slides[0];
    if (slide.layout !== "section") throw new Error("expected section");
    expect(slide.eyebrow).toBe("3.1");
  });

  it("omits eyebrow when not given", () => {
    const deck = normalizeDeck(deckWithSlide({ layout: "section", title: "Part Two" }));
    const slide = deck!.slides[0];
    if (slide.layout !== "section") throw new Error("expected section");
    expect(slide.eyebrow).toBeUndefined();
  });
});

describe("extractSlideDeck — truncation detection", () => {
  it("is not truncated when the fence closes normally", () => {
    const content =
      'Here you go.\n```slides\n{"title":"T","slides":[{"layout":"bullets","title":"One","bullets":["a"]}]}\n```';
    const result = extractSlideDeck(content);
    expect(result.deck).not.toBeNull();
    expect(result.truncated).toBe(false);
  });

  it("flags a deck recovered from an unclosed fence as truncated", () => {
    // No closing ``` — simulates the model getting cut off by the package's
    // token budget mid-deck; repairSlidesJson should still recover the two
    // fully-closed slide objects here.
    const content =
      'Here you go.\n```slides\n{"title":"T","slides":[' +
      '{"layout":"bullets","title":"One","bullets":["a"]},' +
      '{"layout":"bullets","title":"Two","bullets":["b"]},' +
      '{"layout":"bullets","title":"Thr'; // cut off mid-object, no closing fence
    const result = extractSlideDeck(content);
    expect(result.deck).not.toBeNull();
    expect(result.deck!.slides).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("is not truncated when there is no slides fence at all", () => {
    const result = extractSlideDeck("Just a normal reply, no deck here.");
    expect(result.deck).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it("is not truncated (deck null) when an unclosed fence has no recoverable slides", () => {
    const content = 'Here you go.\n```slides\n{"title":"T","sl';
    const result = extractSlideDeck(content);
    expect(result.deck).toBeNull();
    expect(result.truncated).toBe(false);
  });
});
