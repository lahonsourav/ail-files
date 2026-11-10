import { describe, expect, it } from "vitest";
import {
  addSection, blankDoc, cleanForExport, deleteSection, describeDocChange, describeSectionChange, docOutline, duplicateSection, mergeDocs,
  moveSection, newSection, normalizeDoc, sectionLabel, sectionSummary, sectionTemplates, updateSection, MAX_SECTIONS, type DocContent,
} from "../src/edit.js";

const doc: DocContent = {
  title: "Report",
  subtitle: "Q3",
  sections: [
    { heading: "Intro", paragraphs: ["Hello"] },
    { heading: "Numbers", table: { headers: ["A", "B"], rows: [["1", "2"]] } },
    { heading: "End", bullets: ["x"] },
  ],
};

describe("normalizeDoc", () => {
  it("needs a title string and keeps what was typed, empty parts included", () => {
    expect(normalizeDoc(null, "pdf")).toBeNull();
    expect(normalizeDoc({ sections: [] }, "pdf")).toBeNull();
    const d = normalizeDoc({ title: "", sections: [{}, { heading: "", paragraphs: ["", "a"] }] }, "pdf");
    expect(d?.title).toBe("");
    expect(d?.sections).toEqual([{}, { heading: "", paragraphs: ["", "a"] }]);
  });

  it("drops what a Word document cannot hold, and keeps it for a PDF", () => {
    const raw = { title: "T", sections: [{ heading: "H", chart: { type: "bar", data: [{ label: "a", value: 1 }] }, callout: { text: "c" }, columns: { left: {}, right: {} } }] };
    expect(normalizeDoc(raw, "docx")?.sections[0]).toEqual({ heading: "H" });
    const pdf = normalizeDoc(raw, "pdf")?.sections[0];
    expect(pdf?.chart?.data).toEqual([{ label: "a", value: 1 }]);
    expect(pdf?.callout).toEqual({ text: "c" });
    expect(pdf?.columns).toEqual({ left: {}, right: {} });
  });

  it("makes tables rectangular, coerces numbers and limits sizes", () => {
    const d = normalizeDoc({ title: "T", sections: [{ table: { headers: ["a", "b"], rows: [["1"], [1, 2, 3]] } }] }, "pdf");
    expect(d?.sections[0].table).toEqual({ headers: ["a", "b"], rows: [["1", ""], ["1", "2"]] });
    const many = normalizeDoc({ title: "T", sections: Array.from({ length: MAX_SECTIONS + 10 }, () => ({ heading: "x" })) }, "pdf");
    expect(many?.sections).toHaveLength(MAX_SECTIONS);
  });

  it("keeps only valid picture ids, a valid size and a valid logo place", () => {
    const d = normalizeDoc({ title: "T", logo: "right", sections: [{ pictures: [{ image: "img2", size: "large", caption: "c" }, { image: "evil.png" }, { image: "" }] }] }, "docx");
    expect(d?.logo).toBe("right");
    expect(d?.sections[0].pictures).toEqual([{ image: "img2", caption: "c", size: "large" }, { image: "" }, { image: "" }]);
    expect(normalizeDoc({ title: "T", logo: "up", sections: [] }, "pdf")?.logo).toBeUndefined();
  });
});

