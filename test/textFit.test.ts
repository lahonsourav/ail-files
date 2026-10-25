import { describe, it, expect } from "vitest";
import { estimateTextWidthEm, wrapLineCount, fitFontSize, FONT_AVG_WIDTH_EM, avgEmForFont } from "../src/pptx/textFit.js";

describe("avgEmForFont", () => {
  it("returns the exact table value for a known font", () => {
    expect(avgEmForFont("Georgia")).toBe(FONT_AVG_WIDTH_EM.Georgia);
  });

  it("falls back to a default for an unknown font", () => {
    expect(avgEmForFont("Comic Sans MS")).toBeGreaterThan(0);
  });
});

describe("estimateTextWidthEm", () => {
  it("scales with the average width parameter", () => {
    const narrow = estimateTextWidthEm("aaaa", 0.5);
    const wide = estimateTextWidthEm("aaaa", 1.0);
    expect(wide).toBeGreaterThan(narrow);
  });

  it("gives spaces less width than letters", () => {
    const avgEm = FONT_AVG_WIDTH_EM.Arial;
    expect(estimateTextWidthEm(" ", avgEm)).toBeLessThan(estimateTextWidthEm("a", avgEm));
  });
});

describe("wrapLineCount", () => {
  it("returns 1 line for short text in a wide box", () => {
    expect(wrapLineCount("Short title", 8, FONT_AVG_WIDTH_EM.Calibri, 24)).toBe(1);
  });

  it("wraps to more lines as the box narrows", () => {
    const text = "This is a considerably longer sentence that should wrap across several lines.";
    const wide = wrapLineCount(text, 8, FONT_AVG_WIDTH_EM.Arial, 16);
    const narrow = wrapLineCount(text, 1.5, FONT_AVG_WIDTH_EM.Arial, 16);
    expect(narrow).toBeGreaterThan(wide);
  });

  it("treats empty/whitespace-only text as a single line", () => {
    expect(wrapLineCount("   ", 5, FONT_AVG_WIDTH_EM.Arial, 16)).toBe(1);
  });
});

describe("fitFontSize", () => {
  it("keeps the start size unchanged when text comfortably fits", () => {
    const size = fitFontSize("Hi", 9, 5, { avgEm: FONT_AVG_WIDTH_EM.Calibri, startSize: 16 });
    expect(size).toBe(16);
  });

  it("shrinks long text in a small box, but never below the minimum", () => {
    const longText = "A very long piece of text that will never fit inside a tiny box no matter what font size is used here.";
    const size = fitFontSize(longText, 1, 0.4, { avgEm: FONT_AVG_WIDTH_EM.Arial, startSize: 36, minSize: 8 });
    expect(size).toBeLessThan(36);
    expect(size).toBeGreaterThanOrEqual(8);
  });

  it("shrinks proportionally less when given more room", () => {
    const text = "A moderately long line of text for a stat card label.";
    const tight = fitFontSize(text, 2, 0.3, { avgEm: FONT_AVG_WIDTH_EM.Arial, startSize: 24 });
    const roomy = fitFontSize(text, 2, 1.5, { avgEm: FONT_AVG_WIDTH_EM.Arial, startSize: 24 });
    expect(roomy).toBeGreaterThanOrEqual(tight);
  });
});
