import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, basename, extname } from "node:path";
import { buildPptx } from "../pptx/presentationBuilder.js";
import { normalizeDeck } from "../pptx/slideDeck.js";
import { buildGeneralPdf } from "../pdf/pdfDocBuilder.js";
import { normalizeGeneralPdf } from "../pdf/pdfDocExtract.js";
import { closeBrowser } from "../pdf/htmlToPdf.js";
import { buildGeneralDocx } from "../docx/docxDocBuilder.js";
import { normalizeGeneralDocx } from "../docx/docxDocExtract.js";
import { buildGeneralExcel } from "../xlsx/excelBuilder.js";
import { normalizeGeneralExcel } from "../xlsx/excelExtract.js";
import { EXAMPLE_DECK } from "../pptx/exampleDeck.js";
import { EXAMPLE_PDF } from "../pdf/exampleGeneralPdf.js";
import { EXAMPLE_DOCX } from "../docx/exampleGeneralDocx.js";
import { EXAMPLE_EXCEL } from "../xlsx/exampleGeneralExcel.js";
import { listLayouts } from "../pptx/layoutRegistry.js";
import { registerCommunityLayouts } from "../layouts/index.js";
import { applyTheme, getTheme, listThemes, normalizeTheme } from "../theme/theme.js";
import { importThemeFromPptx } from "../theme/importPptx.js";

export type FileKind = "pptx" | "pdf" | "docx" | "xlsx";

const KINDS: FileKind[] = ["pptx", "pdf", "docx", "xlsx"];
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export interface Io {
  out(line: string): void;
  err(line: string): void;
  readStdin(): string;
}

const USAGE = `ail-files: make PowerPoint, PDF, Word and Excel files from JSON.

Usage:
  ail-files build <input.json|-> -o <output> [--type pptx|pdf|docx|xlsx] [--theme <name|file.json>]
  ail-files example <pptx|pdf|docx|xlsx> [-o <file.json>]
  ail-files preview <layout> -o <output.pptx> [--theme <name|file.json>]
  ail-files import-theme <deck.pptx> [-o <file.json>] [--name <name>]
  ail-files themes
  ail-files layouts

The type of file comes from the extension of -o, or from --type.
--theme applies to PowerPoint files only.`;

interface Parsed {
  positional: string[];
  flags: Map<string, string>;
}

