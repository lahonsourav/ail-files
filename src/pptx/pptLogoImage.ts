import sharp from "sharp";
import { LOGO_LIMITS, parseLogoRequest, type PptLogo } from "./pptLogo.js";

/**
 * A logo from the export request, checked and turned into what the builder draws: a PNG no
 * bigger than LOGO_LIMITS.maxSidePx, with its real pixel size. Anything that isn't a PNG, JPEG
 * or WebP picture (SVG included, which can carry scripts) comes back null.
 */
export async function prepareLogo(raw: unknown): Promise<PptLogo | null> {
  const request = parseLogoRequest(raw);
  if (!request) return null;
  try {
    const input = Buffer.from(request.dataUrl.slice(request.dataUrl.indexOf(",") + 1), "base64");
    const base = sharp(input, { limitInputPixels: 25_000_000 }).rotate();
    const { data, info } = request.round ? await roundPng(base) : await base
      .resize(LOGO_LIMITS.maxSidePx, LOGO_LIMITS.maxSidePx, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { data: `image/png;base64,${data.toString("base64")}`, width: info.width, height: info.height, corner: request.corner, round: request.round };
  } catch {
    return null;
  }
}

// A circle with the picture inside. A roughly square picture fills the circle (its corners are
// cropped); a wide or tall one is shown whole on white, so a wordmark isn't cut in half.
const ROUND_SIDE_PX = 400;
async function roundPng(base: ReturnType<typeof sharp>) {
  const meta = await base.clone().metadata();
  const ratio = (meta.width ?? 1) / (meta.height ?? 1);
  const squarish = ratio >= 0.8 && ratio <= 1.25;
  const square = await base
    .clone()
    .resize(ROUND_SIDE_PX, ROUND_SIDE_PX, squarish ? { fit: "cover" } : { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ROUND_SIDE_PX}" height="${ROUND_SIDE_PX}"><circle cx="${ROUND_SIDE_PX / 2}" cy="${ROUND_SIDE_PX / 2}" r="${ROUND_SIDE_PX / 2}"/></svg>`);
  return sharp(square).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer({ resolveWithObject: true });
}
