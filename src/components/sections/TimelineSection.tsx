import Link from 'next/link';
import { Briefcase, FolderOpen, Trophy, type LucideIcon } from 'lucide-react';
import SectionBlock from './SectionBlock';
import { getAchievements, getExperience, getProjects } from '../../lib/content';
import { buildTimeline, formatSpan, groupByYear, type TimelineKind } from '../../utils/timeline';
import { enterAt } from '../../utils/enter';
import { hueStyle, type Hue } from '../../lib/palette';
import type { PageSection } from '../../types/rows';

const KIND: Record<TimelineKind, { icon: LucideIcon; label: string; hue: Hue }> = {
  role:        { icon: Briefcase,  label: 'Role',       hue: 'indigo' },
  project:     { icon: FolderOpen, label: 'Project',    hue: 'green' },
  achievement: { icon: Trophy,     label: 'Credential', hue: 'amber' },
};

/**
 * Roles, projects and credentials on one rail, newest first, with year
 * markers. Derived from three tables that already exist - there is nothing
 * to keep in sync. Hides itself if there is nothing dated to show.
 */
export default async function TimelineSection({ section }: { section: PageSection }) {
  const [experience, projects, achievements] = await Promise.all([getExperience(), getProjects(), getAchievements()]);
  const items = buildTimeline({ experience, projects, achievements });
  if (items.length === 0) return null;
  const years = groupByYear(items);

  let i = 0;
  return (
    <SectionBlock heading={section.heading ?? 'The story so far'} description={section.description}>
      <ol className="relative list-none m-0 p-0 pl-6 sm:pl-8 border-l border-line">
        {years.map(({ year, items: list }) => (
          <li key={year} className="mb-8 last:mb-0">
            <div className="relative mb-4">
              <span
                className="absolute -left-[calc(1.5rem+5px)] sm:-left-[calc(2rem+5px)] top-1.5 w-[9px] h-[9px] rounded-full"
                style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--bg-base)' }}
                aria-hidden="true"
              />
              <h3 className="text-sm font-mono font-semibold tracking-widest m-0 text-muted">{year}</h3>
            </div>
            <ul className="list-none m-0 p-0 space-y-3">
              {list.map((it) => {
                const kind = KIND[it.kind];
                const title = <span className="text-sm font-semibold text-primary">{it.title}</span>;
                const link = it.href
                  ? it.external
                    ? <a href={it.href} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline">{title} ↗</a>
                    : <Link href={it.href} className="no-underline hover:underline">{title}</Link>
                  : title;
                return (
                  <li key={it.id} className="enter flex flex-wrap items-baseline gap-x-3 gap-y-1" style={enterAt(Math.min(i++, 12) * 50)}>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-label font-semibold uppercase tracking-wider shrink-0 hue-chip"
                      style={hueStyle(kind.hue)}
                      title={kind.label}
                    >
                      <kind.icon size={11} aria-hidden /> {kind.label}
                    </span>
                    <span className="min-w-0">
                      {link}
                      {it.subtitle && <span className="text-sm text-secondary"> · {it.subtitle}</span>}
                    </span>
                    <span className="text-caption font-mono ml-auto shrink-0" style={{ color: it.ongoing ? 'var(--success)' : 'var(--text-muted)' }}>
                      {formatSpan(it)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </SectionBlock>
  );
}
