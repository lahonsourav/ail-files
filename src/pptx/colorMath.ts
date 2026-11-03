// Colour maths shared by the PowerPoint builder and the editing code: hex <-> RGB/HSL, contrast, blending. Pure, so it also runs in a browser.

// ── Accent contrast safety ───────────────────────────────────────────────
// The model can pick any accent hex, including one with poor contrast
// against its chosen background (e.g. pale yellow on white). Since `accent`
// is used as text color (slide headings), not a filled panel, an illegible
// accent would make headings unreadable. Nudge lightness toward a minimum
// contrast ratio while preserving hue/saturation, so the color the model
// picked is used verbatim whenever it's already legible, and only adjusted
// (never swapped for a generic black/white) when it isn't.

export type RgbTuple = [number, number, number];

export function hexToRgbTuple(hex: string): RgbTuple {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance([r, g, b]: RgbTuple): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbToHsl([r, g, b]: RgbTuple): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RgbTuple {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

export function rgbToHex([r, g, b]: RgbTuple): string {
  return [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// Blends `mix` into `base` by `amount` (0 = base, 1 = mix) into one solid
// opaque hex. Used for table-cell tints instead of a translucent fill —
// pptxgenjs's table cells don't reliably honor `fill.transparency` the way
// shape/text fills do, so a "light tint" built that way can render as a
// full-opacity color in real PowerPoint. A precomputed solid blend has no
// such ambiguity.
export function blendHex(base: string, mix: string, amount: number): string {
  const [br, bg, bb] = hexToRgbTuple(base);
  const [mr, mg, mb] = hexToRgbTuple(mix);
  return rgbToHex([br + (mr - br) * amount, bg + (mg - bg) * amount, bb + (mb - bb) * amount]);
}

export const MIN_CONTRAST = 3.5;

export function ensureContrast(accentHex: string, backgroundHex: string, mode: "light" | "dark"): string {
  const bgLum = relativeLuminance(hexToRgbTuple(backgroundHex));
  let rgb = hexToRgbTuple(accentHex);
  if (contrastRatio(relativeLuminance(rgb), bgLum) >= MIN_CONTRAST) return accentHex.toUpperCase();

  const [h, s, initialL] = rgbToHsl(rgb);
  let l = initialL;
  const step = mode === "light" ? -0.05 : 0.05; // darken on a light background, lighten on a dark one
  for (let i = 0; i < 18 && l > 0.02 && l < 0.98; i++) {
    l += step;
    rgb = hslToRgb(h, s, l);
    if (contrastRatio(relativeLuminance(rgb), bgLum) >= MIN_CONTRAST) break;
  }
  return rgbToHex(rgb);
}

// White or near-black, whichever contrasts better against a given fill —
// used for text sitting directly on the accent color itself (the "section"
// layout's full-bleed background), since accent varies from a light custom
// color to a dark theme color like "minimal"'s near-black.
export function contrastingTextColor(fillHex: string): string {
  const fillLum = relativeLuminance(hexToRgbTuple(fillHex));
  return contrastRatio(fillLum, relativeLuminance(hexToRgbTuple("FFFFFF"))) >= contrastRatio(fillLum, relativeLuminance(hexToRgbTuple("111827")))
    ? "FFFFFF"
    : "111827";
}

