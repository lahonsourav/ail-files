import type { DocContent, DocKind } from "./docEdit.js";
import { cleanForExport } from "./docEdit.js";

// When someone has changed a Word or PDF document by hand in the document editor, Ail's own reply (still in the conversation) holds the
// old version. If that reply is the latest document in the conversation, Ail is given the edited one for as long as it stays the latest,
// so "add a conclusion" starts from what the person has now, not from what Ail wrote. The same idea as `editedDeckNote`.

const FENCES: Record<DocKind, string> = { pdf: "```pdf_doc", docx: "```docx_doc" };

/** The edited document for the latest document reply of this kind, as instructions for the model; "" when there is none or it was never edited. */
export function editedDocNote(kind: DocKind, messages: { id: string; role: string; content: string }[], edited: { sourceMessageId: string | null; doc: DocContent }[]): string {
  const fence = FENCES[kind];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.content.includes(fence)) continue;
    const found = edited.find((e) => e.sourceMessageId === m.id);
    if (!found) return "";
    // The empty parts, and the pictures and logo (which the model never writes), are left out of what it is shown.
    const { sections, title, subtitle } = cleanForExport(found.doc, kind);
    const shown = { title, ...(subtitle ? { subtitle } : {}), sections: sections.map(({ pictures: _p, anchor: _a, ...rest }) => rest) }; // eslint-disable-line @typescript-eslint/no-unused-vars
    return (
      `\n\nThe user has edited the ${kind === "pdf" ? "PDF" : "Word"} document from your last document reply by hand, in the document editor. Their version is below and replaces yours. ` +
      `When they ask you to change, extend or rewrite the document, start from this version, keep their edits unless they ask otherwise, and answer with the complete updated document in a ${fence} block. ` +
      "Do not mention this note.\n" +
      `${fence}\n${JSON.stringify(shown)}\n\`\`\``
    );
  }
  return "";
}

/** True when any reply in the list holds a document of this kind, so edited documents are only looked up for conversations that have one. */
export function hasDocReply(kind: DocKind, messages: { role: string; content: string }[]): boolean {
  return messages.some((m) => m.role === "assistant" && m.content.includes(FENCES[kind]));
}
