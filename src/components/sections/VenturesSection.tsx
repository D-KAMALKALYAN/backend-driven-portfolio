import SectionBlock from './SectionBlock';
import Card from '../Card';
import Badge from '../Badge';
import VentureLink from './VentureLink';
import { getVentures } from '../../lib/content';
import { RELATIONSHIP_LABEL, STATUS_LABEL, splitVentures } from '../../utils/ventures';
import { enterAt } from '../../utils/enter';
import type { PageSection, Venture } from '../../types/rows';

const STATUS_COLOR: Record<string, string> = {
  stealth: '#9898b0',
  active: '#22c55e',
  acquired: '#6366f1',
  'wound-down': '#82829c',
};

function fmtDates(v: Venture): string | null {
  const f = (d: string) => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  if (!v.founded_on) return null;
  return `${f(v.founded_on)} – ${v.ended_on ? f(v.ended_on) : 'present'}`;
}

function VentureCard({ v, i, light }: { v: Venture; i: number; light: boolean }) {
  const dates = fmtDates(v);
  const statusColor = STATUS_COLOR[v.status] ?? 'var(--text-muted)';
  const name = <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{v.name}</span>;
  return (
    <li className="enter" style={enterAt(i * 70)}>
      <Card className={`${light ? 'p-4' : 'p-6'} h-full flex flex-col gap-3`} hover={Boolean(v.website_url)} glow={!light && v.is_featured}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {v.logo_url && (
              <img src={v.logo_url} alt="" width={40} height={40} className="w-10 h-10 rounded-xl object-cover shrink-0" />
            )}
            <div className="min-w-0">
              {v.website_url ? (
                <VentureLink href={v.website_url} slug={v.slug} className="no-underline hover:underline">{name} ↗</VentureLink>
              ) : name}
              <p className="text-xs m-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {[v.role, RELATIONSHIP_LABEL[v.relationship] ?? v.relationship].filter(Boolean).join(' · ')}
                {dates && <> · {dates}</>}
              </p>
            </div>
          </div>
          <span
            className="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
          >
            {STATUS_LABEL[v.status] ?? v.status}
          </span>
        </div>
        {v.tagline && <p className="text-sm font-medium m-0" style={{ color: 'var(--text-secondary)' }}>{v.tagline}</p>}
        {!light && v.description && (
          <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>
        )}
        {(v.industry.length > 0 || v.tech_stack.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
            {v.industry.map((t) => <Badge key={`i-${t}`}>{t}</Badge>)}
            {!light && v.tech_stack.map((t) => <Badge key={`t-${t}`} color="#6366f1">{t}</Badge>)}
          </div>
        )}
      </Card>
    </li>
  );
}

/**
 * Two section types share this file because they share a table and must
 * never share a frame: `ventures` renders what the author built (prominent,
 * with role and dates); `endorsements` renders what the author vouches for
 * (lighter, and framed as someone else's work). Either hides when empty -
 * a section with no rows is not shipped, it is skipped.
 */
export default async function VenturesSection({ section, variant }: { section: PageSection; variant: 'own' | 'endorsements' }) {
  const { own, endorsements } = splitVentures(await getVentures());
  const list = variant === 'own' ? own : endorsements;
  if (list.length === 0) return null;

  return (
    <SectionBlock
      heading={section.heading ?? (variant === 'own' ? 'Ventures' : 'Building alongside')}
      description={section.description ?? (variant === 'own' ? null : 'Not my work - founders and products I would vouch for.')}
    >
      <ul className={`grid grid-cols-1 ${variant === 'own' ? 'md:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4 list-none m-0 p-0`}>
        {list.map((v, i) => <VentureCard key={v.id} v={v} i={i} light={variant === 'endorsements'} />)}
      </ul>
    </SectionBlock>
  );
}
