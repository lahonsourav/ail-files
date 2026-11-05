import { describe, it, expect } from "vitest";
import { parseSlideReply, slideAskSystem, slideAskUser, needsFreeForm } from "../src/edit/slideAsk.js";

const images = [{ id: "img1", label: "Poster", description: "A poster of a lighthouse", width: 1600, height: 900 }];

describe("slide ask: the prompt", () => {
  it("tells the model to change one slide, keep the rest, and reply with only its JSON", () => {
    const system = slideAskSystem(images);
    expect(system).toMatch(/ONE slide/);
    expect(system).toMatch(/ONLY the complete JSON object/);
    expect(system).toMatch(/"pictures"/);
    expect(system).toMatch(/"canvas"/); // the deck's own slide formats follow the rules
  });

  it("gives the slide, the request, the deck's look and the pictures in the user turn", () => {
    const user = slideAskUser({ prompt: "make it shorter", slide: { layout: "bullets", title: "A", bullets: ["x"] }, index: 2, total: 5, images, deck: { title: "Deck", background: "FFFFFF", accent: "2563EB", backgroundImage: "img1" } });
    expect(user).toContain("slide 3");
    expect(user).toContain("5 slides");
    expect(user).toContain("make it shorter");
    expect(user).toContain('"layout":"bullets"');
    expect(user).toContain("img1: Poster (A poster of a lighthouse), 1600x900");
    expect(user).toContain("background picture img1");
  });
});

describe("slide ask: reading the reply", () => {
  const good = { layout: "bullets", title: "Short", bullets: ["one", "two"] };

  it("reads a bare object, a fenced one, and one with a sentence around it", () => {
    for (const text of [JSON.stringify(good), "```json\n" + JSON.stringify(good) + "\n```", "Here you go: " + JSON.stringify(good) + " Done."]) {
      expect(parseSlideReply(text)).toMatchObject({ layout: "bullets", title: "Short", bullets: ["one", "two"] });
    }
  });

  it("returns null when there is no usable slide", () => {
    expect(parseSlideReply("Sorry, I can't.")).toBeNull();
    expect(parseSlideReply("{not json}")).toBeNull();
    expect(parseSlideReply("[1,2,3]")).toBeNull();
  });

  it("checks the slide like any other: invented fields go, the slide's own look settings stay", () => {
    const slide = parseSlideReply(JSON.stringify({ ...good, hacked: true, background: "#102030", logo: false, pictures: [{ image: "img1", x: 6, y: 1.4, w: 3.4, h: 2.6 }] }))!;
    expect(slide).not.toHaveProperty("hacked");
    expect(slide).toMatchObject({ background: "102030", logo: false });
    expect((slide as { pictures: unknown[] }).pictures).toHaveLength(1);
  });

  it("takes off pictures the person doesn't have", () => {
    const text = JSON.stringify({ ...good, backgroundImage: "img3", pictures: [{ image: "img1", x: 1, y: 1, w: 2, h: 2 }, { image: "img4", x: 4, y: 1, w: 2, h: 2 }] });
    const slide = parseSlideReply(text, ["img1"])! as unknown as { pictures: { image: string }[]; backgroundImage?: string };
    expect(slide.pictures.map((p) => p.image)).toEqual(["img1"]);
    expect(slide.backgroundImage).toBeUndefined();
    const none = parseSlideReply(JSON.stringify({ ...good, pictures: [{ image: "img4", x: 1, y: 1, w: 2, h: 2 }] }), ["img1"]) as unknown as { pictures?: unknown };
    expect(none.pictures).toBeUndefined();
  });

  it("turns a free-form picture of an unknown id into an empty picture box", () => {
    const text = JSON.stringify({ layout: "canvas", title: "Free", elements: [{ type: "image", x: 1, y: 1.5, w: 3, h: 2, image: "img9" }] });
    const slide = parseSlideReply(text, ["img1"]) as unknown as { elements: { image?: string; placeholder?: string }[] };
    expect(slide.elements[0].image).toBeUndefined();
    expect(slide.elements[0].placeholder).toBeTruthy();
  });
});

describe("slide ask: text colour on a free-form slide", () => {
  it("tells the model how to give canvas text its own colour", () => {
    expect(slideAskSystem(images)).toMatch(/"color": a 6 digit hex/);
  });
  it("keeps the colours the model set on text elements, and drops one that is not a hex", () => {
    const reply = JSON.stringify({ layout: "canvas", elements: [{ type: "text", x: 1, y: 1, w: 4, h: 1, text: "A", color: "FFFFFF" }, { type: "text", x: 1, y: 2, w: 4, h: 1, text: "B", color: "white" }] });
    const slide = parseSlideReply(reply) as unknown as { elements: { color?: string }[] };
    expect(slide.elements.map((e) => e.color)).toEqual(["FFFFFF", undefined]);
  });
});

describe("needsFreeForm", () => {
  it.each([
    "change the text colour to white",
    "make the font bigger",
    "make the title smaller",
    "move the picture down",
    "centre the text",
    "Change the background to blue and text color to white and change the list to a table",
  ])("is true for: %s", (p) => expect(needsFreeForm(p)).toBe(true));
  it.each(["make the title shorter", "change the list to a table", "change the background to blue", "add a bullet about pricing", "translate this to Hindi"])("is false for: %s", (p) => expect(needsFreeForm(p)).toBe(false));
});
