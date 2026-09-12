/**
 * Narrowing helpers for jsonb columns.
 *
 * The generated Database type is precise for every scalar column, but jsonb
 * columns (`profiles.meta`, `project_sections.content`, `site_content.value_json`)
 * come back as `Json` - a recursive union with no shape. That is the truth:
 * Postgres does not know what is inside them. So the shape is asserted at the
 * point of reading, once, through these helpers, rather than by casting at
 * each field access. A reader that gets the shape wrong falls back to an
 * empty value instead of a runtime TypeError.
 *
 * If a jsonb payload ever grows past a handful of fields, the right next step
 * is a runtime schema (zod) at the same boundary - not looser types.
 */
import type { Json } from '../types/database';

export type JsonObject = { [key: string]: Json | undefined };

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value as an object, or null for anything else. */
export function asObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

/** The value as a non-empty string, or the fallback. */
export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

/** The value as a finite number (numeric strings accepted), or the fallback. */
export function asNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** The value as an array of strings (non-string elements dropped). */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/** The value as an array of objects (other elements dropped). */
export function asObjectArray(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isJsonObject);
}
