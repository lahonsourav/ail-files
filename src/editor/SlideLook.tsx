"use client";

import type { SlideContent, SlideDeck } from "../pptx/presentationBuilder.js";
import type { Box } from "../edit/deckEdit.js";
import type { PictureChoice } from "./SlideForm.js";
import ColorField from "./ColorField.js";
import PositionFields from "./PositionFields.js";
import { placedPictures, setPlacedPictures, setSlideOption, hasSlideOptions, readableOn, sharedTextColor, withAllTextColor } from "../edit/slideOptionsEdit.js";

// Pinned at the bottom of the right column: this slide's own colours and the pictures placed on it (with exact positions).
// The rest of the slide's look is in the bar above the editor.

const inputClass =
  "w-full text-xs px-2 py-1.5 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none";

type Placed = ReturnType<typeof placedPictures>;

function PictureCard({ i, placed, pictures, setPlaced, active, onFocus }: { i: number; placed: Placed; pictures: PictureChoice[]; setPlaced: (next: Placed, key: string) => void; active: boolean; onFocus: () => void }) {
  const p = placed[i];
  return (
    <div
      onFocusCapture={onFocus}
      className={`rounded-md border p-1.5 space-y-1.5 bg-[var(--ds-bg-elevated)] ${active ? "border-[var(--ds-accent)]" : "border-[var(--ds-border-muted)]"}`}
    >
              <div className="flex items-center gap-1.5">
                <select aria-label={`Picture ${i + 1}`} value={p.image} onChange={(e) => setPlaced(placed.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)), `pictures.${i}.image`)} className={inputClass}>
                  {!pictures.some((x) => x.id === p.image) && <option value={p.image}>{p.image} (picture not found)</option>}
                  {pictures.map((x) => (
                    <option key={x.id} value={x.id}>{x.id} · {x.label}</option>
                  ))}
                </select>
                <button type="button" aria-label={`Remove picture ${i + 1}`} onClick={() => setPlaced(placed.filter((_, j) => j !== i), `pictures.${i}:remove`)} className="shrink-0 w-7 h-7 rounded-md text-xs text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]">×</button>
              </div>
              <PositionFields label={`Picture ${i + 1}`} box={p} onChange={(b: Box) => setPlaced(placed.map((x, j) => (j === i ? { ...x, ...b } : x)), `pictures.${i}.box`)} />
              <input aria-label={`Picture ${i + 1} caption`} placeholder="Caption (optional)" value={p.caption ?? ""} onChange={(e) => setPlaced(placed.map((x, j) => (j === i ? { ...x, caption: e.target.value || undefined } : x)), `pictures.${i}.caption`)} className={inputClass} />
              <label className="flex items-center gap-2 text-xs text-[var(--ds-text-primary)]">
                <input type="checkbox" checked={p.fit === "cover"} onChange={(e) => setPlaced(placed.map((x, j) => (j === i ? { ...x, fit: e.target.checked ? "cover" : undefined } : x)), `pictures.${i}.fit`)} />
                Fill the box (cropped, no caption)
              </label>
            </div>
  );
}

/** When one placed picture is picked: only that picture's fields, nothing else. */
export function PicturePanel({ slide, pictures, index, onChange, onBack }: { slide: SlideContent; pictures: PictureChoice[]; index: number; onChange: (next: SlideContent, key: string) => void; onBack: () => void }) {
  const placed = placedPictures(slide);
  if (!placed[index]) return null;
  const setPlaced = (next: Placed, key: string) => onChange(setPlacedPictures(slide, next), key);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Picture {index + 1}</h2>
        <button type="button" onClick={onBack} className="text-xs font-medium text-[var(--ds-accent)] hover:underline">← Whole slide</button>
      </div>
      <PictureCard i={index} placed={placed} pictures={pictures} setPlaced={(next, key) => { setPlaced(next, key); if (next.length < placed.length) onBack(); }} active={false} onFocus={() => {}} />
      <p className="text-[11px] text-[var(--ds-text-muted)]">Drag on the slide to move; drag a corner to resize.</p>
    </div>
  );
}

export default function SlideLook({
  slide,
  deck,
  pictures,
  onChange,
  activePicture,
  onSelectPicture,
}: {
  slide: SlideContent;
  deck: SlideDeck;
  pictures: PictureChoice[];
  onChange: (next: SlideContent, key: string) => void;
  activePicture: number | null;
  onSelectPicture: (index: number) => void;
}) {
  const fields = slide as unknown as Record<string, unknown>;
  const placed = placedPictures(slide);
  const setPlaced = (next: typeof placed, key: string) => onChange(setPlacedPictures(slide, next), key);

  return (
    <section aria-label="This slide's look" className="shrink-0 border-t border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] p-2.5 space-y-2 max-h-[55%] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--ds-text-secondary)]">This slide&apos;s look</h3>
        <span className="text-[10px] text-[var(--ds-text-muted)]">{hasSlideOptions(slide) ? "Changed from the deck" : "Same as the deck"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Slide background" value={typeof fields.background === "string" ? fields.background : undefined} fallback={deck.background ?? "FFFFFF"} onChange={(v) => onChange(setSlideOption(slide, "background", v), "opt.background")} />
        <ColorField label="Slide accent" value={typeof fields.accent === "string" ? fields.accent : undefined} fallback={deck.accent ?? "2563EB"} onChange={(v) => onChange(setSlideOption(slide, "accent", v), "opt.accent")} />
      </div>
      {withAllTextColor(slide, undefined) && (
        <ColorField
          label="All text colour"
          value={sharedTextColor(slide)}
          fallback={readableOn(typeof fields.background === "string" ? fields.background : deck.background ?? "FFFFFF")}
          onChange={(hex) => onChange(withAllTextColor(slide, hex) ?? slide, "elements.color")}
        />
      )}
      {placed.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-[var(--ds-text-secondary)]">Pictures on this slide</legend>
          {placed.map((p, i) => (
            <PictureCard key={i} i={i} placed={placed} pictures={pictures} setPlaced={setPlaced} active={activePicture === i} onFocus={() => onSelectPicture(i)} />
          ))}
          <p className="text-[11px] text-[var(--ds-text-muted)]">Drag on the slide to move; drag a corner to resize.</p>
        </fieldset>
      )}
    </section>
  );
}
