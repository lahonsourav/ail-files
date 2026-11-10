import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { DeckEditor, DocEditor, PressEffect, barButtonClass, type DeckEditorHost, type DocEditorHost, type EditorPicture } from "../src/editor.js";
import type { DocContent, DocKind } from "../src/edit.js";
import { imageIdsInDeck, IMAGE_LIMITS, type SlideDeck } from "../src/browser.js";
import "./styles.css";

// The editor on a page, with `host` talking to the little backend in api.ts. This is the whole of what a program does to use the editor:
// give it a deck, the pictures, and a host. Read it together with src/editor/host.ts.

const SAMPLES: [string, string, string][] = [
  [
    "Lighthouse",
    "Dusk on the coast",
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".6" stop-color="#7c3aed"/><stop offset="1" stop-color="#f9a8d4"/></linearGradient></defs><rect width="800" height="450" fill="url(#s)"/><circle cx="640" cy="105" r="45" fill="#fde68a"/><rect y="300" width="800" height="150" fill="#172554"/><polygon points="345,300 385,300 375,150 355,150" fill="#f8fafc"/><rect x="347" y="134" width="36" height="18" fill="#fde68a"/><polygon points="345,134 385,134 365,112" fill="#1f2937"/></svg>`,
  ],
  [
    "Team",
    "The people",
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0ea5e9"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="600" height="600" fill="url(#b)"/><g fill="#fff" opacity=".92"><circle cx="180" cy="235" r="60"/><rect x="110" y="310" width="140" height="165" rx="70"/><circle cx="420" cy="235" r="60"/><rect x="350" y="310" width="140" height="165" rx="70"/></g><g fill="#fde68a"><circle cx="300" cy="200" r="70"/><rect x="220" y="285" width="160" height="200" rx="80"/></g></svg>`,
  ],
  [
    "Backdrop",
    "A background",
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d4ed8"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><g fill="#fff" opacity=".1"><circle cx="150" cy="100" r="130"/><circle cx="650" cy="350" r="170"/></g></svg>`,
  ],
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("The picture could not be read."));
    el.src = src;
  });
}

/** The sample drawings as PNGs: the engine takes PNG, JPEG or WebP, never SVG. */
async function samplePictures(): Promise<EditorPicture[]> {
  return Promise.all(
    SAMPLES.map(async ([label, description, svg], i) => {
      const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      return { id: `img${i + 1}`, label, description, width: img.width, height: img.height, dataUrl: canvas.toDataURL("image/png") };
    })
  );
}

const post = (path: string, body: unknown) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function App() {
  const [loaded, setLoaded] = useState<{ version: number; deck: SlideDeck } | null>(null);
  const [pictures, setPictures] = useState<EditorPicture[]>([]);

  useEffect(() => {
    void (async () => {
      setPictures(await samplePictures());
      setLoaded((await (await fetch("/api/deck")).json()) as { version: number; deck: SlideDeck });
    })();
  }, []);

  // The pictures the download needs are read when it is pressed, so the host itself never has to change.
  const [latestPictures, setLatestPictures] = useState(pictures);
  useEffect(() => setLatestPictures(pictures), [pictures]);

  const host = useMemo<DeckEditorHost>(
    () => ({
      async preview({ deck, images }) {
        const res = await post("/api/preview", { deck, images });
        return res.ok ? await res.json() : null;
      },
      async save(deck, baseVersion) {
        const res = await fetch("/api/deck", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deck, baseVersion }) });
        if (res.ok) return { status: "saved", version: ((await res.json()) as { version: number }).version };
        if (res.status === 409) return { status: "conflict", ...((await res.json()) as { version: number; deck: SlideDeck }) };
        return { status: "error", message: ((await res.json().catch(() => null)) as { error?: string } | null)?.error };
      },
      async poll(since) {
        const data = (await (await fetch(`/api/deck?since=${since}`, { cache: "no-store" })).json()) as { unchanged?: boolean; version: number; deck?: SlideDeck };
        return data.unchanged || !data.deck ? null : { version: data.version, deck: data.deck };
      },
      async ask(args) {
        const res = await post("/api/ask", args);
        return (await res.json().catch(() => ({}))) as { slide?: never; error?: string };
      },
      async askCover(args) {
        const res = await post("/api/ask-cover", args);
        return (await res.json().catch(() => ({}))) as { cover?: never; error?: string };
      },
      async freeForm(args) {
        const res = await post("/api/free-form", args);
        return (await res.json().catch(() => ({}))) as { slide?: never; error?: string };
      },
      async download({ deck, allowMissingPictures }) {
        const used = imageIdsInDeck(deck);
        const have = latestPictures.filter((p) => used.includes(p.id));
        const missing = used.filter((id) => !have.some((p) => p.id === id));
        if (missing.length > 0 && !allowMissingPictures) return { ok: false, missing, error: `This deck uses pictures that are not here: ${missing.join(", ")}.` };
        const res = await post("/api/export", { deck, images: Object.fromEntries(have.map((p) => [p.id, p.dataUrl])), imageLabels: Object.fromEntries(have.map((p) => [p.id, p.label])) });
        if (!res.ok) return { ok: false, error: ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't make the file." };
        return { ok: true, blob: await res.blob(), filename: "deck.pptx" };
      },
      versions: {
        async list() {
          const res = await fetch("/api/snapshots");
          return res.ok ? ((await res.json()) as { snapshots: { id: string; version: number; createdAt: string }[] }).snapshots : null;
        },
        async restore(id) {
          const res = await post("/api/snapshots", { snapshotId: id });
          return res.ok ? ((await res.json()) as { version: number; deck: SlideDeck }) : null;
        },
      },
    }),
    [latestPictures]
  );

  const addPicture = useCallback(
    async (file: File) => {
      if (pictures.length >= IMAGE_LIMITS.maxImages) return { ok: false as const, error: `Up to ${IMAGE_LIMITS.maxImages} pictures.` };
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return { ok: false as const, error: "Use a PNG, JPEG or WebP picture." };
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const img = await loadImage(dataUrl);
      let n = 1;
      while (pictures.some((p) => p.id === `img${n}`)) n++;
      const item: EditorPicture = { id: `img${n}`, label: file.name.replace(/\.[^.]+$/, "").slice(0, 40), width: img.width, height: img.height, dataUrl };
      setPictures((all) => [...all, item]);
      return { ok: true as const, item };
    },
    [pictures]
  );

  if (!loaded || pictures.length === 0) return <p className="p-6 text-sm">Starting the editor…</p>;
  return (
    <>
    <PressEffect />
    <DeckEditor
      initialDeck={loaded.deck}
      initialVersion={loaded.version}
      host={host}
      pictures={pictures}
      pictureMode="use"
      logo={{ enabled: false, corner: "top-right", round: false }}
      onAddPicture={addPicture}
      back={<span className={`${barButtonClass} !px-0 font-semibold`}>ail-files playground</span>}
      notice={<p className="px-4 py-1.5 text-[11px] text-[var(--ds-text-muted)] border-b border-[var(--ds-border-muted)]">Changes are kept in memory on this machine. Open this page in two tabs to try live sync; set ANTHROPIC_API_KEY to try the &quot;ask about this slide&quot; box.</p>}
      labels={{ assistantName: "the model", picturesNote: "Samples drawn here, and any PNG, JPEG or WebP you add. They stay in this tab." }}
    />
    </>
  );
}

