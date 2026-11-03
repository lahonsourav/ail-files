import type { SlideDeck } from "../pptx/presentationBuilder.js";

// When someone has changed a deck by hand in the deck editor, Ail's own reply (still in the conversation) holds the old
// version. If that reply is the latest deck in the conversation, Ail is given the edited deck for as long as it stays the
// latest, so "change slide 2" starts from what the person has now, not from what Ail wrote.

const FENCE = "```slides";

/** The edited deck for the latest deck reply, as instructions for the model; "" when there is none or that reply was never edited. */
export function editedDeckNote(messages: { id: string; role: string; content: string }[], edited: { sourceMessageId: string | null; deck: SlideDeck }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.content.includes(FENCE)) continue;
    const found = edited.find((e) => e.sourceMessageId === m.id);
    if (!found) return ""; // the latest deck reply has not been edited: nothing to add
    return (
      "\n\nThe user has edited the deck from your last presentation reply by hand, in the deck editor. Their version is below and replaces yours. " +
      "When they ask you to change, extend or restyle the deck, start from this version, keep their edits (including a slide's own look settings: backgroundImage, background, accent, pageNumber, logo) unless they ask otherwise, and answer with the complete updated deck in a ```slides block. " +
      "Do not mention this note.\n" +
      `${FENCE}\n${JSON.stringify(found.deck)}\n\`\`\``
    );
  }
  return "";
}

/** True when any reply in the list holds a deck, so the edited decks are only looked up for conversations that have one. */
export function hasDeckReply(messages: { role: string; content: string }[]): boolean {
  return messages.some((m) => m.role === "assistant" && m.content.includes(FENCE));
}
