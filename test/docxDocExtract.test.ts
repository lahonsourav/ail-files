import { describe, it, expect } from "vitest";
import { normalizeGeneralDocx } from "../src/docx/docxDocExtract.js";

describe("normalizeGeneralDocx — newPage", () => {
  it("passes through newPage:true on a section with real content", () => {
    const doc = normalizeGeneralDocx({
      title: "Doc",
      sections: [{ heading: "One" }, { heading: "Two", newPage: true }],
    });
    expect(doc?.sections?.[0].newPage).toBeUndefined();
    expect(doc?.sections?.[1].newPage).toBe(true);
  });

  it("drops newPage when it isn't literally true", () => {
    const doc = normalizeGeneralDocx({
      title: "Doc",
      sections: [{ heading: "One", newPage: "yes" }, { heading: "Two", newPage: false }],
    });
    expect(doc?.sections?.[0].newPage).toBeUndefined();
    expect(doc?.sections?.[1].newPage).toBeUndefined();
  });

  it("still drops a section with only newPage and no real content", () => {
    const doc = normalizeGeneralDocx({
      title: "Doc",
      sections: [{ newPage: true }, { heading: "Real section" }],
    });
    expect(doc?.sections?.length).toBe(1);
    expect(doc?.sections?.[0].heading).toBe("Real section");
  });
});
