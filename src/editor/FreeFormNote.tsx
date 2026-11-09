"use client";

// Under a normal-layout slide: why its parts cannot be moved, and the way to change that for this slide.

export default function FreeFormNote({ busy, highlight, onTurnOn }: { busy: boolean; highlight: boolean; onTurnOn: () => void }) {
  return (
    <div
      role="note"
      aria-label="Fixed layout"
      className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${highlight ? "border-amber-500 bg-amber-500/15" : "border-[var(--ds-border-muted)] bg-[var(--ds-bg-elevated)]"} text-[var(--ds-text-secondary)]`}
    >
      <span className="flex-1 min-w-[12rem]">
        <strong className="font-medium text-[var(--ds-text-primary)]">Fixed layout.</strong> Turn on editing to move parts, change the layout and more.
      </span>
      <button type="button" onClick={onTurnOn} disabled={busy} className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--ds-accent)] text-[var(--ds-on-accent)] disabled:opacity-50">
        {busy ? "Changing…" : "Turn on editing"}
      </button>
    </div>
  );
}
