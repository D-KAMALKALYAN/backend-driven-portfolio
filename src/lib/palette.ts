import type { CSSProperties } from 'react';

/**
 * The categorical hues, by name. Each is a CSS variable in globals.css
 * (`--hue-indigo` ...); components never see a hex value (ADR-044).
 *
 * A component that is "coloured by" a hue sets `--c` on its element with
 * `hueStyle()` and uses the `.hue-*` classes, which derive every tint from
 * `--c` in CSS. That replaced string tricks like `${hex}18` that could not
 * take a variable, and framer-motion colour tweens that could not be themed.
 */
export const HUES = [
  'indigo', 'violet', 'purple', 'green', 'amber', 'blue',
  'pink', 'teal', 'red', 'cyan', 'orange', 'slate',
] as const;

export type Hue = (typeof HUES)[number];

/** Semantic colours that also take tints: the accent and the four states. */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function isHue(x: unknown): x is Hue {
  return typeof x === 'string' && (HUES as ReadonlyArray<string>).includes(x);
}

/** `var(--hue-amber)` - for the rare place that needs the colour itself (SVG stops, gradients). */
export function hue(h: Hue): string {
  return `var(--hue-${h})`;
}

/** `color-mix(...)` of a hue or tone at a percentage - for gradients and rings. */
export function tint(c: Hue | Tone, percent: number): string {
  const v = isHue(c) ? `var(--hue-${c})` : `var(--${c})`;
  return `color-mix(in srgb, ${v} ${Math.round(percent)}%, transparent)`;
}

/**
 * `--c` from a colour that is data, not a token: the brand colour of an
 * external platform. The tints still derive in CSS; only the source differs.
 */
export function colorStyle(cssColor: string, extra?: CSSProperties): CSSProperties {
  return { ...extra, ['--c' as string]: cssColor } as CSSProperties;
}

/**
 * The element's hue, as the `--c` custom property the `.hue-*` classes read.
 * Accepts a tone too, so "coloured by the accent" is the same call.
 */
export function hueStyle(c: Hue | Tone, extra?: CSSProperties): CSSProperties {
  return { ...extra, ['--c' as string]: isHue(c) ? `var(--hue-${c})` : `var(--${c})` } as CSSProperties;
}