describe("cleanForExport", () => {
  it("takes the empty parts out and drops sections with nothing left", () => {
    const messy: DocContent = {
      title: "  ",
      sections: [
        { heading: " ", paragraphs: ["", "  "] },
        { heading: "Keep", paragraphs: ["a", ""], bullets: [""], table: { headers: ["", ""], rows: [["", ""], ["x", ""]] }, newPage: true },
        { callout: { kind: "note", text: " " } },
      ],
    };
    const out = cleanForExport(messy, "pdf");
    expect(out.title).toBe("Untitled document");
    expect(out.sections).toEqual([{ heading: "Keep", paragraphs: ["a"], table: { rows: [["x", ""]] }, newPage: true }]);
  });

  it("leaves off pictures the person does not have, and what a Word file cannot hold", () => {
    const d: DocContent = { title: "T", sections: [{ heading: "H", pictures: [{ image: "img1" }, { image: "img2" }, { image: "" }], chart: { type: "pie", data: [{ label: "a", value: 1 }] }, callout: { text: "c" } }] };
    expect(cleanForExport(d, "pdf", new Set(["img1"])).sections[0].pictures).toEqual([{ image: "img1" }]);
    const word = cleanForExport(d, "docx").sections[0];
    expect(word.chart).toBeUndefined();
    expect(word.callout).toBeUndefined();
  });

  it("needs both columns to have something", () => {
    const one: DocContent = { title: "T", sections: [{ heading: "H", columns: { left: { paragraphs: ["a"] }, right: {} } }] };
    expect(cleanForExport(one, "pdf").sections[0].columns).toBeUndefined();
  });
});

describe("sections", () => {
  it("adds, copies, moves and deletes without touching the original", () => {
    const added = addSection(doc, { heading: "New" }, 1);
    expect(added.sections.map((s) => s.heading)).toEqual(["Intro", "New", "Numbers", "End"]);
    expect(doc.sections).toHaveLength(3);
    expect(duplicateSection(doc, 0).sections.map((s) => s.heading)).toEqual(["Intro", "Intro", "Numbers", "End"]);
    expect(moveSection(doc, 0, 2).sections.map((s) => s.heading)).toEqual(["Numbers", "End", "Intro"]);
    expect(deleteSection(doc, 1).sections.map((s) => s.heading)).toEqual(["Intro", "End"]);
    expect(deleteSection(doc, 9)).toBe(doc);
    expect(deleteSection(deleteSection(deleteSection(doc, 0), 0), 0).sections).toEqual([]);
    expect(updateSection(doc, 0, { heading: "X" }).sections[0].heading).toBe("X");
  });

  it("stops adding at the limit", () => {
    const full: DocContent = { title: "T", sections: Array.from({ length: MAX_SECTIONS }, () => ({})) };
    expect(addSection(full, {})).toBe(full);
  });

  it("offers charts, callouts and columns only in a PDF", () => {
    const pdf = sectionTemplates("pdf").map(([k]) => k);
    const word = sectionTemplates("docx").map(([k]) => k);
    expect(pdf).toEqual(expect.arrayContaining(["text", "table", "picture", "chart", "callout", "columns"]));
    expect(word).toEqual(["text", "bullets", "numbered", "table", "picture"]);
    expect(newSection("chart", "docx")).toBeNull();
    expect(newSection("nope", "pdf")).toBeNull();
    expect(newSection("table", "docx")?.table?.rows).toHaveLength(2);
  });

  it("starts every template as something the editor can hold", () => {
    for (const kind of ["pdf", "docx"] as const) {
      for (const [key] of sectionTemplates(kind)) {
        const s = newSection(key, kind)!;
        expect(normalizeDoc({ title: "T", sections: [s] }, kind)?.sections[0]).toEqual(s);
      }
    }
  });

  it("labels and summarises a section", () => {
    expect(sectionLabel({ heading: "Intro" })).toBe("Intro");
    expect(sectionLabel({ paragraphs: ["A fairly long first paragraph that goes on and on and on"] })).toMatch(/…$/);
    expect(sectionLabel({ table: { rows: [["a"]] } })).toBe("Table");
    expect(sectionLabel({})).toBe("Empty section");
    expect(sectionSummary({ paragraphs: ["a", "b"], table: { rows: [] } })).toBe("2 paragraphs, a table");
    expect(sectionSummary({ bullets: ["a"] })).toBe("1 bullet");
  });

  it("starts a blank document with only a title", () => {
    expect(blankDoc("Notes")).toEqual({ title: "Notes", sections: [] });
  });
});

