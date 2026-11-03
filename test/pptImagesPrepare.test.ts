import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { IMAGE_LIMITS } from "../src/pptx/pptImages.js";
import { prepareImages } from "../src/pptx/pptImagesPrepare.js";

const url = async (w: number, h: number, opts: { alpha?: boolean; format?: "png" | "jpeg" | "webp" } = {}) => {
  const format = opts.format ?? "png";
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 40, g: 120, b: 200, alpha: opts.alpha ? 0.5 : 1 } } })[format]().toBuffer();
  return `data:image/${format};base64,${buf.toString("base64")}`;
};

describe("prepareImages", () => {
  it("returns each picture ready to draw, with its real size", async () => {
    const out = (await prepareImages({ img1: await url(800, 450, { format: "jpeg" }), img2: await url(300, 600, { format: "webp" }) }))!;
    expect(out.img1).toMatchObject({ width: 800, height: 450 });
    expect(out.img2).toMatchObject({ width: 300, height: 600 });
    expect(out.img1.data.startsWith("image/jpeg;base64,")).toBe(true);
  });

  it("shrinks a big picture to the limit and keeps transparency as a PNG", async () => {
    const out = (await prepareImages({ img1: await url(3200, 1600), img2: await url(200, 200, { alpha: true }) }))!;
    expect(out.img1).toMatchObject({ width: IMAGE_LIMITS.maxSidePx, height: IMAGE_LIMITS.maxSidePx / 2 });
    expect(out.img1.data.startsWith("image/jpeg;base64,")).toBe(true);
    expect(out.img2.data.startsWith("image/png;base64,")).toBe(true);
  });

  it("fails the whole request when any picture isn't a picture, so a deck is never downloaded with holes", async () => {
    expect(await prepareImages({ img1: await url(100, 100), img2: `data:image/png;base64,${Buffer.from("nope").toString("base64")}` })).toBeNull();
    expect(await prepareImages({ img1: "data:image/svg+xml;base64,AAAA" })).toBeNull();
    expect(await prepareImages(undefined)).toBeNull();
  });

  it("carries each picture's cleaned name along, for its caption", async () => {
    const out = (await prepareImages({ img1: await url(100, 100), img2: await url(100, 100) }, { img1: 'Office <b>front</b>', img2: "", img9: "ignored" }))!;
    expect(out.img1.label).toBe("Office b front b");
    expect(out.img2).not.toHaveProperty("label");
    expect(Object.keys(out)).toEqual(["img1", "img2"]);
  });
});
