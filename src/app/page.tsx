import { Suspense } from 'react';
import Landing from '../views/Landing';
import PageSections from '../lib/sections';
import { AskInvitation, HomeSectionSkeleton, HowItWorksTeaser, LatestNote, SelectedWork } from '../components/HomeSections';
import { getActiveResume, getExperience } from '../lib/content';

/**
 * The landing page, as a narrative (ADR-057): who this is and what he does
 * now, then what the registry says belongs here (Currently, Explore), then
 * selected work, the latest note, how the site itself is built, and an
 * invitation to ask. Everything a recruiter reads above the fold - name,
 * headline, current role, years - is in the HTML. The resume link is
 * resolved here from the same query /resume uses, so both cannot disagree.
 */
export default async function Page() {
  const [experience, resume] = await Promise.all([getExperience(), getActiveResume()]);
  return (
    <Landing experience={experience} resume={resume}>
      {/* Each section reads its own rows. Under a Suspense boundary they
          stream: the hero above is already on screen and does not wait for
          them. A boundary is only ever safe below everything that could
          call notFound() - here there is nothing (ADR-056). */}
      <Suspense fallback={<HomeSectionSkeleton label="Currently" />}>
        {/* page_sections WHERE page = 'landing': Currently, Explore, ... */}
        <PageSections page="landing" />
      </Suspense>
      <Suspense fallback={<HomeSectionSkeleton label="Selected work" cards={3} />}>
        <SelectedWork />
      </Suspense>
      <Suspense fallback={<HomeSectionSkeleton label="Writing" />}>
        <LatestNote />
      </Suspense>
      <HowItWorksTeaser />
      <AskInvitation />
    </Landing>
  );
}
