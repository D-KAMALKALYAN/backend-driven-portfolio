'use client';

import Link from 'next/link';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { ArrowRight, Briefcase, FolderOpen, MapPin, User, Zap, type LucideIcon } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import Button from '../components/Button';
import { CARD, CARD_HOVER_ACCENT } from '../components/Card';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { useResource } from '../hooks/useResource';
import { buildCareerLine } from '../utils/career';
import { trackEvent } from '../services/analytics';
import { NAV_LINKS, type RoutePath } from '../constants/routes';
import { getVal, getItems } from '../utils/siteContent';
import { useSiteContent } from '../hooks/useSiteContent';
import { asStringArray } from '../utils/json';
import { enterAt } from '../utils/enter';
import { hueStyle, tint, type Hue } from '../lib/palette';
import type { ActiveResume, AnalyticsDashboard, Experience } from '../types/rows';

export interface LandingProps {
  experience: Experience[];
  resume: ActiveResume | null;
  /** Registry-driven sections (server-rendered), placed below the hero. */
  children?: ReactNode;
}

// ─── Analytics teaser widget ──────────────────────────────────────────────────
function AnalyticsTeaser() {
  const { data, loading } = useResource<AnalyticsDashboard>('/api/analytics');
  const stats = data?.summary;

  const fmt = (v: number | null | undefined) => {
    if (loading || v == null) return '—';
    const n = Number(v);
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const PILLS: Array<{ label: string; value: string; hue: Hue }> = [
    { label: 'Page Views',    value: fmt(stats?.total_visits),        hue: 'indigo' },
    { label: 'Sessions',      value: fmt(stats?.unique_visitors),     hue: 'green' },
    { label: 'Project Views', value: fmt(stats?.total_project_views), hue: 'amber' },
  ];

  return (
    <div className="enter mt-8 w-full max-w-lg mx-auto" style={enterAt(650)}>
      <Link
        href="/analytics"
        className="group no-underline block"
        aria-label="View system analytics"
      >
        <motion.div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 bg-card
                     shadow-[var(--shadow-card),0_0_0_1px_var(--ring-accent-soft)]
                     group-hover:shadow-[var(--shadow-hover),0_0_0_1px_var(--ring-accent)]"
          whileHover={{ y: -2 }}
        >
          {/* Live dot */}
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2 h-2 rounded-full animate-pulse hue-dot [--dot-glow:6px]"
              style={hueStyle('success')}
            />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-success">
              Live
            </span>
          </span>

          {/* Divider */}
          <span className="w-px self-stretch shrink-0 bg-line" />

          {/* Stat pills */}
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {PILLS.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5 text-xs">
                <span className="font-mono font-bold hue-text" style={hueStyle(p.hue)}>
                  {p.value}
                </span>
                <span className="text-muted">{p.label}</span>
              </span>
            ))}
          </div>

          {/* CTA arrow */}
          <motion.span
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            Analytics
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </motion.span>
        </motion.div>
      </Link>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}


const NAV_ICON_MAP: Partial<Record<RoutePath, LucideIcon>> = { '/about': User, '/projects': FolderOpen, '/skills': Zap, '/experience': Briefcase };
const QUICK_NAV_PATHS: RoutePath[] = ['/about', '/projects', '/skills', '/experience'];

