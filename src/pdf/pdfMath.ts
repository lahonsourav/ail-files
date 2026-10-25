import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import katex from "katex";

// Server-side math rendering for the PDF Maker's general-document schema
// (lib/pdfDocBuilder.ts) — the same KaTeX already used client-side for chat
// math (app/components/MarkdownWithMath.tsx), but called directly via
// katex.renderToString() rather than through the remark/rehype markdown
// pipeline, since this schema's text fields are plain strings with $...$/
// $$...$$ math, not full markdown.

const require = createRequire(import.meta.url);

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Matches $$...$$ (display) before $...$ (inline) so a display block isn't
// mis-split into two empty inline matches at its own outer $ pair.
//
// The inline alternative applies the same dollar-delimiter heuristic Pandoc
// (and this app's own chat-side remark-math) uses, rather than a naive
// "first $ to next $": the opening $ can't be followed by whitespace, the
// closing $ can't be preceded by whitespace, and the closing $ can't be
// immediately followed by a digit. That last guard is the one that matters
// here — this schema's own doc comment calls out "simple invoice-style
// sheets" as a use case, and without it a sentence like "a $5 price tag and
// $10 too" would have its first $ pair with the $ before "10" and render
// "5 price tag and " as a garbled math expression instead of leaving two
// ordinary currency amounts alone. Also excludes newlines, so one stray,
// unpaired $ can't swallow the rest of a multi-line field looking for a
// closing partner.
const MATH_RE = /\$\$([\s\S]+?)\$\$|\$(?!\s)([^\n$]+?)(?<!\s)\$(?!\d)/g;

// Renders any $...$/$$...$$ math in `text` to KaTeX HTML, escaping
// everything else exactly as escapeHtml() already did — a drop-in
// replacement for a bare escapeHtml() call on any prose field in the PDF
// schema (paragraphs, bullets, numbered items, callout text, table cells,
// column text, title/subtitle/headings). Not used for chart data-point
// labels — those render inside an SVG <text> node (lib/pdfDocCharts.ts),
// which can't host KaTeX's HTML output, so they stay plain-escaped.
export function renderTextWithMath(text: string): string {
  let out = "";
  let lastIndex = 0;
  MATH_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MATH_RE.exec(text)) !== null) {
    out += escapeHtml(text.slice(lastIndex, match.index));
    const displayLatex = match[1];
    const inlineLatex = match[2];
    try {
      out += katex.renderToString(displayLatex ?? inlineLatex ?? "", {
        throwOnError: false,
        strict: false,
        displayMode: displayLatex !== undefined,
      });
    } catch {
      // throwOnError:false already covers most bad input, but a genuinely
      // malformed expression can still throw during parsing before that
      // option applies — fall back to the raw (escaped) source rather than
      // dropping the content or failing the whole document.
      out += escapeHtml(match[0]);
    }
    lastIndex = MATH_RE.lastIndex;
  }
  out += escapeHtml(text.slice(lastIndex));
  return out;
}

// lib/htmlToPdf.ts loads this HTML with javaScriptEnabled:false and blocks
// every non-document network request (the content originates from an LLM),
// so KaTeX's normal stylesheet <link>/@font-face network fetches would just
// be dropped and formulas would render as unstyled soup. Inlining instead
// keeps the page exactly as self-contained as it already was: read KaTeX's
// own CSS once, keep only the woff2 source per @font-face (the ttf/woff
// fallbacks are dead weight — this always runs in the one Chromium build we
// bundle, which fully supports woff2) and base64-embed each font file
// directly into the rule. Computed once per process and cached, since the
// installed katex version's CSS/fonts never change at runtime.
//
// Deliberately locates each font file with plain path.join() + readFileSync,
// never require()/require.resolve() on the font path itself: a bundler
// resolves require.resolve("katex/dist/fonts/${file}") — file only known at
// runtime — by conservatively treating the whole fonts/ directory as a
// "could be required" context module, and since raw .ttf/.woff files have
// no registered loader for a plain require, that fails the production build
// (and, since it needs a module type for the same files, corrupts the
// separate, already-working client-side font loading through katex's own
// CSS import in app/components/MarkdownWithMath.tsx along with it). The one
// require.resolve() call below is a static, literal string — that one's
// safe, since a bundler can resolve it to exactly one file without needing
// to enumerate a whole directory.
let inlinedCssCache: string | null = null;

function inlineKatexFonts(css: string, fontsDir: string): string {
  return css.replace(/src:url\(fonts\/([\w.-]+\.woff2)\)[^;]*;/g, (_match, file: string) => {
    const data = readFileSync(join(fontsDir, file)).toString("base64");
    return `src:url(data:font/woff2;base64,${data}) format("woff2");`;
  });
}

export function getInlinedKatexCss(): string {
  if (inlinedCssCache === null) {
    const cssPath = require.resolve("katex/dist/katex.min.css");
    const fontsDir = join(dirname(cssPath), "fonts");
    inlinedCssCache = inlineKatexFonts(readFileSync(cssPath, "utf8"), fontsDir);
  }
  return inlinedCssCache;
}
