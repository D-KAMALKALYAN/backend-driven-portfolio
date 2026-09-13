import type { Metadata } from 'next';
import Skills from '../../views/Skills';
import { getSkills } from '../../lib/content';

export const metadata: Metadata = { title: 'Skills' };

export default async function Page() {
  const skills = await getSkills();
  return <Skills skills={skills} />;
}
