'use client';

import { useEffect, useState } from 'react';
import { countUpValue } from '../utils/countUp';

/**
 * Animates a number from 0 to `value` over `durationMs`.
 *
 * Replaces two copies of a setInterval counter that stepped by a fixed
 * increment every 30-40 ms: it ran at whatever cadence the timer gave it,
 * kept ticking in background tabs, and could overshoot. requestAnimationFrame
 * runs once per painted frame and pauses when the tab is hidden; the value
 * is a function of elapsed time, so the duration is what it says regardless
 * of frame rate. Honours prefers-reduced-motion by showing the final value
 * at once. Renders the final value on the server so the number is in the
 * HTML - the animation is a client-side flourish, not the content.
 */
export default function CountUp({ value, suffix = '', durationMs = 900 }: { value: number; suffix?: string; durationMs?: number }) {
  const target = Number.isFinite(value) && value > 0 ? value : 0;
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (target === 0 || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const next = countUpValue(target, now - start, durationMs);
      setDisplay(next);
      if (next < target) frame = requestAnimationFrame(tick);
    };
    // The first frame drops to ~0 and the loop climbs from there; the server
    // rendered the final value, so a visitor without JavaScript still sees it.
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return <>{display.toLocaleString()}{suffix}</>;
}
