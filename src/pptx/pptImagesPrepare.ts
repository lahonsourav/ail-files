import sharp from "sharp";
import { IMAGE_LIMITS, parseImageLabels, parseImagesRequest, type PptImage } from "./pptImages.js";

/**
 * The pictures in a download request, checked and made ready to draw: each a JPEG (or a PNG when
 * it has transparency) no bigger than IMAGE_LIMITS.maxSidePx, with its real size. Anything that
 * isn't a PNG, JPEG or WebP picture (SVG included, which can carry scripts) fails the whole
 * request: null, so the caller can say so instead of downloading a deck with holes in it.
 */
export async function prepareImages(raw: unknown, rawLabels?: unknown): Promise<Record<string, PptImage> | null> {
  const request = parseImagesRequest(raw);
  if (!request) return null;
  const labels = parseImageLabels(rawLabels);
  const out: Record<string, PptImage> = {};
  try {
    for (const [id, dataUrl] of Object.entries(request)) {
      const input = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
      const base = sharp(input, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(IMAGE_LIMITS.maxSidePx, IMAGE_LIMITS.maxSidePx, { fit: "inside", withoutEnlargement: true });
      // Keep a PNG only when something in it is really see-through; many screenshots carry an alpha channel that is fully opaque.
      const probe = sharp(input, { limitInputPixels: 40_000_000 });
      const keepAlpha = (await probe.metadata()).hasAlpha === true && !(await probe.stats()).isOpaque;
      const { data, info } = keepAlpha
        ? await base.png().toBuffer({ resolveWithObject: true })
        : await base.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
      out[id] = { data: `image/${keepAlpha ? "png" : "jpeg"};base64,${data.toString("base64")}`, width: info.width, height: info.height, ...(labels[id] ? { label: labels[id] } : {}) };
    }
  } catch {
    return null;
  }
  return out;
}
