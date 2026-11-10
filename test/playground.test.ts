import { describe, it, expect, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as engine from "../src/index.js";
import * as edit from "../src/edit.js";
import * as browser from "../src/browser.js";
import { createDocStore, createStore, handle, type DocStore, type Modules, type Store } from "../playground/api.js";

// The editor playground's backend (npm run editor) is the worked example of what a program offers the editor, so it is tested like code
// people copy: the same routes the page calls, with the real engine behind them.

const mods = { engine, edit, browser } as unknown as Modules;
let docs: Record<"pdf" | "docx", DocStore>;

async function call(store: Store, method: string, path: string, body?: unknown) {
  const req = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]), { method, url: path }) as unknown as IncomingMessage;
  const out: { status: number; headers: Record<string, string>; body: Buffer } = { status: 0, headers: {}, body: Buffer.alloc(0) };
  const fake = {
    statusCode: 200,
    setHeader(k: string, v: string) {
      out.headers[k.toLowerCase()] = v;
    },
    end(data?: string | Buffer) {
      out.status = fake.statusCode;
      out.body = Buffer.from(data ?? "");
    },
  };
  const res = fake as unknown as ServerResponse;
  const handled = await handle(req, res, mods, store, docs);
  return { handled, ...out, json: () => JSON.parse(out.body.toString("utf8")) };
}

