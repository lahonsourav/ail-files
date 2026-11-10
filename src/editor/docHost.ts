import type { DocAskPicture } from "../edit/docAsk.js";
import type { DocContent, DocKind, DocSection } from "../edit/docEdit.js";
import type { VoiceEvent } from "./host.js";

// What the document editor needs from the program it runs in, like `DeckEditorHost` for decks: the editor keeps no server, store or
// account of its own. A minimal host needs only `preview`, `save`, `ask`, `askDocument` and `download`.

export type DocSaveResult =
  | { status: "saved"; version: number }
  /** Someone saved first: the document as it is now, and its version, so the editor can merge. */
  | { status: "conflict"; version: number; doc: DocContent }
  | { status: "error"; message?: string };

export interface DocEditorHost {
  /** The page as the file will draw it, as a complete HTML page (the PDF maker's own, with `data-s` on each section: see `anchors` in `renderGeneralPdfHtml`). Null when it cannot be drawn. */
  preview(args: { doc: DocContent; kind: DocKind }): Promise<{ html: string } | null>;
  /** Save the document. `baseVersion` is the version the editor last loaded or saved; a newer one on the server is a conflict. */
  save(doc: DocContent, baseVersion: number): Promise<DocSaveResult>;
  /** Send what is unsaved while the page is closing (for example with `navigator.sendBeacon`). */
  flush?(doc: DocContent, baseVersion: number): void;
  /** Look for a newer version made elsewhere; null (or the same version) when there is none. Called every few seconds. */
  poll?(sinceVersion: number): Promise<{ version: number; doc: DocContent } | null>;
  /** Called after a newer document arrives from `poll`, in case pictures came with it. */
  onRemoteChange?(): void;
  /** The model's new version of one section, or an error to show. See `sectionAskSystem` and `parseSectionReply` in ail-files/edit. */
  ask(args: { prompt: string; section: DocSection; index: number; doc: DocContent; kind: DocKind; images: DocAskPicture[]; fast?: boolean }): Promise<{ section?: DocSection; error?: string; limited?: boolean }>;
  /** The model's new version of the whole document, or an error to show. See `documentAskSystem` and `parseDocumentReply`. */
  askDocument(args: { prompt: string; doc: DocContent; kind: DocKind; images: DocAskPicture[]; fast?: boolean }): Promise<{ doc?: DocContent; error?: string; limited?: boolean }>;
  /** Optional. Told what happened in talk mode (never what was said). */
  track?(event: VoiceEvent): void;
  /** Optional. A quick one-line spoken acknowledgement of a spoken request, from a fast model. */
  acknowledge?(prompt: string): Promise<string | null>;
  /** The finished file. `missing` lists pictures that are not here; with `allowMissingPictures` the file is made without them. */
  download(args: { doc: DocContent; kind: DocKind; allowMissingPictures: boolean }): Promise<{ ok: true; blob: Blob; filename: string } | { ok: false; error: string; missing?: string[] }>;
  /** Earlier versions of the document. Leave out and the Versions button is not shown. */
  versions?: {
    list(): Promise<{ id: string; version: number; createdAt: string }[] | null>;
    restore(id: string): Promise<{ version: number; doc: DocContent } | null>;
  };
}
