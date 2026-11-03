import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { LOGO_CORNERS, LOGO_LIMITS, isLogoCorner, parseLogoRequest, placeLogo } from "../src/pptx/pptLogo.js";
import { prepareLogo } from "../src/pptx/pptLogoImage.js";

const png = async (w: number, h: number) =>
  `data:image/png;base64,${(await sharp({ create: { width: w, height: h, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer()).toString("base64")}`;

describe("placeLogo", () => {
  it("puts the plate in the chosen corner, inside the slide", () => {
    for (const corner of LOGO_CORNERS) {
      const p = placeLogo({ width: 400, height: 100, corner })!;
      expect(p.plate.x).toBeGreaterThanOrEqual(0);
      expect(p.plate.x + p.plate.w).toBeLessThanOrEqual(10);
      expect(p.plate.y).toBeGreaterThanOrEqual(0);
      expect(p.plate.y + p.plate.h).toBeLessThanOrEqual(5.625);
      expect(p.image.x).toBeGreaterThan(p.plate.x);
      expect(p.image.x + p.image.w).toBeLessThan(p.plate.x + p.plate.w);
    }
    expect(placeLogo({ width: 100, height: 100, corner: "top-left" })!.plate.x).toBeLessThan(1);
    expect(placeLogo({ width: 100, height: 100, corner: "top-right" })!.plate.x).toBeGreaterThan(8);
    expect(placeLogo({ width: 100, height: 100, corner: "bottom-left" })!.plate.y).toBeGreaterThan(5);
  });

  it("keeps the picture's proportions and stays within the header bar or the footer strip", () => {
    const wide = placeLogo({ width: 800, height: 100, corner: "top-left" })!;
    expect(wide.image.w / wide.image.h).toBeCloseTo(8, 5);
    expect(wide.image.w).toBeLessThanOrEqual(1.2 + 1e-9);
    const tall = placeLogo({ width: 100, height: 400, corner: "top-right" })!;
    expect(tall.plate.y).toBeGreaterThanOrEqual(0);
    expect(tall.plate.y + tall.plate.h).toBeLessThanOrEqual(0.62);
    const bottom = placeLogo({ width: 100, height: 400, corner: "bottom-right" })!;
    expect(bottom.plate.y).toBeGreaterThanOrEqual(5.25);
  });

  it("makes a round logo a square on a circular plate", () => {
    const p = placeLogo({ width: 400, height: 400, corner: "top-right", round: true })!;
    expect(p.round).toBe(true);
    expect(p.plate.w).toBeCloseTo(p.plate.h, 6);
    expect(p.image.w).toBeCloseTo(p.image.h, 6);
    expect(p.plate.y + p.plate.h).toBeLessThanOrEqual(0.62);
    expect(placeLogo({ width: 400, height: 400, corner: "top-right" })!.round).toBe(false);
  });

  it("refuses a bad corner or size", () => {
    expect(placeLogo({ width: 0, height: 10, corner: "top-left" })).toBeNull();
    expect(placeLogo({ width: 10, height: 10, corner: "middle" as never })).toBeNull();
    expect(isLogoCorner("top-left")).toBe(true);
    expect(isLogoCorner("center")).toBe(false);
  });
});

describe("parseLogoRequest", () => {
  it("accepts PNG, JPEG and WebP data URLs with a known corner", () => {
    for (const type of ["png", "jpeg", "webp"]) expect(parseLogoRequest({ dataUrl: `data:image/${type};base64,AAAA`, corner: "top-right" })).not.toBeNull();
  });

  it("reads the round flag, off unless it is exactly true", () => {
    expect(parseLogoRequest({ dataUrl: "data:image/png;base64,AAAA", corner: "top-left", round: true })!.round).toBe(true);
    expect(parseLogoRequest({ dataUrl: "data:image/png;base64,AAAA", corner: "top-left", round: "yes" })!.round).toBe(false);
    expect(parseLogoRequest({ dataUrl: "data:image/png;base64,AAAA", corner: "top-left" })!.round).toBe(false);
  });

  it("rejects SVG, other types, a bad corner, non-strings and anything too large", () => {
    expect(parseLogoRequest({ dataUrl: "data:image/svg+xml;base64,AAAA", corner: "top-left" })).toBeNull();
    expect(parseLogoRequest({ dataUrl: "https://x.example/logo.png", corner: "top-left" })).toBeNull();
    expect(parseLogoRequest({ dataUrl: "data:image/png;base64,AAAA", corner: "centre" })).toBeNull();
    expect(parseLogoRequest({ dataUrl: 5, corner: "top-left" })).toBeNull();
    expect(parseLogoRequest(null)).toBeNull();
    const big = "A".repeat(Math.ceil((LOGO_LIMITS.maxBytes * 4) / 3) + 8);
    expect(parseLogoRequest({ dataUrl: `data:image/png;base64,${big}`, corner: "top-left" })).toBeNull();
  });
});

describe("prepareLogo", () => {
  it("returns a PNG with its real size, shrunk to the limit", async () => {
    const small = await prepareLogo({ dataUrl: await png(120, 40), corner: "bottom-left" });
    expect(small).toMatchObject({ width: 120, height: 40, corner: "bottom-left" });
    expect(small!.data.startsWith("image/png;base64,")).toBe(true);
    const big = await prepareLogo({ dataUrl: await png(1800, 900), corner: "top-left" });
    expect(big).toMatchObject({ width: LOGO_LIMITS.maxSidePx, height: LOGO_LIMITS.maxSidePx / 2 });
  });

  it("makes a round logo a square PNG with transparent corners, whatever the picture's shape", async () => {
    for (const [w, h] of [[300, 300], [800, 200]]) {
      const out = (await prepareLogo({ dataUrl: await png(w, h), corner: "top-left", round: true }))!;
      expect(out).toMatchObject({ width: 400, height: 400, round: true });
      const raw = await sharp(Buffer.from(out.data.split(",")[1], "base64")).ensureAlpha().raw().toBuffer();
      expect(raw[3]).toBe(0); // top-left pixel is outside the circle
      const centre = (200 * 400 + 200) * 4;
      expect(raw[centre + 3]).toBe(255);
    }
  });

  it("returns null for something that is not a picture", async () => {
    expect(await prepareLogo({ dataUrl: `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`, corner: "top-left" })).toBeNull();
    expect(await prepareLogo(undefined)).toBeNull();
  });
});
