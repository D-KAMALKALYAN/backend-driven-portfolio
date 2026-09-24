import Link from 'next/link';
import { Activity, BookMarked, BookOpen, Compass, Hammer, PenLine, type LucideIcon } from 'lucide-react';
import SectionBlock from './SectionBlock';
import Card from '../Card';
import { getNowEntries, getProjects } from '../../lib/content';
import { formatUpdated, nowFreshness } from '../../utils/now';
import { enterAt } from '../../utils/enter';
import { hueStyle, type Hue, type Tone } from '../../lib/palette';
import type { PageSection } from '../../types/rows';

const KIND: Record<string, { icon: LucideIcon; label: string; hue: Hue | Tone }> = {
  building:  { icon: Hammer,     label: 'Building',  hue: 'indigo' },
  learning:  { icon: BookOpen,   label: 'Learning',  hue: 'green' },
  reading:   { icon: BookMarked, label: 'Reading',   hue: 'amber' },
  exploring: { icon: Compass,    label: 'Exploring', hue: 'blue' },
  writing:   { icon: PenLine,    label: 'Writing',   hue: 'pink' },
};

/**
 * "Currently ..." - what is being built, learned and explored right now.
 *
 * Decays by design: the heading shows when it was last touched, and past
 * NOW_STALE_AFTER_DAYS without an update the whole section returns null.
 * A stale "now" is worse than no "now".
 */
export default async function NowSection({ section }: { section: PageSection }) {
  const [entries, projects] = await Promise.all([getNowEntries(), getProjects()]);
  const freshness = nowFreshness(entries);
  if (!freshness.fresh) {
    if (freshness.reason === 'stale' && process.env.NODE_ENV === 'development') {
      console.warn(`[sections] "now" hidden: last update ${freshness.updatedAt?.toISOString()} is stale`);
    }
    return null;
  }

  const slugById = new Map(projects.map((p) => [p.id, p.slug]));

  return (
    <SectionBlock
      heading={section.heading ?? 'Currently'}
      description={section.description}
      aside={<>updated {formatUpdated(freshness.updatedAt)}</>}
    >
      {/* Two columns only when there are two things to put in them: a
          single entry in a half-width grid leaves the other half blank,
          which reads as a section that failed to load (ADR-064). */}
      <ul className={`grid grid-cols-1 gap-4 list-none m-0 p-0 ${entries.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {entries.map((e, i) => {
          const kind = KIND[e.kind] ?? { icon: Activity, label: e.kind, hue: 'accent' as const };
          const projectSlug = e.project_id ? slugById.get(e.project_id) : undefined;
          const href = projectSlug ? `/projects/${projectSlug}` : e.url ?? null;
          const title = (
            <span className="font-semibold text-primary">{e.title}</span>
          );
          return (
            <li key={e.id} className="enter" style={enterAt(i * 70)}>
              <Card className="p-5 h-full flex flex-col gap-2" hover={Boolean(href)}>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-label font-semibold uppercase tracking-wider hue-chip"
                    style={hueStyle(kind.hue)}
                  >
                    <kind.icon size={11} aria-hidden /> {kind.label}
                  </span>
                  {e.progress && (
                    <span className="text-caption font-mono text-muted">{e.progress}</span>
                  )}
                </div>
                {href ? (
                  projectSlug ? (
                    <Link href={href} className="no-underline hover:underline">{title}</Link>
                  ) : (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline">{title} ↗</a>
                  )
                ) : title}
                {e.description && (
                  <p className="text-sm leading-relaxed m-0 text-secondary">{e.description}</p>
                )}
                {e.started_on && (
                  <p className="text-caption font-mono mt-auto pt-1 m-0 text-muted">
                    since {new Date(e.started_on).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </SectionBlock>
  );
}
