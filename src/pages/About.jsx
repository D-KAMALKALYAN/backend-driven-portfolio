import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { SkeletonSection } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchProfile, fetchAchievements } from '../services/api';

const SECTION_ICONS = {
  bio: '◎', philosophy: '◆', approach: '▣', interests: '◇', education: '▥', certifications: '▦',
};

const TYPE_COLORS = {
  certification: '#6366f1',
  award:         '#f59e0b',
  publication:   '#3b82f6',
  speaking:      '#8b5cf6',
  'open-source': '#22c55e',
  other:         '#9898b0',
};

const TYPE_ICONS = {
  certification: '🏆',
  award:         '🥇',
  publication:   '📄',
  speaking:      '🎤',
  'open-source': '💻',
  other:         '⭐',
};

function AchievementCard({ a, index }) {
  const color = TYPE_COLORS[a?.type] ?? '#9898b0';
  const icon  = TYPE_ICONS[a?.type] ?? '⭐';
  const dateStr = a?.date_earned
    ? new Date(a.date_earned).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
    >
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

export default function About() {
  const { data: profile, loading: lp, error: ep, refetch } = useSupabaseQuery(fetchProfile);
  const { data: achievements, loading: la, error: ea } = useSupabaseQuery(fetchAchievements);

  if (lp) return (
    <PageWrapper><Section><Container><SkeletonSection lines={6} /></Container></Section></PageWrapper>
  );
  if (ep) return (
    <PageWrapper><Section><Container>
      <ErrorState message={ep} onRetry={refetch} />
    </Container></Section></PageWrapper>
  );
  if (!profile) return (
    <PageWrapper><Section><Container>
      <EmptyState title="Profile not found" description="Add profile data in Supabase." />
    </Container></Section></PageWrapper>
  );

  const sections = [
    profile.bio            && { key: 'bio',            label: 'Bio',            content: profile.bio            },
    profile.philosophy     && { key: 'philosophy',     label: 'Philosophy',     content: profile.philosophy     },
    profile.approach       && { key: 'approach',       label: 'Approach',       content: profile.approach       },
    profile.interests      && { key: 'interests',      label: 'Interests',      content: profile.interests      },
    profile.education      && { key: 'education',      label: 'Education',      content: profile.education      },
    profile.certifications && { key: 'certifications', label: 'Certifications', content: profile.certifications },
  ].filter(Boolean);

  const achievementList    = Array.isArray(achievements) ? achievements : [];
  const featuredFirst      = [...achievementList].sort((a, b) => (b?.is_featured ? 1 : 0) - (a?.is_featured ? 1 : 0));

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="About"
            title={profile.full_name || 'About Me'}
            description={profile.headline || undefined}
          />

          {/* Metadata chips */}
          {(profile.location || profile.years_experience != null || profile.focus_area) && (
            <div className="flex flex-wrap gap-2 mb-8">
              {profile.location && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  📍 {profile.location}
                </span>
              )}
              {profile.years_experience != null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  ⏳ {profile.years_experience}+ yrs experience
                </span>
              )}
              {profile.focus_area && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
                  style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  🎯 {profile.focus_area}
                </span>
              )}
            </div>
          )}

          {/* Profile sections */}
          {sections.length > 0 && (
            <div className="space-y-4 mb-12">
              {sections.map((s, i) => (
                <motion.div key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Card className="p-6" hover={false}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm" style={{ color: 'var(--accent)' }}>{SECTION_ICONS[s.key] ?? '◈'}</span>
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-line wrap-any" style={{ color: 'var(--text-primary)' }}>
                      {s.content}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Achievements Section ── */}
          {!la && !ea && (
            <>
              {featuredFirst.length > 0 ? (
                <>
                  <div className="mb-8">
                    <SectionHeader
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

          {sections.length === 0 && achievementList.length === 0 && !la && !ea && (
            <EmptyState title="No profile sections" description="Add bio and other sections via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
