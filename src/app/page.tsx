import Landing from '../views/Landing';
import { getActiveResume, getExperience } from '../lib/content';

/**
 * The landing page. Everything a recruiter reads above the fold - name,
 * headline, current role, years - is in the HTML now. The resume link is
 * resolved here from the same query /resume uses, so both cannot disagree.
 */
export default async function Page() {
  const [experience, resume] = await Promise.all([getExperience(), getActiveResume()]);
  return <Landing experience={experience} resume={resume} />;
}
