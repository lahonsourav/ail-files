// An optional logo of the user's own, drawn in one corner of every slide of an exported deck
// (BuildPptxOptions.logo in lib/presentationBuilder.ts). Like page numbers it is an export-time
// choice, not part of the deck the model wrote. Pure geometry and checks, no Node or browser
// APIs, so the builder, the export route and the PPT settings panel all share it.

export const LOGO_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type LogoCorner = (typeof LOGO_CORNERS)[number];

export const LOGO_CORNER_LABELS: Record<LogoCorner, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};

export function isLogoCorner(value: unknown): value is LogoCorner {
  return typeof value === "string" && (LOGO_CORNERS as readonly string[]).includes(value);
}

export const LOGO_LIMITS = {
  maxBytes: 1_500_000, // the image sent for export, decoded
  maxSidePx: 600, // the server shrinks anything bigger than this
  formats: ["png", "jpeg", "webp"],
} as const;

/** What the builder needs: a PNG as "image/png;base64,...", its pixel size, and where it goes. */
export interface PptLogo {
  data: string;
  width: number;
  height: number;
  corner: LogoCorner;
  /** Cropped to a circle (the picture is already a square PNG, see prepareLogo). */
  round?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LogoPlacement {
  corner: LogoCorner;
  /** The plate is a circle instead of a rounded rectangle. */
  round: boolean;
  /** The white plate behind the logo, so it reads on any slide colour. */
  plate: Rect;
  /** The logo itself, inside the plate. */
  image: Rect;
}

// Slide is 10 x 5.625 inches. The header bar of a content slide is 0.62 high; below 5.25 is
// the footer strip. Top logos sit inside the header bar and bottom ones in the footer strip,
// so they never cover a slide's content. Bottom logos are smaller because the strip is.
const SLIDE_W = 10;
const SLIDE_H = 5.625;
const HEADER_H = 0.62;
const EDGE = 0.15;
const PAD = 0.05;
const MAX_W = 1.2;
const MAX_H_TOP = 0.38;
const MAX_H_BOTTOM = 0.25;
const BOTTOM_GAP = 0.02;

export function placeLogo(logo: Pick<PptLogo, "width" | "height" | "corner" | "round">): LogoPlacement | null {
  if (!isLogoCorner(logo.corner) || !(logo.width > 0) || !(logo.height > 0)) return null;
  const top = logo.corner.startsWith("top");
  const scale = Math.min(MAX_W / logo.width, (top ? MAX_H_TOP : MAX_H_BOTTOM) / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  const plateW = w + 2 * PAD;
  const plateH = h + 2 * PAD;
  const x = logo.corner.endsWith("left") ? EDGE : SLIDE_W - EDGE - plateW;
  const y = top ? (HEADER_H - plateH) / 2 : SLIDE_H - BOTTOM_GAP - plateH;
  return { corner: logo.corner, round: logo.round === true, plate: { x, y, w: plateW, h: plateH }, image: { x: x + PAD, y: y + PAD, w, h } };
}

/** A usable logo from untrusted input (the export request), or null. */
export function parseLogoRequest(raw: unknown): { dataUrl: string; corner: LogoCorner; round: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const { dataUrl, corner, round } = raw as Record<string, unknown>;
  if (typeof dataUrl !== "string" || !isLogoCorner(corner)) return null;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  // Base64 is 4 characters per 3 bytes.
  if (Math.floor((match[2].length * 3) / 4) > LOGO_LIMITS.maxBytes) return null;
  return { dataUrl, corner, round: round === true };
}
