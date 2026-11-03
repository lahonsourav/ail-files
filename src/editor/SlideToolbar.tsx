"use client";

import { LAYOUT_LABELS } from "../edit/deckEdit.js";
import type { SlideContent, SlideDeck } from "../pptx/presentationBuilder.js";
import type { PictureChoice } from "./SlideForm.js";
import PictureSelect from "./PictureSelect.js";
import { setSlideOption, TEXT_SIZES } from "../edit/slideOptionsEdit.js";

// The bar above the editor: what to do with the slide (move, copy, delete) and the options that apply to the whole slide
// (layout, font style, text size, page number, logo, background picture). Colours and placed pictures are in the right column.

const selectClass =
  "text-xs px-2 py-1.5 rounded-md bg-[var(--ds-bg-primary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-muted)] focus:border-[var(--ds-accent)] outline-none disabled:opacity-50";
const buttonClass =
  "px-2 py-1.5 rounded-md text-xs font-medium text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

const layoutName = (key: string) => (key === "advanced_table" ? "Table with sorting" : LAYOUT_LABELS[key] ?? key);

export default function SlideToolbar({
  slide,
  deck,
  pictures,
  index,
  count,
  layout,
  busy,
  onMove,
  onDuplicate,
  onRemove,
  onChange,
  onLayout,
  onApplyPictureToAll,
  assistantName = "the assistant",
}: {
  slide: SlideContent;
  /** The deck as it is drawn (its background picture included). */
  deck: SlideDeck;
  pictures: PictureChoice[];
  index: number;
  count: number;
  layout: string;
  busy: boolean;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onChange: (next: SlideContent, key: string) => void;
  onLayout: (layoutKey: string) => void;
  /** Use (or stop using) this slide's picture on every slide of the deck but the banner slides; `id` is the picture. */
  onApplyPictureToAll: (on: boolean, id: string) => void;
  /** What rebuilds the slide when a layout is picked: "Ail", "the assistant". */
  assistantName?: string;
}) {
  const fields = slide as unknown as Record<string, unknown>;
  const set = (key: Parameters<typeof setSlideOption>[1], value: unknown) => onChange(setSlideOption(slide, key, value), `opt.${key}`);
  const picture = typeof fields.backgroundImage === "string" ? fields.backgroundImage : "";
  const deckPicture = deck.backgroundImage && deck.backgroundImage !== "none" ? deck.backgroundImage : "";
  const pictureOn = picture === "" ? deckPicture !== "" : picture !== "none";
  // The picture this slide shows, and whether it is the deck's (so every slide that can wear it does).
  const shownPicture = !pictureOn ? "" : picture !== "" ? picture : deckPicture;
  const onAllSlides = shownPicture !== "" && shownPicture === deckPicture && (picture === "" || picture === deckPicture);

  return (
    <div role="toolbar" aria-label="Slide tools" className="flex flex-wrap items-center gap-x-1 gap-y-1.5 px-3 py-1.5 border-b border-[var(--ds-border-muted)] bg-[var(--ds-bg-surface)] shrink-0">
      <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0} className={buttonClass}>Move up</button>
      <button type="button" onClick={() => onMove(index + 1)} disabled={index >= count - 1} className={buttonClass}>Move down</button>
      <button type="button" onClick={onDuplicate} className={buttonClass}>Duplicate</button>
      <button type="button" onClick={onRemove} disabled={count <= 1} className={buttonClass}>Delete slide</button>
      <span aria-hidden className="mx-1.5 h-5 w-px bg-[var(--ds-border-muted)] hidden sm:block" />

      <select
        aria-label="Change this slide's layout"
        value=""
        disabled={busy}
        onChange={(e) => e.target.value && onLayout(e.target.value)}
        className={selectClass}
        title={`${assistantName.charAt(0).toUpperCase() + assistantName.slice(1)} rebuilds this slide in the layout you pick`}
      >
        <option value="">Layout: {layoutName(layout)}</option>
        {Object.keys(LAYOUT_LABELS)
          .filter((key) => key !== layout)
          .map((key) => (
            <option key={key} value={key}>{layoutName(key)}</option>
          ))}
      </select>
      <select aria-label="Slide font style" value={typeof fields.fontPair === "string" ? fields.fontPair : ""} onChange={(e) => set("fontPair", e.target.value || undefined)} className={selectClass}>
        <option value="">Font: deck&apos;s</option>
        <option value="modern">Font: Modern</option>
        <option value="classic">Font: Classic</option>
        <option value="bold">Font: Bold</option>
      </select>
      <select aria-label="Slide text size" value={typeof fields.textScale === "number" ? String(fields.textScale) : ""} onChange={(e) => set("textScale", e.target.value ? Number(e.target.value) : undefined)} className={selectClass}>
        <option value="">Size: Normal</option>
        {TEXT_SIZES.map(([value, label]) => (
          <option key={value} value={value}>Size: {label}</option>
        ))}
        {typeof fields.textScale === "number" && !TEXT_SIZES.some(([value]) => value === fields.textScale) && <option value={fields.textScale}>Size: {Math.round(fields.textScale * 100)}%</option>}
      </select>
      <span aria-hidden className="mx-1.5 h-5 w-px bg-[var(--ds-border-muted)] hidden sm:block" />

      <label className="flex items-center gap-1.5 text-xs text-[var(--ds-text-primary)] px-1">
        <input type="checkbox" checked={fields.pageNumber !== false} onChange={(e) => set("pageNumber", e.target.checked ? undefined : false)} />
        Page number
      </label>
      <label className="flex items-center gap-1.5 text-xs text-[var(--ds-text-primary)] px-1">
        <input type="checkbox" checked={fields.logo !== false} onChange={(e) => set("logo", e.target.checked ? undefined : false)} />
        Logo
      </label>
      {/* One control for the background picture: which picture (or Off, which is what the old on/off tick did) and, beside it, whether
          every slide follows it. */}
      <div role="group" aria-label="Background picture" className="flex items-stretch rounded-md border border-[var(--ds-border-muted)] bg-[var(--ds-bg-primary)] focus-within:border-[var(--ds-accent)]">
        <PictureSelect
          ariaLabel="Slide background picture"
          prefix="Background:"
          bare
          value={picture}
          onChange={(v) => set("backgroundImage", v || undefined)}
          className="w-[14.5rem]"
          options={[
            { value: "", label: deckPicture ? `Deck's (${pictures.find((p) => p.id === deckPicture)?.label ?? deckPicture})` : "Deck's (none)", thumb: pictures.find((p) => p.id === deckPicture)?.thumb },
            { value: "none", label: "No picture on this slide", short: "Off" },
            ...(picture && picture !== "none" && !pictures.some((p) => p.id === picture) ? [{ value: picture, label: `${picture} (picture not found)` }] : []),
            ...pictures.map((p) => ({ value: p.id, label: p.label, thumb: p.thumb })),
          ]}
        />
        <label
          className="flex items-center gap-1.5 text-xs text-[var(--ds-text-primary)] px-2 border-l border-[var(--ds-border-muted)]"
          title="Use this picture on every slide except the banner slides: dividers and the closing slide, and any slide with a colour of its own"
        >
          <input
            type="checkbox"
            checked={onAllSlides}
            disabled={shownPicture === ""}
            onChange={(e) => onApplyPictureToAll(e.target.checked, shownPicture)}
          />
          All slides
        </label>
      </div>
    </div>
  );
}
