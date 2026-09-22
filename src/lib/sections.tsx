import 'server-only';
import type { ReactNode } from 'react';
import { getPageSections } from './content';
import NowSection from '../components/sections/NowSection';
import VenturesSection from '../components/sections/VenturesSection';
import TimelineSection from '../components/sections/TimelineSection';
import ExploreSection from '../components/sections/ExploreSection';
import { CodeBlock, DiagramBlock, ProseBlock, StepsBlock, TableBlock } from '../components/sections/ContentBlocks';
import QaBlock from '../components/sections/QaBlock';
import type { ExplainSourceRef } from '../components/Explainable';
import { asObject, asStringArray } from '../utils/json';
import type { BlockLike, PageSection } from '../types/rows';

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
/**
 * Content-only blocks: shared by page_sections and post_blocks. Each takes
 * the row it came from, so "Explain this" (ADR-053) can name it; a qa block
 * is the page's own questions and explains nothing.
 */
export const CONTENT_BLOCKS: Record<string, (block: BlockLike, source: ExplainSourceRef | null) => ReactNode> = {
  prose: (b, s) => <ProseBlock key={b.id} section={b} source={s} />,
  diagram: (b, s) => <DiagramBlock key={b.id} section={b} source={s} />,
  steps: (b, s) => <StepsBlock key={b.id} section={b} source={s} />,
  table: (b, s) => <TableBlock key={b.id} section={b} source={s} />,
  code: (b, s) => <CodeBlock key={b.id} section={b} source={s} />,
  qa: (b) => <QaBlock key={b.id} heading={b.heading} questions={asStringArray((asObject(b.config) ?? {})['questions']).slice(0, 5)} />,
};

/** A post body: ordered blocks, unknown types skipped and reported. */
export function renderBlocks(blocks: ReadonlyArray<BlockLike & { block_type: string }>): { nodes: ReactNode[]; unknown: string[] } {
  const nodes: ReactNode[] = [];
  const unknown: string[] = [];
  for (const b of blocks) {
    const render = CONTENT_BLOCKS[b.block_type];
    if (render) nodes.push(render(b, { table: 'post_blocks', id: b.id }));
    else unknown.push(b.block_type);
  }
  return { nodes, unknown };
}

const SECTION_TYPES: Record<string, (section: PageSection) => ReactNode> = {
  now: (section) => <NowSection key={section.id} section={section} />,
  ventures: (section) => <VenturesSection key={section.id} section={section} variant="own" />,
  endorsements: (section) => <VenturesSection key={section.id} section={section} variant="endorsements" />,
  timeline: (section) => <TimelineSection key={section.id} section={section} />,
  explore: (section) => <ExploreSection key={section.id} section={section} />,
  // Content-only types: everything rendered is in the row's config, and
  // each can be explained from its page_sections row.
  ...Object.fromEntries(Object.entries(CONTENT_BLOCKS).map(([type, render]) => [type, (row: PageSection) => render(row, { table: 'page_sections', id: row.id })])),
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