describe("describing a change aloud", () => {
  it("names what changed in a section, at most three things", () => {
    expect(describeSectionChange({ heading: "A" }, { heading: "B" })).toBe("Done. I changed the heading.");
    expect(describeSectionChange({ heading: "A", bullets: ["x"] }, { heading: "B", bullets: ["y"], paragraphs: ["p"] })).toBe("Done. I changed the heading, the text and the bullets.");
    expect(describeSectionChange({ heading: "A" }, { heading: "A" })).toBe("I didn't change anything in this section.");
  });

  it("describes a whole-document change", () => {
    expect(describeDocChange(doc, { ...doc, title: "New" })).toBe("Done. I changed the title.");
    expect(describeDocChange(doc, addSection(doc, {}))).toBe("Done. I changed one new section.");
    expect(describeDocChange(doc, deleteSection(doc, 0))).toBe("Done. I changed one section removed.");
    expect(describeDocChange(doc, updateSection(doc, 0, { heading: "Z" }))).toBe("Done. I changed one section.");
    expect(describeDocChange(doc, doc)).toBe("I didn't change anything in the document.");
  });

  it("outlines a document for a model", () => {
    const out = docOutline(doc);
    expect(out).toContain("Title: Report");
    expect(out).toContain("1. Intro (1 paragraph)");
    expect(out).toContain("2. Numbers (a table)");
  });
});

describe("mergeDocs", () => {
  it("keeps both sides' changes when they touched different sections", () => {
    const mine = updateSection(doc, 0, { heading: "Mine" });
    const theirs = updateSection(doc, 2, { heading: "Theirs" });
    const merged = mergeDocs(doc, mine, theirs);
    expect(merged?.sections.map((s) => s.heading)).toEqual(["Mine", "Numbers", "Theirs"]);
  });

  it("merges the title from one side and a section from the other", () => {
    const merged = mergeDocs(doc, { ...doc, title: "Mine" }, updateSection(doc, 1, { heading: "Theirs" }));
    expect(merged?.title).toBe("Mine");
    expect(merged?.sections[1].heading).toBe("Theirs");
  });

  it("is a conflict when both changed the same part differently, or both changed the list of sections", () => {
    expect(mergeDocs(doc, updateSection(doc, 0, { heading: "A" }), updateSection(doc, 0, { heading: "B" }))).toBeNull();
    expect(mergeDocs(doc, { ...doc, title: "A" }, { ...doc, title: "B" })).toBeNull();
    expect(mergeDocs(doc, addSection(doc, {}), updateSection(deleteSection(doc, 1), 0, { heading: "Z" }))).toBeNull();
  });

  it("takes the other side's list when only one side changed it", () => {
    const merged = mergeDocs(doc, doc, addSection(doc, { heading: "Added" }));
    expect(merged?.sections).toHaveLength(4);
  });
});

describe("page settings", () => {
  it("keeps page numbers off and the border on, and leaves the defaults out", () => {
    const d = normalizeDoc({ title: "T", pageNumbers: false, border: true, sections: [] }, "pdf");
    expect(d).toEqual({ title: "T", pageNumbers: false, border: true, sections: [] });
    expect(normalizeDoc({ title: "T", pageNumbers: true, border: false, sections: [] }, "pdf")).toEqual({ title: "T", sections: [] });
    expect(cleanForExport(d!, "pdf").border).toBe(true);
    expect(cleanForExport(d!, "pdf").pageNumbers).toBe(false);
  });
});

describe("anchors", () => {
  it("keeps each section's own number when empty ones before it are left out", () => {
    const d: DocContent = { title: "T", sections: [{ heading: "A" }, {}, { heading: "C" }] };
    expect(cleanForExport(d, "pdf", undefined, { anchors: true }).sections.map((s) => s.anchor)).toEqual([0, 2]);
    expect(cleanForExport(d, "pdf").sections.map((s) => s.anchor)).toEqual([undefined, undefined]);
  });
});
