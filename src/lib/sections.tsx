import 'server-only';
import type { ReactNode } from 'react';
import { getPageSections } from './content';
import NowSection from '../components/sections/NowSection';
import VenturesSection from '../components/sections/VenturesSection';
import TimelineSection from '../components/sections/TimelineSection';
import { DiagramBlock, ProseBlock, StepsBlock, TableBlock } from '../components/sections/ContentBlocks';
import type { PageSection } from '../types/rows';

/**
 * The registry, resolved.
 *
 * `page_sections` rows say which sections a page shows, in what order, with
 * what heading. This map says what each `section_type` renders. That split
 * is the whole design (ADR-036): adding an instance or reordering is a row;
 * adding a type is one component and one entry here.
 *
 * An unknown type - a row inserted for a component that has not shipped -
 * renders nothing and is logged, rather than breaking the page. Each
 * section also hides itself when its table is empty, so registering a
 * section ahead of its content costs nothing.
 */
const SECTION_TYPES: Record<string, (section: PageSection) => ReactNode> = {
  now: (section) => <NowSection key={section.id} section={section} />,
  ventures: (section) => <VenturesSection key={section.id} section={section} variant="own" />,
  endorsements: (section) => <VenturesSection key={section.id} section={section} variant="endorsements" />,
  timeline: (section) => <TimelineSection key={section.id} section={section} />,
  // Content-only types: everything rendered is in the row's config.
  prose: (section) => <ProseBlock key={section.id} section={section} />,
  diagram: (section) => <DiagramBlock key={section.id} section={section} />,
  steps: (section) => <StepsBlock key={section.id} section={section} />,
  table: (section) => <TableBlock key={section.id} section={section} />,
};

export const KNOWN_SECTION_TYPES = Object.keys(SECTION_TYPES);

export function resolveSections(rows: ReadonlyArray<PageSection>): { nodes: ReactNode[]; unknown: string[] } {
  const nodes: ReactNode[] = [];
  const unknown: string[] = [];
  for (const row of rows) {
    const render = SECTION_TYPES[row.section_type];
    if (render) nodes.push(render(row));
    else unknown.push(row.section_type);
  }
  return { nodes, unknown };
}

export type SectionPage = 'landing' | 'about' | 'how_it_works';

export default async function PageSections({ page }: { page: SectionPage }) {
  const rows = await getPageSections(page);
  const { nodes, unknown } = resolveSections(rows);
  if (unknown.length > 0) {
    console.warn(`[sections] ${page}: no component for section_type ${unknown.join(', ')}`);
  }
  return <>{nodes}</>;
}