// ─── Animated gradient orbs that loosely track the cursor ────────────────────
function GradientOrbs() {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 30, damping: 20 });
  const sy = useSpring(my, { stiffness: 30, damping: 20 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mx.set(e.clientX / window.innerWidth);
      my.set(e.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [mx, my]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Left orb — accent */}
      <motion.div
        style={{
          x: sx,
          y: sy,
          position: 'absolute',
          top: '10%',
          left: '-10%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${tint('indigo', 12)} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          willChange: 'transform',
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
      {/* Right orb — violet */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: '5%',
          right: '-10%',
          width: '50vw',
          height: '50vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${tint('violet', 9)} 0%, transparent 70%)`,
          filter: 'blur(80px)',
          willChange: 'transform',
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Top-right subtle green (success) */}
      <motion.div
        style={{
          position: 'absolute',
          top: '-5%',
          right: '20%',
          width: '30vw',
          height: '30vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${tint('green', 5)} 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Landing({ experience, resume, children }: LandingProps) {
  const { content } = useSiteContent();
  const { system, latency, systemColor, latencyColor } = useSystemStatus();

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

  // Only genuinely measured values belong here. 'Uptime: 99.9%' and
  // 'Security: Active' were hardcoded string literals sitting beside two
  // real readings, which undermines the credibility of the real ones.
  const STATUS_ITEMS = [
    { label: 'System',  value: system,  color: systemColor,  title: 'Is the database reachable from the server right now' },
    { label: 'Latency', value: latency, color: latencyColor, title: 'Server → database round trip, measured on the server' },
  ];

  // hero.tags shape: { items: string[] }
  const storedTags   = asStringArray(getItems(content, 'hero.tags'));
  const featuredTags = storedTags.length > 0
    ? storedTags
    : ['Java', 'Spring Boot', 'React', 'Supabase', 'PostgreSQL', 'Docker'];

  const quickNav = NAV_LINKS.filter((l) => QUICK_NAV_PATHS.includes(l.path));

  return (
    <PageWrapper>
      <GradientOrbs />

      <Section>
        <Container className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center relative">

          {/* ── Status bar ── */}
          <div
            className="enter inline-flex flex-wrap items-center justify-center gap-5 mb-14 px-6 py-3 rounded-full"
            style={{
              ...enterAt(50),
              boxShadow: 'var(--shadow-card), inset 0 1px 0 var(--sheen)',
              backgroundColor: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {STATUS_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs" title={item.title}>
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }}
                />
                <span className="text-muted">{item.label}:</span>
                <span className="font-mono font-semibold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* ── Hero ── */}
          <div className="enter w-full max-w-3xl mx-auto" style={enterAt(150)}>
            {/* Name with glow */}
            <h1
              className="text-5xl sm:text-7xl font-extrabold leading-tight tracking-tight mb-5"
              style={{
                color: 'var(--text-primary)',
                textShadow: '0 0 80px var(--accent-glow2)',
              }}
            >
              {name}
            </h1>

            {/* Headline — gradient */}
            <p className="text-lg sm:text-xl font-semibold font-mono mb-5 text-gradient leading-snug">
              {headline}
            </p>

            <p
              className="leading-relaxed mb-7 max-w-xl mx-auto text-secondary"
            >
              {subheadline}
            </p>

            {/* Current role + years - the first thing a recruiter scans for */}
            {careerLine && (
              <p
                className="enter text-sm sm:text-base font-medium mb-5"
                style={{ ...enterAt(250), color: 'var(--text-secondary)' }}
              >
                {careerLine}
              </p>
            )}

            {/* Badges row */}
            {(availability || location) && (
              <div className="enter flex flex-wrap items-center justify-center gap-2 mb-8" style={enterAt(300)}>
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
            <div className="enter flex flex-wrap items-center justify-center gap-4 mb-10" style={enterAt(350)}>
              <Button as={Link} href="/projects" size="lg">
                {ctaPrimary}
                <motion.svg
                  className="w-4 h-4"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </motion.svg>
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
            <div className="flex flex-wrap items-center justify-center gap-2 mb-14">
              {featuredTags.map((tag, i) => (
                <motion.span
                  key={tag}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.15 }}
                  className="enter px-3 py-1 rounded-full text-xs font-mono cursor-default bg-subtle text-muted shadow-card
                             transition-[color,box-shadow] duration-150 hover:text-accent hover:shadow-[var(--shadow-card),0_0_0_1px_var(--ring-accent)]"
                  style={enterAt(450 + i * 80)}
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          </div>

          {/* ── Quick-nav cards ── */}
          <div className="enter grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mx-auto" style={enterAt(500)}>
            {quickNav.map((link) => (
              <motion.div key={link.path} whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.18 }}>
                <Link
                  href={link.path}
                  className={`group flex flex-col items-center gap-1.5 p-4 text-center no-underline block ${CARD} ${CARD_HOVER_ACCENT}`}
                >
                  {(() => { const Glyph = NAV_ICON_MAP[link.path] ?? ArrowRight; return <Glyph size={20} className="text-accent" aria-hidden />; })()}
                  <span className="text-xs font-medium text-secondary">
                    {link.label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* ── Analytics live teaser ── */}
          <AnalyticsTeaser />

          {/* ── Keyboard hint ── */}
          <p
            className="enter hidden sm:flex items-center justify-center gap-2 mt-10 text-xs"
            style={{ ...enterAt(750), color: 'var(--text-muted)' }}
          >
            Press{' '}
            <kbd
              className="px-2 py-1 rounded-lg text-[10px] font-mono shadow-card bg-subtle"
            >
              Ctrl+K
            </kbd>
            {' '}for command palette
          </p>



        </Container>
      </Section>

      {/* ── Registry sections: page_sections WHERE page = 'landing' ── */}
      {children}
    </PageWrapper>
  );
}
