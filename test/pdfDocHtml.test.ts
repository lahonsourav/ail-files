import { describe, it, expect } from "vitest";
import { escapeHtml, renderGeneralPdfHtml } from "../src/pdf/pdfDocHtml.js";

describe("escapeHtml", () => {
  it("escapes all five reserved characters", () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Hello world 123")).toBe("Hello world 123");
  });
});

describe("renderGeneralPdfHtml", () => {
  it("escapes injected markup in every field, not just the title", () => {
    const html = renderGeneralPdfHtml({
      title: "<img src=x onerror=alert(1)>",
      subtitle: "<script>alert(2)</script>",
      sections: [
        {
          heading: "<b>heading</b>",
          paragraphs: ["<i>paragraph</i>"],
          bullets: ["<u>bullet</u>"],
          numbered: ["<s>numbered</s>"],
          table: { headers: ["<h>"], rows: [["<c>"]] },
        },
      ],
    });

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(2)");
    expect(html).not.toContain("<b>heading</b>");
    expect(html).not.toContain("<i>paragraph</i>");
    expect(html).not.toContain("<u>bullet</u>");
    expect(html).not.toContain("<s>numbered</s>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
  });

  it("renders one heading, paragraph, list item, and table row per input", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [
        {
          heading: "Section One",
          paragraphs: ["Para A", "Para B"],
          bullets: ["Bullet A"],
          numbered: ["Step A", "Step B"],
          table: { headers: ["Col A", "Col B"], rows: [["1", "2"], ["3", "4"]] },
        },
      ],
    });

    expect((html.match(/<h2>/g) ?? []).length).toBe(1);
    expect((html.match(/<p>/g) ?? []).length).toBe(2);
    expect((html.match(/<li>/g) ?? []).length).toBe(3); // 1 bullet + 2 numbered
    expect((html.match(/<tr>/g) ?? []).length).toBe(3); // 1 header row + 2 body rows
    expect(html).toContain("Section One");
    expect(html).toContain("Col A");
  });

  it("omits the subtitle and section elements entirely when absent", () => {
    const html = renderGeneralPdfHtml({ title: "Bare doc" });
    expect(html).not.toContain('class="subtitle"');
    expect(html).not.toContain("<section>");
  });

  it("only adds the has-border body class when opted in", () => {
    const withoutBorder = renderGeneralPdfHtml({ title: "Doc" });
    const withBorder = renderGeneralPdfHtml({ title: "Doc" }, { border: true });
    expect(withoutBorder).toContain("<body>");
    expect(withoutBorder).not.toContain('<body class="has-border">');
    expect(withBorder).toContain('<body class="has-border">');
  });

  it("forces a page break before a newPage section, but ignores newPage on the very first section", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [
        { heading: "One", newPage: true }, // first section: newPage has no effect
        { heading: "Two", newPage: true }, // forces a break
        { heading: "Three" }, // no break
      ],
    });
    expect((html.match(/class="page-break"/g) ?? []).length).toBe(1);
    expect(html).toContain('<section class="page-break"><h2>Two</h2></section>');
  });

  it("escapes injected markup in chart/callout/columns fields", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [
        {
          chart: { type: "bar", title: "<b>chart</b>", data: [{ label: "<i>cat</i>", value: 5 }] },
          callout: { kind: "warning", text: "<script>alert(3)</script>" },
          columns: {
            left: { heading: "<u>left</u>", paragraphs: ["<s>left para</s>"] },
            right: { heading: "<u>right</u>", bullets: ["<s>right bullet</s>"] },
          },
        },
      ],
    });

    expect(html).not.toContain("<b>chart</b>");
    expect(html).not.toContain("<i>cat</i>");
    expect(html).not.toContain("<script>alert(3)");
    expect(html).not.toContain("<u>left</u>");
    expect(html).not.toContain("<s>left para</s>");
    expect(html).not.toContain("<u>right</u>");
    expect(html).not.toContain("<s>right bullet</s>");
    expect(html).toContain("&lt;b&gt;chart&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;alert(3)&lt;/script&gt;");
  });

  it("renders a bar chart as one <rect> per datum", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [{ chart: { type: "bar", data: [{ label: "Q1", value: 10 }, { label: "Q2", value: 20 }, { label: "Q3", value: 15 }] } }],
    });
    expect((html.match(/<rect/g) ?? []).length).toBe(3);
  });

  it("renders a multi-slice pie chart as one <path> plus one legend <li> per datum", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [{ chart: { type: "pie", data: [{ label: "A", value: 1 }, { label: "B", value: 2 }, { label: "C", value: 3 }] } }],
    });
    expect((html.match(/<path/g) ?? []).length).toBe(3);
    expect((html.match(/class="chart-legend"/g) ?? []).length).toBe(1);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });

  it("renders a single 100% pie slice as a <circle>, not a <path>", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [{ chart: { type: "pie", data: [{ label: "All", value: 1 }] } }],
    });
    expect(html).toContain("<circle");
    expect(html).not.toContain("<path");
  });

  it("callout label matches kind, defaulting to Note", () => {
    const defaultHtml = renderGeneralPdfHtml({ title: "Doc", sections: [{ callout: { text: "hi" } }] });
    expect(defaultHtml).toContain('<p class="callout-label">Note</p>');
    const importantHtml = renderGeneralPdfHtml({ title: "Doc", sections: [{ callout: { kind: "important", text: "hi" } }] });
    expect(importantHtml).toContain('<p class="callout-label">Important</p>');
  });

  it("renders exactly two .col divs for columns, each with its own content", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [{ columns: { left: { heading: "Left side" }, right: { heading: "Right side" } } }],
    });
    expect((html.match(/class="col"/g) ?? []).length).toBe(2);
    expect(html).toContain("Left side");
    expect(html).toContain("Right side");
  });

  it("omits KaTeX's CSS entirely when the document has no math", () => {
    const html = renderGeneralPdfHtml({
      title: "Plain doc",
      sections: [{ paragraphs: ["Just prose, and a $5 price with no closing partner."] }],
    });
    expect(html).not.toContain("data:font/woff2");
    expect(html).not.toContain('class="katex');
  });

  it("includes KaTeX's inlined CSS only when a field actually renders math", () => {
    const html = renderGeneralPdfHtml({
      title: "Physics",
      sections: [{ paragraphs: ["The energy is $E=mc^2$."] }],
    });
    expect(html).toContain('class="katex"');
    expect(html).toContain("data:font/woff2;base64,");
  });

  it("renders math in the title, subtitle, table cells, callout text, and column text", () => {
    const html = renderGeneralPdfHtml({
      title: "Formula $x^2$",
      subtitle: "See $y^2$ too",
      sections: [
        {
          table: { headers: ["$a$"], rows: [["$b$"]] },
          callout: { text: "Note: $c^2$" },
          columns: { left: { paragraphs: ["$d^2$"] }, right: { bullets: ["$e^2$"] } },
        },
      ],
    });
    // One katex span per rendered expression: title, subtitle, table header,
    // table cell, callout, column-left, column-right = 7.
    expect((html.match(/class="katex"/g) ?? []).length).toBe(7);
  });

  it("does not render math inside chart data-point labels (SVG text can't host it)", () => {
    const html = renderGeneralPdfHtml({
      title: "Doc",
      sections: [{ chart: { type: "bar", title: "Chart of $x^2$", data: [{ label: "$y^2$", value: 5 }] } }],
    });
    // The title (an HTML <p>) gets math; the SVG label stays literal text.
    expect((html.match(/class="katex"/g) ?? []).length).toBe(1);
    expect(html).toContain("$y^2$");
  });
});
