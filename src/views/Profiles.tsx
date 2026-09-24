'use client';

import { platformIcon, normalizeUrl } from '../components/PlatformIcon';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import { Link2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { CARD, CARD_HOVER } from '../components/Card';
import { trackEvent } from '../services/analytics';
import { colorStyle } from '../lib/palette';
import { enterAt } from '../utils/enter';
import type { ExternalProfile } from '../types/rows';

// The registry moved to components/PlatformIcon so /contact draws the
// same marks instead of two-letter abbreviations (ADR-065).

/* Brand colour per platform. These are the platforms' own identities, not
   theme tokens - the one place in src/ a literal colour is correct. The tint
   still derives in CSS (.hue-chip), so the old `${hex}18` string trick is
   gone, and with it the broken `var(--accent)18` an unknown platform produced. */
const PLATFORM_COLORS: Record<string, string> = {
  // GitHub and Medium are black-on-white brands: a literal here is invisible
  // in one of the two themes, so they take the theme's own text colour.
  github: 'var(--text-primary)',
  linkedin: '#0a66c2',
  twitter: '#1d9bf0',
  leetcode: '#ffa116',
  hackerrank: '#00ea64',
  geeksforgeeks: '#2f8d46',
  medium: 'var(--text-primary)',
  portfolio: '#6366f1',
};

function platformColor(platform: string | null | undefined): string {
  const k = (platform || '').toLowerCase().replace(/[^a-z]/g, '');
  return PLATFORM_COLORS[k] ?? 'var(--accent)';
}

export default function Profiles({ profiles }: { profiles: ExternalProfile[] }) {
  const list = profiles;

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="Profiles"
            title="External Profiles"
            description="Find me across platforms and networks."
          />

          {list.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((p, i) => {
                const href = normalizeUrl(p?.profile_url);
                const color = platformColor(p?.platform);
                return (
                  <div key={p.id} className="enter" style={enterAt(i * 50)}>
                    <a
                      href={href || undefined}
                      target={href ? '_blank' : undefined}
                      rel={href ? 'noopener noreferrer' : undefined}
                      onClick={() => href && trackEvent('profile_click', { platform: p?.platform, url: href })}
                      className={`group flex items-center gap-4 p-4 sm:p-5 no-underline block ${CARD} ${CARD_HOVER} ${href ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {/* Coloured icon bubble */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 hue-chip"
                        style={colorStyle(color)}
                      >
                        {platformIcon(p?.platform)}
                      </div>

                      {/* Labels */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold capitalize truncate text-primary">
                          {p.platform}
                        </p>
                        {p?.username && (
                          <p className="text-xs font-mono truncate mt-0.5 text-muted">
                            @{p.username}
                          </p>
                        )}
                      </div>

                      {/* External arrow */}
                      {href && (
                        <svg
                          className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity text-muted"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      )}
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Link2 size={24} aria-hidden />} title="No profiles linked" description="Add external profiles via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
