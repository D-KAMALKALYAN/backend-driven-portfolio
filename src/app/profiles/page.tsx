import type { Metadata } from 'next';
import Profiles from '../../views/Profiles';
import { getExternalProfiles } from '../../lib/content';

export const metadata: Metadata = { title: 'Profiles' };

export default async function Page() {
  const profiles = await getExternalProfiles();
  return <Profiles profiles={profiles} />;
}
