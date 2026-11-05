import { describe, expect, it } from "vitest";
import { describeChange } from "../src/edit.js";

describe("describing a slide change in words", () => {
  const before = { layout: "bullets", title: "Agenda", bullets: ["a", "b"], background: "FFFFFF" };

  it("names what changed", () => {
    expect(describeChange(before, { ...before, title: "Plan" })).toBe("Done. I changed the title.");
    expect(describeChange(before, { ...before, title: "Plan", bullets: ["a"] })).toBe("Done. I changed the title and the text.");
    expect(describeChange(before, { ...before, layout: "grid", background: "000000" })).toBe("Done. I changed the layout and how it looks.");
  });

  it("lists at most three things", () => {
    const after = { ...before, layout: "grid", title: "Plan", bullets: [], background: "000000", pictures: [{ image: "img1" }] };
    expect(describeChange(before, after)).toBe("Done. I changed the layout, the title and the text.");
  });

  it("says so when nothing changed, and copes with odd input", () => {
    expect(describeChange(before, { ...before })).toBe("I didn't change anything on this slide.");
    expect(describeChange(null, undefined)).toBe("I didn't change anything on this slide.");
  });
});
