import { describe, expect, it } from "vitest";
import { applyCover, coverAskUser, coverOf, parseCoverReply } from "../src/edit/coverAsk.js";
import type { SlideDeck } from "../src/pptx/presentationBuilder.js";

const deck = { title: "Mercedes-Benz", subtitle: "Excellence in motion", meta: [{ label: "Date", value: "March" }], accent: "C0A060", background: "1A1A1A", backgroundImage: "img1", slides: [{ layout: "section", title: "One" }] } as unknown as SlideDeck;

describe("the cover's fields", () => {
  it("reads what the cover is made of", () => {
    const c = coverOf(deck);
    expect(c.title).toBe("Mercedes-Benz");
    expect(c.meta).toEqual([{ label: "Date", value: "March" }]);
    expect(c.fontPair).toBeNull();
  });
  it("tells the model the fields, the pictures and the request", () => {
    const text = coverAskUser({ prompt: "shorter subtitle", cover: coverOf(deck), images: [{ id: "img1", label: "Car", width: 10, height: 5 }], total: 12 });
    expect(text).toContain("shorter subtitle");
    expect(text).toContain("img1: Car");
    expect(text).toContain("Mercedes-Benz");
  });
});

describe("parseCoverReply", () => {
  it("keeps only the fields the model sent, checked", () => {
    const r = parseCoverReply('Here you go:\n```json\n{"subtitle":"Performance and luxury","accent":"#1e3a8a","fontPair":"bold"}\n```')!;
    expect(r).toEqual({ subtitle: "Performance and luxury", accent: "1E3A8A", fontPair: "bold" });
  });
  it("takes a field away when it is empty", () => {
    expect(parseCoverReply('{"subtitle":"","meta":[],"background":""}')).toEqual({ subtitle: null, meta: null, background: null });
  });
  it("drops a bad colour, a bad font and a picture the person does not have", () => {
    const r = parseCoverReply('{"accent":"blue","fontPair":"comic","backgroundImage":"img9"}', ["img1"])!;
    expect(r).toEqual({ accent: null, fontPair: null, backgroundImage: null });
    expect(parseCoverReply('{"backgroundImage":"img1"}', ["img1"])).toEqual({ backgroundImage: "img1" });
    expect(parseCoverReply('{"backgroundImage":"none"}', ["img1"])).toEqual({ backgroundImage: "none" });
  });
  it("cuts long text and never empties the title", () => {
    expect(parseCoverReply(JSON.stringify({ title: "x".repeat(200) }))!.title).toHaveLength(90);
    expect(parseCoverReply('{"title":""}')).toEqual({});
  });
  it("accepts an empty object (nothing to change) and refuses what is not JSON", () => {
    expect(parseCoverReply("{}")).toEqual({});
    expect(parseCoverReply("I changed the title")).toBeNull();
    expect(parseCoverReply("[1,2]")).toBeNull();
  });
  it("keeps at most four detail lines", () => {
    const meta = Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, value: `V${i}` }));
    expect(parseCoverReply(JSON.stringify({ meta }))!.meta).toHaveLength(4);
  });
});

describe("applyCover", () => {
  it("changes only what was sent", () => {
    const next = applyCover(deck, { subtitle: "New line", accent: "1E3A8A" });
    expect(next.subtitle).toBe("New line");
    expect(next.accent).toBe("1E3A8A");
    expect(next.title).toBe("Mercedes-Benz");
    expect(next.background).toBe("1A1A1A");
    expect(next.slides).toBe(deck.slides);
    expect(deck.subtitle).toBe("Excellence in motion"); // the old deck is untouched
  });
  it("takes a field away on null", () => {
    const next = applyCover(deck, { subtitle: null, meta: null, backgroundImage: null });
    expect(next.subtitle).toBeUndefined();
    expect(next.meta).toBeUndefined();
    expect(next.backgroundImage).toBeUndefined();
    expect(next.accent).toBe("C0A060");
  });
});
