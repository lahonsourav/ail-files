import { describe, it, expect } from "vitest";
import { LAYOUT_DEFAULTS, docxPageMetrics, normalizeLayout, pageNumberText, pdfPageMetrics, previewGeometry } from "../src/pdf/docPage.js";

describe("page metrics", () => {
  it("is the same page as before when nothing is set", () => {
    const m = pdfPageMetrics({});
    expect(m).toMatchObject({ marginPt: 50, borderWidthPt: 1, borderStyle: "solid", borderColor: "#bfbfbf", gapPt: 18, numberAlign: "center", numberFormat: "pageOf" });
    expect(docxPageMetrics({})).toMatchObject({ marginTwips: 1440, borderFromEdgePt: 24, numberAlign: "center", numberFormat: "pageOf" });
  });

  it("turns each choice into points for the PDF", () => {
    expect(pdfPageMetrics({ pageMargin: "wide" }).marginPt).toBe(72);
    expect(pdfPageMetrics({ pageMargin: "narrow" }).marginPt).toBe(36);
    expect(pdfPageMetrics({ borderWeight: "thick" }).borderWidthPt).toBe(2.5);
    expect(pdfPageMetrics({ borderGap: "small" }).gapPt).toBe(8);
    expect(pdfPageMetrics({ borderColor: "red" }).borderColor).toBe("#dc2626");
    // A double line is drawn three times as thick so both lines show.
    expect(pdfPageMetrics({ borderStyle: "double", borderWeight: "medium" }).borderWidthPt).toBe(3);
  });

  it("turns each choice into Word's units, with the frame never further from the edge than Word allows (31 pt)", () => {
    expect(docxPageMetrics({ pageMargin: "narrow" }).marginTwips).toBe(720);
    expect(docxPageMetrics({ borderColor: "blue", borderWeight: "thick" })).toMatchObject({ borderColor: "2563EB", borderSize: 20 });
    for (const gap of ["small", "medium", "large"] as const) expect(docxPageMetrics({ borderGap: gap }).borderFromEdgePt).toBeLessThanOrEqual(31);
    // Close to the text means close to the margin, so further from the edge.
    expect(docxPageMetrics({ borderGap: "small" }).borderFromEdgePt).toBeGreaterThan(docxPageMetrics({ borderGap: "large" }).borderFromEdgePt);
  });
});

describe("previewGeometry", () => {
  it("makes the bottom margin deeper with page numbers, like the PDF, never smaller than the side margin", () => {
    const withNumbers = previewGeometry({}, true);
    const without = previewGeometry({}, false);
    expect(without.bottom).toBe(without.top);
    expect(withNumbers.bottom).toBeGreaterThan(withNumbers.top);
    expect(previewGeometry({ pageMargin: "wide" }, true).bottom).toBe(previewGeometry({ pageMargin: "wide" }, true).top);
  });
});

describe("pageNumberText", () => {
  it("reads three ways", () => {
    expect(pageNumberText("pageOf", 3, 8)).toBe("Page 3 of 8");
    expect(pageNumberText("page", 3, 8)).toBe("Page 3");
    expect(pageNumberText("number", 3, 8)).toBe("3");
  });
});

describe("normalizeLayout", () => {
  it("keeps only real choices that differ from the default", () => {
    expect(normalizeLayout({ pageMargin: "wide", borderStyle: "dotted", borderColor: LAYOUT_DEFAULTS.borderColor, pageNumberFormat: "number", junk: 1 })).toEqual({ pageMargin: "wide", pageNumberFormat: "number" });
    expect(normalizeLayout(null)).toEqual({});
    expect(normalizeLayout({ pageMargin: 5 })).toEqual({});
  });
});
