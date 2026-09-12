'use client';

import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { useSiteContent } from '../hooks/useSiteContent';
import { readProfileMeta } from '../utils/profileMeta';
import { enterAt } from '../utils/enter';
import type { Achievement, Profile } from '../types/rows';

export interface AboutProps {
  profile: Profile | null;
  achievements: Achievement[];
}

const SECTION_ICONS: Record<string, string> = {
  bio: '◎', philosophy: '◆', approach: '▣', interests: '◇', education: '▥', certifications: '▦',
};

const TYPE_COLORS: Record<string, string> = {
  certification: '#6366f1',
  award:         '#f59e0b',
  publication:   '#3b82f6',
  speaking:      '#8b5cf6',
  'open-source': '#22c55e',
  other:         '#9898b0',
};

const TYPE_ICONS: Record<string, string> = {
  certification: '🏆',
  award:         '🥇',
  publication:   '📄',
  speaking:      '🎤',
  'open-source': '💻',
  other:         '⭐',
};

function AchievementCard({ a, index }: { a: Achievement; index: number }) {
  const color = (a.type && TYPE_COLORS[a.type]) ?? '#9898b0';
  const icon  = (a.type && TYPE_ICONS[a.type]) ?? '⭐';
  const dateStr = a?.date_earned
    ? new Date(a.date_earned).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;

  return (
    <motion.div className="enter" style={enterAt(index * 50)} whileHover={{ y: -2 }}>
      <a
        href={a?.credential_url || undefined}
        target={a?.credential_url ? '_blank' : undefined}
        rel={a?.credential_url ? 'noopener noreferrer' : undefined}
        className="group block no-underline h-full rounded-2xl transition-all duration-200"
        style={{
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--shadow-card)',
          cursor: a?.credential_url ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
      >
        <div className="p-5">
          {/* Type badge + icon */}
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: `${color}18`, color }}
            >
              {icon}
            </div>
            {a?.is_featured && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
              >
                Featured
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold mb-1 group-hover:text-[var(--accent-hover)] transition-colors" style={{ color: 'var(--text-primary)' }}>
            {a?.title || 'Achievement'}
          </h3>

          {/* Issuer */}
          {a?.issuer && (
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              {a.issuer}
            </p>
          )}

          {/* Description */}
          {a?.description && (
            <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              {a.description}
            </p>
          )}

          {/* Footer: type tag + date */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <Badge color={color}>{a?.type ?? 'other'}</Badge>
            {dateStr && (
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{dateStr}</span>
            )}
          </div>
        </div>
      </a>
    </motion.div>
  );
}

export default function About({ profile, achievements }: AboutProps) {
  const { val } = useSiteContent();

  if (!profile) return (
    <PageWrapper><Section><Container>
      <EmptyState title="Profile not found" description="Add profile data in Supabase." />
    </Container></Section></PageWrapper>
  );

  const meta = readProfileMeta(profile.meta);

  // Everything after `bio` is not a column on `profiles` - it lives in the
  // JSONB `meta` escape hatch, so it can be filled from the dashboard without
  // a migration. Previously read as top-level fields, so every one of these
  // sections was permanently invisible.
  const sections = [
    { key: 'bio',            label: 'Bio',            content: profile.bio ?? '' },
    { key: 'philosophy',     label: 'Philosophy',     content: meta.philosophy },
    { key: 'approach',       label: 'Approach',       content: meta.approach },
    { key: 'interests',      label: 'Interests',      content: meta.interests },
    { key: 'education',      label: 'Education',      content: meta.education },
    { key: 'certifications', label: 'Certifications', content: meta.certifications },
  ].filter((s) => s.content);

  const achievementList    = Array.isArray(achievements) ? achievements : [];
  const featuredFirst      = [...achievementList].sort((a, b) => (b?.is_featured ? 1 : 0) - (a?.is_featured ? 1 : 0));

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="About"
            title={profile.full_name || 'About Me'}
            description={profile.title || val('about.paragraph') || undefined}
          />

          {/* Metadata chips */}
          {(profile.location || meta.years_experience != null || meta.focus_area) && (
            <div className="flex flex-wrap gap-2 mb-8">
              {profile.location && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  📍 {profile.location}
                </span>
              )}
              {meta.years_experience != null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  ⏳ {meta.years_experience}+ yrs experience
                </span>
              )}
              {meta.focus_area && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  🎯 {meta.focus_area}
                </span>
              )}
            </div>
          )}

          {/* Profile sections */}
          {sections.length > 0 && (
            <div className="space-y-4 mb-12">
              {sections.map((s, i) => (
                <div key={s.key} className="enter" style={enterAt(i * 60)}>
                  <Card className="p-6" hover={false}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm" style={{ color: 'var(--accent)' }}>{SECTION_ICONS[s.key] ?? '◈'}</span>
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-line wrap-any" style={{ color: 'var(--text-primary)' }}>
                      {s.content}
                    </p>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* ── Achievements Section ── */}
          {(
            <>
              {featuredFirst.length > 0 ? (
                <>
                  <div className="mb-8">
                    <SectionHeader
                      as="h2"
                      label="Achievements"
                      title="Certifications & Awards"
                      description="Credentials, publications, and contributions."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {featuredFirst.map((a, i) => (
                      <AchievementCard key={a?.id ?? i} a={a} index={i} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    icon="🏆"
                    title="No achievements yet"
                    description="Add certifications, awards, or publications via the achievements table."
                  />
                </div>
              )}
            </>
          )}

          {sections.length === 0 && achievementList.length === 0 && (
            <EmptyState title="No profile sections" description="Add bio and other sections via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
