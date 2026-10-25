import { describe, it, expect } from "vitest";
import { computePieSlices, arcPath, renderBarChartSvg, renderPieChartSvg } from "../src/pdf/pdfDocCharts.js";

describe("computePieSlices", () => {
  it("sums slice angles to 360 degrees", () => {
    const slices = computePieSlices([
      { label: "A", value: 1 },
      { label: "B", value: 2 },
      { label: "C", value: 5 },
    ]);
    const total = slices.reduce((sum, s) => sum + s.angle, 0);
    expect(total).toBeCloseTo(360, 5);
  });

  it("gives a 50/50 split two slices of exactly 180 degrees each", () => {
    const slices = computePieSlices([
      { label: "A", value: 1 },
      { label: "B", value: 1 },
    ]);
    expect(slices[0].angle).toBeCloseTo(180, 5);
    expect(slices[1].angle).toBeCloseTo(180, 5);
    expect(slices[0].startAngle).toBe(0);
    expect(slices[1].startAngle).toBeCloseTo(180, 5);
  });

  it("computes percent per slice", () => {
    const slices = computePieSlices([
      { label: "A", value: 25 },
      { label: "B", value: 75 },
    ]);
    expect(slices[0].percent).toBeCloseTo(25, 5);
    expect(slices[1].percent).toBeCloseTo(75, 5);
  });
});

describe("arcPath", () => {
  it("uses largeArc=0 for a 180-degree half", () => {
    const path = arcPath(50, 50, 40, 0, 180);
    expect(path).toContain(" 0,1 ");
  });

  it("uses largeArc=1 for a slice greater than 180 degrees", () => {
    const path = arcPath(50, 50, 40, 0, 270);
    expect(path).toContain(" 1,1 ");
  });
});

describe("renderBarChartSvg", () => {
  it("scales the tallest bar to the fixed plot height", () => {
    const svg = renderBarChartSvg([
      { label: "Small", value: 1 },
      { label: "Tallest", value: 10 },
    ]);
    const heights = [...svg.matchAll(/height="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    expect(heights).toHaveLength(2);
    const maxPlotHeight = 220 - 24 - 28; // BAR_CHART_H - PAD_TOP - PAD_BOTTOM
    expect(Math.max(...heights)).toBeCloseTo(maxPlotHeight, 5);
    expect(heights[1]).toBeGreaterThan(heights[0]);
  });

  it("emits one <rect> per datum", () => {
    const svg = renderBarChartSvg([{ label: "A", value: 1 }, { label: "B", value: 2 }, { label: "C", value: 3 }]);
    expect((svg.match(/<rect/g) ?? []).length).toBe(3);
  });
});

describe("renderPieChartSvg", () => {
  it("renders a single <circle> (not <path>) for one 100% slice", () => {
    const svg = renderPieChartSvg([{ label: "All", value: 5 }]);
    expect(svg).toContain("<circle");
    expect(svg).not.toContain("<path");
  });

  it("renders one <path> per slice for multiple categories", () => {
    const svg = renderPieChartSvg([
      { label: "A", value: 1 },
      { label: "B", value: 1 },
      { label: "C", value: 1 },
    ]);
    expect((svg.match(/<path/g) ?? []).length).toBe(3);
  });
});
