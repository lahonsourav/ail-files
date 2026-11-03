import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { DeckEditor, type DeckEditorHost } from "../src/editor.js";
import { normalizeDeck, EXAMPLE_DECK } from "../src/browser.js";

// The editor has to work with nothing but a `host` object: no Ail app, no server. This renders it with a stand-in host.

const host: DeckEditorHost = {
  preview: async () => null,
  save: async () => ({ status: "saved", version: 2 }),
  ask: async () => ({ error: "not here" }),
  freeForm: async () => ({ error: "not here" }),
  download: async () => ({ ok: false, error: "not here" }),
};

describe("ail-files/editor", () => {
  const deck = normalizeDeck(EXAMPLE_DECK, { editing: true })!;
  const props = { initialDeck: deck, initialVersion: 1, host, pictures: [], pictureMode: "use" as const, logo: { enabled: false, corner: "top-right", round: false } };

  it("renders the whole editor from a stand-in host", () => {
    const html = renderToString(createElement(DeckEditor, props));
    expect(html).toContain("Undo");
    expect(html).toContain("Download");
    expect(html).toContain("Drawing your slide"); // the host has not drawn anything yet
    expect(html).toContain("Ask Ail to change this slide");
    expect(html).toContain(deck.slides.length ? "Add slide after" : "");
  });

  it("shows Versions only when the host can list versions, and the program's own buttons and dialogs", () => {
    expect(renderToString(createElement(DeckEditor, props))).not.toContain("Versions");
    const withVersions = { ...host, versions: { list: async () => [], restore: async () => null } };
    const html = renderToString(createElement(DeckEditor, { ...props, host: withVersions, headerActions: createElement("button", null, "Collab"), dialogs: createElement("div", null, "A dialog") }));
    expect(html).toContain("Versions");
    expect(html).toContain("Collab");
    expect(html).toContain("A dialog");
  });

  it("does not mention the Ail app's storage or settings screens unless the program passes that wording in", () => {
    const html = renderToString(createElement(DeckEditor, props));
    expect(html).not.toContain("Images &amp; logo");
    expect(html).not.toContain("encrypted");
  });
});
