'use client';

import type { ReactNode } from 'react';
import {
  Award, Code2, Compass, FileText, GraduationCap, Heart, Hourglass, Lightbulb, MapPin, Medal, Mic, Star, Target, Trophy, User,
  type LucideIcon,
} from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card, { CARD, CARD_HOVER } from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { useSiteContent } from '../hooks/useSiteContent';
import { readProfileMeta } from '../utils/profileMeta';
import { enterAt } from '../utils/enter';
import { hueStyle, type Hue } from '../lib/palette';
import type { Achievement, Profile } from '../types/rows';

export interface AboutProps {
  profile: Profile | null;
  achievements: Achievement[];
  /** Registry-driven sections (server-rendered), placed after achievements. */
  children?: ReactNode;
}

const SECTION_ICONS: Record<string, LucideIcon> = {
  bio: User, philosophy: Lightbulb, approach: Compass, interests: Heart, education: GraduationCap, certifications: Award,
};

/** Achievement type → hue and glyph. Unknown types are grey stars. */
const TYPE_META: Record<string, { hue: Hue; icon: LucideIcon }> = {
  certification: { hue: 'indigo', icon: Trophy },
  award:         { hue: 'amber',  icon: Medal },
  publication:   { hue: 'blue',   icon: FileText },
  speaking:      { hue: 'violet', icon: Mic },
  'open-source': { hue: 'green',  icon: Code2 },
  other:         { hue: 'slate',  icon: Star },
};

function AchievementCard({ a, index }: { a: Achievement; index: number }) {
  const meta = (a.type ? TYPE_META[a.type] : undefined) ?? TYPE_META.other!;
  const Glyph = meta.icon;
  const dateStr = a?.date_earned
    ? new Date(a.date_earned).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;

  return (
    <div className="enter" style={enterAt(index * 50)}>
      <a
        href={a?.credential_url || undefined}
        target={a?.credential_url ? '_blank' : undefined}
        rel={a?.credential_url ? 'noopener noreferrer' : undefined}
        className={`group block no-underline h-full ${CARD} ${CARD_HOVER} ${a?.credential_url ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="p-5">
          {/* Type badge + icon */}
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hue-chip"
              style={hueStyle(meta.hue)}
            >
              <Glyph size={18} aria-hidden />
            </div>
            {a?.is_featured && (
              <span
                className="text-label font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full hue-chip"
                style={hueStyle('amber')}
              >
                Featured
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold mb-1 group-hover:text-accent-hover transition-colors text-primary">
            {a?.title || 'Achievement'}
          </h3>

          {/* Issuer */}
          {a?.issuer && (
            <p className="text-xs mb-2 text-muted">
              {a.issuer}
            </p>
          )}

          {/* Description */}
          {a?.description && (
            <p className="text-xs leading-relaxed mb-3 line-clamp-2 text-secondary">
              {a.description}
            </p>
          )}

          {/* Footer: type tag + date */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line">
            <Badge hue={meta.hue}>{a?.type ?? 'other'}</Badge>
            {dateStr && (
              <span className="text-label font-mono text-muted">{dateStr}</span>
            )}
          </div>
        </div>
      </a>
    </div>
  );
}

export default function About({ profile, achievements, children }: AboutProps) {
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
            label={val('about.title', 'About')}
            title={profile.full_name || 'About Me'}
            description={profile.title || val('about.paragraph') || undefined}
          />

          {/* Metadata chips */}
          {(profile.location || meta.years_experience != null || meta.focus_area) && (
            <div className="flex flex-wrap gap-2 mb-8">
              {profile.location && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono shadow-card bg-card text-secondary"
                >
                  <MapPin size={12} aria-hidden /> {profile.location}
                </span>
              )}
              {meta.years_experience != null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono shadow-card bg-card text-secondary"
                >
                  <Hourglass size={12} aria-hidden /> {meta.years_experience}+ yrs experience
                </span>
              )}
              {meta.focus_area && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono shadow-card bg-card text-secondary"
                >
                  <Target size={12} aria-hidden /> {meta.focus_area}
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
                      {(() => { const Glyph = SECTION_ICONS[s.key] ?? Star; return <Glyph size={14} className="text-accent" aria-hidden />; })()}
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted">{s.label}</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-line wrap-any text-primary">
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
                    icon={<Trophy size={24} aria-hidden />}
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

      {/* ── Registry sections: page_sections WHERE page = 'about' ── */}
      {children}
    </PageWrapper>
  );
}
