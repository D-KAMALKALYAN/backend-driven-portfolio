import Link from 'next/link';
import { ArrowRight, Briefcase, FileText, Link2, Zap, type LucideIcon } from 'lucide-react';
import SectionBlock from './SectionBlock';
import Card from '../Card';
import { NAV_LINKS } from '../../constants/routes';
import { getSiteContent } from '../../lib/content';
import { getVal } from '../../utils/siteContent';
import { enterAt } from '../../utils/enter';
import type { PageSection } from '../../types/rows';

/**
 * The secondary navigation, as a section: the detail pages that left the
 * top bar (ADR-039) - skills, experience, profiles, resume - one level down
 * on About, where "who is this" is answered and "show me more" is the next
 * question. Labels come from the same nav.* rows the bar uses; the one-line
 * descriptions from the pages' own site_content keys where they exist.
 */
const ICON: Record<string, LucideIcon> = { '/skills': Zap, '/experience': Briefcase, '/profiles': Link2, '/resume': FileText };
const DESCRIPTION_KEY: Record<string, string> = { '/skills': 'skills.description', '/experience': 'experience.description' };
const FALLBACK: Record<string, string> = {
  '/skills': 'Technologies, frameworks and tools, grouped by category.',
  '/experience': 'Roles and what each one involved.',
  '/profiles': 'GitHub, LinkedIn and the other places this work lives.',
  '/resume': 'The one-page version, always the latest upload.',
};

export default async function ExploreSection({ section }: { section: PageSection }) {
  const content = await getSiteContent();
  const links = NAV_LINKS.filter((l) => l.tier === 'secondary');
  if (links.length === 0) return null;

  return (
    <SectionBlock heading={section.heading ?? 'Also here'} description={section.description}>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none m-0 p-0">
        {links.map((l, i) => {
          const label = getVal(content, l.contentKey, l.label);
          const descKey = DESCRIPTION_KEY[l.path];
          const description = descKey ? getVal(content, descKey, FALLBACK[l.path] ?? '') : FALLBACK[l.path] ?? '';
          return (
            <li key={l.path} className="enter" style={enterAt(i * 60)}>
              <Link href={l.path} className="block h-full no-underline group">
                <Card className="p-5 h-full flex flex-col gap-2" hover glow>
                  {(() => { const Glyph = ICON[l.path] ?? ArrowRight; return <Glyph size={20} className="text-accent" aria-hidden />; })()}
                  <span className="font-semibold group-hover:underline text-primary">{label} →</span>
                  {description && <span className="text-sm leading-relaxed text-secondary">{description}</span>}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionBlock>
  );
}
