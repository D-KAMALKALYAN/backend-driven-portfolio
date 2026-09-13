import type { Metadata } from 'next';
import Resume from '../../views/Resume';
import { getActiveResume, getExperience, getProfile, getSkills } from '../../lib/content';

export const metadata: Metadata = { title: 'Resume' };

/**
 * The resume row, the profile and two counts, all in one server render.
 * A missing active resume is not an error - the page says so - but a failing
 * read is, and surfaces through the route's error boundary rather than being
 * swallowed to null (which is how the resume outage stayed invisible).
 */
export default async function Page() {
  const [resume, profile, skills, experience] = await Promise.all([
    getActiveResume(),
    getProfile(),
    getSkills(),
    getExperience(),
  ]);
  return <Resume resume={resume} profile={profile} skillCount={skills.length} expCount={experience.length} />;
}
