"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { moveBox, resizeBox, SLIDE_HEIGHT, SLIDE_WIDTH, type BoxList, type Corner, type MovableBox, type Box } from "../edit/deckEdit.js";

// Drag handles laid over the slide preview: one frame per movable box (a free-form slide's elements, pictures placed on
// the slide). Drag a frame to move it, drag a corner to resize it, arrow keys nudge (Shift for bigger steps), Delete removes.
// The positions come from the deck itself (inches), so the frames move at once while the picture of the slide is redrawn.

export interface BoxRef {
  list: BoxList;
  index: number;
}

const CORNERS: { corner: Corner; style: React.CSSProperties; cursor: string }[] = [
  { corner: "nw", style: { left: -5, top: -5 }, cursor: "nwse-resize" },
  { corner: "ne", style: { right: -5, top: -5 }, cursor: "nesw-resize" },
  { corner: "sw", style: { left: -5, bottom: -5 }, cursor: "nesw-resize" },
  { corner: "se", style: { right: -5, bottom: -5 }, cursor: "nwse-resize" },
];

// Whether the device has a hovering pointer (a mouse). Without one (a tablet) there is no hover to reveal a frame, so the faint outlines stay.
const subscribeHover = (cb: () => void) => {
  const q = window.matchMedia("(hover: hover)");
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};
const canHover = () => window.matchMedia("(hover: hover)").matches;

export default function SlideHandles({
  boxes,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  boxes: MovableBox[];
  selected: BoxRef | null;
  onSelect: (ref: BoxRef | null) => void;
  onChange: (ref: BoxRef, box: Box) => void;
  onRemove: (ref: BoxRef) => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverDevice = useSyncExternalStore(subscribeHover, canHover, () => true);

  function begin(e: React.PointerEvent, b: MovableBox, mode: "move" | Corner) {
    e.preventDefault();
    e.stopPropagation();
    const width = area.current?.getBoundingClientRect().width ?? 0;
    const ref = { list: b.list, index: b.index };
    onSelect(ref);
    if (width <= 0) return;
    const inchesPerPixel = SLIDE_WIDTH / width;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const base = b.box;
    const drag = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) * inchesPerPixel;
      const dy = (ev.clientY - y0) * inchesPerPixel;
      onChange(ref, mode === "move" ? moveBox(base, dx, dy) : resizeBox(base, mode, dx, dy));
    };
    const end = () => {
      window.removeEventListener("pointermove", drag);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", drag);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function key(e: React.KeyboardEvent, b: MovableBox) {
    const step = e.shiftKey ? 0.5 : 0.1;
    const ref = { list: b.list, index: b.index };
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key]) {
      e.preventDefault();
      onChange(ref, moveBox(b.box, arrows[e.key][0], arrows[e.key][1]));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove(ref);
    } else if (e.key === "Escape") {
      onSelect(null);
    }
  }

  return (
    <div ref={area} className="absolute inset-0" style={{ pointerEvents: "none" }} aria-label="Move and resize" role="group">
      {boxes.map((b) => {
        const active = selected?.list === b.list && selected.index === b.index;
        return (
          <div
            key={`${b.list}.${b.index}`}
            role="button"
            tabIndex={0}
            aria-label={`${b.kind === "picture" ? "Picture" : b.kind[0].toUpperCase() + b.kind.slice(1)} ${b.index + 1}, ${b.list === "pictures" ? "on the slide" : "free-form"}`}
            aria-pressed={active}
            onPointerDown={(e) => begin(e, b, "move")}
            onPointerEnter={() => setHovered(`${b.list}.${b.index}`)}
            onPointerLeave={() => setHovered((h) => (h === `${b.list}.${b.index}` ? null : h))}
            onFocus={() => onSelect({ list: b.list, index: b.index })}
            onKeyDown={(e) => key(e, b)}
            style={{
              position: "absolute",
              left: `${(b.box.x / SLIDE_WIDTH) * 100}%`,
              top: `${(b.box.y / SLIDE_HEIGHT) * 100}%`,
              width: `${(b.box.w / SLIDE_WIDTH) * 100}%`,
              height: `${(b.box.h / SLIDE_HEIGHT) * 100}%`,
              pointerEvents: "auto",
              touchAction: "none",
              cursor: "move",
              // The selected part has its frame and corners; the others show an outline only under the pointer (always, faintly, where
              // there is no pointer to hover with), so clicking away leaves a clean slide.
              outline: active ? "2px solid var(--ds-accent)" : hovered === `${b.list}.${b.index}` ? "1px dashed rgba(37,99,235,0.7)" : hoverDevice ? "none" : "1px dashed rgba(37,99,235,0.3)",
              outlineOffset: 0,
              background: active ? "rgba(37,99,235,0.06)" : "transparent",
            }}
          >
            {active &&
              CORNERS.map((c) => (
                <span
                  key={c.corner}
                  data-corner={c.corner}
                  onPointerDown={(e) => begin(e, b, c.corner)}
                  style={{ position: "absolute", width: 10, height: 10, borderRadius: 2, background: "#fff", border: "2px solid var(--ds-accent)", cursor: c.cursor, touchAction: "none", ...c.style }}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
