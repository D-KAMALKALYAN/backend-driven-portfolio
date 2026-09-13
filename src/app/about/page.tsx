import type { Metadata } from 'next';
import About from '../../views/About';
import { getAchievements, getProfile } from '../../lib/content';

export const metadata: Metadata = { title: 'About' };

export default async function Page() {
  const [profile, achievements] = await Promise.all([getProfile(), getAchievements()]);
  return <About profile={profile} achievements={achievements} />;
}
