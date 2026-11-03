import { describe, it, expect } from "vitest";
import { editedDeckNote, hasDeckReply } from "../src/edit/deckContext.js";
import type { SlideDeck } from "../src/pptx/presentationBuilder.js";

const deckOf = (title: string) => ({ title, slides: [{ layout: "bullets", title: "A", bullets: ["x"] }] }) as SlideDeck;
const reply = (id: string, withDeck: boolean) => ({ id, role: "assistant", content: withDeck ? "Here.\n```slides\n{}\n```" : "Just text." });
const user = (id: string) => ({ id, role: "user", content: "hi" });

describe("editedDeckNote", () => {
  it("gives the edited deck when the latest deck reply was edited", () => {
    const note = editedDeckNote([user("u1"), reply("a1", true), user("u2")], [{ sourceMessageId: "a1", deck: deckOf("Edited title") }]);
    expect(note).toContain("edited the deck");
    expect(note).toContain("```slides");
    expect(note).toContain("Edited title");
  });

  it("keeps giving it on later turns while that reply is still the latest deck, even after text-only replies", () => {
    const messages = [user("u1"), reply("a1", true), user("u2"), reply("a2", false), user("u3")];
    expect(editedDeckNote(messages, [{ sourceMessageId: "a1", deck: deckOf("E") }])).toContain("```slides");
  });

  it("stops once Ail has made a newer deck", () => {
    const messages = [user("u1"), reply("a1", true), user("u2"), reply("a2", true), user("u3")];
    expect(editedDeckNote(messages, [{ sourceMessageId: "a1", deck: deckOf("Old edit") }])).toBe("");
  });

  it("says nothing when there is no edit, no deck, or the edit belongs to an earlier deck", () => {
    expect(editedDeckNote([user("u1"), reply("a1", true)], [])).toBe("");
    expect(editedDeckNote([user("u1"), reply("a1", false)], [{ sourceMessageId: "a1", deck: deckOf("E") }])).toBe("");
    expect(editedDeckNote([], [{ sourceMessageId: "a1", deck: deckOf("E") }])).toBe("");
  });
});

describe("hasDeckReply", () => {
  it("is true only when an assistant reply holds a deck", () => {
    expect(hasDeckReply([user("u1"), reply("a1", true)])).toBe(true);
    expect(hasDeckReply([user("u1"), reply("a1", false)])).toBe(false);
    expect(hasDeckReply([{ role: "user", content: "```slides" }])).toBe(false);
  });
});
