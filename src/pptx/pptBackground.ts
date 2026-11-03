import sharp from "sharp";
import type { PptImage } from "./pptImages.js";

// A deck's own picture as the background of every slide ("backgroundImage" on the deck). The picture is cropped to
// fill the slide, then softened with the slide's own background colour, so the text colours already chosen for that
// colour stay readable on top of it. Server only (sharp), like the rest of the builder.

/** How much of the slide's background colour is laid over the picture (0 to 1). */
export const BACKGROUND_SCRIM = 0.7;
// One copy of this is stored per slide, so it is kept modest: 1280 x 720 is plenty for a soft backdrop.
const WIDTH = 1280;
const HEIGHT = 720; // the slide is 16:9

function rgb(hex: string) {
  const h = /^[0-9a-fA-F]{6}$/.test(hex) ? hex : "FFFFFF";
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/** "image/jpeg;base64,..." for pptxgenjs: the picture filling the slide under a wash of `colorHex`. */
export async function softenedBackground(picture: PptImage, colorHex: string): Promise<string> {
  const input = Buffer.from(picture.data.slice(picture.data.indexOf(",") + 1), "base64");
  const wash = { create: { width: WIDTH, height: HEIGHT, channels: 4 as const, background: { ...rgb(colorHex), alpha: BACKGROUND_SCRIM } } };
  const out = await sharp(input, { limitInputPixels: 40_000_000 })
    .flatten({ background: rgb(colorHex) })
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .composite([{ input: await sharp(wash).png().toBuffer() }])
    .jpeg({ quality: 78 })
    .toBuffer();
  return `image/jpeg;base64,${out.toString("base64")}`;
}
