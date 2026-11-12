"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CONTENT_HEIGHT, PAGE_HEIGHT, PAGE_PADDING_PT, PAGE_PX, paginate } from "./docPaginate.js";

// The page of a document as the file will draw it, shown in the editor. The host sends the PDF maker's own HTML (`data-s` on each section);
// it is drawn inside a shadow root, so its styles cannot touch the editor's, and replaced in place when it changes, so the page does not
// flash or lose its place. Nothing in it runs: scripts are taken out and only pictures that are inline are shown. Clicking a section
// selects it; clicking the title, the logo or the space around picks the document itself.

// The page's own styles come from the HTML; these only put it on sheets of paper (cut into pages by docPaginate.ts) and mark the picked section.
const SHEET_CSS = `
:host { display: block; }
.pages { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.sheet-wrap { display: flex; flex-direction: column; gap: 6px; margin-bottom: 30px; }
.sheet { width: ${PAGE_PX}px; min-height: ${PAGE_HEIGHT}px; box-sizing: border-box; padding: ${PAGE_PADDING_PT}pt; background: #fff; color: #1a1a1a; box-shadow: 0 1px 3px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.08); cursor: default; }
.sheet .page { display: flow-root; min-height: ${CONTENT_HEIGHT}px; margin: 0; }
.pageno { font: 11px/1 sans-serif; color: #8a8a8a; text-align: center; width: ${PAGE_PX}px; }
section[data-s] { cursor: pointer; border-radius: 3px; transition: background-color .15s, outline-color .15s; outline: 2px solid transparent; outline-offset: 8px; }
section[data-s]:hover { background-color: rgba(37, 99, 235, .05); }
section[data-s].picked { outline-color: #2563eb; }
.doc-head { cursor: pointer; }
`;

function parts(html: string): { css: string; body: string; bodyClass: string } {
  if (typeof DOMParser === "undefined") return { css: "", body: "", bodyClass: "" };
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script, iframe, object, embed, link, meta, base, form").forEach((n) => n.remove());
  // The page's styles were written for <body>; here the page is a div, so the rules follow it.
  const css = Array.from(parsed.querySelectorAll("style")).map((s) => (s.textContent ?? "").replace(/(^|[\s}])body(\.[\w-]+)?\s*\{/g, "$1.page$2 {")).join("\n");
  parsed.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name) || (/^(href|src|xlink:href|srcset)$/i.test(a.name) && !/^data:image\//i.test(a.value))) el.removeAttribute(a.name);
    }
  });
  parsed.querySelectorAll("style").forEach((s) => s.remove());
  return { css, body: parsed.body.innerHTML, bodyClass: parsed.body.className };
}

// A section cut across sheets is several parts with the same number: all of them are marked. Returns the first, or null.
function markPicked(root: ShadowRoot, selected: number | "doc"): HTMLElement | null {
  root.querySelectorAll("section.picked").forEach((n) => n.classList.remove("picked"));
  if (selected === "doc") return null;
  const found = Array.from(root.querySelectorAll(`section[data-s="${selected}"]`)) as HTMLElement[];
  found.forEach((p) => p.classList.add("picked"));
  return found[0] ?? null;
}

export default function DocPage({ html, selected, onSelect, flash = false }: { html: string; selected: number | "doc"; onSelect: (target: number | "doc") => void; flash?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const shadow = useRef<ShadowRoot | null>(null);
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(PAGE_HEIGHT);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedRef.current = selected;
  });

  // Draw the page: in place, so it neither reloads nor jumps.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    shadow.current ??= el.attachShadow({ mode: "open" });
    const root = shadow.current;
    const { css, body, bodyClass } = parts(html);
    root.innerHTML = `<style>${css}</style><style>${SHEET_CSS}</style><div class="pages"></div>`;
    const pagesEl = root.querySelector(".pages") as HTMLElement | null;
    if (!pagesEl) return;
    // The page as the HTML draws it, in one piece, kept aside: it is cut into sheets, and cut again if a picture loads and changes a height.
    const source = document.createElement("div");
    source.innerHTML = body;
    // The title, the subtitle and the logo are the document's own part.
    source.querySelectorAll(".doc-logo, h1.title, p.subtitle").forEach((n) => n.classList.add("doc-head"));
    let cuts = 0;
    let alive = true;
    const lay = () => {
      const copy = source.cloneNode(true) as HTMLElement;
      paginate(pagesEl, copy, bodyClass);
      markPicked(root, selectedRef.current);
      cuts++;
      // A picture that was not ready changes the height once it is: cut again (twice at most, so it can never loop).
      if (cuts <= 2) {
        const waiting = Array.from(pagesEl.querySelectorAll("img")).filter((img) => !img.complete);
        if (waiting.length > 0) Promise.all(waiting.map((img) => new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }))).then(() => { if (alive) lay(); });
      }
    };
    lay();
    const click = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const sec = t?.closest?.("section[data-s]") as HTMLElement | null;
      onSelectRef.current(sec ? Number(sec.dataset.s) : "doc");
    };
    root.addEventListener("click", click);
    const measure = () => setHeight(pagesEl.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pagesEl);
    return () => {
      alive = false;
      root.removeEventListener("click", click);
      ro.disconnect();
    };
  }, [html]);

  // Mark the picked section, and bring it into view when it is off screen.
  useLayoutEffect(() => {
    const root = shadow.current;
    if (!root) return;
    const sec = markPicked(root, selected);
    if (!sec) return;
    const scroller = outer.current?.closest("[data-doc-scroll]") as HTMLElement | null;
    if (!scroller) return;
    const r = sec.getBoundingClientRect();
    const c = scroller.getBoundingClientRect();
    if (r.top < c.top + 8 || r.bottom > c.bottom - 8) scroller.scrollTo({ top: scroller.scrollTop + (r.top - c.top) - 24, behavior: "smooth" });
  }, [selected, html]);

  // Fit the sheet to the column: smaller on a phone, never larger than life.
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, Math.max(0.3, el.clientWidth / PAGE_PX)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className={`w-full rounded-sm ring-4 transition-shadow duration-700 motion-reduce:transition-none ${flash ? "ring-[var(--ds-accent)]" : "ring-transparent"}`} style={{ height: height * scale, maxWidth: PAGE_PX }}>
      <div ref={host} data-doc-page style={{ width: PAGE_PX, transform: `scale(${scale})`, transformOrigin: "top left" }} />
    </div>
  );
}
