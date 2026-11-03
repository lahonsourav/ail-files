"use client";

import { useEffect } from "react";
import { MOTION, pressScaleFor, reducedMotion } from "./motion.js";

// A button sinks to 95% under the finger and springs back when it lets go. Mount this once in a program that does not already do it
// (the Ail app has the same behaviour for its whole interface, so it does not mount this); every button in the page then gets it with
// no change to the button. It animates the `scale` property with the Web Animations API, which sits on top of the button's own
// transitions. Bigger things sink less. Skip an element with data-no-press, opt a non-button in with data-press.

const TARGET = 'button, [role="button"], summary, [data-press]';

export default function PressEffect() {
  useEffect(() => {
    if (reducedMotion()) return;
    let pressed: { el: HTMLElement; anim: Animation; from: number; to: number } | null = null;

    const find = (target: EventTarget | null): HTMLElement | null => {
      const el = (target as Element | null)?.closest?.(TARGET) as HTMLElement | null;
      if (!el || el.closest("[data-no-press]")) return null;
      if (el.matches(':disabled, [aria-disabled="true"]')) return null;
      return el;
    };
    const release = () => {
      if (!pressed) return;
      const { el, anim, from, to } = pressed;
      pressed = null;
      anim.cancel();
      el.animate([{ scale: String(to) }, { scale: String(from) }], { duration: MOTION.releaseMs, easing: MOTION.easeSpring });
    };
    const press = (el: HTMLElement) => {
      release();
      const rect = el.getBoundingClientRect();
      const current = Number.parseFloat(getComputedStyle(el).scale);
      const from = Number.isFinite(current) ? current : 1;
      const to = from * pressScaleFor(rect.width, rect.height);
      pressed = { el, from, to, anim: el.animate([{ scale: String(from) }, { scale: String(to) }], { duration: MOTION.pressMs, easing: "ease-out", fill: "forwards" }) };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = find(e.target);
      if (el) press(el);
    };
    const keyDown = (e: KeyboardEvent) => {
      if ((e.key !== " " && e.key !== "Enter") || e.repeat) return;
      const el = find(e.target);
      if (el && el.matches("button, [role='button'], summary")) press(el);
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") release();
    };

    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointercancel", release, { passive: true });
    document.addEventListener("dragstart", release, { passive: true });
    document.addEventListener("keydown", keyDown);
    document.addEventListener("keyup", keyUp);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      document.removeEventListener("dragstart", release);
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, []);

  return null;
}
