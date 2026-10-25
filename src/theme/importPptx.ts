import JSZip from "jszip";
import { normalizeTheme, type Theme } from "./theme.js";

// Reads the look of a PowerPoint file: its color scheme and fonts. Nothing
// else is taken. Slide text, images, logos and masters' artwork are never read
// or copied, so a theme from someone's deck cannot carry their content along.
//
// The .pptx is untrusted input, so the limits below keep a hostile file from
// using much memory, and the XML is read with plain pattern matching (no XML
// parser, so there are no external entities to resolve).

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_XML_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 5000;

const SCHEME_SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const;

type SlotColors = Partial<Record<(typeof SCHEME_SLOTS)[number], string>>;

async function readXml(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  // JSZip records the real uncompressed size from the zip directory. A file that
  // claims to be small is also checked after reading.
  const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof declared === "number" && declared > MAX_XML_BYTES) return null;
  const text = await entry.async("string");
  return text.length > MAX_XML_BYTES ? null : text;
}

function firstMatch(xml: string, re: RegExp): string | null {
  const m = xml.match(re);
  return m ? m[1] : null;
}

function parseScheme(themeXml: string): SlotColors {
  const scheme = firstMatch(themeXml, /<a:clrScheme\b[^>]*>([\s\S]*?)<\/a:clrScheme>/);
  const out: SlotColors = {};
  if (!scheme) return out;
  for (const slot of SCHEME_SLOTS) {
    const block = firstMatch(scheme, new RegExp(`<a:${slot}\\b[^>]*>([\\s\\S]*?)</a:${slot}>`));
    if (!block) continue;
    // A color is either a plain hex value or a system color that records its hex in lastClr.
    const hex = firstMatch(block, /<a:srgbClr\b[^>]*\bval="([0-9a-fA-F]{6})"/) ?? firstMatch(block, /<a:sysClr\b[^>]*\blastClr="([0-9a-fA-F]{6})"/);
    if (hex) out[slot] = hex.toUpperCase();
  }
  return out;
}

function parseFonts(themeXml: string): { heading: string; body: string } | null {
  const major = firstMatch(themeXml, /<a:majorFont\b[^>]*>\s*<a:latin\b[^>]*\btypeface="([^"]*)"/);
  const minor = firstMatch(themeXml, /<a:minorFont\b[^>]*>\s*<a:latin\b[^>]*\btypeface="([^"]*)"/);
  if (!major || !minor) return null;
  return { heading: major.trim(), body: minor.trim() };
}

// The master says which scheme slot is the slide background (usually lt1, light
// decks; dk1 for dark decks).
function backgroundSlot(masterXml: string | null): "lt1" | "dk1" | "lt2" | "dk2" {
  const bg1 = masterXml ? firstMatch(masterXml, /<p:clrMap\b[^>]*\bbg1="(lt1|dk1|lt2|dk2)"/) : null;
  return (bg1 as "lt1" | "dk1" | "lt2" | "dk2" | null) ?? "lt1";
}

function slug(name: string): string {
  const s = name.replace(/\.(pptx|potx)$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || "imported";
}

export interface ImportOptions {
  /** Name for the theme. Defaults to the file name. */
  name?: string;
  /** Used to make the default name. */
  fileName?: string;
}

/**
 * Reads the theme from a .pptx or .potx file's bytes. Returns null if the file
 * is not a PowerPoint file, is too large, or has no usable color scheme.
 * Never throws.
 */
export async function importThemeFromPptx(bytes: Uint8Array | Buffer, options: ImportOptions = {}): Promise<Theme | null> {
  try {
    if (bytes.byteLength > MAX_FILE_BYTES) return null;
    const zip = await JSZip.loadAsync(bytes);
    if (Object.keys(zip.files).length > MAX_ENTRIES) return null;

    const themeXml = await readXml(zip, "ppt/theme/theme1.xml");
    if (!themeXml) return null;
    const colors = parseScheme(themeXml);
    const bgSlot = backgroundSlot(await readXml(zip, "ppt/slideMasters/slideMaster1.xml"));
    const background = colors[bgSlot];
    const accent = colors.accent1;
    if (!background || !accent) return null;

    const fonts = parseFonts(themeXml);
    const palette: Record<string, string> = {};
    for (const slot of SCHEME_SLOTS) if (colors[slot]) palette[slot] = colors[slot]!;

    return normalizeTheme({
      name: options.name ?? slug(options.fileName ?? "imported"),
      description: "Imported from a PowerPoint file.",
      background,
      accent,
      fonts: fonts ?? undefined,
      source: "pptx-import",
      palette,
    });
  } catch {
    return null;
  }
}
