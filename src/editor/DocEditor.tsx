"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import DocPage from "./DocPage.js";
import DocSectionForm from "./DocSectionForm.js";
import SlideAsk, { type VoiceCommand, type VoiceCommandResult, type VoicePhase } from "./SlideAsk.js";
import SuccessTick from "./SuccessTick.js";
import { useFlip } from "./useFlip.js";
import { usePhone } from "./usePhone.js";
import { MOTION, previewOrder } from "./motion.js";
import type { NavCommand } from "./voice.js";
import { canRedo, canUndo, commit, createHistory, redo, undo } from "../edit/deckEdit.js";
import {
  addSection, deleteSection, describeDocChange, describeSectionChange, duplicateSection, LOGO_PLACES, mergeDocs, moveSection, newSection, sectionLabel,
  sectionSummary, sectionTemplates, updateSection, type DocContent, type DocKind, type DocLogoPlace, type DocSection,
} from "../edit/docEdit.js";
import { wantsWholeDocument } from "../edit/docAsk.js";
import { saveBlob, type EditorPicture, type VoiceEvent } from "./host.js";
import type { DocEditorHost } from "./docHost.js";

// The document editor, for Word and PDF documents: the sections down the left, the page as the file will draw it in the middle (click a
// section to pick it), and the picked section's fields on the right. Every change is a new document (edit/docEdit.ts), drawn again by the
// host with the export's own code (host.preview) and saved a moment later (host.save). The chat box under the page changes the picked
// section, or the whole document when the title and settings are picked or the request is about all of it; Talk does the same by voice,
// with "next section", "undo" and the rest. Everything that touches a server, a store or an account goes through the `host` prop.

const SAVE_AFTER_MS = 1500;
const PREVIEW_AFTER_MS = 300;

const barButton =
  "px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors";
const inputClass =
  "w-full text-sm px-2.5 py-1.5 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none";
const toolButton =
  "shrink-0 h-8 min-w-8 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center gap-1.5 rounded-md text-xs text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

const icon = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const SECTION_SUGGESTIONS: [string, string][] = [
  ["Make it shorter", "Make this section shorter and clearer, keeping what matters."],
  ["Fix the writing", "Fix the spelling, grammar and punctuation in this section without changing its meaning."],
];
const DOCUMENT_SUGGESTIONS: [string, string][] = [
  ["More formal", "Make the whole document more formal."],
  ["Add a summary", "Add a short summary section at the top of the document."],
];

export interface DocEditorProps {
  kind: DocKind;
  initialDoc: DocContent;
  initialVersion: number;
  host: DocEditorHost;
  /** The pictures the person can place in the document (with their pixels, for the small previews in the picker). */
  pictures: EditorPicture[];
  /** The person has a logo, so one can be placed at the top. */
  hasLogo: boolean;
  /** The pictures belong to someone else: they can be placed but not added. */
  picturesReadOnly?: boolean;
  /** Add a picture the person chose; leave out where pictures cannot be added from here. */
  onAddPicture?: (file: File) => Promise<{ ok: true; item: EditorPicture } | { ok: false; error: string }>;
  /** The back link at the left of the top bar. */
  back?: ReactNode;
  /** More buttons in the top bar, after Versions (a share button, a leave button). */
  headerActions?: ReactNode;
  /** A line under the top bar (for example "You are editing a document shared with you"). */
  notice?: ReactNode;
  /** Dialogs the program opens from `headerActions`; rendered once at the end. */
  dialogs?: ReactNode;
  /** What shows over the page while it is changed; a small spinner if left out. */
  busyMark?: ReactNode;
  /** Wording that depends on the program. */
  labels?: { assistantName?: string };
}

type Selected = number | "doc";

