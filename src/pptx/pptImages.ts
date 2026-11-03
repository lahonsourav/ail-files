// The person's own pictures in a deck. They are added in the PPT settings (kept in that
// browser), the model is told they exist and places them on slides by id, and the picture
// itself is only sent when the deck is downloaded. Pure checks and helpers with no Node or
// browser APIs, shared by the settings panel, the chat route, the export route and the builder.

export const IMAGE_LIMITS = {
  maxImages: 6, // per conversation
  maxBytes: 2_000_000, // one image sent for export, decoded
  maxSidePx: 1600, // the server shrinks anything bigger than this
  labelChars: 40,
  descriptionChars: 120,
  previewBytes: 150_000, // one preview shown to the model, decoded
  previewSidePx: 512,
} as const;

// Letting Ail look at the pictures puts an image in the model's input on every message. Sparks are charged
// on output, so this is a flat extra per picture shown, like the "remember relevant" memory surcharge
// (RELEVANT_MEMORY_SPARKS): each picture shown adds this to that reply's cost.
export const PICTURE_PREVIEW_SPARKS = 50;
export function previewSparks(pictureCount: number): number {
  return Math.max(0, Math.floor(pictureCount)) * PICTURE_PREVIEW_SPARKS;
}

// How a deck uses pictures: "use" places the pictures the user added (none added means no picture slides,
// the default), "placeholders" also leaves empty labelled picture boxes to fill in PowerPoint later, and
// "none" means no picture slides or boxes at all, whatever has been added.
export const PICTURE_MODES = ["use", "placeholders", "none"] as const;
export type PictureMode = (typeof PICTURE_MODES)[number];
export const DEFAULT_PICTURE_MODE: PictureMode = "use";
export function parsePictureMode(value: unknown): PictureMode {
  return (PICTURE_MODES as readonly string[]).includes(value as string) ? (value as PictureMode) : DEFAULT_PICTURE_MODE;
}

/** What a placeholder box says (the model writes it, so it gets the same cleaning as a description). */
export function cleanPlaceholderText(value: unknown): string {
  return cleanImageDescription(value).slice(0, 60);
}

/** A picture as the builder draws it: "image/jpeg;base64,..." or "image/png;base64,...", with its pixel size. */
export interface PptImage {
  data: string;
  width: number;
  height: number;
  /** The name the user gave the picture. Shown as its caption on a slide when the slide doesn't have one of its own. */
  label?: string;
}

/** What the model is told about a picture: never the picture itself. */
export interface PptImageRef {
  id: string;
  label: string;
  /** One line on what the picture shows, written when it was added (and editable), so the model can match it to a slide. */
  description?: string;
  /** Attached to the user's latest message too (added from the chat's normal attach button), so the model can see it in that message. */
  attached?: boolean;
  /** The user chose this picture as the background of the whole deck (at most one). */
  background?: boolean;
  width: number;
  height: number;
}

// ids are img1, img2, ... so the model can't be handed (or invent) anything that looks like a path or a URL.
const IMAGE_ID = /^img[1-9][0-9]?$/;
export function isImageId(value: unknown): value is string {
  return typeof value === "string" && IMAGE_ID.test(value);
}

/** The label goes into the model's instructions, so keep it to plain words. */
export function cleanImageLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\.[A-Za-z0-9]{2,5}$/, "")
    .replace(/[^\p{L}\p{N} _.,'()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, IMAGE_LIMITS.labelChars);
}

/** A description (what a picture shows) goes into the model's instructions too, so it gets the same cleaning, a little longer. */
export function cleanImageDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[^\p{L}\p{N} _.,'()%&:;/+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, IMAGE_LIMITS.descriptionChars);
}

/** The picture list from a chat request, or [] when there is none or it is malformed. */
export function parseImageHints(raw: unknown): PptImageRef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PptImageRef[] = [];
  let backgroundTaken = false;
  for (const item of raw) {
    if (out.length >= IMAGE_LIMITS.maxImages) break;
    if (!item || typeof item !== "object") continue;
    const { id, label, description, attached, background, width, height } = item as Record<string, unknown>;
    if (!isImageId(id) || seen.has(id)) continue;
    if (typeof width !== "number" || typeof height !== "number" || !(width > 0) || !(height > 0)) continue;
    seen.add(id);
    const described = cleanImageDescription(description);
    const isBackground = background === true && !backgroundTaken;
    if (isBackground) backgroundTaken = true;
    out.push({ id, label: cleanImageLabel(label) || id, ...(described ? { description: described } : {}), ...(attached === true ? { attached: true } : {}), ...(isBackground ? { background: true } : {}), width: Math.round(width), height: Math.round(height) });
  }
  return out;
}

/** Picture names sent with a download (id to label), cleaned to plain words; anything else is dropped. */
export function parseImageLabels(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isImageId(id)) continue;
    const label = cleanImageLabel(value);
    if (label) out[id] = label;
  }
  return out;
}

/** Picture sizes sent with a preview request (the pixels stay in the browser): id to width, height and name, anything unusable dropped. */
export function parseImageMeta(raw: unknown): Record<string, { width: number; height: number; label: string }> {
  const out: Record<string, { width: number; height: number; label: string }> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= IMAGE_LIMITS.maxImages) break;
    if (!isImageId(id) || !value || typeof value !== "object") continue;
    const { width, height, label } = value as Record<string, unknown>;
    if (typeof width !== "number" || typeof height !== "number" || !(width > 0) || !(height > 0) || width > 20000 || height > 20000) continue;
    out[id] = { width: Math.round(width), height: Math.round(height), label: cleanImageLabel(label) || id };
  }
  return out;
}

