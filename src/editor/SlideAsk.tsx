"use client";

import { useState } from "react";

// The chat box under the slide: type what to change and the assistant rewrites this slide only, as one step the person can undo. It stays
// put at the bottom of the middle column. `onSend` does the asking and returns an error message, or null when the slide was changed;
// `busy` and `note` come from the editor so a change started from the toolbar (a new layout) shows here too.

const SUGGESTIONS: [string, string][] = [
  ["Make it shorter", "Make the text on this slide shorter and punchier."],
  ["Make it more visual", "Make this slide more visual: use a different layout or icons where that helps, without losing the content."],
];

export default function SlideAsk({ onSend, busy, note, assistantName = "the assistant" }: { onSend: (prompt: string) => Promise<string | null>; busy: boolean; note: { kind: "done" | "error"; text: string } | null; /** What the person is asking: "Ail", "the assistant". */ assistantName?: string }) {
  const name = assistantName;
  const capitalName = name.charAt(0).toUpperCase() + name.slice(1);
  const [text, setText] = useState("");

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
          <button
            type="button"
            onClick={() => void send(text, true)}
            disabled={!text.trim() || busy}
            className="shrink-0 h-10 px-4 text-xs font-medium rounded-xl bg-[var(--ds-accent)] text-[var(--ds-on-accent)] disabled:opacity-40"
          >
            {busy ? "Changing…" : "Change slide"}
          </button>
        </div>
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