describe("editor playground backend", () => {
  let store: Store;
  beforeEach(() => {
    store = createStore(browser.normalizeDeck(browser.EXAMPLE_DECK, { editing: true }));
    docs = { pdf: createDocStore(edit.normalizeDoc(browser.EXAMPLE_PDF, "pdf")), docx: createDocStore(edit.normalizeDoc(browser.EXAMPLE_DOCX, "docx")) };
  });

  it("leaves other paths alone", async () => {
    expect((await call(store, "GET", "/index.html")).handled).toBe(false);
  });

  it("saves with a version check and answers a stale save with the current deck", async () => {
    const first = await call(store, "GET", "/api/deck");
    const deck = first.json().deck;
    expect(first.json().version).toBe(1);
    const saved = await call(store, "PUT", "/api/deck", { deck: { ...deck, title: "Mine" }, baseVersion: 1 });
    expect(saved.json()).toEqual({ version: 2 });
    const stale = await call(store, "PUT", "/api/deck", { deck: { ...deck, title: "Late" }, baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.json().version).toBe(2);
    expect(stale.json().deck.title).toBe("Mine");
    // a poll sees nothing new at the current version, and the new deck for an older one
    expect((await call(store, "GET", "/api/deck?since=2")).json()).toEqual({ unchanged: true, version: 2 });
    expect((await call(store, "GET", "/api/deck?since=1")).json().deck.title).toBe("Mine");
  });

  it("keeps earlier versions and restores one", async () => {
    const deck = (await call(store, "GET", "/api/deck")).json().deck;
    await call(store, "PUT", "/api/deck", { deck: { ...deck, title: "Two" }, baseVersion: 1 });
    const list = (await call(store, "GET", "/api/snapshots")).json().snapshots;
    expect(list).toHaveLength(1);
    const restored = (await call(store, "POST", "/api/snapshots", { snapshotId: list[0].id })).json();
    expect(restored.version).toBe(3);
    expect(restored.deck.title).toBe(deck.title);
  });

  it("draws the deck, turns a slide free-form, and makes the file", async () => {
    const deck = (await call(store, "GET", "/api/deck")).json().deck;
    const preview = await call(store, "POST", "/api/preview", { deck, images: {} });
    expect(preview.status).toBe(200);
    expect(preview.json().slides.length).toBeGreaterThan(deck.slides.length - 1);

    const slide = deck.slides[0];
    const free = await call(store, "POST", "/api/free-form", { slide, deck: { background: deck.background, accent: deck.accent }, images: [] });
    expect(free.status).toBe(200);
    expect(free.json().slide.layout).toBe("canvas");

    const file = await call(store, "POST", "/api/export", { deck: { title: "T", slides: [slide] } });
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("presentationml");
    expect(file.body.subarray(0, 2).toString()).toBe("PK"); // a zip, which is what a .pptx is
  }, 60_000);

  it("says plainly when there is no model to ask", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const deck = (await call(store, "GET", "/api/deck")).json().deck;
      const asked = await call(store, "POST", "/api/ask", { prompt: "Make it shorter", slide: deck.slides[0], index: 0, total: 1, deck: {}, images: [] });
      expect(asked.status).toBe(503);
      expect(asked.json().error).toContain("ANTHROPIC_API_KEY");
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  describe("document routes", () => {
    it("keeps a document per file type, with the version check", async () => {
      const pdf = (await call(store, "GET", "/api/doc?kind=pdf")).json();
      const word = (await call(store, "GET", "/api/doc?kind=docx")).json();
      expect(pdf.doc.title).not.toBe(word.doc.title);
      const saved = await call(store, "PUT", "/api/doc?kind=pdf", { doc: { ...pdf.doc, title: "Mine" }, baseVersion: 1 });
      expect(saved.json()).toEqual({ version: 2 });
      const stale = await call(store, "PUT", "/api/doc?kind=pdf", { doc: { ...pdf.doc, title: "Late" }, baseVersion: 1 });
      expect(stale.status).toBe(409);
      expect(stale.json().doc.title).toBe("Mine");
      expect((await call(store, "GET", "/api/doc?kind=docx")).json().version).toBe(1); // the Word document is separate
      expect((await call(store, "GET", "/api/doc?kind=pdf&since=2")).json()).toEqual({ unchanged: true, version: 2 });
    });

    it("refuses what is not a document", async () => {
      expect((await call(store, "PUT", "/api/doc?kind=pdf", { doc: { sections: [] }, baseVersion: 1 })).status).toBe(400);
      expect((await call(store, "POST", "/api/doc/preview?kind=pdf", { doc: "no" })).status).toBe(400);
    });

    it("keeps earlier versions and restores one", async () => {
      const doc = (await call(store, "GET", "/api/doc?kind=pdf")).json().doc;
      await call(store, "PUT", "/api/doc?kind=pdf", { doc: { ...doc, title: "Two" }, baseVersion: 1 });
      const list = (await call(store, "GET", "/api/doc/snapshots?kind=pdf")).json().snapshots;
      expect(list).toHaveLength(1);
      const restored = await call(store, "POST", "/api/doc/snapshots?kind=pdf", { snapshotId: list[0].id });
      expect(restored.json().doc.title).toBe(doc.title);
    });

    it("draws the page with a tag on each section, and leaves out empty parts", async () => {
      const doc = { title: "T", sections: [{ heading: "A", paragraphs: ["hello"] }, {}, { heading: "C", paragraphs: [""] }] };
      const r = await call(store, "POST", "/api/doc/preview?kind=pdf", { doc });
      const { html } = r.json();
      expect(html).toContain('<section data-s="0">');
      expect(html).toContain("hello");
      expect(html).toContain('<section data-s="2">'); // C keeps its own number although the empty one before it is not drawn
      expect(html).not.toContain('data-s="1"');
    });

    it("needs a model for the ask routes", async () => {
      const prev = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const doc = (await call(store, "GET", "/api/doc?kind=pdf")).json().doc;
      expect((await call(store, "POST", "/api/doc/ask?kind=pdf", { prompt: "shorter", section: doc.sections[0], index: 0, doc })).status).toBe(503);
      expect((await call(store, "POST", "/api/doc/ask-document?kind=pdf", { prompt: "" , doc })).status).toBe(400);
      if (prev) process.env.ANTHROPIC_API_KEY = prev;
    });

    it("makes the Word file", async () => {
      const doc = (await call(store, "GET", "/api/doc?kind=docx")).json().doc;
      const r = await call(store, "POST", "/api/doc/export?kind=docx", { doc });
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toContain("wordprocessingml");
      expect(r.body.subarray(0, 2).toString()).toBe("PK");
    });
  });
});
