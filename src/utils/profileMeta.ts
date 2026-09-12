/**
 * Typed reader for `profiles.meta`.
 *
 * The About page's philosophy/approach/interests/education/certifications
 * sections and the "N+ yrs experience" chip are not columns: they live in
 * the JSONB `meta` escape hatch so they can be edited from the dashboard
 * without a migration. The keys below are the contract; the population
 * migration (20260912100100_content_population) writes exactly these.
 *
 * Reading through one function means the shape is asserted once, and a key
 * that is missing or the wrong type degrades to "not shown" rather than to a
 * runtime error in the render tree.
 */
import type { Json } from '../types/rows';
import { asNumber, asObject, asString } from './json';

export interface ProfileMeta {
  focus_area: string;
  years_experience: number | null;
  philosophy: string;
  approach: string;
  interests: string;
  education: string;
  certifications: string;
}

export function readProfileMeta(meta: Json | null | undefined): ProfileMeta {
  const m = asObject(meta) ?? {};
  return {
    focus_area: asString(m['focus_area']),
    years_experience: asNumber(m['years_experience']),
    philosophy: asString(m['philosophy']),
    approach: asString(m['approach']),
    interests: asString(m['interests']),
    education: asString(m['education']),
    certifications: asString(m['certifications']),
  };
}
