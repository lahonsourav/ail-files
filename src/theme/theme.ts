import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FONT_PAIRS, type FontPairKey, type SlideDeck } from "../pptx/presentationBuilder.js";

// A theme is a look for a deck: a background, an accent, and fonts. It is a
// small JSON file (see themes/ for the built-in ones), or it comes from a
// PowerPoint template with `ail-files import-theme`. Applying a theme sets
// those fields on a deck. Text colors are never part of a theme: the engine
// derives them from the background so text is always readable.

export interface Theme {
  /** Short name, lowercase letters, digits and dashes. Used on the command line. */
  name: string;
  description?: string;
  /** Hex color, 6 digits, no #. */
  background: string;
  /** Hex color, 6 digits, no #. */
  accent: string;
  /** One of the built-in font pairs. Used when `fonts` is not given. */
  fontPair?: FontPairKey;
  /** Exact font names. Wins over fontPair. */
  fonts?: { heading: string; body: string };
  /** "pptx-import" for a theme read from a PowerPoint file. */
  source?: "builtin" | "pptx-import";
  /** The template's whole color scheme, kept for reference. Not used when drawing. */
  palette?: Record<string, string>;
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;
const THEME_NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;

function hex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(HEX_RE);
  return m ? m[1].toUpperCase() : null;
}

/** Checks a theme from JSON and returns a clean copy, or null if it is not usable. */
export function normalizeTheme(raw: unknown): Theme | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const name = typeof t.name === "string" ? t.name.trim() : "";
  const background = hex(t.background);
  const accent = hex(t.accent);
  if (!THEME_NAME_RE.test(name) || !background || !accent) return null;

  const theme: Theme = { name, background, accent };
  if (typeof t.description === "string" && t.description.trim()) theme.description = t.description.trim().slice(0, 200);
  if (typeof t.fontPair === "string" && t.fontPair in FONT_PAIRS) theme.fontPair = t.fontPair as FontPairKey;
  if (t.fonts && typeof t.fonts === "object") {
    const f = t.fonts as Record<string, unknown>;
    const heading = typeof f.heading === "string" ? f.heading.trim() : "";
    const body = typeof f.body === "string" ? f.body.trim() : "";
    if (FONT_NAME_RE.test(heading) && FONT_NAME_RE.test(body)) theme.fonts = { heading, body };
  }
  if (t.source === "builtin" || t.source === "pptx-import") theme.source = t.source;
  if (t.palette && typeof t.palette === "object") {
    const palette: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.palette as Record<string, unknown>)) {
      const c = hex(v);
      if (c && /^[a-zA-Z0-9]{2,12}$/.test(k)) palette[k] = c;
    }
    if (Object.keys(palette).length) theme.palette = palette;
  }
  return theme;
}

/** Returns the deck with the theme's background, accent and fonts set. The deck itself is not changed. */
export function applyTheme(deck: SlideDeck, theme: Theme): SlideDeck {
  return {
    ...deck,
    background: theme.background,
    accent: theme.accent,
    fontPair: theme.fontPair ?? deck.fontPair,
    fonts: theme.fonts,
  };
}

const THEMES_DIR = fileURLToPath(new URL("../../themes/", import.meta.url));

/** The built-in themes in the themes folder, in alphabetical order. */
export function listThemes(dir: string = THEMES_DIR): Theme[] {
  const themes: Theme[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const theme = normalizeTheme(JSON.parse(readFileSync(join(dir, file), "utf8")));
    if (theme) themes.push(theme);
  }
  return themes;
}

/** A built-in theme by name, or null. */
export function getTheme(name: string, dir: string = THEMES_DIR): Theme | null {
  return listThemes(dir).find((t) => t.name === name) ?? null;
}
