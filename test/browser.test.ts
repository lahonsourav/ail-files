import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// "ail-files/browser" has to be something a bundler can put in a web page. This walks every file it imports (not counting
// `import type`, which leaves no code behind) and fails if any of them reaches Node or a server-only library.

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const SERVER_ONLY = /^(node:|sharp$|pptxgenjs$|playwright|jszip$|docx$|exceljs$|react-dom|react-icons|katex|fs$|path$|crypto$|child_process$)/;

function runtimeImports(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm)) found.push(m[1]);
  for (const m of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) found.push(m[1]);
  return found;
}

function walk(entry: string, seen = new Set<string>(), bad: string[] = []): { files: string[]; bad: string[] } {
  if (seen.has(entry)) return { files: [...seen], bad };
  seen.add(entry);
  for (const spec of runtimeImports(readFileSync(entry, "utf8"))) {
    if (spec.startsWith(".")) {
      const target = resolve(dirname(entry), spec.replace(/\.js$/, ".ts"));
      expect(existsSync(target), `${entry} imports ${spec}, which is not a file`).toBe(true);
      walk(target, seen, bad);
    } else if (SERVER_ONLY.test(spec)) {
      bad.push(`${entry.replace(root, "src")} imports ${spec}`);
    }
  }
  return { files: [...seen], bad };
}

describe("ail-files/browser and ail-files/edit", () => {
  for (const entry of ["browser.ts", "edit.ts"]) {
    it(`${entry} imports nothing that needs Node or a server-only library`, () => {
      const { files, bad } = walk(join(root, entry));
      expect(files.length).toBeGreaterThan(5);
      expect(bad).toEqual([]);
    });
  }

  it("is exported from package.json, next to the main entry", () => {
    const pkg = JSON.parse(readFileSync(join(root, "..", "package.json"), "utf8"));
    expect(pkg.exports["./browser"]).toEqual({ types: "./dist/browser.d.ts", import: "./dist/browser.js", default: "./dist/browser.js" }); // "default" lets a CommonJS tool (tsx, jest) require() it too
    expect(pkg.exports["./edit"]).toEqual({ types: "./dist/edit.d.ts", import: "./dist/edit.js", default: "./dist/edit.js" });
    expect(pkg.exports["."].import).toBe("./dist/index.js");
  });

  it("offers the cleaners, the picture and logo rules and the examples", async () => {
    const browser = await import("../src/browser.js");
    for (const name of ["normalizeDeck", "extractSlideDeck", "extractGeneralPdf", "extractGeneralDocx", "extractGeneralExcel", "IMAGE_LIMITS", "isImageId", "LOGO_CORNERS", "SLIDE_W", "EXAMPLE_DECK", "EXAMPLE_PDF", "EXAMPLE_DOCX", "EXAMPLE_EXCEL"]) {
      expect((browser as Record<string, unknown>)[name], name).toBeDefined();
    }
    // Drawing a file is not here: that needs the server entry.
    expect((browser as Record<string, unknown>).buildPptx).toBeUndefined();
    expect((browser as Record<string, unknown>).prepareImages).toBeUndefined();
  });
});
