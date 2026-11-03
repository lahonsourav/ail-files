import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import sharp from "sharp";
import { buildPptx } from "../src/pptx/presentationBuilder.js";
import { prepareLogo } from "../src/pptx/pptLogoImage.js";
import type { SlideDeck } from "../src/pptx/presentationBuilder.js";

const deck = {
  title: "Quarterly review",
  slides: [
    { layout: "bullets", title: "Highlights", bullets: ["Revenue up", "Churn down"] },
    { layout: "section", title: "Next steps" },
    { layout: "thank_you", title: "Thanks" },
  ],
} as unknown as SlideDeck;

async function logo(corner: "top-left" | "top-right" | "bottom-left" | "bottom-right", round = false) {
  const buf = await sharp({ create: { width: 200, height: 60, channels: 4, background: { r: 10, g: 90, b: 200, alpha: 1 } } }).png().toBuffer();
  return (await prepareLogo({ dataUrl: `data:image/png;base64,${buf.toString("base64")}`, corner, round }))!;
}

async function slideXml(file: Buffer, n: number) {
  const zip = await JSZip.loadAsync(file);
  return zip.file(`ppt/slides/slide${n}.xml`)!.async("string");
}

describe("buildPptx logo option", () => {
  it("draws the logo on every slide, the cover and early-return layouts included", async () => {
    const file = await buildPptx(deck, { logo: await logo("top-right") });
    for (const n of [1, 2, 3, 4]) expect(await slideXml(file, n)).toContain("<p:pic>");
  });

  it("draws nothing when there is no logo", async () => {
    const file = await buildPptx(deck);
    for (const n of [1, 2, 3, 4]) expect(await slideXml(file, n)).not.toContain("<p:pic>");
  });

  it("puts the logo in the chosen corner", async () => {
    const EMU = 914400;
    const at = async (corner: Parameters<typeof logo>[0]) => {
      const xml = await slideXml(await buildPptx(deck, { logo: await logo(corner) }), 2);
      const pic = xml.slice(xml.indexOf("<p:pic>"));
      const off = /<a:off x="(\d+)" y="(\d+)"/.exec(pic)!;
      return { x: Number(off[1]) / EMU, y: Number(off[2]) / EMU };
    };
    expect((await at("top-left")).x).toBeLessThan(1);
    expect((await at("top-left")).y).toBeLessThan(0.62);
    expect((await at("top-right")).x).toBeGreaterThan(8);
    expect((await at("bottom-left")).y).toBeGreaterThan(5);
    const br = await at("bottom-right");
    expect(br.x).toBeGreaterThan(8);
    expect(br.y).toBeGreaterThan(5);
  });

  it("draws a round logo on a circular plate", async () => {
    // The bullet dots are ellipses already, so compare the counts.
    const count = (xml: string, shape: string) => xml.split(`prst="${shape}"`).length - 1;
    const round = await slideXml(await buildPptx(deck, { logo: await logo("top-right", true) }), 2);
    const square = await slideXml(await buildPptx(deck, { logo: await logo("top-right") }), 2);
    expect(count(round, "ellipse")).toBe(count(square, "ellipse") + 1);
    expect(count(round, "roundRect")).toBe(count(square, "roundRect") - 1);
  });

  it("moves the slide title clear of a top-left logo", async () => {
    const EMU = 914400;
    const titleX = async (opts?: Parameters<typeof buildPptx>[1]) => {
      const xml = await slideXml(await buildPptx(deck, opts), 2);
      const sp = xml.split("<p:sp>").find((chunk) => chunk.includes("Highlights"))!;
      return Number(/<a:off x="(\d+)"/.exec(sp)![1]) / EMU;
    };
    expect(await titleX()).toBeCloseTo(0.5, 2);
    expect(await titleX({ logo: await logo("top-left") })).toBeGreaterThan(1.3);
    expect(await titleX({ logo: await logo("bottom-right") })).toBeCloseTo(0.5, 2);
  });

  it("moves the page number left of a bottom-right logo", async () => {
    const EMU = 914400;
    const numberX = async (opts?: Parameters<typeof buildPptx>[1]) => {
      const xml = await slideXml(await buildPptx(deck, opts), 2);
      const sp = xml.split("<p:sp>").find((chunk) => chunk.includes("1 / 3"))!;
      return Number(/<a:off x="(\d+)"/.exec(sp)![1]) / EMU;
    };
    expect(await numberX()).toBeCloseTo(8.7, 2);
    expect(await numberX({ logo: await logo("bottom-right") })).toBeLessThan(8.7);
    const without = await slideXml(await buildPptx(deck, { logo: await logo("bottom-right"), pageNumbers: false }), 2);
    expect(without).not.toContain("1 / 3");
  });
});
