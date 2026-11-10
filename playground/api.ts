import type { IncomingMessage, ServerResponse } from "node:http";

// The backend of the editor playground (`npm run editor`): the few routes a program has to offer the editor, kept in memory on this
// machine. It is also a worked example of what a `DeckEditorHost` needs on the server side: draw the deck (recordDeck), save with a version
// check, convert a slide to free-form, make the file, and, if you give it an ANTHROPIC_API_KEY, answer "ask about this slide".
// Nothing here is part of the published package.

type Engine = typeof import("../src/index.js");
type Edit = typeof import("../src/edit.js");
type Browser = typeof import("../src/browser.js");
export interface Modules {
  engine: Engine;
  edit: Edit;
  browser: Browser;
}

export interface Store {
  version: number;
  deck: unknown;
  snapshots: { id: string; version: number; createdAt: string; deck: unknown }[];
}

/** The document editor's store (`?doc=pdf` or `?doc=docx` on the page): one document per file type. */
export interface DocStore {
  version: number;
  doc: unknown;
  snapshots: { id: string; version: number; createdAt: string; doc: unknown }[];
}

export function createDocStore(initial: unknown): DocStore {
  return { version: 1, doc: initial, snapshots: [] };
}

const MAX_SNAPSHOTS = 20;
const SNAPSHOT_EVERY_MS = 10_000;
const MAX_BODY = 40_000_000;

