// What a deck looks like when it is drawn into a recorder instead of a .pptx file (lib/pptRecorder.ts): a flat list of
// positioned primitives per slide, in inches on a 10 x 5.625 slide, with every colour and size already worked out. The
// browser draws these (SlideStage), so a preview shows exactly what the export draws, for every layout. Types only,
// safe to import from client code.

export const SLIDE_W = 10;
export const SLIDE_H = 5.625;

/** One run of text with its own options (what pptxgenjs takes as an array of text pieces). */
export interface RecordedRun {
  text: string;
  options?: Record<string, unknown>;
}

/** Where a picture's pixels are: a stored asset (an icon, as a data URL in `assets`) or a reference the client fills in ("img1", "logo"). */
export type RecordedSource = { asset: string } | { ref: string };

export type RecordedItem =
  | { kind: "text"; text: string | RecordedRun[]; opts: Record<string, unknown> }
  | { kind: "shape"; shape: string; opts: Record<string, unknown> }
  | { kind: "image"; src: RecordedSource; opts: Record<string, unknown> }
  | { kind: "chart"; chartType: unknown; data: unknown; opts: Record<string, unknown> }
  | { kind: "table"; rows: unknown; opts: Record<string, unknown> };

export interface RecordedBackground {
  color?: string;
  /** A deck background picture (a ref such as "img1") washed with `color` at `scrim` (0 to 1), as the export does. */
  image?: string;
  scrim?: number;
}

export interface RecordedSlide {
  background: RecordedBackground;
  items: RecordedItem[];
  notes?: string;
}

export interface RecordedDeck {
  width: number;
  height: number;
  slides: RecordedSlide[];
  /** Small pictures used by items (icons), by id, as data URLs. */
  assets: Record<string, string>;
  /** Which icon an asset picture is, by asset id, for the ones that are icons. */
  icons?: Record<string, string>;
  /** The colour (hex) each icon asset was drawn in, by asset id. */
  iconColors?: Record<string, string>;
}
