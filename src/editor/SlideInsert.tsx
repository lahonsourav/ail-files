"use client";

import { useState } from "react";
import { newSlidePicture } from "../edit/deckEdit.js";
import type { SlideContent } from "../pptx/presentationBuilder.js";
import type { PictureChoice } from "./SlideForm.js";
import PictureSelect from "./PictureSelect.js";
import { hasSlideOptions, placedPictures, resetSlideOptions, setPlacedPictures } from "../edit/slideOptionsEdit.js";

// Above the chat box: put a picture on the slide (one of the person's, or a new one from a file) and take back this slide's own look.
// Where a placed picture sits, and its caption, are in the right column and by dragging it on the slide.

export default function SlideInsert({
  slide,
  pictures,
  onChange,
  onUploadPicture,
  onPlaced,
}: {
  slide: SlideContent;
  pictures: PictureChoice[];
  onChange: (next: SlideContent, key: string) => void;
  /** Left out for someone editing another person's deck: they use the owner's pictures but cannot add to them. */
  onUploadPicture?: (file: File) => Promise<{ id: string; width: number; height: number } | { error: string }>;
  /** A picture was placed: which one it is on the slide, so it can be selected. */
  onPlaced: (index: number) => void;
}) {
  const [error, setError] = useState("");
  const place = (id: string, width?: number, height?: number) => {
    const known = pictures.find((p) => p.id === id);
    const placed = placedPictures(slide);
    onChange(setPlacedPictures(slide, [...placed, newSlidePicture(id, width ?? known?.width ?? 0, height ?? known?.height ?? 0)]), `pictures.add${placed.length}`);
    onPlaced(placed.length);
  };

  return (
    <div role="group" aria-label="Add to this slide" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 sm:px-4 py-2 border-t border-[var(--ds-border-muted)] shrink-0">
      <span className="text-[11px] uppercase tracking-wide text-[var(--ds-text-muted)]">Pictures</span>
      {pictures.length > 0 && (
        <PictureSelect
          ariaLabel="Add one of my pictures"
          accent
          className="w-56"
          value=""
          options={[{ value: "", label: "+ Add one of my pictures", noSwatch: true }, ...pictures.map((x) => ({ value: x.id, label: `${x.id} · ${x.label}`, thumb: x.thumb }))]}
          onChange={(id) => id && place(id)}
        />
      )}
      {onUploadPicture && (
      <label className="text-xs font-medium text-[var(--ds-accent)] hover:underline cursor-pointer">
        + Upload a new picture
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload a picture to this slide"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            const made = await onUploadPicture(file);
            if ("error" in made) setError(made.error);
            else place(made.id, made.width, made.height);
          }}
        />
      </label>
      )}
      {hasSlideOptions(slide) && (
        <button type="button" onClick={() => onChange(resetSlideOptions(slide), "opt.reset")} className="text-xs font-medium text-[var(--ds-accent)] hover:underline ml-auto">
          Reset to the deck&apos;s look
        </button>
      )}
      {error && <p role="alert" className="basis-full text-xs text-red-500">{error}</p>}
    </div>
  );
}