export function createStore(initial: unknown): Store {
  return { version: 1, deck: initial, snapshots: [] };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk as Buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Picture ids and sizes as the engine wants them for drawing: the pixels stay in the browser, a `ref:` stands in for them. */
function imageRefs(m: Modules, raw: unknown) {
  const out: Record<string, { data: string; width: number; height: number; label: string }> = {};
  if (raw && typeof raw === "object") {
    for (const [id, v] of Object.entries(raw as Record<string, { width?: number; height?: number; label?: string }>).slice(0, 12)) {
      if (m.browser.isImageId(id)) out[id] = { data: `ref:${id}`, width: Number(v?.width) || 0, height: Number(v?.height) || 0, label: typeof v?.label === "string" ? v.label.slice(0, 80) : id };
    }
  }
  return out;
}

/** Handles one request for `/api/...`. Returns false when the path is not one of ours. */
export async function handle(req: IncomingMessage, res: ServerResponse, m: Modules, store: Store, docs: Record<"pdf" | "docx", DocStore>): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;
  const route = `${req.method} ${url.pathname}`;
  try {

    // ── The document editor (Word and PDF) ────────────────────────────────────────────────────────
    if (url.pathname.startsWith("/api/doc")) {
      const kind = url.searchParams.get("kind") === "docx" ? "docx" : "pdf";
      const d = docs[kind];
      if (route === "GET /api/doc") {
        const since = Number(url.searchParams.get("since"));
        if (url.searchParams.has("since") && since === d.version) return send(res, 200, { unchanged: true, version: d.version }), true;
        return send(res, 200, { version: d.version, doc: d.doc }), true;
      }
      if (route === "PUT /api/doc") {
        const body = await readJson(req);
        const doc = m.edit.normalizeDoc(body?.doc, kind);
        if (!doc) return send(res, 400, { error: "That document can't be read." }), true;
        if (body?.baseVersion !== d.version) return send(res, 409, { version: d.version, doc: d.doc }), true;
        const last = d.snapshots[d.snapshots.length - 1];
        if (!last || Date.now() - new Date(last.createdAt).getTime() > SNAPSHOT_EVERY_MS) {
          d.snapshots.push({ id: `s${d.version}`, version: d.version, createdAt: new Date().toISOString(), doc: d.doc });
          if (d.snapshots.length > MAX_SNAPSHOTS) d.snapshots.shift();
        }
        d.doc = doc;
        d.version += 1;
        return send(res, 200, { version: d.version }), true;
      }
      if (route === "GET /api/doc/snapshots") return send(res, 200, { snapshots: d.snapshots.map(({ id, version, createdAt }) => ({ id, version, createdAt })).reverse() }), true;
      if (route === "POST /api/doc/snapshots") {
        const body = await readJson(req);
        const snap = d.snapshots.find((x) => x.id === body?.snapshotId);
        if (!snap) return send(res, 404, { error: "No such version." }), true;
        d.doc = snap.doc;
        d.version += 1;
        return send(res, 200, { version: d.version, doc: d.doc }), true;
      }
      if (route === "POST /api/doc/preview") {
        const body = await readJson(req);
        const doc = m.edit.normalizeDoc(body?.doc, kind);
        if (!doc) return send(res, 400, { error: "That document can't be drawn." }), true;
        const clean = m.edit.cleanForExport(doc, kind, undefined, { anchors: true });
        // The page the PDF maker draws, with each section tagged so the editor can find it. The playground keeps pictures in the browser, so it has none to draw.
        const html = m.engine.renderGeneralPdfHtml(clean as never, { border: clean.border === true, anchors: true });
        return send(res, 200, { html }), true;
      }
      if (route === "POST /api/doc/ask" || route === "POST /api/doc/ask-document") {
        const body = await readJson(req);
        const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
        if (!prompt || prompt.length > m.edit.MAX_DOC_ASK_CHARS) return send(res, 400, { error: `Say what to change, in up to ${m.edit.MAX_DOC_ASK_CHARS} characters.` }), true;
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) return send(res, 503, { error: "The playground has no model. Start it with ANTHROPIC_API_KEY set to try this box." }), true;
        const images = ((body?.images as { id: string; label?: string; description?: string; width?: number; height?: number }[]) ?? []).map((i) => ({ id: i.id, label: i.label ?? i.id, description: i.description, width: Number(i.width) || 0, height: Number(i.height) || 0 }));
        const whole = route.endsWith("ask-document");
        const current = m.edit.normalizeDoc(body?.doc, kind);
        if (!current) return send(res, 400, { error: "That document can't be read." }), true;
        const answer = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: process.env.PLAYGROUND_MODEL ?? "claude-sonnet-5-5",
            max_tokens: whole ? 8000 : 3000,
            system: whole ? m.edit.documentAskSystem(kind) : m.edit.sectionAskSystem(kind),
            messages: [{ role: "user", content: whole ? m.edit.documentAskUser({ prompt, doc: current, images }) : m.edit.sectionAskUser({ prompt, section: (body?.section ?? {}) as never, doc: current, index: Number(body?.index) || 0, images }) }],
          }),
        });
        if (!answer.ok) return send(res, 502, { error: "The model could not be reached. Check ANTHROPIC_API_KEY." }), true;
        const data = (await answer.json()) as { content?: { type: string; text?: string }[] };
        const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
        if (whole) {
          const next = m.edit.parseDocumentReply(text, kind, current, images.map((i) => i.id));
          return next ? send(res, 200, { doc: next }) : send(res, 502, { error: "The answer wasn't a usable document. Try saying it another way." }), true;
        }
        const section = m.edit.parseSectionReply(text, kind, images.map((i) => i.id));
        return section ? send(res, 200, { section }) : send(res, 502, { error: "The answer wasn't a usable section. Try saying it another way." }), true;
      }
      if (route === "POST /api/doc/export") {
        const body = await readJson(req);
        const doc = m.edit.normalizeDoc(body?.doc, kind);
        if (!doc) return send(res, 400, { error: "That document can't be made into a file." }), true;
        const clean = m.edit.cleanForExport(doc, kind);
        const bytes = kind === "pdf" ? await m.engine.buildGeneralPdf(clean as never, { pageNumbers: clean.pageNumbers !== false, border: clean.border === true }) : await m.engine.buildGeneralDocx(clean as never, { pageNumbers: clean.pageNumbers !== false, border: clean.border === true });
        res.statusCode = 200;
        res.setHeader("Content-Type", kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.end(Buffer.from(bytes));
        return true;
      }
    }

    if (route === "GET /api/deck") {
      const since = Number(url.searchParams.get("since"));
      if (url.searchParams.has("since") && since === store.version) return send(res, 200, { unchanged: true, version: store.version }), true;
      return send(res, 200, { version: store.version, deck: store.deck }), true;
    }

    if (route === "PUT /api/deck") {
      const body = await readJson(req);
      const deck = m.browser.normalizeDeck(body?.deck, { editing: true });
      if (!deck) return send(res, 400, { error: "That deck can't be read." }), true;
      // Someone saved first (another tab): send the deck as it is now so the editor can merge.
      if (body?.baseVersion !== store.version) return send(res, 409, { version: store.version, deck: store.deck }), true;
      const last = store.snapshots[store.snapshots.length - 1];
      if (!last || Date.now() - new Date(last.createdAt).getTime() > SNAPSHOT_EVERY_MS) {
        store.snapshots.push({ id: `s${store.version}`, version: store.version, createdAt: new Date().toISOString(), deck: store.deck });
        if (store.snapshots.length > MAX_SNAPSHOTS) store.snapshots.shift();
      }
      store.deck = deck;
      store.version += 1;
      return send(res, 200, { version: store.version }), true;
    }

    if (route === "GET /api/snapshots") {
      return send(res, 200, { snapshots: store.snapshots.map(({ id, version, createdAt }) => ({ id, version, createdAt })).reverse() }), true;
    }
    if (route === "POST /api/snapshots") {
      const body = await readJson(req);
      const snap = store.snapshots.find((s) => s.id === body?.snapshotId);
      if (!snap) return send(res, 404, { error: "No such version." }), true;
      store.deck = snap.deck;
      store.version += 1;
      return send(res, 200, { version: store.version, deck: store.deck }), true;
    }

    if (route === "POST /api/preview") {
      const body = await readJson(req);
      const deck = m.browser.normalizeDeck(body?.deck, { editing: true });
      if (!deck) return send(res, 400, { error: "That deck can't be drawn." }), true;
      // The playground has no logo; a program with one passes `{ data: "ref:logo", width, height, corner, round }` here, as the Ail app does.
      const recorded = await m.engine.recordDeck(deck, { pageNumbers: true, images: imageRefs(m, body?.images) });
      return send(res, 200, recorded), true;
    }

    if (route === "POST /api/free-form") {
      const body = await readJson(req);
      if (!body?.slide || typeof body.slide !== "object") return send(res, 400, { error: "Send the slide to convert." }), true;
      const d = (body.deck && typeof body.deck === "object" ? body.deck : {}) as Record<string, unknown>;
      const checked = m.browser.normalizeDeck({ background: d.background, accent: d.accent, fontPair: d.fontPair, slides: [body.slide] }, { editing: true });
      if (!checked) return send(res, 400, { error: "That slide can't be read." }), true;
      const drawn = await m.engine.recordDeck(checked, { pageNumbers: false, images: imageRefs(m, Object.fromEntries(((body.images as { id: string }[]) ?? []).map((i) => [i.id, i]))) });
      const converted = m.edit.slideToFreeForm({ slide: checked.slides[0], drawn: drawn.slides[0], icons: drawn.icons, iconColors: drawn.iconColors, palette: m.engine.slidePalette(checked, checked.slides[0]), logoDrawn: false });
      const result = converted ? (m.browser.normalizeDeck({ slides: [converted] }, { editing: true })?.slides[0] ?? null) : null;
      if (!result) return send(res, 422, { error: "This slide has a chart or table that free-form can't carry over exactly." }), true;
      return send(res, 200, { slide: result }), true;
    }

    if (route === "POST /api/ask") {
      const body = await readJson(req);
      const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt || prompt.length > m.edit.MAX_ASK_CHARS) return send(res, 400, { error: `Say what to change, in up to ${m.edit.MAX_ASK_CHARS} characters.` }), true;
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return send(res, 503, { error: "The playground has no model. Start it with ANTHROPIC_API_KEY set to try this box." }), true;
      const images = ((body?.images as { id: string; label?: string; description?: string; width?: number; height?: number }[]) ?? []).map((i) => ({ id: i.id, label: i.label ?? i.id, description: i.description, width: Number(i.width) || 0, height: Number(i.height) || 0 }));
      const answer = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.PLAYGROUND_MODEL ?? "claude-sonnet-5-5",
          max_tokens: 4000,
          system: m.edit.slideAskSystem(images),
          messages: [{ role: "user", content: m.edit.slideAskUser({ prompt, slide: body?.slide, index: Number(body?.index) || 0, total: Number(body?.total) || 1, images, deck: (body?.deck ?? {}) as never }) }],
        }),
      });
      if (!answer.ok) return send(res, 502, { error: "The model could not be reached. Check ANTHROPIC_API_KEY." }), true;
      const data = (await answer.json()) as { content?: { type: string; text?: string }[] };
      const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      const slide = m.edit.parseSlideReply(text, images.map((i) => i.id));
      if (!slide) return send(res, 502, { error: "The answer wasn't a usable slide. Try saying it another way." }), true;
      return send(res, 200, { slide }), true;
    }

    if (route === "POST /api/ask-cover") {
      const body = await readJson(req);
      const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt || prompt.length > m.edit.MAX_ASK_CHARS) return send(res, 400, { error: `Say what to change, in up to ${m.edit.MAX_ASK_CHARS} characters.` }), true;
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return send(res, 503, { error: "The playground has no model. Start it with ANTHROPIC_API_KEY set to try this box." }), true;
      const images = ((body?.images as { id: string; label?: string; description?: string; width?: number; height?: number }[]) ?? []).map((i) => ({ id: i.id, label: i.label ?? i.id, description: i.description, width: Number(i.width) || 0, height: Number(i.height) || 0 }));
      const answer = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.PLAYGROUND_MODEL ?? "claude-sonnet-5-5",
          max_tokens: 1500,
          system: m.edit.coverAskSystem(),
          messages: [{ role: "user", content: m.edit.coverAskUser({ prompt, cover: (body?.cover ?? {}) as never, images, total: Number(body?.total) || 1 }) }],
        }),
      });
      if (!answer.ok) return send(res, 502, { error: "The model could not be reached. Check ANTHROPIC_API_KEY." }), true;
      const data = (await answer.json()) as { content?: { type: string; text?: string }[] };
      const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      const cover = m.edit.parseCoverReply(text, images.map((i) => i.id));
      if (!cover) return send(res, 502, { error: "The answer wasn't usable. Try saying it another way." }), true;
      return send(res, 200, { cover }), true;
    }

    if (route === "POST /api/export") {
      const body = await readJson(req);
      const deck = m.browser.normalizeDeck(body?.deck, { editing: true });
      if (!deck) return send(res, 400, { error: "That deck can't be made into a file." }), true;
      const images = body?.images && Object.keys(body.images as object).length > 0 ? await m.engine.prepareImages(body.images, body.imageLabels) : undefined;
      if (images === null) return send(res, 400, { error: "A picture could not be read. Use PNG, JPEG or WebP." }), true;
      const bytes = await m.engine.buildPptx(deck, { pageNumbers: true, ...(images ? { images } : {}) });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", 'attachment; filename="deck.pptx"');
      res.end(bytes);
      return true;
    }

    return send(res, 404, { error: "No such route." }), true;
  } catch (e) {
    return send(res, 500, { error: e instanceof Error ? e.message : "Something went wrong." }), true;
  }
}
