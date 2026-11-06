"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VoiceSession, browserRecognition, isStopCommand, narrateWhile, parseActionCommand, parseAnswer, parseNavCommand, primeSpeech, speak, splitTrailingNav, type ActionCommand, type NavCommand, type VoiceState } from "./voice.js";
import type { VoiceEvent } from "./host.js";

// The chat box under the slide: type what to change and the assistant rewrites this slide only, as one step the person can undo. It stays
// put at the bottom of the middle column. `onSend` does the asking and returns an error message, or null when the slide was changed;
// `busy` and `note` come from the editor so a change started from the toolbar (a new layout) shows here too.
//
// Talk mode (where the browser can listen): press Talk and just speak. Nothing is typed or shown as text. The typed box gives way to a calm voice
// bar, and the editor shows the animated mark over the slide (`onVoicePhase`) from the first words until the work is done, so it reads as
// listening and working, not as typing and sending. When the person has been quiet for two seconds the sentence is sent. While the slide is
// being changed the microphone is held, and it picks up again when the work is done, so the person can go on talking. "Speak replies" makes
// it say "Done." (or the problem) out loud; it is off by default. Saying "stop" ends talk mode. The browser does the listening, and nothing is
// kept.

/** What the voice is doing, for the editor's overlay: not on, waiting for the person to speak, hearing them, or speaking a reply. (While the slide is being changed the editor already knows: `busy`.) */
export type VoicePhase = "off" | "idle" | "hearing" | "speaking";

const SUGGESTIONS: [string, string][] = [
  ["Make it shorter", "Make the text on this slide shorter and punchier."],
  ["Make it more visual", "Make this slide more visual: use a different layout or icons where that helps, without losing the content."],
];

// Said while the work goes on, when no specific acknowledgement arrives in time (the first) and then every few seconds (the rest).
const WORKING_LINES = ["Okay, working on it.", "Still on it.", "Just a moment more.", "Nearly there."];

const SPEAK_KEY = "ail-files:voice-speak";
const HINT_KEY = "ail-files:voice-hint-seen";

/** What a spoken command asks the editor to do, and what the editor answers: the words to say back, and whether it now waits for a yes or no. */
export type VoiceCommand = NavCommand | ActionCommand;
export interface VoiceCommandResult {
  say: string;
  confirm?: boolean;
}
const noSubscribe = () => () => {};

