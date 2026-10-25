import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeDeck } from "../src/pptx/slideDeck.js";
import { normalizeGeneralPdf } from "../src/pdf/pdfDocExtract.js";
import { normalizeGeneralDocx } from "../src/docx/docxDocExtract.js";
import { normalizeGeneralExcel } from "../src/xlsx/excelExtract.js";
import { registerCommunityLayouts } from "../src/layouts/index.js";

// The README shows these files, so they must keep working: every slide has to
// come out as the layout it asks for, not fall back to plain bullets.

const read = (name: string) => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"));

describe("examples/", () => {
  it("deck.json keeps every slide's layout", () => {
    registerCommunityLayouts();
    const json = read("deck.json");
    const deck = normalizeDeck(json);
    expect(deck?.slides).toHaveLength(json.slides.length);
    deck!.slides.forEach((slide, i) => {
      const asked = json.slides[i].layout ?? "bullets";
      const got = slide.layout === "custom" ? slide.custom : slide.layout;
      expect(got, `slide ${i + 1}`).toBe(asked);
    });
  });

  it("report.json is a valid PDF and Word document", () => {
    const json = read("report.json");
    expect(normalizeGeneralPdf(json)?.sections?.length).toBe(json.sections.length);
    expect(normalizeGeneralDocx(json)).not.toBeNull();
  });

  it("budget.json is a valid workbook", () => {
    expect(normalizeGeneralExcel(read("budget.json"))?.sheets?.length).toBe(1);
  });
});
