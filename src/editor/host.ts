import type { CoverFields } from "../edit/coverAsk.js";
import type { SlideContent, SlideDeck } from "../pptx/presentationBuilder.js";
import type { RecordedDeck } from "../pptx/pptRecorded.js";

// What the deck editor needs from the program it runs in. The editor itself keeps no server, store or account: everything that does goes
// through a `DeckEditorHost`, so it can be used with any backend. The Ail app's implementation (fetch calls to its own routes) is a
// good worked example; a minimal one needs only `preview`, `save`, `ask`, `freeForm` and `download`.

/** A picture the person can put on slides. `dataUrl` holds its pixels, for drawing. */
export interface EditorPicture {
  id: string;
  label: string;
  description?: string;
  width: number;
  height: number;
  dataUrl: string;
  /** Chosen as the background of the whole deck in the picture settings. */
  background?: boolean;
  /** The background was chosen and then switched off. */
  backgroundOff?: boolean;
}

export interface EditorLogo {
  enabled: boolean;
  dataUrl?: string | null;
  corner: string;
  round: boolean;
}

export interface PictureMeta {
  width: number;
  height: number;
  label: string;
}

export interface AskArgs {
  prompt: string;
  slide: SlideContent;
  index: number;
  total: number;
  deck: { title?: string; background?: string; accent?: string; fontPair?: string; backgroundImage?: string };
  images: { id: string; label: string; description?: string; width: number; height: number }[];
  /** The request was spoken (talk mode), so the person is waiting for the answer to carry on talking: favour speed, for example with a quicker model. */
  fast?: boolean;
}

export interface AskCoverArgs {
  prompt: string;
  /** The cover as it is now (see `coverOf` in ail-files/edit). */
  cover: CoverFields;
  /** How many slides follow the cover. */
  total: number;
  images: { id: string; label: string; description?: string; width: number; height: number }[];
  fast?: boolean;
}

/** What talk mode reports, with no words from the person: only what happened. A host can count these to see whether talking works. */
export interface VoiceEvent {
  type: "talk_start" | "talk_request" | "talk_command" | "talk_blocked" | "talk_trouble" | "talk_undo_after" | "talk_limit";
  /** For example the command ("next", "undo") or the kind of trouble ("silence"). */
  detail?: string;
  /** For a request: whether it changed the slide. */
  ok?: boolean;
}

export interface FreeFormArgs {
  slide: SlideContent;
  deck: { background?: string; accent?: string; fontPair?: string };
  images: { id: string; label: string; width: number; height: number }[];
}

export type SaveResult =
  | { status: "saved"; version: number }
  /** Someone saved first: the deck as it is now, and its version, so the editor can merge. */
  | { status: "conflict"; version: number; deck: SlideDeck }
  | { status: "error"; message?: string };

export interface DeckEditorHost {
  /** Draw the deck: what `recordDeck(deck, options)` returns, computed wherever the engine runs. Null when it cannot be drawn. */
  preview(args: { deck: SlideDeck; images: Record<string, PictureMeta>; logo?: { corner: string; round: boolean; width?: number; height?: number } }): Promise<RecordedDeck | null>;
  /** Save the deck. `baseVersion` is the version the editor last loaded or saved; a newer one on the server is a conflict. */
  save(deck: SlideDeck, baseVersion: number): Promise<SaveResult>;
  /** Send what is unsaved while the page is closing (for example with `navigator.sendBeacon`). */
  flush?(deck: SlideDeck, baseVersion: number): void;
  /** Look for a newer version made elsewhere; null (or the same version) when there is none. Called every few seconds. */
  poll?(sinceVersion: number): Promise<{ version: number; deck: SlideDeck } | null>;
  /** Called after a newer deck arrives from `poll`, in case pictures came with it. */
  onRemoteChange?(): void;
  /** The model's new version of one slide ("Ask about this slide"), or an error to show. See `slideAskSystem` and `parseSlideReply` in ail-files/edit. */
  ask(args: AskArgs): Promise<{ slide?: SlideContent; error?: string; /** The person has used up their allowed changes for now (the editor counts it). */ limited?: boolean }>;
  /** Optional. The model's changes to the cover (the deck's title, subtitle, detail lines, colours, font style and background picture), as checked fields (see `coverAskSystem` and `parseCoverReply` in ail-files/edit). Leave out and the cover has no chat box. */
  askCover?(args: AskCoverArgs): Promise<{ cover?: CoverFields; error?: string; limited?: boolean }>;
  /** Optional. Told what happened in talk mode (never what was said), for example to count how it is used. */
  track?(event: VoiceEvent): void;
  /** Optional. In talk mode, a quick one-line spoken acknowledgement of the request ("Sure, making the title bigger."), from a fast model, asked for at the same time as `ask`. Null (or slower than about a second) and a generic line is said instead. */
  acknowledge?(prompt: string): Promise<string | null>;
  /** A normal slide turned into a free-form one (see `slideToFreeForm` in ail-files/edit), or an error to show. */
  freeForm(args: FreeFormArgs): Promise<{ slide?: SlideContent; error?: string }>;
  /** The finished file. `missing` lists pictures that are not here; with `allowMissingPictures` the file is made without them. */
  download(args: { deck: SlideDeck; allowMissingPictures: boolean }): Promise<{ ok: true; blob: Blob; filename: string } | { ok: false; error: string; missing?: string[] }>;
  /** Earlier versions of the deck. Leave out and the Versions button is not shown. */
  versions?: {
    list(): Promise<{ id: string; version: number; createdAt: string }[] | null>;
    restore(id: string): Promise<{ version: number; deck: SlideDeck } | null>;
  };
}

/** Hands a file to the browser as a download. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
