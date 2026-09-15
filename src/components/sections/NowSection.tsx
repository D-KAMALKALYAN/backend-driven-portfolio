import Link from 'next/link';
import SectionBlock from './SectionBlock';
import Card from '../Card';
import { getNowEntries, getProjects } from '../../lib/content';
import { formatUpdated, nowFreshness } from '../../utils/now';
import { enterAt } from '../../utils/enter';
import type { PageSection } from '../../types/rows';

const KIND: Record<string, { icon: string; label: string; color: string }> = {
  building:  { icon: '🛠', label: 'Building',  color: '#6366f1' },
  learning:  { icon: '📚', label: 'Learning',  color: '#22c55e' },
  reading:   { icon: '📖', label: 'Reading',   color: '#f59e0b' },
  exploring: { icon: '🧭', label: 'Exploring', color: '#3b82f6' },
  writing:   { icon: '✍️', label: 'Writing',   color: '#ec4899' },
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
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none m-0 p-0">
        {entries.map((e, i) => {
          const kind = KIND[e.kind] ?? { icon: '◈', label: e.kind, color: 'var(--accent)' };
          const projectSlug = e.project_id ? slugById.get(e.project_id) : undefined;
          const href = projectSlug ? `/projects/${projectSlug}` : e.url ?? null;
          const title = (
            <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{e.title}</span>
          );
          return (
            <li key={e.id} className="enter" style={enterAt(i * 70)}>
              <Card className="p-5 h-full flex flex-col gap-2" hover={Boolean(href)}>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: `${kind.color}18`, color: kind.color }}
                  >
                    <span aria-hidden="true">{kind.icon}</span> {kind.label}
                  </span>
                  {e.progress && (
                    <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{e.progress}</span>
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
                  <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>{e.description}</p>
                )}
                {e.started_on && (
                  <p className="text-[11px] font-mono mt-auto pt-1 m-0" style={{ color: 'var(--text-muted)' }}>
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
