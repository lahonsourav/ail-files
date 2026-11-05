"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VoiceSession, browserRecognition, isStopCommand, speak, VOICE_PAUSE_MS, type VoiceState } from "./voice.js";

// The chat box under the slide: type what to change and the assistant rewrites this slide only, as one step the person can undo. It stays
// put at the bottom of the middle column. `onSend` does the asking and returns an error message, or null when the slide was changed;
// `busy` and `note` come from the editor so a change started from the toolbar (a new layout) shows here too.
//
// Talk mode (where the browser can listen): press Talk and just speak. The words appear in the box as they are heard; when the person has been
// quiet for two seconds the sentence is sent. While the slide is being changed the microphone is held, and it picks up again when the work is
// done, so the person can go on talking. "Speak replies" makes it say "Done." (or the problem) out loud; it is off by default. Saying "stop"
// ends talk mode. Nothing is sent anywhere until the sentence is finished, and nothing is kept: the browser does the listening.

const SUGGESTIONS: [string, string][] = [
  ["Make it shorter", "Make the text on this slide shorter and punchier."],
  ["Make it more visual", "Make this slide more visual: use a different layout or icons where that helps, without losing the content."],
];

const SPEAK_KEY = "ail-files:voice-speak";
const noSubscribe = () => () => {};

export default function SlideAsk({ onSend, busy, note, assistantName = "the assistant", slideKey }: { onSend: (prompt: string) => Promise<string | null>; busy: boolean; note: { kind: "done" | "error"; text: string } | null; /** What the person is asking: "Ail", "the assistant". */ assistantName?: string; /** The slide being asked about: the typed text starts afresh when it changes, while talk mode carries on. */ slideKey?: unknown }) {
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
  const [speakBack, setSpeakBack] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(SPEAK_KEY) === "1";
    } catch {
      return false;
    }
  });
  const session = useRef<VoiceSession | null>(null);
  const inFlow = useRef(false); // true from a spoken sentence being sent until its work (and the spoken reply) is over
  const live = useRef({ onSend, busy, speakBack });
  useEffect(() => {
    live.current = { onSend, busy, speakBack };
  });
  const lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-IN";

  async function onSentence(sentence: string) {
    const v = session.current;
    if (!v) return;
    if (isStopCommand(sentence)) {
      v.stop();
      setText("");
      return;
    }
    if (live.current.busy) return void v.resume();
    inFlow.current = true;
    setText(sentence);
    const problem = await live.current.onSend(sentence);
    if (!problem) setText("");
    if (live.current.speakBack) await speak(problem ?? "Done.", lang);
    inFlow.current = false;
    v.resume();
  }

  function toggleVoice() {
    if (voice === "listening" || voice === "paused") {
      session.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      return;
    }
    session.current ??= new VoiceSession({
      create: () => {
        const C = browserRecognition();
        return C ? new C() : null;
      },
      lang,
      onHeard: setText,
      onState: setVoice,
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
  useEffect(() => () => session.current?.stop(), []);

  async function send(prompt: string, fromBox: boolean) {
    const clean = prompt.trim();
    if (!clean || busy) return;
    const problem = await onSend(clean);
    if (!problem && fromBox) setText("");
  }

  return (
    <section aria-label={`Ask ${name} about this slide`} className="shrink-0 border-t border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] px-3 sm:px-4 pt-2.5 pb-3">
      <div className="mx-auto w-full max-w-3xl space-y-1.5">
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
          {canTalk && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voice === "listening" || voice === "paused"}
              title={voice === "listening" || voice === "paused" ? "Stop talking" : `Talk to ${name}: speak, then pause for two seconds`}
              className={`shrink-0 h-10 px-3 text-xs font-medium rounded-xl border ${voice === "listening" || voice === "paused" ? "border-[var(--ds-accent)] text-[var(--ds-accent)]" : "border-[var(--ds-border-muted)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]"}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
                {voice === "listening" || voice === "paused" ? "Stop talking" : "Talk"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void send(text, true)}
            disabled={!text.trim() || busy}
            className="shrink-0 h-10 px-4 text-xs font-medium rounded-xl bg-[var(--ds-accent)] text-[var(--ds-on-accent)] disabled:opacity-40"
          >
            {busy ? "Changing…" : "Change slide"}
          </button>
        </div>
        {voice !== "off" && (
          <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ds-text-secondary)]">
            {voice === "listening" && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-[var(--ds-accent)] animate-pulse" />
                Listening. Say what to change, then pause for {VOICE_PAUSE_MS / 1000} seconds. Say "stop" to finish.
              </span>
            )}
            {voice === "paused" && <span>{busy ? `${capitalName} is working. I will listen again when it is done.` : "Voice paused."}</span>}
            {voice === "blocked" && <span className="text-red-500">The microphone is blocked. Allow it for this site in your browser settings, then press Talk again.</span>}
            {voice === "unsupported" && <span className="text-red-500">This browser cannot listen. Type your request instead.</span>}
            {(voice === "listening" || voice === "paused") && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
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
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {SUGGESTIONS.map(([label, prompt]) => (
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
            {busy ? `${capitalName} is changing this slide…` : note?.text ?? ""}
          </p>
        </div>
      </div>
    </section>
  );
}
