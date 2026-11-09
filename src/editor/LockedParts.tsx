"use client";

import { SLIDE_HEIGHT, SLIDE_WIDTH, type LockedPart } from "../edit/deckEdit.js";

// Greyed frames over the parts a normal layout places itself. They cannot be moved; pointing at one says why, and pressing one
// draws attention to the "Turn on editing" note under the slide.

export default function LockedParts({ parts, onTry }: { parts: LockedPart[]; onTry: () => void }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {parts.map((p, i) => (
        <div
          key={i}
          onClick={onTry}
          title="Placed by this slide's layout. Turn on editing to move or resize it."
          className="group absolute pointer-events-auto cursor-not-allowed"
          style={{ left: `${(p.x / SLIDE_WIDTH) * 100}%`, top: `${(p.y / SLIDE_HEIGHT) * 100}%`, width: `${(p.w / SLIDE_WIDTH) * 100}%`, height: `${(p.h / SLIDE_HEIGHT) * 100}%` }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ outline: "1.5px dashed rgba(120,120,120,0.9)", background: "rgba(120,120,120,0.14)" }} />
          <span className="absolute left-1 top-1 text-[10px] leading-none px-1 py-0.5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Locked · fixed layout</span>
        </div>
      ))}
    </div>
  );
}
