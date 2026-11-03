"use client";

import { useEffect, useId, useRef, useState } from "react";

// A drop-down for choosing a picture that shows the pictures themselves, not just their names (a plain <select> cannot hold
// images). One row per option: a small thumbnail (none for the "deck's" and "no picture" rows) and its label. Opens on a click,
// closes on a choice, Escape or a click elsewhere, and works with the arrow keys.

export interface PictureOption {
  value: string;
  label: string;
  /** A small picture for the row (a data URL); the rows without one get an empty swatch. */
  thumb?: string;
  /** A shorter name for the closed button, when the row's own label is long ("Off" for "No picture on this slide"). */
  short?: string;
}

export default function PictureSelect({
  value,
  options,
  ariaLabel,
  onChange,
  className = "",
  prefix,
  bare = false,
}: {
  value: string;
  options: PictureOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
  className?: string;
  /** Text before the choice on the closed button ("Background:"), so one control says what it is for and what it is set to. */
  prefix?: string;
  /** No border or fill of its own: the control sits inside a group that draws them. */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false); // the list would run off the right edge of a narrow screen
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function openList() {
    const rect = root.current?.getBoundingClientRect();
    setAlignRight(!!rect && rect.left + 256 > window.innerWidth - 8 && rect.right - 256 >= 8);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }
  function key(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    }
  }

  const thumb = (o: PictureOption | undefined, size: string) =>
    o?.thumb ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={o.thumb} alt="" className={`${size} shrink-0 rounded-sm object-cover`} />
    ) : (
      <span aria-hidden className={`${size} shrink-0 rounded-sm border border-dashed border-[var(--ds-border-muted)]`} />
    );

  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={key}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`flex items-center gap-1.5 w-full text-xs px-2 py-1 text-[var(--ds-text-primary)] outline-none ${bare ? "rounded-l-md hover:bg-[var(--ds-bg-hover)] focus-visible:bg-[var(--ds-bg-hover)]" : "rounded-md bg-[var(--ds-bg-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)]"}`}
      >
        {thumb(current, "w-7 h-5")}
        <span className="truncate flex-1 text-left">
          {prefix && <span className="text-[var(--ds-text-muted)]">{prefix} </span>}
          {current?.short ?? current?.label}
        </span>
        <span aria-hidden className="text-[var(--ds-text-muted)]">▾</span>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={ariaLabel} className={`absolute ${alignRight ? "right-0" : "left-0"} top-full mt-1 z-30 w-64 max-w-[calc(100vw-1rem)] max-h-72 overflow-y-auto rounded-lg border border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] shadow-lg p-1`}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer text-xs text-[var(--ds-text-primary)] ${i === active ? "bg-[var(--ds-bg-hover)]" : ""}`}
            >
              {thumb(o, "w-12 h-8")}
              <span className="flex-1 min-w-0 truncate">{o.label}</span>
              {o.value === value && <span aria-hidden className="text-[var(--ds-accent)]">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
