import { createHash } from "node:crypto";
import { iconOfPng } from "./pptIcons.js";
import { SLIDE_H, SLIDE_W, type RecordedBackground, type RecordedDeck, type RecordedItem, type RecordedRun, type RecordedSlide, type RecordedSource } from "./pptRecorded.js";

// Stands in for pptxgenjs while the builder draws a deck (see recordDeck in lib/presentationBuilder.ts): every call the
// builder makes is written down instead of being turned into a file. The builder only ever calls addText, addShape,
// addImage, addChart, addTable and addNotes on a slide, and sets its background, so that is all this needs to be.

const clone = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

class RecordingSlide {
  items: RecordedItem[] = [];
  notes?: string;
  private bg: Record<string, unknown> | undefined;

  constructor(private readonly deck: DeckRecorder) {}

  get background() {
    return this.bg as { color?: string } | undefined;
  }
  set background(value: unknown) {
    this.bg = value as Record<string, unknown> | undefined;
  }
  recordedBackground(): RecordedBackground {
    const bg = (this.bg ?? {}) as { color?: string; image?: string; scrim?: number };
    return { ...(typeof bg.color === "string" ? { color: bg.color } : {}), ...(typeof bg.image === "string" ? { image: bg.image, scrim: bg.scrim } : {}) };
  }

  addText(text: string | RecordedRun[], opts: Record<string, unknown> = {}) {
    this.items.push({ kind: "text", text: clone(text), opts: clone(opts) });
    return this;
  }
  addShape(shape: unknown, opts: Record<string, unknown> = {}) {
    this.items.push({ kind: "shape", shape: String(shape), opts: clone(opts) });
    return this;
  }
  addImage(opts: Record<string, unknown>) {
    const { data, path, ...rest } = opts as { data?: string; path?: string } & Record<string, unknown>;
    const src = this.deck.source(data ?? path);
    if (src) this.items.push({ kind: "image", src, opts: clone(rest) });
    return this;
  }
  addChart(chartType: unknown, data: unknown, opts: Record<string, unknown> = {}) {
    this.items.push({ kind: "chart", chartType: clone(chartType), data: clone(data), opts: clone(opts) });
    return this;
  }
  addTable(rows: unknown, opts: Record<string, unknown> = {}) {
    this.items.push({ kind: "table", rows: clone(rows), opts: clone(opts) });
    return this;
  }
  addNotes(notes: string) {
    this.notes = notes;
    return this;
  }
}

export class DeckRecorder {
  private slides: RecordingSlide[] = [];
  private assets: Record<string, string> = {};
  private icons: Record<string, string> = {};
  private iconColors: Record<string, string> = {};

  addSlide() {
    const slide = new RecordingSlide(this);
    this.slides.push(slide);
    return slide;
  }

  /** "ref:img1" is left for the client to fill in; any other picture data is stored once, by content. */
  source(value: string | undefined): RecordedSource | null {
    if (!value) return null;
    if (value.startsWith("ref:")) return { ref: value.slice(4) };
    const id = "a" + createHash("sha1").update(value).digest("hex").slice(0, 12);
    this.assets[id] = value.startsWith("data:") ? value : `data:${value}`;
    const icon = iconOfPng(value);
    if (icon) {
      this.icons[id] = icon.icon;
      this.iconColors[id] = icon.color;
    }
    return { asset: id };
  }

  result(): RecordedDeck {
    const slides: RecordedSlide[] = this.slides.map((s) => ({ background: s.recordedBackground(), items: s.items, ...(s.notes ? { notes: s.notes } : {}) }));
    return { width: SLIDE_W, height: SLIDE_H, slides, assets: this.assets, ...(Object.keys(this.icons).length > 0 ? { icons: this.icons, iconColors: this.iconColors } : {}) };
  }
}
