// Pictures and the logo in a Word or PDF document. The pictures are the person's own, passed in when the file is made (the document only
// names them: "img1" to "img6", and "logo"), so a document stays small and the same document can be drawn with or without them.

export interface DocPictureData {
  /** `data:image/png|jpeg|webp;base64,...` */
  dataUrl: string;
  width: number;
  height: number;
}

/** Picture id ("img1" to "img6", or "logo") to its pixels. */
export type DocPictureMap = Record<string, DocPictureData>;

export type DocPictureSize = "small" | "medium" | "large";
export type DocLogoPlace = "left" | "center" | "right";

/** How much of the text width a picture takes. */
export const PICTURE_WIDTH_FRACTION: Record<DocPictureSize, number> = { small: 0.3, medium: 0.55, large: 1 };

const DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/;

/** Checks a data URL is a picture of a kind we draw and returns its type and bytes; null for anything else (never a link, never a script). */
export function parsePictureDataUrl(url: string): { type: "png" | "jpg" | "webp"; bytes: Buffer } | null {
  const m = DATA_URL.exec(url);
  if (!m) return null;
  const type = m[1] === "jpeg" || m[1] === "jpg" ? "jpg" : (m[1] as "png" | "webp");
  return { type, bytes: Buffer.from(m[2].replace(/\s+/g, ""), "base64") };
}

/** The URL itself when it is a safe picture data URL, else null: what an `<img src>` may be given. */
export function safePictureSrc(url: string | undefined): string | null {
  return url && DATA_URL.test(url) ? url : null;
}

/** A picture's size in pixels when drawn `fraction` of a text column `columnPx` wide, never taller than `maxHeightPx`. */
export function fitPicture(width: number, height: number, columnPx: number, fraction: number, maxHeightPx: number): { width: number; height: number } {
  const w0 = Math.max(1, columnPx * fraction);
  const ratio = height > 0 && width > 0 ? height / width : 1;
  let w = Math.min(w0, width > 0 ? width * 3 : w0);
  let h = w * ratio;
  if (h > maxHeightPx) {
    h = maxHeightPx;
    w = h / ratio;
  }
  return { width: Math.round(w), height: Math.round(h) };
}
