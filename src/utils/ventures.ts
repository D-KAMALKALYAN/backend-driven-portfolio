import type { Venture } from '../types/rows';

/**
 * What you built and what you are recommending must never render as the
 * same thing. A recruiter reading a wall of logos assumes you founded all
 * of them, and that is a claim you do not want to make by accident.
 */
export const OWN_RELATIONSHIPS = new Set(['founder', 'co-founder', 'early-employee', 'advisor']);

export function splitVentures<T extends Pick<Venture, 'relationship'>>(ventures: ReadonlyArray<T>): { own: T[]; endorsements: T[] } {
  const own: T[] = [];
  const endorsements: T[] = [];
  for (const v of ventures) (OWN_RELATIONSHIPS.has(v.relationship) ? own : endorsements).push(v);
  return { own, endorsements };
}

export const RELATIONSHIP_LABEL: Record<string, string> = {
  founder: 'Founder',
  'co-founder': 'Co-founder',
  'early-employee': 'Early team',
  advisor: 'Advisor',
  endorsement: 'Endorsed',
};

export const STATUS_LABEL: Record<string, string> = {
  stealth: 'Stealth',
  active: 'Active',
  acquired: 'Acquired',
  'wound-down': 'Wound down',
};
