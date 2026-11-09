"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SlideStage from "./SlideStage.js";
import SlideForm, { ElementPanel } from "./SlideForm.js";
import SlideToolbar from "./SlideToolbar.js";
import SlideInsert from "./SlideInsert.js";
import SlideLook, { PicturePanel } from "./SlideLook.js";
import { placedPictures, setSlideOption, readableOn } from "../edit/slideOptionsEdit.js";
import LockedParts from "./LockedParts.js";
import FreeFormNote from "./FreeFormNote.js";
import SlideAsk, { type VoiceCommand, type VoiceCommandResult, type VoicePhase } from "./SlideAsk.js";
import type { NavCommand } from "./voice.js";
import SuccessTick from "./SuccessTick.js";
import { useFlip } from "./useFlip.js";
import { usePhone } from "./usePhone.js";
import { MOTION, previewOrder } from "./motion.js";
import { mergeDecks } from "../edit/deckMerge.js";
import { moveDrawn } from "../edit/recordedMove.js";
import { describeChange } from "../edit/describeChange.js";
import { needsFreeForm } from "../edit/slideAsk.js";
import SlideHandles, { type BoxRef } from "./SlideHandles.js";
import ColorField from "./ColorField.js";
import PictureSelect from "./PictureSelect.js";
import { addSlide, canRedo, canUndo, commit, createHistory, deleteSlide, duplicateSlide, LAYOUT_LABELS, layoutOf, moveSlide, NEW_SLIDE_TEMPLATES, newSlide, redo, setAt, undo, updateSlide, removeAt, insertAt, movableBoxes, lockedParts, setBox, type Box } from "../edit/deckEdit.js";
import type { FontPairKey, SlideContent, SlideDeck } from "../pptx/presentationBuilder.js";
import type { RecordedDeck } from "../pptx/pptRecorded.js";
import { saveBlob, type DeckEditorHost, type EditorLogo, type EditorPicture, type VoiceEvent } from "./host.js";

// The deck editor: the slides down the left, the selected slide as the download will draw it, and its fields on the right. Every
// change is a new deck (edit/deckEdit.ts), drawn again by the host with the export's own code (host.preview, which calls recordDeck) and
// saved a moment later (host.save). What you see is what you download. Everything that touches a server, a store or an account goes
// through the `host` prop (see host.ts), so any program can use this editor with its own storage.
// On a phone the three parts stack and dragging is left out; the same page works on a bigger screen.

// The keys of changes that redraw slowly enough to need a loading mark (see `change`): one slide's picture, background, font, size or colours.
const HEAVY_CHANGE = /\.opt\.(backgroundImage|fontPair|textScale|background|accent)$|pictures\.(add\d+|\d+\.image)$|\.freeform\./;
const SAVE_AFTER_MS = 1500;
const PREVIEW_AFTER_MS = 300;

/** The look of a button in the editor's top bar, for the buttons a program adds with `headerActions`. */
export const barButtonClass =
  "px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors";

const inputClass =
  "w-full text-sm px-2.5 py-1.5 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none";
const barButton =
  "px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors";

function naturalSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const el = new Image();
    el.onload = () => resolve({ width: el.naturalWidth, height: el.naturalHeight });
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
}

export interface DeckEditorProps {
  initialDeck: SlideDeck;
  initialVersion: number;
  host: DeckEditorHost;
  /** The pictures the person can use on slides (with their pixels, for drawing). */
  pictures: EditorPicture[];
  /** What the chosen "pictures on slides" setting is; "none" ignores a background picture chosen in the picture settings. */
  pictureMode: "use" | "placeholders" | "none";
  logo: EditorLogo;
  /** The pictures belong to someone else: they can be used but not added or removed. */
  picturesReadOnly?: boolean;
  /** Add a picture the person chose; leave out where pictures cannot be added from here. */
  onAddPicture?: (file: File) => Promise<{ ok: true; item: EditorPicture } | { ok: false; error: string }>;
  /** The back link at the left of the top bar. */
  back?: ReactNode;
  /** More buttons in the top bar, after Versions (a share button, a leave button). Style them with `barButtonClass`. */
  headerActions?: ReactNode;
  /** A line under the top bar (for example "You are editing a deck shared with you"). */
  notice?: ReactNode;
  /** Dialogs the program opens from `headerActions`; rendered once at the end. */
  dialogs?: ReactNode;
  /** What shows over the slide while it is redrawn; a small spinner if left out. */
  busyMark?: ReactNode;
  /** Wording that depends on the program; every part has a plain default. */
  labels?: { assistantName?: string; defaultPicture?: string; picturesNote?: string; readOnlyPicturesNote?: string };
}

