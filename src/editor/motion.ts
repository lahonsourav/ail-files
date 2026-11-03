// The motion the editor follows (the same six behaviours as the Ail app's design system): a button sinks to 95% and springs back, the
// slide being dragged in the strip lifts to 105% while the others slide out of the way, what opens eases out in 350 ms (fast first,
// then slow), and a success tick draws its circle first and then the tick, 470 ms in all. Everything is off for people who ask for
// less motion (prefers-reduced-motion).

export const MOTION = {
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeSpring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  pressScale: 0.95,
  pressScaleLarge: 0.985,
  pressMs: 90,
  releaseMs: 320,
  largeArea: 40_000,
  liftScale: 1.05,
  expandMs: 350,
  tickMs: 470,
  tickCircleMs: 260,
  flipMs: 250,
} as const;

export function pressScaleFor(width: number, height: number): number {
  return width * height > MOTION.largeArea ? MOTION.pressScaleLarge : MOTION.pressScale;
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The order the slides are shown in while one is being dragged: slide `from` is taken out and put where it would land if dropped on
 * `over` (the same place `moveSlide(deck, from, over)` puts it). Indexes are the slides' own, so a slide keeps its key while it moves.
 */
export function previewOrder(count: number, from: number | null, over: number | null): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (from === null || over === null || from === over || from < 0 || from >= count || over < 0 || over >= count) return order;
  order.splice(from, 1);
  order.splice(over, 0, from);
  return order;
}