/** The images in a download request: id to a data URL we can read, anything else dropped. */
export function parseImagesRequest(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0 || entries.length > IMAGE_LIMITS.maxImages) return null;
  const out: Record<string, string> = {};
  for (const [id, value] of entries) {
    if (!isImageId(id) || typeof value !== "string") return null;
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match || Math.floor((match[2].length * 3) / 4) > IMAGE_LIMITS.maxBytes) return null;
    out[id] = value;
  }
  return out;
}

/** Every picture slot a deck's slides have: the item objects of "photos" and the two sides of "before_after", the cards of "gallery", the "image" slide itself, and the image elements of "canvas" slides. */
function pictureSlots(deck: unknown): { image?: unknown; placeholder?: unknown }[] {
  const slides = (deck as { slides?: unknown } | null)?.slides;
  if (!Array.isArray(slides)) return [];
  const slots: { image?: unknown; placeholder?: unknown }[] = [];
  const push = (value: unknown) => {
    if (value && typeof value === "object") slots.push(value as { image?: unknown; placeholder?: unknown });
  };
  for (const slide of slides) {
    if (!slide || typeof slide !== "object") continue;
    const s = slide as { layout?: unknown; items?: unknown; before?: unknown; after?: unknown };
    if (s.layout === "image") push(slide);
    else if ((s.layout === "gallery" || s.layout === "photos") && Array.isArray(s.items)) s.items.forEach(push);
    else if (s.layout === "before_after") {
      push(s.before);
      push(s.after);
    }
    else if (s.layout === "canvas" && Array.isArray((slide as { elements?: unknown }).elements)) {
      for (const el of (slide as { elements: unknown[] }).elements) if ((el as { type?: unknown } | null)?.type === "image") push(el);
    }
  }
  return slots;
}

/** The picture ids a deck refers to: its background picture, a slide's own background picture, and those on its slides (an image slide, a gallery card, a photo, a before/after side, a canvas image). */
export function imageIdsInDeck(deck: unknown): string[] {
  const ids = new Set<string>();
  const background = (deck as { backgroundImage?: unknown } | null)?.backgroundImage;
  if (isImageId(background)) ids.add(background);
  const slides = (deck as { slides?: unknown } | null)?.slides;
  if (Array.isArray(slides)) for (const x of slides) { const own = (x as { backgroundImage?: unknown } | null)?.backgroundImage; if (isImageId(own)) ids.add(own); const placed = (x as { pictures?: unknown } | null)?.pictures; if (Array.isArray(placed)) for (const pic of placed) { const id = (pic as { image?: unknown } | null)?.image; if (isImageId(id)) ids.add(id); } }
  for (const slot of pictureSlots(deck)) if (isImageId(slot.image)) ids.add(slot.image);
  return [...ids];
}

/** True when a deck has an empty picture box: a slot with a placeholder text and no picture (an "image" slide with neither counts too). */
export function deckHasPicturePlaceholders(deck: unknown): boolean {
  const slides = (deck as { slides?: unknown } | null)?.slides;
  const imageSlideWithoutPicture = Array.isArray(slides) && slides.some((x) => (x as { layout?: unknown; image?: unknown } | null)?.layout === "image" && !isImageId((x as { image?: unknown }).image));
  return (
    imageSlideWithoutPicture ||
    pictureSlots(deck).some((slot) => !isImageId(slot.image) && typeof slot.placeholder === "string" && slot.placeholder.length > 0)
  );
}

/** The next free id (img1 to img6), or null when the limit is reached. */
export function nextImageId(used: readonly string[]): string | null {
  for (let n = 1; n <= IMAGE_LIMITS.maxImages; n++) if (!used.includes(`img${n}`)) return `img${n}`;
  return null;
}

/** A picture's shape in plain words, for the model. */
export function describeShape(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.15) return "landscape";
  if (ratio < 0.87) return "portrait";
  return "square";
}

/**
 * Small previews the model is allowed to look at (the "Let Ail see them" switch), for the pictures it
 * was told about. Anything that isn't a small PNG, JPEG or WebP data URL, or isn't one of `known`, is dropped.
 */
export function parseImagePreviews(raw: unknown, known: readonly PptImageRef[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.some((k) => k.id === id) || typeof value !== "string") continue;
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match || Math.floor((match[2].length * 3) / 4) > IMAGE_LIMITS.previewBytes) continue;
    out[id] = value;
  }
  return out;
}

/**
 * Puts the previews on the last user turn of a model conversation, each after a line naming its id,
 * so the model can tie what it sees to the id it writes into a slide. Mutates `history`; does nothing
 * without previews or without a user turn.
 */
export function attachImagePreviews(history: { role: string; content: unknown }[], known: readonly PptImageRef[], previews: Record<string, string>): void {
  const blocks: object[] = [];
  for (const ref of known) {
    const url = previews[ref.id];
    if (!url) continue;
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(url);
    if (!match) continue;
    blocks.push({ type: "text", text: `${ref.id} ("${ref.label}"):` }, { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
  }
  if (blocks.length === 0) return;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== "user") continue;
    const current = history[i].content;
    history[i].content = [...blocks, ...(typeof current === "string" ? [{ type: "text", text: current }] : Array.isArray(current) ? current : [])];
    return;
  }
}
