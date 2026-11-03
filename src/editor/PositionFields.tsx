"use client";

import type { Box } from "../edit/deckEdit.js";

const numberClass =
  "w-full text-xs px-1.5 py-1 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none";

/** Where a box is on the slide, in inches from the top left, with its size: for exact placement next to dragging. */
export default function PositionFields({ box, label, onChange }: { box: Box; label: string; onChange: (next: Box) => void }) {
  const field = (k: keyof Box, text: string) => (
    <label key={k} className="block space-y-0.5">
      <span className="text-[10px] uppercase tracking-wide text-[var(--ds-text-muted)]">{text}</span>
      <input
        type="number"
        step={0.1}
        min={0}
        aria-label={`${label} ${text}`}
        value={Number.isFinite(box[k]) ? Math.round(box[k] * 100) / 100 : 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange({ ...box, [k]: v });
        }}
        className={numberClass}
      />
    </label>
  );
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {field("x", "Left")}
      {field("y", "Top")}
      {field("w", "Width")}
      {field("h", "Height")}
    </div>
  );
}
