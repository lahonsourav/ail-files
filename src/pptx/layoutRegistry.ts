import type PptxGenJS from "pptxgenjs";
import type { ThemeColors } from "./presentationBuilder.js";

// Community slide layouts.
//
// A layout is one file that says three things: what JSON it accepts
// (`normalize`), how to draw it on a slide (`render`), and an `example` used
// for the preview image and the tests. Register it and it can be used in any
// deck as { "layout": "<name>", ...your fields }. Nothing else in the engine
// needs to change. See CONTRIBUTING.md.

/** What `render` gets to draw with. */
export interface LayoutHelpers {
  /** The standard accent title bar with the title, the icon badge and the page number. Call it first unless you draw your own header. */
  chrome(title?: string): void;
  /** Removes markdown marks (** _ ` # etc.) so text is safe to put on a slide. Use it on every string you draw. */
  clean(text: string): string;
  /** The free area under the title bar, in inches. */
  contentTop: number;
  contentBottom: number;
  /** Slide size in inches (16:9). */
  slideWidth: number;
  slideHeight: number;
}

export interface LayoutContext {
  /** The pptxgenjs slide to draw on. */
  slide: PptxGenJS.Slide;
  /** The deck's palette. Every text color here is already readable on `colors.background`. */
  colors: ThemeColors;
  /** 1-based position of this slide, and the number of slides in the deck. */
  pageNumber: number;
  totalSlides: number;
  helpers: LayoutHelpers;
}

export interface CustomLayout<T = unknown> {
  /** Lowercase letters, digits and underscores, starting with a letter. Becomes the `layout` value in JSON. */
  name: string;
  /** One sentence on when to use it. Shown in the gallery, and used by AI tools to choose a layout. */
  description: string;
  /**
   * Cleans the raw JSON of one slide. Keep only what you understand, trim and limit lengths, and return
   * null if the slide cannot be drawn (it is then dropped). Never throw, and never trust the input.
   */
  normalize(raw: Record<string, unknown>): T | null;
  /** Draws the slide. Synchronous. Must not read files or use the network. */
  render(ctx: LayoutContext, data: T): void;
  /** A complete example slide (the same JSON a user would write). Used for the preview and the tests. */
  example: Record<string, unknown>;
}

/** Names the engine already uses. A community layout cannot take one. */
export const BUILTIN_LAYOUT_NAMES: readonly string[] = [
  "bullets", "stat", "comparison", "quote", "section", "table", "chart", "grid", "ranked", "timeline", "columns",
  "problem_solution", "team", "iconlist", "funnel", "stats_row", "process", "recommendation", "canvas", "thank_you",
  "presenter", "hero", "tiers", "recap", "glossary", "roadmap", "matrix", "flowchart", "calendar", "gallery",
  "quote_carousel", "advanced_table", "custom",
];

const NAME_RE = /^[a-z][a-z0-9_]{1,39}$/;
const layouts = new Map<string, CustomLayout<never>>();

/** Identity helper that gives your layout its types. */
export function defineLayout<T>(layout: CustomLayout<T>): CustomLayout<T> {
  return layout;
}

/** Adds a layout. Registering the same object again is fine; a different layout with a taken name throws. */
export function registerLayout<T>(layout: CustomLayout<T>): void {
  if (!NAME_RE.test(layout.name)) {
    throw new Error(`Layout name "${layout.name}" must be lowercase letters, digits and underscores, 2 to 40 characters, starting with a letter.`);
  }
  if (BUILTIN_LAYOUT_NAMES.includes(layout.name)) {
    throw new Error(`Layout name "${layout.name}" is already used by a built-in layout.`);
  }
  if (typeof layout.normalize !== "function" || typeof layout.render !== "function") {
    throw new Error(`Layout "${layout.name}" needs normalize and render functions.`);
  }
  const existing = layouts.get(layout.name);
  if (existing && existing !== (layout as unknown as CustomLayout<never>)) {
    throw new Error(`A layout named "${layout.name}" is already registered.`);
  }
  layouts.set(layout.name, layout as unknown as CustomLayout<never>);
}

export function getLayout(name: string): CustomLayout<unknown> | undefined {
  return layouts.get(name) as CustomLayout<unknown> | undefined;
}

export function listLayouts(): CustomLayout<unknown>[] {
  return [...layouts.values()] as CustomLayout<unknown>[];
}

/** For tests only. */
export function clearLayoutsForTests(): void {
  layouts.clear();
}
