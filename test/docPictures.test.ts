import { describe, expect, it } from "vitest";
import { renderGeneralPdfHtml } from "../src/pdf/pdfDocHtml.js";
import { buildGeneralDocx } from "../src/docx/docxDocBuilder.js";
import { fitPicture, parsePictureDataUrl, safePictureSrc } from "../src/pdf/docPictures.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const pictures = { img1: { dataUrl: PNG, width: 1, height: 1 }, logo: { dataUrl: PNG, width: 1, height: 1 } };

describe("document pictures", () => {
  it("accepts only picture data URLs", () => {
    expect(parsePictureDataUrl(PNG)?.type).toBe("png");
    expect(parsePictureDataUrl("data:image/jpeg;base64,AAAA")?.type).toBe("jpg");
    expect(parsePictureDataUrl("data:image/svg+xml;base64,AAAA")).toBeNull();
    expect(parsePictureDataUrl("https://example.com/a.png")).toBeNull();
    expect(safePictureSrc('data:image/png;base64,AAAA" onerror="x')).toBeNull();
    expect(safePictureSrc(undefined)).toBeNull();
  });

  it("fits a picture into the column without stretching it or passing the maximum height", () => {
    expect(fitPicture(1000, 500, 600, 0.5, 640)).toEqual({ width: 300, height: 150 });
    expect(fitPicture(100, 100, 600, 1, 640).width).toBeLessThanOrEqual(300); // a small picture is not blown up past 3 times
    const tall = fitPicture(100, 1000, 600, 1, 400);
    expect(tall.height).toBe(400);
    expect(tall.width).toBe(40);
  });
});

describe("PDF html with pictures", () => {
  const doc = { title: "T", logo: "right" as const, sections: [{ heading: "H", paragraphs: ["p"], pictures: [{ image: "img1", caption: "A <b>cap</b>", size: "small" as const }, { image: "img2" }] }] };

  it("draws the logo, the pictures that are there and their captions, escaped", () => {
    const html = renderGeneralPdfHtml(doc, { pictures });
    expect(html).toContain('class="doc-logo" style="text-align:right"');
    expect(html).toContain('class="pic pic-small"');
    expect(html).toContain("A &lt;b&gt;cap&lt;/b&gt;");
    expect(html.match(/<figure/g)).toHaveLength(1); // img2 is not here: left out
    expect(html.indexOf("doc-logo")).toBeLessThan(html.indexOf('<h1 class="title">'));
  });

  it("draws nothing for pictures when none are given, and never a link", () => {
    expect(renderGeneralPdfHtml(doc)).not.toContain("<figure");
    const bad = renderGeneralPdfHtml(doc, { pictures: { img1: { dataUrl: "https://evil.example/x.png", width: 1, height: 1 } } });
    expect(bad).not.toContain("evil.example");
  });
});

describe("Word document with pictures", () => {
  it("puts the pictures and the logo in the file", async () => {
    const buf = await buildGeneralDocx({ title: "T", logo: "center", sections: [{ heading: "H", pictures: [{ image: "img1", caption: "Cap" }] }] }, { pictures });
    expect(buf.includes(Buffer.from("word/media/"))).toBe(true);
  });

  it("leaves a picture out when it is not there or is a kind Word cannot hold", async () => {
    const without = await buildGeneralDocx({ title: "T", sections: [{ heading: "H", pictures: [{ image: "img9" }] }] }, { pictures });
    expect(without.includes(Buffer.from("word/media/"))).toBe(false);
    const webp = await buildGeneralDocx({ title: "T", sections: [{ pictures: [{ image: "img1" }] }] }, { pictures: { img1: { dataUrl: "data:image/webp;base64,AAAA", width: 1, height: 1 } } });
    expect(webp.includes(Buffer.from("word/media/"))).toBe(false);
  });
});

describe("anchors", () => {
  it("tags sections with their number only when asked", () => {
    const doc = { title: "T", sections: [{ heading: "A" }, { heading: "B", newPage: true }] };
    expect(renderGeneralPdfHtml(doc)).not.toContain("data-s=");
    const html = renderGeneralPdfHtml(doc, { anchors: true });
    expect(html).toContain('<section data-s="0">');
    expect(html).toContain('<section data-s="1" class="page-break">');
  });
});

describe("anchored sections", () => {
  it("uses the section's own number when it has one", () => {
    const html = renderGeneralPdfHtml({ title: "T", sections: [{ heading: "A", anchor: 0 }, { heading: "C", anchor: 5 }] }, { anchors: true });
    expect(html).toContain('<section data-s="5">');
    expect(html).not.toContain('data-s="1"');
  });
});
