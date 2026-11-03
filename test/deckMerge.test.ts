import { describe, it, expect } from "vitest";
import { mergeDecks } from "../src/edit/deckMerge.js";
import type { SlideDeck } from "../src/pptx/presentationBuilder.js";

const slide = (title: string, extra: Record<string, unknown> = {}) => ({ layout: "bullets", title, bullets: ["a", "b"], ...extra });
const deck = (slides: unknown[], extra: Record<string, unknown> = {}) => ({ title: "Deck", slides, ...extra }) as unknown as SlideDeck;
const titles = (d: SlideDeck | null) => (d?.slides as { title?: string }[] | undefined)?.map((s) => s.title);

describe("mergeDecks", () => {
  const base = deck([slide("One"), slide("Two"), slide("Three")]);

  it("keeps edits to different slides from both sides", () => {
    const mine = deck([slide("One edited"), slide("Two"), slide("Three")]);
    const theirs = deck([slide("One"), slide("Two"), slide("Three edited")]);
    expect(titles(mergeDecks(base, mine, theirs))).toEqual(["One edited", "Two", "Three edited"]);
  });

  it("takes the other side's slides when this side changed none", () => {
    const theirs = deck([slide("One"), slide("Two"), slide("Three"), slide("Four")]);
    expect(titles(mergeDecks(base, base, theirs))).toEqual(["One", "Two", "Three", "Four"]);
  });

  it("keeps this side's slides when the other side changed none", () => {
    const mine = deck([slide("One"), slide("Three")]);
    expect(titles(mergeDecks(base, mine, base))).toEqual(["One", "Three"]);
  });

  it("is a conflict when both sides changed the same slide differently", () => {
    const mine = deck([slide("One mine"), slide("Two"), slide("Three")]);
    const theirs = deck([slide("One theirs"), slide("Two"), slide("Three")]);
    expect(mergeDecks(base, mine, theirs)).toBeNull();
  });

  it("is fine when both sides made the same change", () => {
    const both = deck([slide("One same"), slide("Two"), slide("Three")]);
    expect(titles(mergeDecks(base, both, both))).toEqual(["One same", "Two", "Three"]);
  });

  it("is a conflict when both changed the list of slides and the lengths differ", () => {
    const mine = deck([slide("One"), slide("Two"), slide("Three"), slide("Mine")]);
    const theirs = deck([slide("One"), slide("Three")]);
    expect(mergeDecks(base, mine, theirs)).toBeNull();
  });

  it("merges deck-level fields separately from the slides", () => {
    const b = deck([slide("One")], { theme: "plain" });
    const mine = deck([slide("One edited")], { theme: "plain" });
    const theirs = deck([slide("One")], { theme: "forest" });
    const merged = mergeDecks(b, mine, theirs) as unknown as { theme: string; slides: { title: string }[] };
    expect(merged.theme).toBe("forest");
    expect(merged.slides[0].title).toBe("One edited");
  });

  it("is a conflict when both changed the same deck-level field differently", () => {
    const b = deck([slide("One")], { theme: "plain" });
    expect(mergeDecks(b, deck([slide("One")], { theme: "plum" }), deck([slide("One")], { theme: "forest" }))).toBeNull();
  });

  it("drops a field one side removed and the other left alone", () => {
    const b = deck([slide("One")], { subtitle: "Old" });
    const merged = mergeDecks(b, deck([slide("One")]), b) as unknown as Record<string, unknown>;
    expect("subtitle" in merged).toBe(false);
  });
});