// The document editor (Word and PDF) is the same page with `?doc=pdf` or `?doc=docx`.
function DocApp({ kind }: { kind: DocKind }) {
  const [loaded, setLoaded] = useState<{ version: number; doc: DocContent } | null>(null);
  const [pictures] = useState<EditorPicture[]>([]);
  useEffect(() => {
    void (async () => setLoaded((await (await fetch(`/api/doc?kind=${kind}`)).json()) as { version: number; doc: DocContent }))();
  }, [kind]);
  const q = `?kind=${kind}`;
  const host = useMemo<DocEditorHost>(
    () => ({
      async preview({ doc }) {
        const res = await post(`/api/doc/preview${q}`, { doc });
        return res.ok ? ((await res.json()) as { html: string }) : null;
      },
      async save(doc, baseVersion) {
        const res = await fetch(`/api/doc${q}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc, baseVersion }) });
        if (res.ok) return { status: "saved", version: ((await res.json()) as { version: number }).version };
        if (res.status === 409) return { status: "conflict", ...((await res.json()) as { version: number; doc: DocContent }) };
        return { status: "error", message: ((await res.json().catch(() => null)) as { error?: string } | null)?.error };
      },
      async poll(since) {
        const data = (await (await fetch(`/api/doc${q}&since=${since}`, { cache: "no-store" })).json()) as { unchanged?: boolean; version: number; doc?: DocContent };
        return data.unchanged || !data.doc ? null : { version: data.version, doc: data.doc };
      },
      async ask(args) {
        const res = await post(`/api/doc/ask${q}`, args);
        return (await res.json().catch(() => ({}))) as { section?: never; error?: string };
      },
      async askDocument(args) {
        const res = await post(`/api/doc/ask-document${q}`, args);
        return (await res.json().catch(() => ({}))) as { doc?: never; error?: string };
      },
      async download({ doc }) {
        const res = await post(`/api/doc/export${q}`, { doc });
        if (!res.ok) return { ok: false, error: ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't make the file." };
        return { ok: true, blob: await res.blob(), filename: kind === "pdf" ? "document.pdf" : "document.docx" };
      },
      versions: {
        async list() {
          const res = await fetch(`/api/doc/snapshots${q}`);
          return res.ok ? ((await res.json()) as { snapshots: { id: string; version: number; createdAt: string }[] }).snapshots : null;
        },
        async restore(id) {
          const res = await post(`/api/doc/snapshots${q}`, { snapshotId: id });
          return res.ok ? ((await res.json()) as { version: number; doc: DocContent }) : null;
        },
      },
    }),
    [kind, q]
  );
  if (!loaded) return <p className="p-6 text-sm">Starting the editor…</p>;
  return (
    <>
      <PressEffect />
      <DocEditor
        kind={kind}
        initialDoc={loaded.doc}
        initialVersion={loaded.version}
        host={host}
        pictures={pictures}
        hasLogo={false}
        back={<span className={`${barButtonClass} !px-0 font-semibold`}>ail-files playground</span>}
        notice={<p className="px-4 py-1.5 text-[11px] text-[var(--ds-text-muted)] border-b border-[var(--ds-border-muted)]">Changes are kept in memory on this machine. Set ANTHROPIC_API_KEY to try the chat box and Talk. Pictures and the logo are not part of the playground.</p>}
        labels={{ assistantName: "the model" }}
      />
    </>
  );
}

const docParam = new URLSearchParams(location.search).get("doc");
createRoot(document.getElementById("root")!).render(
  <StrictMode>{docParam === "pdf" || docParam === "docx" ? <DocApp kind={docParam} /> : <App />}</StrictMode>
);
