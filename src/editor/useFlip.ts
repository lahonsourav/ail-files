"use client";

import { useLayoutEffect, type RefObject } from "react";
import { MOTION, reducedMotion } from "./motion.js";

// After every render, each child of the container that carries `data-flip-id` and has moved is animated from where it was to where it
// is now (a FLIP animation, ease-out), so when the order changes the others slide instead of jumping. Positions are offsetTop and
// offsetLeft, so scrolling the container never counts as a move.

export function useFlip(container: RefObject<HTMLElement | null>, durationMs: number = MOTION.flipMs) {
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const reduce = reducedMotion();
    const store = ((root as unknown as { __flip?: Map<string, { x: number; y: number }> }).__flip ??= new Map());
    const seen = new Set<string>();
    for (const child of Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-flip-id]"))) {
      const id = child.dataset.flipId!;
      seen.add(id);
      const now = { x: child.offsetLeft, y: child.offsetTop };
      const before = store.get(id);
      store.set(id, now);
      if (!before || reduce) continue;
      const dx = before.x - now.x;
      const dy = before.y - now.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      child.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: durationMs, easing: MOTION.easeOut });
    }
    for (const id of Array.from(store.keys())) if (!seen.has(id)) store.delete(id);
  });
}