export default function DocEditor({ kind, initialDoc, initialVersion, host, pictures: images, hasLogo, picturesReadOnly = false, onAddPicture, back, headerActions, notice: headerNotice, dialogs, busyMark, labels = {} }: DocEditorProps) {
  const assistantName = labels.assistantName ?? "the assistant";
  const fileName = kind === "pdf" ? "PDF" : "Word";
  const [hist, setHist] = useState(() => createHistory<DocContent>(initialDoc));
  const doc = hist.present;
  const [selected, setSelected] = useState<Selected>(initialDoc.sections.length > 0 ? 0 : "doc");
  const sel: Selected = selected === "doc" ? "doc" : doc.sections.length === 0 ? "doc" : Math.max(0, Math.min(selected, doc.sections.length - 1));

  const [html, setHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [savedDoc, setSavedDoc] = useState(initialDoc);
  const versionRef = useRef(initialVersion);
  const savedRef = useRef(initialDoc); // the document as last loaded or saved, the base for merging
  const [updatedNote, setUpdatedNote] = useState("");
  const showUpdated = useCallback((text: string) => {
    setUpdatedNote(text);
    setTimeout(() => setUpdatedNote((n) => (n === text ? "" : n)), 5000);
  }, []);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState<{ version: number; doc: DocContent } | null>(null);
  const conflictRef = useRef<typeof conflict>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(doc);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [missingPictures, setMissingPictures] = useState(false);
  const [versions, setVersions] = useState<{ id: string; version: number; createdAt: string }[] | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const phone = usePhone();
  const rootRef = useRef<HTMLDivElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  // On a phone or tablet the page and the section's fields do not fit side by side: one at a time, the page scrolling inside its own area
  // (the header, the tools and the section strip stay where they are), and this says which.
  const [smallView, setSmallView] = useState<"page" | "fields">("page");
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  useFlip(strip);
  const dirty = doc !== savedDoc;

  const change = useCallback((next: DocContent, key?: string) => {
    setHist((h) => commit(h, next, { key }));
  }, []);

  const choices = useMemo(() => images.map((i) => ({ id: i.id, label: i.label, width: i.width, height: i.height, thumb: i.dataUrl })), [images]);
  const askImages = useMemo(() => images.map((i) => ({ id: i.id, label: i.label, description: i.description, width: i.width, height: i.height })), [images]);

  // ── Drawing: the server draws the page, the browser shows it ──────────────────────────────────────
  const drawSeq = useRef(0);
  useEffect(() => {
    const mine = ++drawSeq.current;
    const timer = setTimeout(async () => {
      try {
        const drawn = await host.preview({ doc, kind });
        if (mine !== drawSeq.current) return;
        if (drawn) {
          setHtml(drawn.html);
          setPreviewError("");
        } else setPreviewError("This change can't be drawn yet. Finish what you are typing, or undo it.");
      } catch {
        if (mine === drawSeq.current) setPreviewError("Couldn't draw the page. Check your connection.");
      }
    }, html === null ? 0 : PREVIEW_AFTER_MS);
    return () => clearTimeout(timer);
    // `html` only decides the first delay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, kind, host]);

  // ── Saving ───────────────────────────────────────────────────────────────────────────────────────
  const setConflictState = (c: typeof conflict) => {
    conflictRef.current = c;
    setConflict(c);
  };
  const enqueueSave = useCallback(
    (toSave: DocContent) => {
      chain.current = chain.current.then(async () => {
        if (conflictRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try {
          const result = await host.save(toSave, versionRef.current);
          if (result.status === "saved") {
            versionRef.current = result.version;
            savedRef.current = toSave;
            setSavedDoc(toSave);
            setSaveError("");
            setSavedCount((n) => n + 1);
          } else if (result.status === "conflict") {
            // Someone saved first (another device, a collaborator): keep both sets of changes when they touch different parts.
            const merged = mergeDocs(savedRef.current, latest.current, result.doc);
            if (merged) {
              versionRef.current = result.version;
              savedRef.current = result.doc;
              setSavedDoc(result.doc);
              setHist((h) => commit(h, merged));
              showUpdated("Merged with changes made elsewhere.");
            } else setConflictState({ version: result.version, doc: result.doc });
          } else setSaveError(result.message ?? "Couldn't save.");
        } catch {
          setSaveError("Couldn't reach the server. Your changes will be saved when it is back.");
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      });
      return chain.current;
    },
    [host, showUpdated],
  );

  useEffect(() => {
    latest.current = doc;
  }, [doc]);

  useEffect(() => {
    if (!dirty || conflict) return;
    const timer = setTimeout(() => void enqueueSave(doc), SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [doc, dirty, conflict, enqueueSave, saveError]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  // Changes made somewhere else: look every few seconds while this tab is showing (see DeckEditor).
  useEffect(() => {
    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState !== "visible" || conflictRef.current) return;
      try {
        const data = await host.poll?.(versionRef.current);
        if (!data || stopped || data.version === versionRef.current) return;
        if (latest.current !== savedRef.current || savingRef.current) return; // something of mine is pending: the save will merge
        versionRef.current = data.version;
        savedRef.current = data.doc;
        setSavedDoc(data.doc);
        setHist(createHistory(data.doc));
        showUpdated("Updated with changes made elsewhere.");
        host.onRemoteChange?.();
      } catch {
        /* offline: the next look tries again */
      }
    }
    const timer = setInterval(() => void check(), 8000);
    const onShow = () => void check();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [host, showUpdated]);

  useEffect(() => {
    const flush = () => {
      if (latest.current === savedDoc || conflictRef.current) return;
      host.flush?.(latest.current, versionRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [host, savedDoc]);

  // ── Undo and redo ────────────────────────────────────────────────────────────────────────────────
  const track = (event: VoiceEvent) => {
    try {
      host.track?.(event);
    } catch {
      /* counting must never get in the way */
    }
  };
  const lastVoiceEdit = useRef(0);
  const doUndo = () => {
    if (lastVoiceEdit.current && Date.now() - lastVoiceEdit.current < 20_000) track({ type: "talk_undo_after" });
    lastVoiceEdit.current = 0;
    setHist((h) => undo(h));
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return; // a field has its own undo for what is typed in it
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        setHist((h) => redo(h));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Section actions ──────────────────────────────────────────────────────────────────────────────
  const current = typeof sel === "number" ? sel : -1;
  const add = (key: string) => {
    const section = newSection(key, kind);
    if (!section) return;
    const at = current >= 0 ? current + 1 : doc.sections.length;
    change(addSection(doc, section, at));
    setSelected(at);
    setAddOpen(false);
  };
  const remove = () => {
    if (current < 0) return;
    change(deleteSection(doc, current));
    setSelected(doc.sections.length <= 1 ? "doc" : Math.max(0, current - 1));
  };
  const move = (to: number) => {
    if (current < 0 || to < 0 || to >= doc.sections.length) return;
    change(moveSection(doc, current, to));
    setSelected(to);
  };
  const duplicate = () => {
    if (current < 0) return;
    change(duplicateSection(doc, current));
    setSelected(current + 1);
  };
  useEffect(() => {
    if (!addOpen) return;
    addMenuRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [addOpen]);

  const setDocField = (patch: Partial<DocContent>, key: string) => change({ ...doc, ...patch }, `doc.${key}`);
  const dropDocField = (field: keyof DocContent, key: string) => {
    const next = { ...doc };
    delete next[field];
    change(next, `doc.${key}`);
  };

  async function uploadPicture(file: File): Promise<{ id: string } | { error: string }> {
    const r = await onAddPicture?.(file);
    if (!r) return { error: "Pictures can't be added here." };
    return r.ok ? { id: r.item.id } : { error: r.error };
  }

  // ── Asking: one section, or the whole document ───────────────────────────────────────────────────
  const latestDoc = useRef(doc);
  useEffect(() => {
    latestDoc.current = doc;
  });
  const [asking, setAsking] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("off");
  const talkOn = voicePhase !== "off";
  const dim = `transition-opacity duration-300 motion-reduce:transition-none ${talkOn ? "opacity-35" : ""}`;
  const spoken = useRef<string | undefined>(undefined);
  const [askNote, setAskNote] = useState<{ kind: "done" | "error"; text: string } | null>(null);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashPage() {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1600);
  }

  async function askWhole(prompt: string, opts?: { voice?: boolean }): Promise<string | null> {
    const original = latestDoc.current;
    try {
      const data = await host.askDocument({ prompt, doc: original, kind, images: askImages, ...(opts?.voice ? { fast: true } : {}) });
      if (opts?.voice) {
        track({ type: "talk_request", ok: !!data.doc });
        if (data.limited) track({ type: "talk_limit" });
      }
      if (!data.doc) return data.error ?? "Couldn't change the document. Try again.";
      if (latestDoc.current !== original) return `The document changed while ${assistantName} was working. Ask again.`;
      // The page settings and the logo place are the person's own; a reply never moves them.
      const next: DocContent = { ...data.doc, ...(original.logo ? { logo: original.logo } : {}), ...(original.pageNumbers === false ? { pageNumbers: false } : {}), ...(original.border ? { border: true } : {}) };
      spoken.current = describeDocChange(original, next);
      change(next, `doc.ask.${Date.now()}`);
      setSelected((s) => (typeof s === "number" ? Math.min(s, Math.max(0, next.sections.length - 1)) : s));
      return null;
    } catch {
      if (opts?.voice) track({ type: "talk_request", ok: false });
      return `Couldn't reach ${assistantName}. Check your connection and try again.`;
    }
  }

  async function askSection(prompt: string, opts?: { voice?: boolean }): Promise<string | null> {
    if (typeof sel !== "number") return "Pick a section first.";
    const index = sel;
    const original = doc.sections[index];
    try {
      const data = await host.ask({ prompt, section: original, index, doc, kind, images: askImages, ...(opts?.voice ? { fast: true } : {}) });
      if (opts?.voice) {
        track({ type: "talk_request", ok: !!data.section });
        if (data.limited) track({ type: "talk_limit" });
      }
      if (!data.section) return data.error ?? "Couldn't change the section. Try again.";
      if (latestDoc.current.sections[index] !== original) return `The section changed while ${assistantName} was working. Ask again.`;
      spoken.current = describeSectionChange(original, data.section);
      change(updateSection(latestDoc.current, index, data.section), `${index}.ask.${Date.now()}`);
      return null;
    } catch {
      if (opts?.voice) track({ type: "talk_request", ok: false });
      return `Couldn't reach ${assistantName}. Check your connection and try again.`;
    }
  }

  async function runAsk(prompt: string, opts?: { voice?: boolean }): Promise<string | null> {
    setAsking(true);
    setAskNote(null);
    spoken.current = undefined;
    // The title and settings are picked, or the request is about all of it ("shorten every section"), or there is no section yet.
    const whole = sel === "doc" || doc.sections.length === 0 || wantsWholeDocument(prompt);
    const problem = whole ? await askWhole(prompt, opts) : await askSection(prompt, opts);
    setAsking(false);
    if (!problem) {
      flashPage();
      if (opts?.voice) lastVoiceEdit.current = Date.now();
    }
    // A spoken request is answered aloud, so the same words are not written on the screen too (a problem still is).
    setAskNote(problem ? { kind: "error", text: problem } : opts?.voice ? null : { kind: "done", text: `${spoken.current ?? "Done."} Not right? Press Undo.` });
    return problem;
  }

  // "Next section", "go back", "section 3" spoken in talk mode. Returns what to say aloud.
  function goBySpeech(c: NavCommand): string {
    const count = doc.sections.length;
    if (count === 0) return "This document has no sections yet.";
    const at = typeof sel === "number" ? sel : -1;
    const to = c.to === "next" ? at + 1 : c.to === "previous" ? (at < 0 ? 0 : at - 1) : c.to === "first" ? 0 : c.to === "last" ? count - 1 : c.to === "number" ? c.n - 1 : at;
    if (to < 0) return "This is the first section.";
    if (to >= count) return c.to === "next" ? "This is the last section." : `There are only ${count} sections.`;
    if (to === at) return c.to === "first" ? "This is the first section." : c.to === "last" ? "This is the last section." : `Section ${to + 1}.`;
    setSelected(to);
    return `Section ${to + 1}.`;
  }
  function runCommand(c: VoiceCommand): VoiceCommandResult {
    track({ type: "talk_command", detail: c.to });
    if (c.to === "undo") {
      if (!canUndo(hist)) return { say: "There is nothing to undo." };
      doUndo();
      return { say: "Undone." };
    }
    if (c.to === "redo") {
      if (!canRedo(hist)) return { say: "There is nothing to redo." };
      setHist((h) => redo(h));
      return { say: "Done again." };
    }
    if (c.to === "delete") {
      if (current < 0) return { say: "Pick a section first." };
      return { say: `Delete section ${current + 1}? Say yes or no.`, confirm: true };
    }
    if (c.to === "confirm-delete") {
      if (current < 0) return { say: "Nothing was deleted." };
      const now = Math.max(0, current - 1);
      remove();
      return { say: doc.sections.length <= 1 ? "Deleted. The document has no sections now." : `Deleted. You are on section ${now + 1}.` };
    }
    if (c.to === "cancel-delete") return { say: "Okay, I kept it." };
    return { say: goBySpeech(c as NavCommand) };
  }

  async function download(allowMissingPictures = false) {
    setExporting(true);
    setNotice("");
    setMissingPictures(false);
    const made = await host.download({ doc, kind, allowMissingPictures });
    setExporting(false);
    if (made.ok) saveBlob(made.blob, made.filename);
    else {
      setNotice(made.error);
      setMissingPictures((made.missing?.length ?? 0) > 0);
    }
  }

  async function openVersions() {
    setVersions([]);
    setVersions((await host.versions?.list()) ?? null);
  }
  async function restore(snapshotId: string) {
    const data = await host.versions?.restore(snapshotId);
    if (!data) {
      setNotice("Couldn't restore that version.");
      return;
    }
    versionRef.current = data.version;
    savedRef.current = data.doc;
    setSavedDoc(data.doc);
    setHist((h) => commit(h, data.doc));
    setSelected(data.doc.sections.length > 0 ? 0 : "doc");
    setVersions(null);
  }

  const order = previewOrder(doc.sections.length, dragFrom, dragOver);
  const status = conflict ? "Changed somewhere else" : saveError ? "Not saved" : saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved";
  const templates = sectionTemplates(kind);
  const section = typeof sel === "number" ? doc.sections[sel] : undefined;

  return (
    <div ref={rootRef} className="h-dvh min-h-0 overflow-hidden flex flex-col bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)]">
      <header className={`${dim} flex items-center gap-2 px-3 sm:px-4 h-14 border-b border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] shrink-0`}>
        {back}
        <h1 className="text-sm font-semibold truncate min-w-0 flex-1">{doc.title || `Untitled ${fileName === "PDF" ? "PDF" : "document"}`}</h1>
        <span role="status" aria-live="polite" className={`hidden sm:inline text-xs ${saveError || conflict ? "text-red-500" : "text-[var(--ds-text-muted)]"}`}>{status === "Saved" && savedCount > 0 && <SuccessTick key={savedCount} size={13} className="mr-1 inline-block align-[-2px]" />}{status}</span>
        <button type="button" onClick={doUndo} disabled={!canUndo(hist)} className={barButton} aria-label="Undo">Undo</button>
        <button type="button" onClick={() => setHist((h) => redo(h))} disabled={!canRedo(hist)} className={barButton} aria-label="Redo">Redo</button>
        {host.versions && <button type="button" onClick={openVersions} className={`${barButton} hidden sm:inline-block`}>Versions</button>}
        {headerActions}
        <button type="button" onClick={() => void download()} disabled={exporting} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--ds-accent)] text-[var(--ds-on-accent)] hover:opacity-90 disabled:opacity-50 transition-opacity">
          {exporting ? "Making…" : <><span className="max-sm:hidden">Download {fileName}</span><span className="sm:hidden">Download</span></>}
        </button>
      </header>

      {updatedNote && !conflict && <div role="status" className={`${dim} px-4 py-1.5 text-xs border-b border-[var(--ds-border-muted)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text-secondary)]`}>{updatedNote}</div>}
      {headerNotice}

      {(conflict || saveError || notice) && (
        <div role="alert" className="px-4 py-2 text-xs border-b border-[var(--ds-border-muted)] bg-amber-500/10 text-[var(--ds-text-primary)] flex flex-wrap items-center gap-3">
          {conflict ? (
            <>
              <span>This document was changed in another tab or on another device.</span>
              <button type="button" className="font-medium underline" onClick={() => { versionRef.current = conflict.version; savedRef.current = conflict.doc; setSavedDoc(conflict.doc); setHist(createHistory(conflict.doc)); setConflictState(null); }}>Load the newer version</button>
              <button type="button" className="font-medium underline" onClick={() => { versionRef.current = conflict.version; setConflictState(null); }}>Keep my changes</button>
            </>
          ) : (
            <>
              <span>{notice || saveError}</span>
              {missingPictures && <button type="button" disabled={exporting} className="font-medium underline disabled:opacity-50" onClick={() => void download(true)}>Download without them</button>}
            </>
          )}
        </div>
      )}

      {typeof sel === "number" && section && (
        <div className={`${dim} shrink-0 flex items-center gap-1 px-3 sm:px-4 py-1.5 border-b border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] overflow-x-auto [scrollbar-width:none]`}>
          <span className="text-xs text-[var(--ds-text-muted)] mr-2 shrink-0">Section {sel + 1} of {doc.sections.length}</span>
          <button type="button" onClick={() => move(sel - 1)} disabled={sel === 0} aria-label="Move section up" title="Move up" className={toolButton}>{icon("M12 19V5M5 12l7-7 7 7")}<span className="max-sm:hidden">Up</span></button>
          <button type="button" onClick={() => move(sel + 1)} disabled={sel === doc.sections.length - 1} aria-label="Move section down" title="Move down" className={toolButton}>{icon("M12 5v14M19 12l-7 7-7-7")}<span className="max-sm:hidden">Down</span></button>
          <button type="button" onClick={duplicate} aria-label="Duplicate section" title="Duplicate" className={toolButton}>{icon("M9 9h11v11H9zM5 15H4V4h11v1")}<span className="max-sm:hidden">Duplicate</span></button>
          <button type="button" onClick={remove} aria-label="Delete section" title="Delete" className={toolButton}>{icon("M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14")}<span className="max-sm:hidden">Delete</span></button>
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[230px_minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]">
        {/* Sections */}
        <aside aria-label="Sections" className={`${dim} max-lg:shrink-0 lg:border-r border-[var(--ds-border-muted)] lg:overflow-y-auto bg-[var(--ds-bg-surface)]`}>
          <div
            ref={strip}
            onDragEnter={(e) => dragFrom !== null && e.preventDefault()}
            onDragOver={(e) => dragFrom !== null && e.preventDefault()}
            onDrop={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              if (dragOver !== null && dragFrom !== dragOver) {
                change(moveSection(doc, dragFrom, dragOver));
                setSelected(dragOver);
              }
              setDragFrom(null);
              setDragOver(null);
            }}
            className="relative flex lg:block gap-2 p-2 overflow-x-auto lg:overflow-x-visible"
          >
            <button type="button" onClick={() => setSelected("doc")} aria-pressed={sel === "doc"} className={`shrink-0 w-40 lg:w-full text-left rounded-lg border px-2.5 py-2 mb-0 lg:mb-2 ${sel === "doc" ? "border-[var(--ds-accent)] ring-1 ring-[var(--ds-accent)]" : "border-[var(--ds-border-muted)]"}`}>
              <span className="block text-xs font-semibold truncate">{doc.title || "Untitled"}</span>
              <span className="block text-[11px] mt-0.5 text-[var(--ds-text-muted)]">Title and settings</span>
            </button>
            {order.map((i) => {
              const s = doc.sections[i];
              const lifted = dragFrom === i;
              return (
                <Fragment key={i}>
                  <button
                    type="button"
                    draggable
                    data-flip-id={i}
                    onDragStart={(e) => {
                      setDragFrom(i);
                      setDragOver(i);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(i));
                      e.dataTransfer.setDragImage(new Image(), 0, 0);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragFrom !== null && i !== dragFrom) setDragOver(order.indexOf(i));
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onClick={() => setSelected(i)}
                    aria-pressed={sel === i}
                    aria-label={`Section ${i + 1}, ${sectionLabel(s)}`}
                    style={lifted ? { scale: String(MOTION.liftScale) } : undefined}
                    className={`shrink-0 w-40 lg:w-full text-left rounded-lg border px-2.5 py-2 mb-0 lg:mb-2 transition-[scale,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] bg-[var(--ds-bg-surface)] ${lifted ? "relative z-10 shadow-xl cursor-grabbing" : ""} ${sel === i ? "border-[var(--ds-accent)] ring-1 ring-[var(--ds-accent)]" : "border-[var(--ds-border-muted)]"}`}
                  >
                    <span className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[11px] text-[var(--ds-text-muted)] tabular-nums shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium truncate">{sectionLabel(s)}</span>
                    </span>
                    <span className="block text-[11px] mt-0.5 text-[var(--ds-text-muted)] truncate">{sectionSummary(s) || "Empty"}{s.newPage ? " · new page" : ""}</span>
                  </button>
                </Fragment>
              );
            })}
            <div className="relative shrink-0 self-center lg:self-auto max-sm:order-first max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:self-stretch max-sm:flex max-sm:bg-[var(--ds-bg-surface)] max-sm:pr-1">
              <button type="button" onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen} className="w-28 lg:w-full max-sm:w-16 max-sm:px-1 max-sm:text-[11px] max-sm:leading-tight px-3 py-2 rounded-lg border border-dashed border-[var(--ds-border-muted)] text-xs font-medium text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:border-[var(--ds-accent)]">
                + Add section
              </button>
              {addOpen && !phone && (
                <div ref={addMenuRef} role="menu" className="absolute left-0 bottom-full lg:static lg:bottom-auto lg:w-full mt-1 z-20 w-52 rounded-lg border border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] shadow-lg p-1">
                  {templates.map(([key, t]) => (
                    <button key={key} role="menuitem" type="button" onClick={() => add(key)} className="w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-[var(--ds-bg-hover)]">{t.label}</button>
                  ))}
                </div>
              )}
              {addOpen && phone && rootRef.current &&
                createPortal(
                  <>
                    <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/20" onClick={() => setAddOpen(false)} />
                    <div ref={addMenuRef} role="menu" aria-label="Add a section" className="fixed inset-x-3 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-50 grid grid-cols-2 gap-1 max-h-[55dvh] overflow-y-auto rounded-xl border border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] shadow-xl p-1.5">
                      {templates.map(([key, t]) => (
                        <button key={key} role="menuitem" type="button" onClick={() => add(key)} className="w-full text-left text-sm px-3 py-3 rounded-lg hover:bg-[var(--ds-bg-hover)] active:bg-[var(--ds-bg-hover)]">{t.label}</button>
                      ))}
                    </div>
                  </>,
                  rootRef.current,
                )}
            </div>
          </div>
        </aside>

        {/* Phone and tablet: the page or the section's fields, one at a time. */}
        <div role="tablist" aria-label="What to show" className={`${dim} lg:hidden shrink-0 flex gap-1 p-1.5 border-b border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)]`}>
          {(["page", "fields"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={smallView === v} onClick={() => setSmallView(v)} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${smallView === v ? "bg-[var(--ds-bg-elevated)] text-[var(--ds-text-primary)]" : "text-[var(--ds-text-muted)]"}`}>
              {v === "page" ? "Page" : sel === "doc" ? "Title and settings" : "Edit section"}
            </button>
          ))}
        </div>

        {/* The page */}
        <section aria-label="Page preview" className={`min-w-0 min-h-0 flex flex-col max-lg:order-last ${smallView === "page" ? "max-lg:flex-1" : ""}`}>
          <div data-doc-scroll className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 bg-[var(--ds-bg-elevated)] ${smallView === "fields" ? "max-lg:hidden" : ""}`}>
            <div className="mx-auto w-full max-w-[794px] relative">
              {html !== null ? <DocPage html={html} selected={sel} onSelect={setSelected} flash={flash} /> : <div className="aspect-[210/297] rounded-sm bg-[var(--ds-bg-surface)] flex items-center justify-center text-xs text-[var(--ds-text-muted)]">Drawing your page…</div>}
              {(asking || voicePhase === "hearing" || voicePhase === "speaking") && (
                <div className={`absolute inset-0 z-20 flex flex-col items-center justify-start pt-24 gap-3 ${asking ? "bg-[var(--ds-bg-primary)]/60" : "bg-[var(--ds-bg-primary)]/35"}`} aria-live="polite">
                  <div className="relative flex items-center justify-center">
                    {voicePhase === "hearing" && !asking && <span aria-hidden="true" className="motion-safe:animate-ping absolute h-28 w-28 rounded-full border-2 border-[var(--ds-accent)] opacity-40" />}
                    {busyMark ?? <span role="status" aria-label="Updating the document" className="inline-block h-8 w-8 rounded-full border-2 border-[var(--ds-border-muted)] border-t-[var(--ds-accent)] animate-spin" />}
                  </div>
                  {voicePhase !== "off" && <p className="text-xs font-medium text-[var(--ds-text-secondary)]">{asking ? "Working on it…" : voicePhase === "speaking" ? "Speaking…" : "Listening…"}</p>}
                </div>
              )}
            </div>
            {previewError && <p role="status" className="mt-2 text-xs text-amber-600 text-center">{previewError}</p>}
            <p className="mt-2 text-[11px] text-center text-[var(--ds-text-muted)]">
              {kind === "pdf" ? "This is the page as the PDF will draw it." : "A close look at the Word file. Fonts and page breaks may differ a little in Word."} Click a section to pick it.
            </p>
          </div>
          <SlideAsk
            subject={sel === "doc" ? "document" : "section"}
            suggestions={sel === "doc" ? DOCUMENT_SUGGESTIONS : SECTION_SUGGESTIONS}
            exampleText={'For example: "Make it shorter", "Turn this into a table", "Add a summary at the top", "Use simpler words"'}
            talkHint={<>Try: &ldquo;Make this section shorter&rdquo;, &ldquo;Next section&rdquo;, &ldquo;Undo&rdquo;, &ldquo;Add a summary at the top&rdquo;, or both in one go: &ldquo;Fix the writing, next section&rdquo;.</>}
            slideKey={sel}
            onCommand={runCommand}
            track={track}
            acknowledge={host.acknowledge ? (p) => host.acknowledge!(p) : undefined}
            onVoicePhase={setVoicePhase}
            spokenReply={() => spoken.current}
            onSend={runAsk}
            busy={asking}
            note={askNote}
            assistantName={assistantName}
          />
        </section>

        {/* The fields */}
        <aside aria-label="Section fields" className={`${dim} lg:border-l border-[var(--ds-border-muted)] min-h-0 flex flex-col bg-[var(--ds-bg-surface)] max-lg:flex-1 ${smallView === "page" ? "max-lg:hidden" : ""}`}>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {sel === "doc" || !section ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">Title and settings</h2>
                <label className="block space-y-1"><span className="text-xs font-medium text-[var(--ds-text-secondary)]">Title</span><input value={doc.title} onChange={(e) => setDocField({ title: e.target.value }, "title")} className={inputClass} /></label>
                <label className="block space-y-1"><span className="text-xs font-medium text-[var(--ds-text-secondary)]">Subtitle</span><input value={doc.subtitle ?? ""} onChange={(e) => (e.target.value ? setDocField({ subtitle: e.target.value }, "subtitle") : dropDocField("subtitle", "subtitle"))} className={inputClass} /></label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[var(--ds-text-secondary)]">Logo</span>
                  <select aria-label="Logo place" value={doc.logo ?? ""} disabled={!hasLogo} onChange={(e) => (e.target.value ? setDocField({ logo: e.target.value as DocLogoPlace }, "logo") : dropDocField("logo", "logo"))} className={`${inputClass} disabled:opacity-50`}>
                    <option value="">No logo</option>
                    {LOGO_PLACES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                  </select>
                  {!hasLogo && <span className="block text-[11px] text-[var(--ds-text-muted)]">Add a logo in the chat's picture settings to place it here.</span>}
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--ds-text-secondary)] cursor-pointer"><input type="checkbox" checked={doc.pageNumbers !== false} onChange={(e) => (e.target.checked ? dropDocField("pageNumbers", "pageNumbers") : setDocField({ pageNumbers: false }, "pageNumbers"))} />Page numbers</label>
                <label className="flex items-center gap-2 text-xs text-[var(--ds-text-secondary)] cursor-pointer"><input type="checkbox" checked={doc.border === true} onChange={(e) => (e.target.checked ? setDocField({ border: true }, "border") : dropDocField("border", "border"))} />A border round every page</label>
                <p className="text-[11px] text-[var(--ds-text-muted)]">Asking from here changes the whole document: its title, its sections and their order.</p>
                {doc.sections.length === 0 && <p className="text-xs text-[var(--ds-text-secondary)]">This document has no sections yet. Press &ldquo;+ Add section&rdquo;, or ask for one in the box below.</p>}
              </div>
            ) : (
              <>
                <h2 className="text-sm font-semibold">Section {sel + 1}</h2>
                <DocSectionForm
                  key={sel}
                  section={section}
                  kind={kind}
                  pictures={choices}
                  onUploadPicture={picturesReadOnly || !onAddPicture ? undefined : uploadPicture}
                  onChange={(next, key) => change(updateSection(doc, sel, next), `${sel}.${key}`)}
                />
              </>
            )}
          </div>
        </aside>
      </main>

      {/* Room under the page for the chat box, which is fixed to the bottom of a phone screen. */}
      <div aria-hidden className="sm:hidden h-28 shrink-0" />

      {dialogs}

      {versions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setVersions(null)}>
          <div role="dialog" aria-modal="true" aria-label="Earlier versions" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Earlier versions</h2>
              <button type="button" onClick={() => setVersions(null)} aria-label="Close" className="text-lg leading-none px-1 text-[var(--ds-text-muted)]">×</button>
            </div>
            {versions.length === 0 ? (
              <p className="text-xs text-[var(--ds-text-muted)]">Nothing earlier yet. A version is kept now and then while you edit.</p>
            ) : (
              <ul className="space-y-1.5">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{new Date(v.createdAt).toLocaleString()}</span>
                    <button type="button" onClick={() => void restore(v.id)} className="text-xs font-medium text-[var(--ds-accent)] hover:underline">Restore</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
