import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { runCli, type Io } from "../src/cli/run.js";
import { getBrowser, closeBrowser } from "../src/pdf/htmlToPdf.js";

const haveChromium = await getBrowser().then(() => true, () => false);
afterAll(closeBrowser);

let dir: string;
let stdout: string[];
let stderr: string[];
let stdin = "";
const io: Io = { out: (l) => stdout.push(l), err: (l) => stderr.push(l), readStdin: () => stdin };
const run = (...args: string[]) => runCli(args, io);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ail-cli-"));
  stdout = [];
  stderr = [];
  stdin = "";
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const deckJson = { slides: [{ layout: "bullets", title: "Hello", bullets: ["one", "two"] }] };

describe("ail-files CLI", () => {
  it("builds a .pptx from a JSON file, with a theme", async () => {
    const input = join(dir, "deck.json");
    writeFileSync(input, JSON.stringify(deckJson));
    const out = join(dir, "nested", "deck.pptx");
    expect(await run("build", input, "-o", out, "--theme", "midnight")).toBe(0);
    const zip = await JSZip.loadAsync(readFileSync(out));
    const slide = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slide).toContain("Hello");
    expect(slide).toContain("0B1220");
  });

  it("reads JSON from standard input and takes the type from --type", async () => {
    stdin = JSON.stringify({ title: "Book", sheets: [{ name: "S", headers: ["a"], rows: [["1"]] }] });
    const out = join(dir, "book.bin");
    expect(await run("build", "-", "-o", out, "--type", "xlsx")).toBe(0);
    expect((await JSZip.loadAsync(readFileSync(out))).file("xl/workbook.xml")).toBeTruthy();
  });

  it("builds a .docx and a .pdf", async () => {
    const input = join(dir, "doc.json");
    writeFileSync(input, JSON.stringify({ title: "T", sections: [{ heading: "H", paragraphs: ["p"] }] }));
    expect(await run("build", input, "-o", join(dir, "a.docx"))).toBe(0);
    if (haveChromium) {
      expect(await run("build", input, "-o", join(dir, "a.pdf"))).toBe(0);
      expect(readFileSync(join(dir, "a.pdf")).subarray(0, 5).toString()).toBe("%PDF-");
    }
    expect((await JSZip.loadAsync(readFileSync(join(dir, "a.docx")))).file("word/document.xml")).toBeTruthy();
  });

  it("gives plain-language errors and a non-zero code for bad requests", async () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{nope");
    expect(await run("build", bad, "-o", join(dir, "x.pptx"))).toBe(1);
    expect(stderr.at(-1)).toMatch(/not valid JSON/);

    writeFileSync(bad, JSON.stringify({ hello: 1 }));
    expect(await run("build", bad, "-o", join(dir, "x.pptx"))).toBe(1);
    expect(stderr.at(-1)).toMatch(/slides/);
    expect(await run("build", bad)).toBe(1);
    expect(await run("build", join(dir, "missing.json"), "-o", "x.pptx")).toBe(1);
    expect(await run("build", bad, "-o", join(dir, "x.txt"))).toBe(1);
    expect(stderr.at(-1)).toMatch(/Cannot tell/);
    writeFileSync(bad, JSON.stringify(deckJson));
    expect(await run("build", bad, "-o", join(dir, "x.pptx"), "--theme", "nope")).toBe(1);
    expect(stderr.at(-1)).toMatch(/No theme named/);
    expect(await run("build", bad, "--bogus", "1")).toBe(1);
    expect(await run("nonsense")).toBe(1);
    expect(existsSync(join(dir, "x.pptx"))).toBe(false);
  });

  it("lists themes and layouts, prints examples", async () => {
    expect(await run("themes")).toBe(0);
    expect(stdout.join("\n")).toContain("midnight");
    stdout = [];
    expect(await run("layouts")).toBe(0);
    expect(stdout.join("\n")).toContain("pricing");
    stdout = [];
    expect(await run("example", "pptx")).toBe(0);
    expect(JSON.parse(stdout.join("\n")).slides.length).toBeGreaterThan(3);
    expect(await run("example", "wat")).toBe(1);
  });

  it("previews a community layout", async () => {
    const out = join(dir, "pricing.pptx");
    expect(await run("preview", "pricing", "-o", out)).toBe(0);
    const zip = await JSZip.loadAsync(readFileSync(out));
    expect(await zip.file("ppt/slides/slide1.xml")!.async("string")).toContain("Choose a plan");
    expect(await run("preview", "nope", "-o", out)).toBe(1);
  });

  it("imports a theme from a pptx made by the engine, and the theme builds a deck", async () => {
    const deckFile = join(dir, "deck.json");
    writeFileSync(deckFile, JSON.stringify(deckJson));
    const pptx = join(dir, "Brand Deck.pptx");
    expect(await run("build", deckFile, "-o", pptx)).toBe(0);
    const themeFile = join(dir, "brand.json");
    expect(await run("import-theme", pptx, "-o", themeFile)).toBe(0);
    const theme = JSON.parse(readFileSync(themeFile, "utf8"));
    expect(theme).toMatchObject({ name: "brand-deck", source: "pptx-import" });
    expect(await run("build", deckFile, "-o", join(dir, "again.pptx"), "--theme", themeFile)).toBe(0);
    writeFileSync(join(dir, "notppt.pptx"), "nope");
    expect(await run("import-theme", join(dir, "notppt.pptx"))).toBe(1);
  });
});
