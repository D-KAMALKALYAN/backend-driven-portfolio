import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { HUES, hue, tint, hueStyle, colorStyle, isHue } from '../lib/palette';
import { ICONS, isIconName } from '../components/Icon';

/**
 * ADR-044: components name hues; globals.css owns the values. These tests
 * pin the contract between the two files, since nothing else would notice a
 * hue that TypeScript accepts but the stylesheet never defines.
 */

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf-8');

describe('palette', () => {
  it('every hue TypeScript knows is defined in globals.css, and vice versa', () => {
    const defined = [...css.matchAll(/--hue-([a-z]+):/g)].map((m) => m[1]);
    expect(new Set(defined)).toEqual(new Set(HUES));
  });

  it('hue() and tint() only ever emit CSS variables, never a literal colour', () => {
    for (const h of HUES) {
      expect(hue(h)).toBe(`var(--hue-${h})`);
      expect(tint(h, 12)).toBe(`color-mix(in srgb, var(--hue-${h}) 12%, transparent)`);
    }
    expect(tint('accent', 20)).toBe('color-mix(in srgb, var(--accent) 20%, transparent)');
    expect(tint('success', 7.6)).toContain(' 8%,');
  });

  it('hueStyle sets --c and keeps the extra properties', () => {
    expect(hueStyle('amber')).toEqual({ '--c': 'var(--hue-amber)' });
    expect(hueStyle('danger', { width: 4 })).toEqual({ width: 4, '--c': 'var(--danger)' });
    expect(colorStyle('#0a66c2')).toEqual({ '--c': '#0a66c2' });
  });

  it('isHue rejects tones and arbitrary strings', () => {
    expect(isHue('indigo')).toBe(true);
    expect(isHue('accent')).toBe(false);
    expect(isHue('#6366f1')).toBe(false);
  });

  it('the .hue-* classes the components use exist in the stylesheet', () => {
    for (const cls of ['hue-chip', 'hue-chip-soft', 'hue-badge', 'hue-tag', 'hue-dot', 'hue-pill', 'hue-panel', 'hue-text', 'hue-edge']) {
      expect(css, cls).toContain(`.${cls}`);
    }
  });

  it('no colour name is also a font-size name (text-base would become a colour)', () => {
    // Tailwind's `text-*` utility serves both namespaces. A colour called
    // `base` made every inheriting `text-base` element the page background
    // colour - found by the 2026-09-19 UI check on /how-it-works.
    const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
    const colours = [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1] ?? '');
    expect(colours.filter((c) => sizes.includes(c))).toEqual([]);
  });

  it('no font-size token is also a colour name, and the two label steps exist', () => {
    // The same trap as `text-base`, from the other side: a font size named
    // `muted` would make `text-muted` a size instead of a colour (ADR-056).
    // Only the @theme block defines utilities; :root's --text-primary and
    // friends are colour values the bridge maps to --color-*.
    const theme = css.slice(css.indexOf('@theme inline {'), css.indexOf('/* ── Dark theme'));
    const colours = [...theme.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1] ?? '');
    // `--text-label--line-height` is a modifier of a size, not a size.
    const sizes = [...theme.matchAll(/--text-([a-z0-9-]+):/g)].map((m) => m[1] ?? '').filter((n) => !n.includes('--'));
    expect(sizes.filter((s) => colours.includes(s))).toEqual([]);
    // The two steps below Tailwind's text-xs that this site's labels live on.
    expect(new Set(sizes)).toEqual(new Set(['label', 'caption']));
  });

  it('the ad-hoc type sizes are gone: a scale nobody can change is not a scale', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.tsx')) files.push(full);
      }
    };
    walk(resolve(process.cwd(), 'src'));
    const offenders = files.filter((f) => /text-\[\d+px\]/.test(readFileSync(f, 'utf-8')));
    expect(offenders.map((f) => basename(f))).toEqual([]);
  });

  it('framer-motion is imported by exactly one component, and it is lazily mounted', () => {
    // The motion budget (ADR-056): an animation library on every page cost
    // ~45 kB for hover lifts CSS already does. The palette needs an exit
    // animation; nothing else does, and AppShell mounts it on first open.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(full)) files.push(full);
      }
    };
    walk(resolve(process.cwd(), 'src'));
    const importers = files
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => /^import .*from 'framer-motion';$/m.test(readFileSync(f, 'utf-8')));
    expect(importers.map((f) => basename(f))).toEqual(['CommandPalette.tsx']);
    expect(readFileSync(resolve(process.cwd(), 'src/components/AppShell.tsx'), 'utf-8'))
      .toMatch(/dynamic\(\(\) => import\('\.\/CommandPalette'\)/);
  });

  it('the theme bridge maps every semantic token a utility relies on', () => {
    for (const name of ['canvas', 'surface', 'subtle', 'card', 'line', 'line-hover', 'primary', 'secondary', 'muted', 'accent', 'accent-hover', 'on-accent', 'success', 'warning', 'danger', 'info']) {
      expect(css, name).toMatch(new RegExp(`--color-${name}:\\s+var\\(--`));
    }
    // and resets Tailwind's own palette, so text-gray-400 is not an option
    expect(css).toContain('--color-*: initial;');
  });
});

describe('every CSS variable the source reads exists', () => {
  // Set on elements by the code itself, or by next/font, or Tailwind's own.
  const SELF_SET = new Set(['--c', '--dot-glow', '--enter-delay', '--font-inter', '--font-jetbrains']);
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

  it('no component references a token globals.css does not define (this is how --error was found)', () => {
    const missing = new Set<string>();
    for (const file of walk(resolve(process.cwd(), 'src'))) {
      if (file.includes('__tests__')) continue;
      // A closing paren keeps the template in lib/palette.ts (`var(--hue-${c})`) out of the scan.
      for (const m of readFileSync(file, 'utf-8').matchAll(/var\((--[a-z0-9-]+)\)/g)) {
        const name = m[1]!;
        if (!defined.has(name) && !SELF_SET.has(name) && !name.startsWith('--tw-')) missing.add(`${name} in ${file.split(/[\\/]/).slice(-2).join('/')}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('icon registry', () => {
  it('resolves the names the resume defaults use and rejects unknown strings', () => {
    for (const n of ['lock', 'building', 'wrench', 'cloud']) expect(isIconName(n)).toBe(true);
    expect(isIconName('🔒')).toBe(false);
    expect(isIconName('')).toBe(false);
    expect(Object.keys(ICONS).length).toBeGreaterThan(20);
  });
});
