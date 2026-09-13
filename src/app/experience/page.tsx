import type { Metadata } from 'next';
import Experience from '../../views/Experience';
import { getExperience } from '../../lib/content';

export const metadata: Metadata = { title: 'Experience' };

export default async function Page() {
  const experience = await getExperience();
  return <Experience experience={experience} />;
}
