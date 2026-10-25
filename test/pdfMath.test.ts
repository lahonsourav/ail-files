import { describe, it, expect } from "vitest";
import { renderTextWithMath, getInlinedKatexCss } from "../src/pdf/pdfMath.js";

describe("renderTextWithMath", () => {
  it("leaves plain text untouched (still escaped, no math)", () => {
    expect(renderTextWithMath("Hello world 123")).toBe("Hello world 123");
  });

  it("renders inline $...$ math as KaTeX HTML", () => {
    const html = renderTextWithMath("The formula is $E=mc^2$ indeed.");
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("$E=mc^2$");
    expect(html).toContain("The formula is ");
    expect(html).toContain(" indeed.");
  });

  it("renders display $$...$$ math in display mode", () => {
    const html = renderTextWithMath("$$E=mc^2$$");
    expect(html).toContain('class="katex-display"');
  });

  it("does not misfire on two unpaired currency dollar signs in the same string", () => {
    // The classic false-positive: a naive "first $ to next $" scan would
    // treat "5 price tag and " as math content between these two $ signs.
    const html = renderTextWithMath("a literal $5 price tag and $10 too");
    expect(html).not.toContain('class="katex"');
    expect(html).toContain("$5 price tag and $10 too");
  });

  it("still renders real math elsewhere in a string that also has a currency amount", () => {
    const html = renderTextWithMath("It costs $5 but note that $\\alpha \\approx 1$ separately.");
    expect(html).toContain("$5 but note that");
    expect(html).toContain('class="katex"');
  });

  it("treats a single unpaired $ as literal text", () => {
    const html = renderTextWithMath("Only one dollar sign: $5 here.");
    expect(html).not.toContain('class="katex"');
    expect(html).toContain("$5 here");
  });

  it("rejects a $ pair with whitespace right inside either delimiter", () => {
    const html = renderTextWithMath("Not math: $ 5 dollars $ literally.");
    expect(html).not.toContain('class="katex"');
  });

  it("still escapes HTML in the non-math portions of a string containing math", () => {
    const html = renderTextWithMath("<script>alert(1)</script> and $x^2$");
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('class="katex"');
  });

  it("degrades to escaped raw source instead of throwing on malformed math", () => {
    expect(() => renderTextWithMath("$\\left($")).not.toThrow();
  });

  it("handles a string with no dollar signs at all", () => {
    expect(renderTextWithMath("no math here")).toBe("no math here");
  });
});

describe("getInlinedKatexCss", () => {
  it("returns CSS with base64-embedded woff2 fonts, no external font URLs", () => {
    const css = getInlinedKatexCss();
    expect(css).toContain("data:font/woff2;base64,");
    expect(css).not.toContain("url(fonts/");
  });

  it("is memoized (same reference across calls)", () => {
    expect(getInlinedKatexCss()).toBe(getInlinedKatexCss());
  });
});