function parseArgs(argv: string[]): Parsed | string {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  const withValue = new Set(["-o", "--out", "--type", "--theme", "--name"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-") positional.push(a);
    else if (a.startsWith("-")) {
      if (!withValue.has(a)) return `Unknown option ${a}`;
      const v = argv[++i];
      if (v === undefined) return `Option ${a} needs a value`;
      flags.set(a === "--out" ? "-o" : a, v);
    } else positional.push(a);
  }
  return { positional, flags };
}

function kindFor(out: string | undefined, type: string | undefined, json?: unknown): FileKind | string {
  if (type) return (KINDS as string[]).includes(type) ? (type as FileKind) : `Unknown type "${type}". Use one of: ${KINDS.join(", ")}.`;
  const ext = out ? extname(out).slice(1).toLowerCase() : "";
  if ((KINDS as string[]).includes(ext)) return ext as FileKind;
  if (json && typeof json === "object") {
    const j = json as Record<string, unknown>;
    if (Array.isArray(j.slides)) return "pptx";
    if (Array.isArray(j.sheets)) return "xlsx";
  }
  return "Cannot tell what to make. Give -o with a .pptx, .pdf, .docx or .xlsx name, or use --type.";
}

function loadTheme(spec: string) {
  const named = getTheme(spec);
  if (named) return named;
  try {
    const theme = normalizeTheme(JSON.parse(readFileSync(spec, "utf8")));
    return theme ?? `The theme file "${spec}" is not a valid theme.`;
  } catch {
    return `No theme named "${spec}" and no readable theme file at that path. Run "ail-files themes" to see the names.`;
  }
}

function save(path: string, data: Uint8Array | string) {
  mkdirSync(dirname(path) || ".", { recursive: true });
  writeFileSync(path, data);
}

async function buildFile(kind: FileKind, json: unknown, themeSpec?: string): Promise<Uint8Array | string> {
  if (kind === "pptx") {
    let deck = normalizeDeck(json);
    if (!deck) return "The JSON is not a deck. It needs a non-empty \"slides\" array.";
    if (themeSpec) {
      const theme = loadTheme(themeSpec);
      if (typeof theme === "string") return theme;
      deck = applyTheme(deck, theme);
    }
    return buildPptx(deck);
  }
  if (themeSpec) return "--theme only applies to PowerPoint files.";
  if (kind === "pdf") {
    const doc = normalizeGeneralPdf(json);
    return doc ? buildGeneralPdf(doc) : "The JSON is not a PDF document. It needs a \"title\" and a \"sections\" array.";
  }
  if (kind === "docx") {
    const doc = normalizeGeneralDocx(json);
    return doc ? buildGeneralDocx(doc) : "The JSON is not a Word document. It needs a \"title\" and a \"sections\" array.";
  }
  const book = normalizeGeneralExcel(json);
  return book ? buildGeneralExcel(book) : "The JSON is not a workbook. It needs a \"title\" and a \"sheets\" array.";
}

/** Runs one command. Returns the exit code: 0 on success, 1 for a bad request, 2 for an unexpected failure. */
export async function runCli(argv: string[], io: Io): Promise<number> {
  registerCommunityLayouts();
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.out(USAGE);
    return command ? 0 : 1;
  }
  const parsed = parseArgs(rest);
  if (typeof parsed === "string") {
    io.err(parsed);
    return 1;
  }
  const { positional, flags } = parsed;
  const out = flags.get("-o");
  const fail = (msg: string) => {
    io.err(msg);
    return 1;
  };

  try {
    if (command === "themes") {
      for (const t of listThemes()) io.out(`${t.name.padEnd(12)} #${t.background} on #${t.accent}  ${t.description ?? ""}`.trimEnd());
      return 0;
    }

    if (command === "layouts") {
      for (const l of listLayouts()) io.out(`${l.name.padEnd(14)} ${l.description}`);
      return 0;
    }

    if (command === "example") {
      const kind = positional[0];
      const examples: Record<string, unknown> = { pptx: EXAMPLE_DECK, pdf: EXAMPLE_PDF, docx: EXAMPLE_DOCX, xlsx: EXAMPLE_EXCEL };
      if (!kind || !(kind in examples)) return fail(`Say which example: ${KINDS.join(", ")}.`);
      const text = JSON.stringify(examples[kind], null, 2) + "\n";
      if (out) save(out, text);
      else io.out(text.trimEnd());
      return 0;
    }

    if (command === "build") {
      const input = positional[0];
      if (!input) return fail("Give the input JSON file, or - to read it from standard input.");
      let raw: string;
      try {
        raw = input === "-" ? io.readStdin() : readFileSync(input, "utf8");
      } catch {
        return fail(`Cannot read "${input}".`);
      }
      if (raw.length > MAX_INPUT_BYTES) return fail("The input is larger than 20 MB.");
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return fail("The input is not valid JSON.");
      }
      const kind = kindFor(out, flags.get("--type"), json);
      if (!(KINDS as string[]).includes(kind)) return fail(kind);
      if (!out) return fail("Give the output file with -o.");
      const result = await buildFile(kind as FileKind, json, flags.get("--theme"));
      if (typeof result === "string") return fail(result);
      save(out, result);
      io.out(`Wrote ${out} (${result.byteLength} bytes)`);
      return 0;
    }

    if (command === "preview") {
      const name = positional[0];
      if (!name) return fail("Give a layout name. Run \"ail-files layouts\" to see them.");
      const layout = listLayouts().find((l) => l.name === name);
      if (!layout) return fail(`No layout named "${name}" is registered. Built-in layouts are shown by example decks; community layouts by "ail-files layouts".`);
      if (!out) return fail("Give the output file with -o.");
      const result = await buildFile("pptx", { slides: [layout.example] }, flags.get("--theme"));
      if (typeof result === "string") return fail(result);
      save(out, result);
      io.out(`Wrote ${out}`);
      return 0;
    }

    if (command === "import-theme") {
      const file = positional[0];
      if (!file) return fail("Give the PowerPoint file to read the look from.");
      let bytes: Buffer;
      try {
        bytes = readFileSync(file);
      } catch {
        return fail(`Cannot read "${file}".`);
      }
      const theme = await importThemeFromPptx(bytes, { fileName: basename(file), name: flags.get("--name") });
      if (!theme) return fail("Could not read a color scheme from that file. Is it a .pptx or .potx made by PowerPoint, Keynote or Google Slides?");
      const text = JSON.stringify(theme, null, 2) + "\n";
      if (out) {
        save(out, text);
        io.out(`Wrote theme "${theme.name}" to ${out}`);
      } else io.out(text.trimEnd());
      return 0;
    }

    io.err(`Unknown command "${command}".\n\n${USAGE}`);
    return 1;
  } catch (e) {
    io.err(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  } finally {
    await closeBrowser().catch(() => {});
  }
}