export default function SlideAsk({ onSend, busy, note, assistantName = "the assistant", slideKey, onVoicePhase, spokenReply, acknowledge, onCommand, track }: { onSend: (prompt: string, opts?: { voice?: boolean }) => Promise<string | null>; busy: boolean; note: { kind: "done" | "error"; text: string } | null; /** What the person is asking: "Ail", "the assistant". */ assistantName?: string; /** The slide being asked about: the typed text starts afresh when it changes, while talk mode carries on. */ slideKey?: unknown; /** Told whenever talk mode moves between its phases, so the editor can show the mark over the slide. */ onVoicePhase?: (phase: VoicePhase) => void; /** What to say aloud after a spoken request that worked ("Done. I changed the title."). Falls back to "Done." */ spokenReply?: () => string | undefined; /** A quick one-line spoken acknowledgement of the request ("Sure, making the title bigger."), asked for in parallel with the real work so the assistant can answer at once. Null or slow: a generic line is said instead. */ acknowledge?: (prompt: string) => Promise<string | null>; /** Carries out a spoken command that is not a request to the assistant ("next slide", "go back", "slide 3", "undo", "redo", "delete this slide") and says what to speak back. */ onCommand?: (command: VoiceCommand) => VoiceCommandResult; /** Told about talk mode events (started, blocked, in trouble), with no words from the person. */ track?: (event: VoiceEvent) => void }) {
  const name = assistantName;
  const capitalName = name.charAt(0).toUpperCase() + name.slice(1);
  const [text, setText] = useState("");
  const [seenKey, setSeenKey] = useState(slideKey);
  if (seenKey !== slideKey) {
    setSeenKey(slideKey);
    setText("");
  }

  // Talk mode.
  const canTalk = useSyncExternalStore(noSubscribe, () => !!browserRecognition(), () => false);
  const [voice, setVoice] = useState<VoiceState>("off");
  // Replies are spoken unless the person has turned that off (the choice is remembered).
  const [speakBack, setSpeakBack] = useState(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem(SPEAK_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const session = useRef<VoiceSession | null>(null);
  const pendingDelete = useRef(false); // "Delete slide 3? Say yes or no.": the next sentence answers it
  const [trouble, setTrouble] = useState<string | null>(null);
  // A few example phrases until the person has spoken once.
  const [hintSeen, setHintSeen] = useState(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem(HINT_KEY) === "1";
    } catch {
      return true;
    }
  });
  function markHintSeen() {
    setHintSeen(true);
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* storage blocked: the hint comes back next time */
    }
  }
  const inFlow = useRef(false); // true from a spoken sentence being sent until its work (and the spoken reply) is over
  const live = useRef({ onSend, busy, speakBack, spokenReply, acknowledge, onCommand, track });
  useEffect(() => {
    live.current = { onSend, busy, speakBack, spokenReply, acknowledge, onCommand, track };
  });
  const lastPhase = useRef<VoicePhase>("off");
  function report(p: VoicePhase) {
    if (lastPhase.current === p) return;
    lastPhase.current = p;
    onVoicePhase?.(p);
  }
  const lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-IN";

  async function onSentence(sentence: string) {
    const v = session.current;
    if (!v) return;
    if (isStopCommand(sentence)) {
      v.stop();
      return;
    }
    if (live.current.busy) return void v.resume();
    markHintSeen();
    setTrouble(null);
    // Says a short line (where we are, what was undone) with the microphone held, then listens again.
    const sayThenListen = async (said: string) => {
      if (live.current.speakBack) {
        inFlow.current = true;
        v.pause();
        await new Promise((r) => setTimeout(r, 150));
        await speak(said, lang);
        inFlow.current = false;
      }
      report("idle");
      v.resume();
    };
    // "Delete slide 3? Say yes or no.": the next sentence answers it; anything else drops the question and is heard as usual.
    if (pendingDelete.current) {
      pendingDelete.current = false;
      const answer = parseAnswer(sentence);
      if (answer === "yes") return void (await sayThenListen(live.current.onCommand?.({ to: "confirm-delete" }).say ?? "Done."));
      if (answer === "no") return void (await sayThenListen("Okay, I kept it."));
    }
    // Commands that are not requests to the assistant (moving about, undo, redo, delete): no waiting, no overlay.
    const command = live.current.onCommand ? (parseNavCommand(sentence) ?? parseActionCommand(sentence)) : null;
    if (command) {
      const result = live.current.onCommand!(command);
      if (command.to === "delete" && result.confirm) pendingDelete.current = true;
      return void (await sayThenListen(result.say));
    }
    // "…change the list to a table, next slide": do the edit, then move on.
    const split = live.current.onCommand ? splitTrailingNav(sentence) : null;
    const request = split?.request ?? sentence;
    inFlow.current = true;
    const work = live.current.onSend(request, { voice: true });
    if (live.current.speakBack) {
      // Keep talking while the slide is being changed, so it feels active: a quick acknowledgement, then a short line every few seconds.
      void narrateWhile(work, {
        say: (t) => speak(t, lang),
        acknowledge: live.current.acknowledge ? live.current.acknowledge(request).catch(() => null) : Promise.resolve(null),
        generic: WORKING_LINES[0],
        fillers: WORKING_LINES.slice(1),
      });
    }
    const problem = await work;
    if (live.current.speakBack) {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel(); // stop mid-line: the result comes next
      report("speaking");
      await new Promise((r) => setTimeout(r, 150)); // let the microphone let go of the audio before speaking (iOS)
      await speak(problem ?? live.current.spokenReply?.() ?? "Done.", lang);
    }
    if (split && !problem) {
      const moved = live.current.onCommand!(split.nav);
      if (live.current.speakBack) await speak(moved.say, lang);
    }
    inFlow.current = false;
    report("idle");
    v.resume();
  }

  function toggleVoice() {
    if (voice === "listening" || voice === "paused") {
      session.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      return;
    }
    primeSpeech(); // inside the tap, so replies can be spoken later
    setTrouble(null);
    live.current.track?.({ type: "talk_start" });
    session.current ??= new VoiceSession({
      create: () => {
        const C = browserRecognition();
        return C ? new C() : null;
      },
      lang,
      onHeard: () => {
        setTrouble(null);
        report("hearing");
      },
      onTrouble: (kind, detail) => {
        setTrouble(kind === "silence" ? "I can't hear anything. Check that the microphone is on and not muted, or type instead." : `The microphone or the speech service is not working${detail ? ` (${detail})` : ""}. You can type instead.`);
        live.current.track?.({ type: "talk_trouble", detail: kind === "silence" ? "silence" : (detail ?? "error") });
      },
      onState: (st) => {
        setVoice(st);
        if (st === "blocked") live.current.track?.({ type: "talk_blocked" });
        if (st === "off" || st === "blocked" || st === "unsupported") report("off");
        else if (st === "listening" && lastPhase.current === "off") report("idle");
      },
      onSentence: (t) => void onSentence(t),
    });
    session.current.start();
  }

  // Hold the microphone whenever the slide is being changed (also by something other than a spoken sentence, such as a new layout), and pick it up afterwards.
  useEffect(() => {
    const v = session.current;
    if (!v) return;
    if (busy) v.pause();
    else if (!inFlow.current) v.resume();
  }, [busy]);
  useEffect(
    () => () => {
      session.current?.stop();
    },
    [],
  );

  async function send(prompt: string, fromBox: boolean) {
    const clean = prompt.trim();
    if (!clean || busy) return;
    const problem = await onSend(clean);
    if (!problem && fromBox) setText("");
  }

  const talking = voice === "listening" || voice === "paused";

  const micButton = canTalk && (
    <button
      type="button"
      onClick={toggleVoice}
      aria-pressed={talking}
      title={talking ? "Stop talking" : `Talk to ${name}: just speak, and pause when you are done`}
      className={`shrink-0 h-10 px-3 text-xs font-medium rounded-xl border ${talking ? "border-[var(--ds-accent)] text-[var(--ds-accent)]" : "border-[var(--ds-border-muted)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]"}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {talking ? "Stop talking" : "Talk"}
      </span>
    </button>
  );

  return (
    <section aria-label={`Ask ${name} about this slide`} className="shrink-0 border-t border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] px-3 sm:px-4 pt-2.5 pb-3">
      <div className="mx-auto w-full max-w-3xl space-y-1.5">
        {talking ? (
          // Talk mode: no typed text. The mark animates over the slide while it listens and works; this bar only says what is happening.
          <div role="status" aria-live="polite" className="flex items-center gap-3 min-h-[4rem] px-3 rounded-xl border border-[var(--ds-border-muted)] bg-[var(--ds-bg-primary)]">
            <span aria-hidden="true" className="relative flex h-3 w-3 shrink-0">
              {voice === "listening" && !busy && <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ds-accent)] opacity-60" />}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${voice === "listening" && !busy ? "bg-[var(--ds-accent)]" : "bg-[var(--ds-text-muted)]"}`} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--ds-text-secondary)]">
                {busy ? `${capitalName} is on it. I will listen again when it is done.` : voice === "paused" ? "Paused." : "Listening. Just tell me what to change. Say \"stop\" to finish."}
              </p>
              {!hintSeen && !busy && <p className="mt-0.5 text-[11px] text-[var(--ds-text-muted)]">Try: &ldquo;Make the title shorter&rdquo;, &ldquo;Next slide&rdquo;, &ldquo;Undo&rdquo;.</p>}
            </div>
            <label className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-[var(--ds-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={speakBack}
                onChange={(e) => {
                  setSpeakBack(e.target.checked);
                  try {
                    window.localStorage.setItem(SPEAK_KEY, e.target.checked ? "1" : "0");
                  } catch {
                    /* storage blocked: the choice lasts until the page closes */
                  }
                }}
              />
              Speak replies
            </label>
            {micButton}
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              aria-label={`Ask ${name} to change this slide`}
              rows={2}
              title='For example: "Make it shorter", "Put my poster on the right", "Make the background dark blue"'
              value={text}
              maxLength={1000}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(text, true);
                }
              }}
              placeholder={`Ask ${name} to change this slide`}
              className="flex-1 min-w-0 text-sm px-3 py-2 rounded-xl bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none resize-none disabled:opacity-60"
            />
            {micButton}
            <button
              type="button"
              onClick={() => void send(text, true)}
              disabled={!text.trim() || busy}
              className="shrink-0 h-10 px-4 text-xs font-medium rounded-xl bg-[var(--ds-accent)] text-[var(--ds-on-accent)] disabled:opacity-40"
            >
              {busy ? "Changing…" : "Change slide"}
            </button>
          </div>
        )}
        {talking && trouble && (
          <p role="status" className="flex flex-wrap items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400">
            <span>{trouble}</span>
            <button
              type="button"
              onClick={() => {
                session.current?.stop();
                if (typeof window !== "undefined") window.speechSynthesis?.cancel();
              }}
              className="px-2 py-0.5 rounded-full border border-current font-medium"
            >
              Type instead
            </button>
          </p>
        )}
        {voice === "blocked" && <p role="status" className="text-[11px] text-red-500">The microphone is blocked. Allow it for this site in your browser settings, then press Talk again.</p>}
        {voice === "unsupported" && <p role="status" className="text-[11px] text-red-500">This browser cannot listen. Type your request instead.</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          {!talking &&
            SUGGESTIONS.map(([label, prompt]) => (
              <button
                key={label}
                type="button"
                onClick={() => void send(prompt, false)}
                disabled={busy}
                className="text-[11px] px-2 py-1 rounded-full border border-[var(--ds-border-muted)] text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          <p role="status" className={`text-[11px] ml-auto ${note?.kind === "error" ? "text-red-500" : "text-[var(--ds-text-muted)]"}`}>
            {busy && !talking ? `${capitalName} is changing this slide…` : note?.text ?? ""}
          </p>
        </div>
      </div>
    </section>
  );
}
