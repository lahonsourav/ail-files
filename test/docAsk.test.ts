import { describe, expect, it } from "vitest";
import { documentAskSystem, documentAskUser, parseDocumentReply, parseSectionReply, sectionAskSystem, sectionAskUser, type DocContent } from "../src/edit.js";

const doc: DocContent = { title: "Report", logo: "left", sections: [{ heading: "Intro", paragraphs: ["Hello"] }, { heading: "End", bullets: ["x"] }] };

describe("prompts", () => {
  it("tell the model the format of the file type", () => {
    expect(sectionAskSystem("pdf")).toContain('"chart"');
    expect(sectionAskSystem("docx")).not.toContain('"chart"');
    expect(sectionAskSystem("docx")).toContain("no charts, callouts or columns");
    expect(documentAskSystem("pdf")).toContain('{"document":');
    expect(sectionAskSystem("pdf")).toContain('{"section":');
  });

  it("send the outline, the section and the request", () => {
    const user = sectionAskUser({ prompt: "make it shorter", section: doc.sections[0], doc, index: 0, images: [{ id: "img1", label: "Logo", width: 10, height: 10 }] });
    expect(user).toContain("section 1 of 2");
    expect(user).toContain("img1: Logo");
    expect(user).toContain("make it shorter");
    expect(documentAskUser({ prompt: "add a summary", doc, images: [] })).toContain("The user's pictures: none");
  });
});

describe("parseSectionReply", () => {
  it("reads the section from a fenced or bare reply", () => {
    expect(parseSectionReply('```json\n{"section":{"heading":"New","paragraphs":["a"]}}\n```', "pdf")).toEqual({ heading: "New", paragraphs: ["a"] });
    expect(parseSectionReply('Sure! {"heading":"Bare"}', "docx")).toEqual({ heading: "Bare" });
  });

  it("refuses a reply that is not a section", () => {
    expect(parseSectionReply("I cannot do that", "pdf")).toBeNull();
    expect(parseSectionReply("{not json", "pdf")).toBeNull();
    expect(parseSectionReply('{"document":{"title":"x","sections":[]}}', "pdf")).toBeNull();
    expect(parseSectionReply('{"title":"x","sections":[]}', "pdf")).toBeNull();
  });

  it("drops what a Word file cannot hold and pictures the person does not have", () => {
    const reply = '{"section":{"heading":"H","chart":{"type":"bar","data":[{"label":"a","value":1}]},"pictures":[{"image":"img1"},{"image":"img3"}]}}';
    expect(parseSectionReply(reply, "docx", ["img1"])).toEqual({ heading: "H", pictures: [{ image: "img1" }] });
    expect(parseSectionReply(reply, "pdf", [])?.pictures).toBeUndefined();
  });
});

describe("parseDocumentReply", () => {
  it("reads the document and keeps the logo setting", () => {
    const got = parseDocumentReply('{"document":{"title":"Report 2","sections":[{"heading":"Only"}]}}', "pdf", doc);
    expect(got?.title).toBe("Report 2");
    expect(got?.logo).toBe("left");
    expect(got?.sections).toEqual([{ heading: "Only" }]);
  });

  it("keeps the old title when the reply has none, and takes a bare document", () => {
    expect(parseDocumentReply('{"title":"","sections":[{"heading":"A"}]}', "docx", doc)?.title).toBe("Report");
    expect(parseDocumentReply('{"title":"T","sections":[{"heading":"A"}]}', "docx", doc)?.title).toBe("T");
  });

  it("refuses a reply that would empty the document, or is not one", () => {
    expect(parseDocumentReply('{"document":{"title":"T","sections":[]}}', "pdf", doc)).toBeNull();
    expect(parseDocumentReply('{"document":{"title":"T","sections":[{}]}}', "pdf", doc)).toBeNull();
    expect(parseDocumentReply("nope", "pdf", doc)).toBeNull();
    expect(parseDocumentReply('{"section":{"heading":"x"}}', "pdf", doc)).toBeNull();
    expect(parseDocumentReply('{"document":{"title":"T","sections":[]}}', "pdf", { title: "Empty", sections: [] })?.sections).toEqual([]);
  });
});
