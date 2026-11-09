"use client";

import { useSyncExternalStore } from "react";

// Whether the screen is a phone (under 640 px wide, Tailwind's `sm`). The phone layout puts things in other places, not only at other sizes
// (the settings of a tapped part open above the slide, the chat box is fixed to the bottom), so a few spots need to know in code.
const QUERY = "(max-width: 639px)";
const subscribe = (cb: () => void) => {
  const q = window.matchMedia(QUERY);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
