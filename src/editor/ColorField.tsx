"use client";

const inputClass =
  "w-full text-sm px-2.5 py-1.5 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none";

/** A colour picker with a hex box; empty means "the default", shown as `fallback`. Used for the deck's colours and a slide's own. */
export default function ColorField({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (hex: string | undefined) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-[var(--ds-text-secondary)]">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} colour`} value={`#${value ?? fallback}`} onChange={(e) => onChange(e.target.value.slice(1).toUpperCase())} className="h-8 w-10 rounded border border-[var(--ds-border-muted)] bg-transparent p-0.5" />
        <input
          aria-label={`${label} hex`}
          value={value ?? ""}
          placeholder={fallback}
          maxLength={6}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
            if (v === "") onChange(undefined);
            else if (v.length === 6) onChange(v);
          }}
          className={`${inputClass} font-mono`}
        />
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="text-[11px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] underline shrink-0">
            Default
          </button>
        )}
      </div>
    </div>
  );
}

