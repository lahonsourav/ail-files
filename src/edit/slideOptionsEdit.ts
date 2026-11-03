import type { SlideContent, SlidePicture } from "../pptx/presentationBuilder.js";

// Small helpers for a slide's own look settings (SlideOptions in lib/presentationBuilder.ts), shared by the toolbar, the look panel and the form.

/** The keys these tools own; the slide's field form leaves them out. */
export const SLIDE_OPTION_KEYS = ["pictures", "backgroundImage", "background", "accent", "pageNumber", "logo", "fontPair", "textScale"] as const;
export type SlideOptionKey = (typeof SLIDE_OPTION_KEYS)[number];

export const TEXT_SIZES: [number, string][] = [
  [0.8, "Smaller"],
  [1.15, "Larger"],
  [1.3, "Largest"],
];

const asFields = (slide: SlideContent) => slide as unknown as Record<string, unknown>;

export function hasSlideOptions(slide: SlideContent): boolean {
  return SLIDE_OPTION_KEYS.some((k) => asFields(slide)[k] !== undefined);
}

/** The slide with one option set, or taken off when `value` is undefined. */
export function setSlideOption(slide: SlideContent, key: SlideOptionKey, value: unknown): SlideContent {
  const next = { ...asFields(slide) };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next as unknown as SlideContent;
}

/** The slide with every look setting taken off. */
export function resetSlideOptions(slide: SlideContent): SlideContent {
  const next = { ...asFields(slide) };
  for (const k of SLIDE_OPTION_KEYS) delete next[k];
  return next as unknown as SlideContent;
}

export function placedPictures(slide: SlideContent): SlidePicture[] {
  const list = asFields(slide).pictures;
  return Array.isArray(list) ? (list as SlidePicture[]) : [];
}

/** The slide with its placed pictures replaced (none left removes the field). */
export function setPlacedPictures(slide: SlideContent, pictures: SlidePicture[]): SlideContent {
  return setSlideOption(slide, "pictures", pictures.length > 0 ? pictures : undefined);
}

/** A readable text colour (white or near black) for a background hex: only the hint shown as a colour box's default. */
export function readableOn(background: string): string {
  const hex = /^[0-9a-fA-F]{6}$/.test(background) ? background : "FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "111827" : "FFFFFF";
}

/** The one colour all of a canvas slide's text shares, or undefined when it differs (or the slide has none to colour). */
export function sharedTextColor(slide: SlideContent): string | undefined {
  const els = ((slide as unknown as { elements?: unknown }).elements ?? []) as Record<string, unknown>[];
  const colors = els.filter((e) => e.type === "text").map((e) => (typeof e.color === "string" ? e.color : ""));
  return colors.length > 0 && colors.every((c) => c !== "" && c === colors[0]) ? colors[0] : undefined;
}

/** The slide with every text element given this colour (or, for undefined, back to its role's colour). Null when it is not a canvas slide with text. */
export function withAllTextColor(slide: SlideContent, color: string | undefined): SlideContent | null {
  const fields = slide as unknown as { layout?: string; elements?: unknown };
  if (fields.layout !== "canvas" || !Array.isArray(fields.elements) || !fields.elements.some((e) => (e as { type?: string })?.type === "text")) return null;
  const elements = (fields.elements as Record<string, unknown>[]).map((e) => {
    if (e.type !== "text") return e;
    const next = { ...e };
    if (color === undefined) delete next.color;
    else next.color = color;
    return next;
  });
  return { ...(slide as object), elements } as unknown as SlideContent;
}