export default function DeckEditor({ initialDeck, initialVersion, host, pictures: images, pictureMode, logo, picturesReadOnly = false, onAddPicture, back, headerActions, notice: headerNotice, dialogs, busyMark, labels = {} }: DeckEditorProps) {
  const isEditor = picturesReadOnly;
  const assistantName = labels.assistantName ?? "the assistant";
  const [hist, setHist] = useState(() => createHistory<SlideDeck>(initialDeck));
  const deck = hist.present;
  const [selected, setSelected] = useState<number | "deck">(0);

  const [recorded, setRecorded] = useState<RecordedDeck | null>(null);
  const [previewError, setPreviewError] = useState("");
  // A change that takes a moment to show (a new picture or background, a font, colours, a new layout): the slide wears a loading mark until it is redrawn.
  const [heavy, setHeavy] = useState(false);
  const [savedDeck, setSavedDeck] = useState(initialDeck);
  const versionRef = useRef(initialVersion);
  const savedRef = useRef(initialDeck); // the deck as last loaded or saved, the base for merging
  const [updatedNote, setUpdatedNote] = useState("");
  const showUpdated = useCallback((text: string) => {
    setUpdatedNote(text);
    setTimeout(() => setUpdatedNote((n) => (n === text ? "" : n)), 5000);
  }, []);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState<{ version: number; deck: SlideDeck } | null>(null);
  const conflictRef = useRef<typeof conflict>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(deck);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [missingPictures, setMissingPictures] = useState(false); // the last download stopped because pictures are not on this device
  const [versions, setVersions] = useState<{ id: string; version: number; createdAt: string }[] | null>(null);
  const phone = usePhone();
  const pickedPanelRef = useRef<HTMLDivElement>(null); // the settings of the tapped part, above the slide on a phone
  const [addOpen, setAddOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null); // the "+ Add slide" menu at the end of the strip
  const addAfterRef = useRef<HTMLDivElement>(null); // the templates opened under the selected slide
  const [addAfter, setAddAfter] = useState<number | null>(null); // the slide whose templates are showing under it in the strip
  // A template list that opens near the bottom of the strip must not stay half off the screen: scroll the strip so the whole list shows
  // (after the opening animation for the one under a slide).
  useEffect(() => {
    if (!addOpen) return;
    addMenuRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [addOpen]);
  useEffect(() => {
    if (addAfter === null) return;
    const t = setTimeout(() => addAfterRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }), 380);
    return () => clearTimeout(t);
  }, [addAfter]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null); // where the dragged slide would land if let go now: the others slide to make room
  const [savedCount, setSavedCount] = useState(0); // how many saves have finished, so the tick by "Saved" plays again for each
  const strip = useRef<HTMLDivElement>(null);
  useFlip(strip);
  const [pictureError, setPictureError] = useState("");
  // The box picked on the slide (a free-form element or a placed picture), for the slide it was picked on.
  const [pickedBox, setPickedBox] = useState<(BoxRef & { slide: number }) | null>(null);

  const change = useCallback((next: SlideDeck, key?: string) => {
    if (key && HEAVY_CHANGE.test(key)) setHeavy(true);
    setHist((h) => commit(h, next, { key }));
  }, []);
  const offset = deck.title ? 1 : 0; // the cover is drawn first when the deck has a title
  const sel = selected === "deck" ? "deck" : Math.max(0, Math.min(selected, deck.slides.length - 1));
  const dirty = deck !== savedDeck;

  // What the preview and the download use: the background picture chosen under Images & logo applies unless the deck names one.
  const effective = useMemo(() => {
    const chosen = pictureMode !== "none" ? images.find((i) => i.background && !i.backgroundOff) : undefined;
    return chosen && !deck.backgroundImage ? { ...deck, backgroundImage: chosen.id } : deck;
  }, [deck, images, pictureMode]);
  // The pictures as the pickers show them: with a small copy of each, so a person chooses by what it looks like.
  const choices = useMemo(() => images.map((i) => ({ id: i.id, label: i.label, width: i.width, height: i.height, thumb: i.dataUrl })), [images]);
  const imageMeta = useMemo(() => Object.fromEntries(images.map((i) => [i.id, { width: i.width, height: i.height, label: i.label }])), [images]);
  const pixels = useMemo(() => {
    const out: Record<string, string> = Object.fromEntries(images.map((i) => [i.id, i.dataUrl]));
    if (logo.enabled && logo.dataUrl) out.logo = logo.dataUrl;
    return out;
  }, [images, logo]);

  // ── Drawing: the server draws the deck, the browser paints it ───────────────────────────────────────
  const drawSeq = useRef(0);
  useEffect(() => {
    const mine = ++drawSeq.current;
    const timer = setTimeout(async () => {
      try {
        const logoSize = logo.enabled && logo.dataUrl && !logo.round ? await naturalSize(logo.dataUrl) : null;
        const drawn = await host.preview({ deck: effective, images: imageMeta, ...(logo.enabled && logo.dataUrl ? { logo: { corner: logo.corner, round: logo.round, ...(logoSize ?? {}) } } : {}) });
        if (mine !== drawSeq.current) return;
        if (drawn) {
          setRecorded(drawn);
          setPreviewError("");
          // A moment for the browser to paint the new picture before the mark goes.
          setTimeout(() => setHeavy(false), 200);
        } else {
          setPreviewError("This change can't be drawn yet. Finish what you are typing, or undo it.");
          setHeavy(false);
        }
      } catch {
        if (mine === drawSeq.current) {
          setPreviewError("Couldn't draw the slide. Check your connection.");
          setHeavy(false);
        }
      }
    }, recorded ? PREVIEW_AFTER_MS : 0);
    return () => clearTimeout(timer);
    // `recorded` only decides the first delay; the drawing depends on the deck, the pictures' sizes and the logo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, imageMeta, logo.enabled, logo.dataUrl, logo.corner, logo.round]);

  // Never leave the mark on if a redraw does not come (the change drew the same slide).
  useEffect(() => {
    if (!heavy) return;
    const timer = setTimeout(() => setHeavy(false), 8000);
    return () => clearTimeout(timer);
  }, [heavy]);

  // ── Saving ───────────────────────────────────────────────────────────────────────────────────────
  const setConflictState = (c: typeof conflict) => {
    conflictRef.current = c;
    setConflict(c);
  };
  const enqueueSave = useCallback(
    (toSave: SlideDeck) => {
      chain.current = chain.current.then(async () => {
        if (conflictRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try {
          const result = await host.save(toSave, versionRef.current);
          if (result.status === "saved") {
            versionRef.current = result.version;
            savedRef.current = toSave;
            setSavedDeck(toSave);
            setSaveError("");
            setSavedCount((n) => n + 1);
          } else if (result.status === "conflict") {
            const data = result;
            // Someone saved first (another device, a collaborator): keep both sets of changes when they touch different parts.
            const merged = mergeDecks(savedRef.current, latest.current, data.deck);
            if (merged) {
              versionRef.current = data.version;
              savedRef.current = data.deck;
              setSavedDeck(data.deck);
              setHist((h) => commit(h, merged));
              showUpdated("Merged with changes made elsewhere.");
            } else {
              setConflictState({ version: data.version, deck: data.deck });
            }
          } else {
            setSaveError(result.message ?? "Couldn't save.");
          }
        } catch {
          setSaveError("Couldn't reach the server. Your changes will be saved when it is back.");
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      });
      return chain.current;
    },
    [host]
  );

  useEffect(() => {
    latest.current = deck;
  }, [deck]);

  useEffect(() => {
    if (!dirty || conflict) return;
    const timer = setTimeout(() => void enqueueSave(deck), SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [deck, dirty, conflict, enqueueSave, saveError]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  // Changes made somewhere else (another device, a collaborator): look every few seconds while this tab is showing. When nothing of
  // mine is waiting to be saved, the newer deck simply replaces this one; when something is, my save meets the newer version, and the
  // two are merged then (see enqueueSave). The question is cheap: the server sends nothing unless the deck has moved on.
  useEffect(() => {
    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState !== "visible" || conflictRef.current) return;
      try {
        const data = await host.poll?.(versionRef.current);
        if (!data || stopped) return;
        if (data.version === versionRef.current) return;
        if (latest.current !== savedRef.current || savingRef.current) return; // something of mine is pending: the save will merge
        const fresh = data.deck;
        versionRef.current = data.version;
        savedRef.current = fresh;
        setSavedDeck(fresh);
        setHist(createHistory(fresh));
        setSelected((s) => (typeof s === "number" ? Math.min(s, Math.max(0, fresh.slides.length - 1)) : s));
        showUpdated("Updated with changes made elsewhere.");
        host.onRemoteChange?.(); // a picture may have been added with them
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

  // Closing the tab right after a change: send what is there. sendBeacon is the one way a browser promises to finish a request after the page is gone.
  useEffect(() => {
    const flush = () => {
      if (latest.current === savedDeck || conflictRef.current) return;
      host.flush?.(latest.current, versionRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [host, savedDeck]);

  // ── Undo and redo ────────────────────────────────────────────────────────────────────────────────
  // What talk mode reports to the host (never words). An undo soon after a spoken change is the sign that it was misheard or misread.
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

  // ── Slide actions ────────────────────────────────────────────────────────────────────────────────
  const current = typeof sel === "number" ? sel : 0;
  const add = (layout: string) => {
    const slide = newSlide(layout);
    if (!slide) return;
    const at = typeof sel === "number" ? sel + 1 : 0;
    change(addSlide(deck, slide, at));
    setSelected(at);
    setAddOpen(false);
    setAddAfter(null);
  };
  // "All slides" next to the background picture: the picture becomes the deck's, and every slide follows it (a slide's own choice is cleared).
  // The drawing code leaves out the banner slides, those filled with the accent colour (dividers, the closing slide) or with a colour of
  // their own. Unticked: only this slide keeps the picture.
  const applyPictureToAll = (on: boolean, id: string) => {
    if (typeof sel !== "number" || !id) return;
    const slides = deck.slides.map((s, i) => (on ? setSlideOption(s, "backgroundImage", undefined) : i === sel ? setSlideOption(s, "backgroundImage", id) : s));
    change({ ...deck, backgroundImage: on ? id : "none", slides } as SlideDeck, `${sel}.opt.backgroundImage`);
  };
  const remove = () => {
    if (typeof sel !== "number" || deck.slides.length <= 1) return;
    change(deleteSlide(deck, sel));
    setSelected(Math.max(0, sel - 1));
  };
  const move = (to: number) => {
    if (typeof sel !== "number" || to < 0 || to >= deck.slides.length) return;
    change(moveSlide(deck, sel, to));
    setSelected(to);
  };
  const duplicate = () => {
    if (typeof sel !== "number") return;
    change(duplicateSlide(deck, sel));
    setSelected(sel + 1);
  };

  // ── Deck settings ────────────────────────────────────────────────────────────────────────────────
  const setDeckField = (key: keyof SlideDeck, value: unknown, coalesce = key) => {
    const next = value === undefined || value === "" ? (removeAt(deck as unknown as Record<string, unknown>, [key]) as unknown as SlideDeck) : (setAt(deck, [key], value) as SlideDeck);
    change(next, `deck.${String(coalesce)}`);
  };

  async function addPicture(file: File | undefined) {
    if (!file) return;
    setPictureError("");
    const r = await onAddPicture?.(file);
    if (r && !r.ok) setPictureError(r.error);
  }

  async function uploadPicture(file: File): Promise<{ id: string; width: number; height: number } | { error: string }> {
    const r = await onAddPicture?.(file);
    if (!r) return { error: "Pictures can't be added here." };
    return r.ok ? { id: r.item.id, width: r.item.width, height: r.item.height } : { error: r.error };
  }

  // Ail changes one slide: what it writes replaces that slide only if the slide has not been edited meanwhile.
  const latestDeck = useRef(deck);
  useEffect(() => {
    latestDeck.current = deck;
  });
  const [asking, setAsking] = useState(false);
  // Talk mode (see SlideAsk): while it hears the person, or speaks back, the animated mark shows over the slide, as it does while the slide changes.
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("off");
  // While talk mode is on everything but the slide and the talk bar is faded, so it is plain that the editor is listening and the slide is
  // what is being worked on. Still there and still usable, just quieter.
  const talkOn = voicePhase !== "off";
  const dim = `transition-opacity duration-300 motion-reduce:transition-none ${talkOn ? "opacity-35" : ""}`;
  const spoken = useRef<string | undefined>(undefined); // what talk mode says after the last request
  const [nudgeNote, setNudgeNote] = useState(false);
  const [askNote, setAskNote] = useState<{ kind: "done" | "error"; text: string } | null>(null);
  // "Next slide", "go back", "slide 3" spoken in talk mode. Returns what to say aloud.
  function goBySpeech(c: NavCommand): string {
    const count = deck.slides.length;
    const at = typeof sel === "number" ? sel : -1;
    const to = c.to === "next" ? at + 1 : c.to === "previous" ? (at < 0 ? 0 : at - 1) : c.to === "first" ? 0 : c.to === "last" ? count - 1 : c.to === "number" ? c.n - 1 : at;
    if (to < 0) return "This is the first slide.";
    if (to >= count) return c.to === "next" ? "This is the last slide." : `There are only ${count} slides.`;
    if (to === at) return c.to === "first" ? "This is the first slide." : c.to === "last" ? "This is the last slide." : `Slide ${to + 1}.`;
    setSelected(to);
    return `Slide ${to + 1}.`;
  }
  // Every spoken command that is not a request to the assistant: moving about, undo, redo, and delete (which asks for a yes first).
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
      if (typeof sel !== "number") return { say: "Pick a slide first." };
      if (deck.slides.length <= 1) return { say: "A deck needs at least one slide, so I can't delete this one." };
      return { say: `Delete slide ${sel + 1}? Say yes or no.`, confirm: true };
    }
    if (c.to === "confirm-delete") {
      if (typeof sel !== "number" || deck.slides.length <= 1) return { say: "Nothing was deleted." };
      const now = Math.max(0, sel - 1);
      remove();
      return { say: `Deleted. You are on slide ${now + 1}.` };
    }
    if (c.to === "cancel-delete") return { say: "Okay, I kept it." };
    return { say: goBySpeech(c as NavCommand) }; // every other command was handled above
  }
  // The slide briefly shows a ring after a change, so a change made by voice (with nothing typed on screen) is easy to spot.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashStage() {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1600);
  }
  async function runAsk(prompt: string, opts?: { voice?: boolean }): Promise<string | null> {
    setAsking(true);
    setAskNote(null);
    spoken.current = undefined;
    const problem = await askSlide(prompt, opts);
    setAsking(false);
    if (!problem) {
      flashStage();
      if (opts?.voice) lastVoiceEdit.current = Date.now();
    }
    setAskNote(problem ? { kind: "error", text: problem } : { kind: "done", text: `${spoken.current ?? "Done."} Not right? Press Undo.` });
    return problem;
  }
  // Turning a normal slide into a free-form one is done by the server from how the slide is drawn: instant, no model, no cost.
  async function turnOnFreeForm(): Promise<string | null> {
    if (typeof sel !== "number") return "Pick a slide first.";
    const index = sel;
    const original = deck.slides[index];
    setAsking(true);
    setAskNote(null);
    let problem: string | null = null;
    try {
      const data = await host.freeForm({
        slide: original,
        deck: { background: deck.background, accent: deck.accent, fontPair: deck.fontPair },
        images: images.map((i) => ({ id: i.id, label: i.label, width: i.width, height: i.height })),
      });
      if (!data.slide) problem = data.error ?? "Couldn't turn on editing for this slide.";
      else if (latestDeck.current.slides[index] !== original) problem = "The slide changed meanwhile. Try again.";
      else change(updateSlide(latestDeck.current, index, data.slide), `${index}.freeform.${Date.now()}`);
    } catch {
      problem = "Couldn't reach the server. Check your connection and try again.";
    }
    setAsking(false);
    setAskNote(problem ? { kind: "error", text: problem } : { kind: "done", text: "Editing is on for this slide. Drag its parts, or press Undo." });
    return problem;
  }
  async function askSlide(prompt: string, opts?: { voice?: boolean }): Promise<string | null> {
    if (typeof sel !== "number") return "Pick a slide first.";
    const index = sel;
    const original = deck.slides[index];
    // A normal slide can only change its words and its own look settings. For a spoken request about colours, fonts, sizes or moving things,
    // turn this one slide free-form first (instant, no model, one undo step together with the change), so the request can be carried out.
    let base = original;
    let converted = false;
    if (opts?.voice && layoutOf(original) !== "canvas" && needsFreeForm(prompt)) {
      try {
        const ff = await host.freeForm({
          slide: original,
          deck: { background: deck.background, accent: deck.accent, fontPair: deck.fontPair },
          images: images.map((i) => ({ id: i.id, label: i.label, width: i.width, height: i.height })),
        });
        if (ff.slide) {
          base = ff.slide;
          converted = true;
        }
      } catch {
        /* carry on with the slide as it is */
      }
    }
    try {
      const data = await host.ask({
        prompt,
        slide: base,
        index,
        total: deck.slides.length,
        deck: { title: deck.title, background: deck.background, accent: deck.accent, fontPair: deck.fontPair, backgroundImage: effective.backgroundImage },
        images: images.map((i) => ({ id: i.id, label: i.label, description: i.description, width: i.width, height: i.height })),
        ...(opts?.voice ? { fast: true } : {}),
      });
      if (opts?.voice) {
        track({ type: "talk_request", ok: !!data.slide });
        if (data.limited) track({ type: "talk_limit" });
      }
      if (!data.slide) return data.error ?? "Couldn't change the slide. Try again.";
      if (latestDeck.current.slides[index] !== original) return `The slide changed while ${assistantName} was working. Ask again.`;
      spoken.current = (converted ? "Editing is on for this slide. " : "") + describeChange(base, data.slide);
      change(updateSlide(latestDeck.current, index, data.slide), `${index}.ask.${Date.now()}`);
      return null;
    } catch {
      if (opts?.voice) track({ type: "talk_request", ok: false });
      return `Couldn't reach ${assistantName}. Check your connection and try again.`;
    }
  }

  function nudgeFreeForm() {
    setNudgeNote(true);
    setTimeout(() => setNudgeNote(false), 2500);
  }
  const fixedLayout = typeof sel === "number" && layoutOf(deck.slides[sel]) !== "canvas";

  const activeBox = typeof sel === "number" && pickedBox && pickedBox.slide === sel ? pickedBox : null;
  // The picked part only counts while it still exists on the slide (it may have been removed, or the slide swapped).
  const pickedExists = (() => {
    if (!activeBox || typeof sel !== "number") return false;
    const slide = deck.slides[sel];
    if (activeBox.list === "elements") return Array.isArray((slide as unknown as { elements?: unknown[] }).elements) && !!(slide as unknown as { elements: unknown[] }).elements[activeBox.index];
    return !!placedPictures(slide)[activeBox.index];
  })();
  const pickedNow = pickedExists ? activeBox : null;
  // The settings of the picked part (a free-form element or a placed picture). On a phone they open above the slide, so the slide is not
  // covered and the part can still be seen while it is changed; from a tablet up they are in the column beside the slide.
  const pickedPanel =
    pickedNow?.list === "elements" ? (
      <ElementPanel
        key={`el${current}.${pickedNow.index}`}
        slide={deck.slides[current]}
        pictures={choices}
        index={pickedNow.index}
        defaultTextColor={readableOn(((deck.slides[current] as unknown as { background?: unknown }).background as string | undefined) ?? effective.background ?? "FFFFFF")}
        onSelect={(index) => setPickedBox({ slide: current, list: "elements", index })}
        onBack={() => setPickedBox(null)}
        onChange={(next: SlideContent, key) => change(updateSlide(deck, current, next), `${current}.${key}`)}
      />
    ) : pickedNow?.list === "pictures" ? (
      <PicturePanel
        key={`pic${current}.${pickedNow.index}`}
        slide={deck.slides[current]}
        pictures={choices}
        index={pickedNow.index}
        onBack={() => setPickedBox(null)}
        onChange={(next: SlideContent, key) => change(updateSlide(deck, current, next), `${current}.${key}`)}
      />
    ) : null;
  const pickedKey = pickedNow ? `${pickedNow.list}.${pickedNow.index}` : "";
  useEffect(() => {
    if (phone && pickedKey) pickedPanelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phone, pickedKey]);
  function moveBoxTo(ref: BoxRef, box: Box) {
    if (typeof sel !== "number") return;
    // The drawn slide comes from the server a moment after the drag, so move what is drawn for this part right now, from where it is
    // drawn at the moment (the deck as it stands, not as it was when this drag callback was made), and let the server's drawing settle it.
    const drawnAt = movableBoxes(latest.current.slides[sel] ?? deck.slides[sel]).find((m) => m.list === ref.list && m.index === ref.index);
    if (drawnAt) setRecorded((r) => (r ? moveDrawn(r, sel + offset, drawnAt.kind, drawnAt.box, box) : r));
    change(updateSlide(deck, sel, setBox(deck.slides[sel], ref.list, ref.index, box)), `${sel}.box.${ref.list}.${ref.index}`);
  }
  function removeBox(ref: BoxRef) {
    if (typeof sel !== "number") return;
    change(updateSlide(deck, sel, removeAt(deck.slides[sel], [ref.list, ref.index])), `${sel}.${ref.list}.${ref.index}:remove`);
    setPickedBox(null);
  }

  async function download(allowMissingPictures = false) {
    setExporting(true);
    setNotice("");
    setMissingPictures(false);
    const made = await host.download({ deck: effective, allowMissingPictures });
    setExporting(false);
    if (made.ok) saveBlob(made.blob, made.filename);
    else {
      setNotice(made.error);
      setMissingPictures((made.missing?.length ?? 0) > 0); // offer the download without them, instead of leaving the person stuck
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
    savedRef.current = data.deck;
    setSavedDeck(data.deck);
    setHist((h) => commit(h, data.deck));
    setSelected(0);
    setVersions(null);
  }

  const order = previewOrder(deck.slides.length, dragFrom, dragOver); // the strip's order, with the dragged slide already in its new place
  const status = conflict ? "Changed somewhere else" : saveError ? "Not saved" : saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved";
  const shownSlide = recorded?.slides[(sel === "deck" ? 0 : sel + offset)];

  return (
    <div className="min-h-dvh lg:h-dvh lg:min-h-0 lg:overflow-hidden flex flex-col bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)]">
      <header className={`${dim} flex items-center gap-2 px-3 sm:px-4 h-14 border-b border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] shrink-0`}>
        {back}
        <h1 className="text-sm font-semibold truncate min-w-0 flex-1">{deck.title ?? "Untitled deck"}</h1>
        <span role="status" aria-live="polite" className={`hidden sm:inline text-xs ${saveError || conflict ? "text-red-500" : "text-[var(--ds-text-muted)]"}`}>{status === "Saved" && savedCount > 0 && <SuccessTick key={savedCount} size={13} className="mr-1 inline-block align-[-2px]" />}{status}</span>
        <button type="button" onClick={doUndo} disabled={!canUndo(hist)} className={barButton} aria-label="Undo">Undo</button>
        <button type="button" onClick={() => setHist((h) => redo(h))} disabled={!canRedo(hist)} className={barButton} aria-label="Redo">Redo</button>
        {host.versions && <button type="button" onClick={openVersions} className={`${barButton} hidden sm:inline-block`}>Versions</button>}
        {headerActions}
        <button type="button" onClick={() => void download()} disabled={exporting} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--ds-accent)] text-[var(--ds-on-accent)] hover:opacity-90 disabled:opacity-50 transition-opacity">
          {exporting ? "Making…" : "Download"}
        </button>
      </header>

      {updatedNote && !conflict && (
        <div role="status" className={`${dim} px-4 py-1.5 text-xs border-b border-[var(--ds-border-muted)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text-secondary)]`}>{updatedNote}</div>
      )}
      {headerNotice}

      {(conflict || saveError || notice) && (
        <div role="alert" className="px-4 py-2 text-xs border-b border-[var(--ds-border-muted)] bg-amber-500/10 text-[var(--ds-text-primary)] flex flex-wrap items-center gap-3">
          {conflict ? (
            <>
              <span>This deck was changed in another tab or on another device.</span>
              <button type="button" className="font-medium underline" onClick={() => { versionRef.current = conflict.version; savedRef.current = conflict.deck; setSavedDeck(conflict.deck); setHist(createHistory(conflict.deck)); setConflictState(null); }}>Load the newer version</button>
              <button type="button" className="font-medium underline" onClick={() => { versionRef.current = conflict.version; setConflictState(null); }}>Keep my changes</button>
            </>
          ) : (
            <>
              <span>{notice || saveError}</span>
              {missingPictures && (
                <button type="button" disabled={exporting} className="font-medium underline disabled:opacity-50" onClick={() => void download(true)}>Download without them</button>
              )}
            </>
          )}
        </div>
      )}

      <p className={`${dim} lg:hidden px-4 py-2 text-[11px] text-[var(--ds-text-muted)] border-b border-[var(--ds-border-muted)]`}>
        Basic editing on a phone: change text, add, move or remove slides. For pictures, charts and more room, open this page on a larger screen.
      </p>

      {typeof sel === "number" && (
        <div className={`${dim} shrink-0`}>
        <SlideToolbar
          key={`bar${sel}`}
          slide={deck.slides[sel]}
          deck={effective}
          pictures={choices}
          index={sel}
          count={deck.slides.length}
          layout={layoutOf(deck.slides[sel])}
          busy={asking}
          onMove={move}
          onDuplicate={duplicate}
          onRemove={remove}
          onChange={(next: SlideContent, key) => change(updateSlide(deck, sel, next), `${sel}.${key}`)}
          onApplyPictureToAll={applyPictureToAll}
          assistantName={assistantName}
          onLayout={(layoutKey) => void (layoutKey === "canvas" ? turnOnFreeForm() : runAsk(`Change this slide to the "${layoutKey}" layout, carrying the content over and keeping what it says.`))}
        />
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[200px_minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]">
        {/* Slides */}
        <aside aria-label="Slides" className={`${dim} lg:border-r border-[var(--ds-border-muted)] lg:overflow-y-auto bg-[var(--ds-bg-surface)]`}>
          <div
            ref={strip}
            // The whole strip takes the drop (not only a slide), so letting go in a gap between two slides still counts.
            onDragEnter={(e) => dragFrom !== null && e.preventDefault()}
            onDragOver={(e) => dragFrom !== null && e.preventDefault()}
            onDrop={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              if (dragOver !== null && dragFrom !== dragOver) {
                change(moveSlide(deck, dragFrom, dragOver));
                setSelected(dragOver);
              }
              setDragFrom(null);
              setDragOver(null);
            }}
            className="relative flex lg:block gap-2 p-2 overflow-x-auto lg:overflow-x-visible"
          >
            {deck.title && (
              <button type="button" onClick={() => setSelected("deck")} aria-pressed={sel === "deck"} className={`shrink-0 w-36 lg:w-full text-left rounded-lg border p-1 mb-0 lg:mb-2 ${sel === "deck" ? "border-[var(--ds-accent)]" : "border-[var(--ds-border-muted)]"}`}>
                {recorded?.slides[0] ? <SlideStage slide={recorded.slides[0]} assets={recorded.assets} images={pixels} logoRound={logo.round} /> : <div className="aspect-video bg-[var(--ds-bg-elevated)]" />}
                <span className="block text-[11px] mt-1 px-1 text-[var(--ds-text-muted)]">Cover and deck settings</span>
              </button>
            )}
            {order.map((i) => {
              const slide = deck.slides[i];
              const rs = recorded?.slides[i + offset];
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
                    // The slide itself is what moves (lifted, in the strip), so the browser's own ghost picture is not wanted.
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                    e.dataTransfer.setDragImage(new Image(), 0, 0);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragFrom !== null && i !== dragFrom) setDragOver(order.indexOf(i)); // where this slide sits now is where the dragged one goes
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onClick={() => setSelected(i)}
                  aria-pressed={sel === i}
                  aria-label={`Slide ${i + 1}, ${LAYOUT_LABELS[layoutOf(slide)] ?? layoutOf(slide)}`}
                  style={lifted ? { scale: String(MOTION.liftScale) } : undefined}
                  className={`shrink-0 w-36 lg:w-full text-left rounded-lg border p-1 mb-0 lg:mb-2 transition-[scale,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${lifted ? "relative z-10 shadow-xl cursor-grabbing" : ""} ${sel === i ? "border-[var(--ds-accent)] ring-1 ring-[var(--ds-accent)]" : "border-[var(--ds-border-muted)]"}`}
                >
                  {rs ? <SlideStage slide={rs} assets={recorded!.assets} images={pixels} logoRound={logo.round} /> : <div className="aspect-video bg-[var(--ds-bg-elevated)]" />}
                  <span className="block text-[11px] mt-1 px-1 text-[var(--ds-text-muted)] truncate">{i + 1} · {LAYOUT_LABELS[layoutOf(slide)] ?? layoutOf(slide)}</span>
                </button>
                {sel === i && (
                  <div className="hidden lg:block mb-2 -mt-1">
                    <button type="button" onClick={() => setAddAfter((o) => (o === i ? null : i))} aria-expanded={addAfter === i} className="w-full px-3 py-1.5 rounded-lg border border-dashed border-[var(--ds-accent)] text-xs font-medium text-[var(--ds-accent)] hover:bg-[var(--ds-bg-hover)]">
                      {addAfter === i ? "Close templates" : `+ Add slide after ${i + 1}`}
                    </button>
                    {/* Opens by growing, ease-out, 350 ms: fast first, then slow. */}
                    <div data-open={addAfter === i} inert={addAfter !== i} className="grid grid-rows-[0fr] data-[open=true]:grid-rows-[1fr] opacity-0 data-[open=true]:opacity-100 transition-[grid-template-rows,opacity] duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none">
                      <div className="min-h-0 overflow-hidden">
                        <div ref={addAfter === i ? addAfterRef : undefined} role="group" aria-label="Slide templates" className="mt-1.5 grid grid-cols-2 gap-1.5">
                          {Object.entries(NEW_SLIDE_TEMPLATES).map(([layout, t]) => (
                            <button key={layout} type="button" onClick={() => add(layout)} className="text-left text-[11px] leading-tight px-2 py-2 rounded-md border border-[var(--ds-border-muted)] bg-[var(--ds-bg-primary)] hover:border-[var(--ds-accent)]">{t.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </Fragment>
              );
            })}
            <div className="relative shrink-0 self-center lg:self-auto max-sm:order-first max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:self-stretch max-sm:flex max-sm:bg-[var(--ds-bg-surface)] max-sm:pr-1">
              {/* On a phone this sits first in the strip and stays in view while the slides scroll, so adding a slide is always one tap away. */}
              <button type="button" onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen} className="w-24 lg:w-full max-sm:w-16 max-sm:px-1 max-sm:text-[11px] max-sm:leading-tight px-3 py-2 rounded-lg border border-dashed border-[var(--ds-border-muted)] text-xs font-medium text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:border-[var(--ds-accent)]">
                + Add slide
              </button>
              {addOpen && (
                <div ref={addMenuRef} role="menu" className="absolute left-0 bottom-full lg:static lg:bottom-auto lg:w-full mt-1 z-20 w-52 max-sm:fixed max-sm:inset-x-3 max-sm:bottom-28 max-sm:left-3 max-sm:z-40 max-sm:w-auto max-sm:max-h-[50dvh] max-sm:overflow-y-auto max-sm:grid max-sm:grid-cols-2 rounded-lg border border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] shadow-lg p-1">
                  {Object.entries(NEW_SLIDE_TEMPLATES).map(([layout, t]) => (
                    <button key={layout} role="menuitem" type="button" onClick={() => add(layout)} className="w-full text-left text-sm px-2.5 py-1.5 max-sm:py-3 rounded-md hover:bg-[var(--ds-bg-hover)]">{t.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* The slide */}
        <section aria-label="Slide preview" className="min-w-0 min-h-0 flex flex-col" onPointerDown={() => setPickedBox(null)}>
          {phone && pickedPanel && (
            <div ref={pickedPanelRef} onPointerDown={(e) => e.stopPropagation()} className={`${dim} mx-3 mt-3 max-h-[40dvh] overflow-y-auto rounded-lg border border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] p-3 shadow-sm`}>
              {pickedPanel}
            </div>
          )}
          <div className="flex-1 min-h-0 p-3 sm:p-4 lg:[container-type:size] flex items-center justify-center">
            <div className="w-full lg:w-[min(100cqw,calc(100cqh*16/9))] max-w-[1100px]">
              <div className={`rounded-lg overflow-hidden border border-[var(--ds-border-muted)] shadow-sm bg-[var(--ds-bg-surface)] ring-4 transition-shadow duration-700 motion-reduce:transition-none ${flash ? "ring-[var(--ds-accent)]" : "ring-transparent"}`}>
                <div className="relative">
                  {shownSlide ? <SlideStage slide={shownSlide} assets={recorded!.assets} images={pixels} logoRound={logo.round} /> : <div className="aspect-video flex items-center justify-center text-xs text-[var(--ds-text-muted)]">Drawing your slide…</div>}
                  {fixedLayout && typeof sel === "number" && shownSlide && <LockedParts parts={lockedParts(shownSlide, movableBoxes(deck.slides[sel]).map((m) => m.box))} onTry={nudgeFreeForm} />}
                  {(asking || heavy || voicePhase === "hearing" || voicePhase === "speaking") && (
                    <div className={`slide-busy absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 ${asking || heavy ? "bg-[var(--ds-bg-primary)]/70" : "bg-[var(--ds-bg-primary)]/45"}`} aria-live="polite">
                      <div className="relative flex items-center justify-center">
                        {voicePhase === "hearing" && !asking && !heavy && <span aria-hidden="true" className="motion-safe:animate-ping absolute h-28 w-28 rounded-full border-2 border-[var(--ds-accent)] opacity-40" />}
                        {busyMark ?? <span role="status" aria-label="Updating the slide" className="inline-block h-8 w-8 rounded-full border-2 border-[var(--ds-border-muted)] border-t-[var(--ds-accent)] animate-spin" />}
                      </div>
                      {voicePhase !== "off" && <p className="text-xs font-medium text-[var(--ds-text-secondary)]">{asking || heavy ? "Working on it…" : voicePhase === "speaking" ? "Speaking…" : "Listening…"}</p>}
                    </div>
                  )}
                  {typeof sel === "number" && shownSlide && (
                    <SlideHandles boxes={movableBoxes(deck.slides[sel])} selected={activeBox} onSelect={(ref) => setPickedBox(ref ? { ...ref, slide: sel } : null)} onChange={moveBoxTo} onRemove={removeBox} />
                  )}
                </div>
              </div>
              {previewError && <p role="status" className="mt-2 text-xs text-amber-600">{previewError}</p>}
            </div>
          </div>
          {fixedLayout && shownSlide && (
            <div className={`${dim} px-3 sm:px-4 pb-2 shrink-0`}>
              <div className="mx-auto w-full max-w-[1100px]">
                <FreeFormNote busy={asking} highlight={nudgeNote} onTurnOn={() => void turnOnFreeForm()} />
              </div>
            </div>
          )}
          {typeof sel === "number" && (
            <>
              <div className={dim}>
              <SlideInsert
                key={`ins${sel}`}
                slide={deck.slides[sel]}
                pictures={choices}
                onChange={(next: SlideContent, key) => change(updateSlide(deck, sel, next), `${sel}.${key}`)}
                onUploadPicture={isEditor ? undefined : uploadPicture}
                onPlaced={(index) => setPickedBox({ slide: sel, list: "pictures", index })}
              />
              </div>
              <SlideAsk slideKey={sel} onCommand={runCommand} track={track} acknowledge={host.acknowledge ? (p) => host.acknowledge!(p) : undefined} onVoicePhase={setVoicePhase} spokenReply={() => spoken.current} onSend={runAsk} busy={asking} note={askNote} assistantName={assistantName} />
            </>
          )}
        </section>

        {/* The fields */}
        <aside aria-label="Slide fields" className={`${dim} lg:border-l border-[var(--ds-border-muted)] min-h-0 flex flex-col bg-[var(--ds-bg-surface)]`}>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {sel === "deck" ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Cover and deck settings</h2>
              <label className="block space-y-1"><span className="text-xs font-medium text-[var(--ds-text-secondary)]">Title</span><input value={deck.title ?? ""} onChange={(e) => setDeckField("title", e.target.value)} className={inputClass} /></label>
              <label className="block space-y-1"><span className="text-xs font-medium text-[var(--ds-text-secondary)]">Subtitle</span><input value={deck.subtitle ?? ""} onChange={(e) => setDeckField("subtitle", e.target.value)} className={inputClass} /></label>
              <ColorField label="Background" value={deck.background} fallback="FFFFFF" onChange={(v) => setDeckField("background", v)} />
              <ColorField label="Accent" value={deck.accent} fallback="2563EB" onChange={(v) => setDeckField("accent", v)} />
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ds-text-secondary)]">Font style</span>
                <select value={deck.fontPair ?? ""} onChange={(e) => setDeckField("fontPair", (e.target.value || undefined) as FontPairKey | undefined)} className={inputClass}>
                  <option value="">Automatic</option>
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                  <option value="bold">Bold</option>
                </select>
              </label>
              <div className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ds-text-secondary)]">Background picture</span>
                <PictureSelect
                  ariaLabel="Background picture"
                  value={deck.backgroundImage ?? ""}
                  buttonClassName="!text-sm !px-2.5 !py-1.5"
                  options={[
                    { value: "", label: labels.defaultPicture ?? "From the picture settings (default)" },
                    { value: "none", label: "None" },
                    ...choices.map((i) => ({ value: i.id, label: `${i.id} · ${i.label}`, thumb: i.thumb })),
                  ]}
                  onChange={(id) => setDeckField("backgroundImage", id || undefined)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-medium text-[var(--ds-text-secondary)]">Your pictures ({images.length} of 6)</span>
                <p className="text-[11px] text-[var(--ds-text-muted)]">{isEditor ? (labels.readOnlyPicturesNote ?? "These pictures belong to someone else. They can be used here but not added or removed.") : (labels.picturesNote ?? "Used on picture slides and as the background.")}</p>
                {!isEditor && onAddPicture && <label className="inline-block">
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--ds-border-muted)] cursor-pointer hover:border-[var(--ds-accent)]">Add a picture</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Add a picture" className="hidden" onChange={(e) => { void addPicture(e.target.files?.[0]); e.target.value = ""; }} />
                </label>}
                {pictureError && <p className="text-xs text-red-500">{pictureError}</p>}
              </div>
              {(deck.subtitle || (deck.meta && deck.meta.length > 0)) && (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-[var(--ds-text-secondary)]">Cover details</legend>
                  {(deck.meta ?? []).map((m, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input aria-label={`Detail ${i + 1} label`} value={m.label} onChange={(e) => change(setAt(deck, ["meta", i, "label"], e.target.value), `deck.meta.${i}.label`)} className={inputClass} />
                      <input aria-label={`Detail ${i + 1} value`} value={m.value} onChange={(e) => change(setAt(deck, ["meta", i, "value"], e.target.value), `deck.meta.${i}.value`)} className={inputClass} />
                      <button type="button" aria-label={`Remove detail ${i + 1}`} onClick={() => change(removeAt(deck, ["meta", i]))} className="shrink-0 w-7 h-8 pointer-coarse:w-11 pointer-coarse:h-11 text-xs text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]">×</button>
                    </div>
                  ))}
                  {(deck.meta?.length ?? 0) < 4 && (
                    <button type="button" onClick={() => change(deck.meta ? (insertAt(deck, ["meta"], deck.meta.length, { label: "", value: "" }) as SlideDeck) : ({ ...deck, meta: [{ label: "", value: "" }] } as SlideDeck))} className="text-xs font-medium text-[var(--ds-accent)] hover:underline">+ Add a detail</button>
                  )}
                </fieldset>
              )}
            </div>
          ) : (
            pickedPanel && !phone ? (
              pickedPanel
            ) : (
            <>
              <h2 className="text-sm font-semibold">Slide {current + 1}</h2>
              <SlideForm key={current} slide={deck.slides[current]} pictures={choices} activeElement={activeBox?.list === "elements" ? activeBox.index : null} onSelectElement={(index) => setPickedBox({ slide: current, list: "elements", index })} onChange={(next: SlideContent, key) => change(updateSlide(deck, current, next), `${current}.${key}`)} />
            </>
            )
          )}
          </div>
          {typeof sel === "number" && !(pickedNow && !phone) && (
            <SlideLook
              key={`look${sel}`}
              slide={deck.slides[sel]}
              deck={effective}
              pictures={choices}
              onChange={(next: SlideContent, key) => change(updateSlide(deck, sel, next), `${sel}.${key}`)}
              activePicture={activeBox?.list === "pictures" ? activeBox.index : null}
              onSelectPicture={(index) => setPickedBox({ slide: sel, list: "pictures", index })}
            />
          )}
        </aside>
      </main>

      {/* Room under the page for the chat box, which is fixed to the bottom of a phone screen. */}
      {typeof sel === "number" && <div aria-hidden className="sm:hidden h-28 shrink-0" />}

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
