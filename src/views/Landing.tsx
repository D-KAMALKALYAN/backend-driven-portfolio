'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import Button from '../components/Button';
import SystemPanel from '../components/SystemPanel';
import { buildCareerLine } from '../utils/career';
import { trackEvent } from '../services/analytics';
import { getVal, getItems } from '../utils/siteContent';
import { useSiteContent } from '../hooks/useSiteContent';
import { asStringArray } from '../utils/json';
import { enterAt } from '../utils/enter';
import { hueStyle } from '../lib/palette';
import type { ActiveResume, Experience } from '../types/rows';

export interface LandingProps {
  experience: Experience[];
  resume: ActiveResume | null;
  /** Registry-driven sections (server-rendered), placed below the hero. */
  children?: ReactNode;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}




// ─── Component ────────────────────────────────────────────────────────────────
export default function Landing({ experience, resume, children }: LandingProps) {
  const { content } = useSiteContent();

  // Current role + years, derived from the experience table. These are the
  // signals a recruiter looks for first and they were absent from the hero
  // despite already living in the database.
  const careerLine = buildCareerLine(experience);

  const name         = getVal(content, 'profile.name',       'Kamal Kalyan');
  const headline     = getVal(content, 'hero.headline',      'Backend Engineer building scalable & secure systems');
  const subheadline  = getVal(content, 'hero.subheadline',   'I design systems, not just APIs — focused on performance, security, and real-world impact.');
  const ctaPrimary   = getVal(content, 'hero.cta_primary',   'View Projects');
  const ctaSecond    = getVal(content, 'hero.cta_secondary', 'Download Resume');
  const availability = getVal(content, 'hero.availability',  '');
  const location     = getVal(content, 'hero.location',      '');

  // hero.tags shape: { items: string[] }
  const storedTags   = asStringArray(getItems(content, 'hero.tags'));
  const featuredTags = storedTags.length > 0
    ? storedTags
    : ['Java', 'Spring Boot', 'React', 'Supabase', 'PostgreSQL', 'Docker'];

  return (
    <PageWrapper>

      <Section>
        <Container className="relative">

          {/* ── Hero ──
              Two columns from `lg`: the intro, and the readings the site
              measures about itself (ADR-061). The intro alone left the
              right half of a 1280 px screen empty, and the readings were
              in the footer where nobody scrolled to them. One change
              answers both. Below `lg` the panel follows the intro. */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10 lg:gap-16">
          <div className="enter w-full max-w-3xl min-w-0" style={enterAt(50)}>
            <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight mb-4 text-primary">
              {name}
            </h1>

            <p className="text-lg sm:text-xl font-semibold font-mono mb-5 text-gradient leading-snug">
              {headline}
            </p>

            <p className="leading-relaxed mb-6 max-w-2xl text-secondary">
              {subheadline}
            </p>

            {/* Current role + years - the first thing a recruiter scans for */}
            {careerLine && (
              <p
                className="enter text-sm sm:text-base font-medium mb-5"
                style={{ ...enterAt(150), color: 'var(--text-secondary)' }}
              >
                {careerLine}
              </p>
            )}

            {/* Badges row */}
            {(availability || location) && (
              <div className="enter flex flex-wrap items-center gap-2 mb-8" style={enterAt(200)}>
                {availability && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium hue-pill"
                    style={hueStyle('success')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-success" />
                    {availability}
                  </span>
                )}
                {location && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-subtle text-muted shadow-card"
                  >
                    <MapPin size={12} aria-hidden /> {location}
                  </span>
                )}
              </div>
            )}

            {/* CTAs */}
            <div className="enter flex flex-wrap items-center gap-4 mb-8" style={enterAt(250)}>
              <Button as={Link} href="/projects" size="lg">
                {ctaPrimary}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
              {/* Resolved on the server from the same query as /resume - one
                  source of truth. Falls back to the resume page if none is active. */}
              {resume?.url ? (
                <Button
                  as="a"
                  href={resume.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent('resume_download', { from: 'landing', version: resume.version ?? null })}
                  variant="secondary" size="lg"
                >
                  {ctaSecond}
                  <DownloadIcon />
                </Button>
              ) : (
                <Button as={Link} href="/resume" variant="secondary" size="lg">
                  {ctaSecond}
                  <DownloadIcon />
                </Button>
              )}
            </div>

            {/* Tech tags — staggered by CSS delay */}
            <div className="flex flex-wrap items-center gap-2">
              {featuredTags.map((tag, i) => (
                <span key={tag} className="enter px-3 py-1 rounded-full text-xs font-mono cursor-default bg-subtle text-muted shadow-card transition-[color,box-shadow] duration-150 hover:text-accent hover:shadow-[var(--shadow-card),0_0_0_1px_var(--ring-accent)]" style={enterAt(300 + i * 60)}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

            {/* Measured, not asserted: what the server just saw of the
                database. The one thing on this page that cannot be faked
                by a static file. */}
            <div className="enter w-full lg:w-auto lg:shrink-0" style={enterAt(400)}>
              <SystemPanel />
            </div>
          </div>

        </Container>
      </Section>

      {/* ── Registry sections: page_sections WHERE page = 'landing' ── */}
      {children}
    </PageWrapper>
  );
}
