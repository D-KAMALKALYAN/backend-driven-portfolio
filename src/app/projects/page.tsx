import type { Metadata } from 'next';
import { Suspense } from 'react';
import Projects from '../../views/Projects';
import { getProjects } from '../../lib/content';

export const metadata: Metadata = { title: 'Projects' };

export default async function Page() {
  const projects = await getProjects();
  return (
    // The list reads its filters from useSearchParams, which needs a boundary.
    <Suspense fallback={null}>
      <Projects projects={projects} />
    </Suspense>
  );
}
