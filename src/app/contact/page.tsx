import type { Metadata } from 'next';
import Contact from '../../views/Contact';
import { getExternalProfiles } from '../../lib/content';

export const metadata: Metadata = { title: 'Contact' };

/**
 * The links beside the contact details come from `external_profiles`, the
 * same rows /profiles renders - not from three `social.*` strings in
 * site_content, which held a second copy of three of the six and drew them
 * as the letters "GH", "LI", "LC" (ADR-065).
 */
export default async function Page() {
  const profiles = await getExternalProfiles();
  return <Contact profiles={profiles} />;
}
