import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { applyTheme, getTheme, listThemes, normalizeTheme } from "../src/theme/theme.js";
import { importThemeFromPptx } from "../src/theme/importPptx.js";
import { normalizeDeck } from "../src/pptx/slideDeck.js";
import { buildPptx } from "../src/pptx/presentationBuilder.js";

const THEME_XML = `<?xml version="1.0"?><a:theme xmlns:a="x"><a:themeElements>
<a:clrScheme name="Test">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>
<a:accent1><a:srgbClr val="c0392b"/></a:accent1><a:accent2><a:srgbClr val="2980B9"/></a:accent2>
</a:clrScheme>
<a:fontScheme name="T"><a:majorFont><a:latin typeface="Cambria" panose="x"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme>
</a:themeElements></a:theme>`;

async function fakePptx(opts: { theme?: string; master?: string } = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  if (opts.theme !== "") zip.file("ppt/theme/theme1.xml", opts.theme ?? THEME_XML);
  if (opts.master) zip.file("ppt/slideMasters/slideMaster1.xml", opts.master);
  zip.file("ppt/slides/slide1.xml", "<p:sld>SECRET SLIDE TEXT</p:sld>");
  zip.file("ppt/media/logo.png", Buffer.from([1, 2, 3]));
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("built-in themes", () => {
  it("are all valid, uniquely named, and readable by name", () => {
    const themes = listThemes();
    expect(themes.length).toBeGreaterThanOrEqual(8);
    expect(new Set(themes.map((t) => t.name)).size).toBe(themes.length);
    expect(getTheme("midnight")?.background).toBe("0B1220");
    expect(getTheme("nope")).toBeNull();
  });
});

describe("normalizeTheme", () => {
  it("cleans colors and rejects unusable themes", () => {
    expect(normalizeTheme({ name: "a-b", background: "#ffffff", accent: "2563eb" })).toMatchObject({ background: "FFFFFF", accent: "2563EB" });
    expect(normalizeTheme({ name: "Bad Name", background: "FFFFFF", accent: "2563EB" })).toBeNull();
    expect(normalizeTheme({ name: "ok", background: "red", accent: "2563EB" })).toBeNull();
    expect(normalizeTheme(null)).toBeNull();
    expect(normalizeTheme({ name: "ok", background: "FFFFFF", accent: "2563EB", fonts: { heading: "<script>", body: "Arial" } })?.fonts).toBeUndefined();
  });
});

describe("applyTheme", () => {
  it("sets the deck look without changing the deck, and builds", async () => {
    const deck = normalizeDeck({ slides: [{ layout: "bullets", title: "T", bullets: ["a"] }] })!;
    const themed = applyTheme(deck, { name: "x", background: "0B1220", accent: "38BDF8", fonts: { heading: "Cambria", body: "Calibri" } });
    expect(deck.background).toBeUndefined();
    expect(themed).toMatchObject({ background: "0B1220", accent: "38BDF8", fonts: { heading: "Cambria", body: "Calibri" } });
    const zip = await JSZip.loadAsync(await buildPptx(themed));
    const slide = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slide).toContain("0B1220");
    expect(slide).toContain("Cambria");
  });
});

describe("importThemeFromPptx", () => {
  it("reads colors and fonts and nothing else", async () => {
    const theme = await importThemeFromPptx(await fakePptx(), { fileName: "Acme Brand 2024.pptx" });
    expect(theme).toMatchObject({
      name: "acme-brand-2024",
      background: "FFFFFF",
      accent: "C0392B",
      fonts: { heading: "Cambria", body: "Calibri" },
      source: "pptx-import",
    });
    expect(theme?.palette).toMatchObject({ dk2: "1F2937", accent2: "2980B9" });
    expect(JSON.stringify(theme)).not.toContain("SECRET");
  });

  it("uses the master's background slot for dark decks", async () => {
    const theme = await importThemeFromPptx(await fakePptx({ master: `<p:sldMaster><p:clrMap bg1="dk1" tx1="lt1"/></p:sldMaster>` }));
    expect(theme?.background).toBe("000000");
  });

  it("returns null, never throws, for bad input", async () => {
    expect(await importThemeFromPptx(Buffer.from("not a zip"))).toBeNull();
    expect(await importThemeFromPptx(await fakePptx({ theme: "" }))).toBeNull();
    expect(await importThemeFromPptx(await fakePptx({ theme: "<a:theme/>" }))).toBeNull();
    expect(await importThemeFromPptx(new Uint8Array(0))).toBeNull();
  });

  it("round-trips a deck this engine made", async () => {
    const deck = normalizeDeck({ background: "FFFFFF", accent: "2563EB", slides: [{ layout: "bullets", title: "T", bullets: ["a"] }] })!;
    const theme = await importThemeFromPptx(await buildPptx(deck));
    expect(theme).not.toBeNull();
    expect(theme?.background).toMatch(/^[0-9A-F]{6}$/);
  });
});
