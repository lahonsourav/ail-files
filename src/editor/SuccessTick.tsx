import { MOTION, reducedMotion } from "./motion.js";

// A success tick: the circle draws first (260 ms), then the tick (210 ms), 470 ms in all. Drawn with the SVG's own animation, so it needs
// no stylesheet. Follows the surrounding text colour. Give it a new `key` to play it again. Still when the device asks for less motion.

const CIRCLE = 66; // the circle's length
const CHECK = 16; // longer than the tick

export default function SuccessTick({ size = 14, className }: { size?: number; className?: string }) {
  const still = reducedMotion();
  const circleS = MOTION.tickCircleMs / 1000;
  const checkS = (MOTION.tickMs - MOTION.tickCircleMs) / 1000;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" strokeDasharray={CIRCLE} strokeDashoffset={still ? 0 : CIRCLE}>
        {!still && <animate attributeName="stroke-dashoffset" from={CIRCLE} to="0" dur={`${circleS}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />}
      </circle>
      <path d="M7 12.5l3.2 3.2L17 9" strokeDasharray={CHECK} strokeDashoffset={still ? 0 : CHECK}>
        {!still && <animate attributeName="stroke-dashoffset" from={CHECK} to="0" begin={`${circleS}s`} dur={`${checkS}s`} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />}
      </path>
    </svg>
  );
}
