// The page settings of a Word or PDF document that are more than on or off: the margin round the page, the frame (style, thickness, colour,
// and how far it sits from the text) and the page numbers (where, and how they read). Everything here is plain data with no Node or browser
// code, so the editor can use the same numbers to draw its preview as the engines use to make the file.
// A document that sets none of them looks as it always has: normal margin, a thin grey solid frame with a medium gap, "Page 3 of 8" in the middle.

export const PAGE_MARGINS = ["narrow", "normal", "wide"] as const;
export const BORDER_STYLES = ["solid", "double", "dashed"] as const;
export const BORDER_WEIGHTS = ["thin", "medium", "thick"] as const;
export const BORDER_COLORS = ["grey", "black", "blue", "green", "red"] as const;
export const BORDER_GAPS = ["small", "medium", "large"] as const;
export const NUMBER_POSITIONS = ["left", "center", "right"] as const;
export const NUMBER_FORMATS = ["pageOf", "page", "number"] as const;

export type PageMargin = (typeof PAGE_MARGINS)[number];
export type BorderStyleName = (typeof BORDER_STYLES)[number];
export type BorderWeight = (typeof BORDER_WEIGHTS)[number];
export type BorderColor = (typeof BORDER_COLORS)[number];
export type BorderGap = (typeof BORDER_GAPS)[number];
export type NumberPosition = (typeof NUMBER_POSITIONS)[number];
export type NumberFormat = (typeof NUMBER_FORMATS)[number];

/** The document's own fields for these settings (all optional: a missing one means the default). */
export interface DocPageLayout {
  /** Space between the edge of the paper and the page (or its frame). */
  pageMargin?: PageMargin;
  borderStyle?: BorderStyleName;
  borderWeight?: BorderWeight;
  borderColor?: BorderColor;
  /** How far the frame sits from the text. */
  borderGap?: BorderGap;
  pageNumberPosition?: NumberPosition;
  pageNumberFormat?: NumberFormat;
}

/** The keys of `DocPageLayout`, for code that copies or checks them all. */
export const PAGE_LAYOUT_KEYS = ["pageMargin", "borderStyle", "borderWeight", "borderColor", "borderGap", "pageNumberPosition", "pageNumberFormat"] as const;

export const LAYOUT_OPTIONS = {
  pageMargin: PAGE_MARGINS,
  borderStyle: BORDER_STYLES,
  borderWeight: BORDER_WEIGHTS,
  borderColor: BORDER_COLORS,
  borderGap: BORDER_GAPS,
  pageNumberPosition: NUMBER_POSITIONS,
  pageNumberFormat: NUMBER_FORMATS,
} as const;

export const LAYOUT_DEFAULTS: Required<DocPageLayout> = {
  pageMargin: "normal",
  borderStyle: "solid",
  borderWeight: "medium",
  borderColor: "grey",
  borderGap: "medium",
  pageNumberPosition: "center",
  pageNumberFormat: "pageOf",
};

/** The words the editor shows for each choice. */
export const LAYOUT_LABELS = {
  pageMargin: { narrow: "Narrow", normal: "Normal", wide: "Wide" },
  borderStyle: { solid: "Solid", double: "Double", dashed: "Dashed" },
  borderWeight: { thin: "Thin", medium: "Medium", thick: "Thick" },
  borderColor: { grey: "Grey", black: "Black", blue: "Blue", green: "Green", red: "Red" },
  borderGap: { small: "Close to the text", medium: "Medium", large: "Far from the text" },
  pageNumberPosition: { left: "Left", center: "Centre", right: "Right" },
  pageNumberFormat: { pageOf: "Page 3 of 8", page: "Page 3", number: "3" },
} as const;

const COLOR_HEX: Record<BorderColor, string> = { grey: "bfbfbf", black: "1a1a1a", blue: "2563eb", green: "16a34a", red: "dc2626" };

const pick = <K extends keyof DocPageLayout>(l: DocPageLayout, key: K): NonNullable<DocPageLayout[K]> => (l[key] ?? LAYOUT_DEFAULTS[key]) as NonNullable<DocPageLayout[K]>;

/** The numbers the PDF is made with: points, and the CSS words. */
export function pdfPageMetrics(l: DocPageLayout) {
  const style = pick(l, "borderStyle");
  const weight = { thin: 0.5, medium: 1, thick: 2.5 }[pick(l, "borderWeight")];
  return {
    marginPt: { narrow: 36, normal: 50, wide: 72 }[pick(l, "pageMargin")],
    // A "double" line needs room to show two lines: three times as thick draws as two thin ones with a gap.
    borderWidthPt: style === "double" ? weight * 3 : weight,
    borderStyle: style,
    borderColor: `#${COLOR_HEX[pick(l, "borderColor")]}`,
    gapPt: { small: 8, medium: 18, large: 30 }[pick(l, "borderGap")],
    numberAlign: pick(l, "pageNumberPosition"),
    numberFormat: pick(l, "pageNumberFormat"),
  };
}

/** The numbers the Word file is made with: twips (a twentieth of a point), eighths of a point, hex colours without "#". */
export function docxPageMetrics(l: DocPageLayout) {
  const marginTwips = { narrow: 720, normal: 1440, wide: 1800 }[pick(l, "pageMargin")];
  return {
    marginTwips,
    borderStyle: pick(l, "borderStyle"),
    borderSize: { thin: 4, medium: 8, thick: 20 }[pick(l, "borderWeight")],
    borderColor: COLOR_HEX[pick(l, "borderColor")].toUpperCase(),
    // Word measures the frame from the edge of the paper and allows at most 31 pt: the closer to the text, the larger this is.
    borderFromEdgePt: { small: 31, medium: 24, large: 12 }[pick(l, "borderGap")],
    numberAlign: pick(l, "pageNumberPosition"),
    numberFormat: pick(l, "pageNumberFormat"),
  };
}

/**
 * What the editor's preview needs to draw a sheet like the printed page: the margins in pixels (96 per inch), and the page number's place and
 * words. The bottom margin is deeper when there are page numbers, as in the PDF, so the number sits below the frame.
 */
export function previewGeometry(l: DocPageLayout, pageNumbers: boolean) {
  const m = pdfPageMetrics(l);
  const top = (m.marginPt * 96) / 72;
  const bottom = (Math.max(m.marginPt, pageNumbers ? FOOTER_MIN_MARGIN_PT : 0) * 96) / 72;
  return { top, bottom, side: top, numberAlign: m.numberAlign, numberFormat: m.numberFormat, showNumbers: pageNumbers };
}

/** With page numbers the bottom margin is at least this, so the number has room below the text. */
export const FOOTER_MIN_MARGIN_PT = 60;

/** The page number as it reads on page `n` of `total`. */
export function pageNumberText(format: NumberFormat, n: number, total: number): string {
  return format === "number" ? String(n) : format === "page" ? `Page ${n}` : `Page ${n} of ${total}`;
}

/** The layout fields of anything that has them, checked: a value that is not one of the choices is left out. */
export function normalizeLayout(raw: unknown): DocPageLayout {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const key of PAGE_LAYOUT_KEYS) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "string" && (LAYOUT_OPTIONS[key] as readonly string[]).includes(v) && v !== LAYOUT_DEFAULTS[key]) out[key] = v;
    }
  }
  return out as DocPageLayout;
}
