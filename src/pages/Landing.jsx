import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect } from 'react';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import Button from '../components/Button';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { fetchSiteContent, fetchAnalyticsSummary, fetchExperience } from '../services/api';
import { buildCareerLine } from '../utils/career';
import { useActiveResume } from '../hooks/useActiveResume';
import { trackEvent } from '../services/analytics';
import { NAV_LINKS } from '../constants/routes';
import { getVal, getJson } from '../utils/siteContent';

// ─── Analytics teaser widget ──────────────────────────────────────────────────
function AnalyticsTeaser() {
  const { data: stats, loading } = useSupabaseQuery(fetchAnalyticsSummary);

  const fmt = (v) => {
    if (loading || v == null) return '—';
    const n = Number(v);
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const PILLS = [
    { label: 'Page Views',      value: fmt(stats?.total_visits),        color: '#6366f1' },
    { label: 'Sessions',       value: fmt(stats?.unique_visitors),      color: '#22c55e' },
    { label: 'Project Views',   value: fmt(stats?.total_project_views),  color: '#f59e0b' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65 }}
      className="mt-8 w-full max-w-lg mx-auto"
    >
      <Link
        to="/analytics"
        className="group no-underline block"
        aria-label="View system analytics"
      >
        <motion.div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200"
          style={{
            backgroundColor: 'var(--bg-card)',
            boxShadow: 'var(--shadow-card), 0 0 0 1px rgba(99,102,241,0.12)',
          }}
          whileHover={{
            boxShadow: 'var(--shadow-hover), 0 0 0 1px rgba(99,102,241,0.35)',
            y: -2,
          }}
        >
          {/* Live dot */}
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#22c55e' }}>
              Live
            </span>
          </span>

          {/* Divider */}
          <span className="w-px self-stretch shrink-0" style={{ backgroundColor: 'var(--border)' }} />

          {/* Stat pills */}
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {PILLS.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5 text-xs">
                <span
                  className="font-mono font-bold"
                  style={{ color: p.color }}
                >
                  {p.value}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{p.label}</span>
              </span>
            ))}
          </div>

          {/* CTA arrow */}
          <motion.span
            className="shrink-0 flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
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
    </motion.div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NAV_ICON_MAP = { '/about': '👤', '/projects': '📂', '/skills': '⚡', '/experience': '💼' };
const QUICK_NAV_PATHS = ['/about', '/projects', '/skills', '/experience'];

// ─── Animated gradient orbs that loosely track the cursor ────────────────────
function GradientOrbs() {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 30, damping: 20 });
  const sy = useSpring(my, { stiffness: 30, damping: 20 });

  useEffect(() => {
    const move = (e) => {
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
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Landing() {
  const { data: content, loading } = useSupabaseQuery(fetchSiteContent);
  const { system, latency, systemColor, latencyColor } = useSystemStatus();
  const { resume } = useActiveResume();
  const { data: experience } = useSupabaseQuery(fetchExperience);

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
    { label: 'System',  value: loading ? 'Checking' : system, color: loading ? 'var(--text-muted)' : systemColor  },
    { label: 'Latency', value: loading ? '...' : latency,     color: loading ? 'var(--text-muted)' : latencyColor },
  ];

  const tagsJson     = getJson(content, 'hero.tags', null);
  const featuredTags = Array.isArray(tagsJson?.items) && tagsJson.items.length > 0
    ? tagsJson.items
    : ['Java', 'Spring Boot', 'React', 'Supabase', 'PostgreSQL', 'Docker'];

  const quickNav = NAV_LINKS.filter((l) => QUICK_NAV_PATHS.includes(l.path));

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const tagVariant = {
    hidden: { opacity: 0, y: 8 },
    show:   { opacity: 1, y: 0 },
  };

  return (
    <PageWrapper>
      <GradientOrbs />

      <Section>
        <Container className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center relative">

          {/* ── Status bar ── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="inline-flex flex-wrap items-center justify-center gap-5 mb-14 px-6 py-3 rounded-full"
            style={{
              boxShadow: 'var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04)',
              backgroundColor: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {STATUS_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }}
                />
                <span style={{ color: 'var(--text-muted)' }}>{item.label}:</span>
                <span className="font-mono font-semibold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </motion.div>

          {/* ── Hero ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-3xl mx-auto"
          >
            {/* Name with glow */}
            <h1
              className="text-5xl sm:text-7xl font-extrabold leading-tight tracking-tight mb-5"
              style={{
                color: 'var(--text-primary)',
                textShadow: '0 0 80px rgba(99,102,241,0.25)',
              }}
            >
              {name}
            </h1>

            {/* Headline — gradient */}
            <p className="text-lg sm:text-xl font-semibold font-mono mb-5 text-gradient leading-snug">
              {headline}
            </p>

            <p
              className="text-base leading-relaxed mb-7 max-w-xl mx-auto"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subheadline}
            </p>

            {/* Current role + years - the first thing a recruiter scans for */}
            {careerLine && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-sm sm:text-base font-medium mb-5"
                style={{ color: 'var(--text-secondary)' }}
              >
                {careerLine}
              </motion.p>
            )}

            {/* Badges row */}
            {(availability || location) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap items-center justify-center gap-2 mb-8"
              >
                {availability && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(34,197,94,0.08)',
                      color: 'var(--success)',
                      boxShadow: '0 0 0 1px rgba(34,197,94,0.2)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
                    {availability}
                  </span>
                )}
                {location && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--text-muted)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    📍 {location}
                  </span>
                )}
              </motion.div>
            )}

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex flex-wrap items-center justify-center gap-4 mb-10"
            >
              <Button as={Link} to="/projects" size="lg">
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
              {/* Resolves through the same hook as /resume - one source of truth.
                  Falls back to the resume page while loading or if none is active. */}
              <Button
                as={resume?.url ? 'a' : Link}
                {...(resume?.url
                  ? { href: resume.url, target: '_blank', rel: 'noopener noreferrer',
                      onClick: () => trackEvent('resume_download', { from: 'landing', version: resume.version ?? null }) }
                  : { to: '/resume' })}
                variant="secondary" size="lg"
              >
                {ctaSecond}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </Button>
            </motion.div>

            {/* Tech tags — staggered */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              transition={{ delayChildren: 0.45 }}
              className="flex flex-wrap items-center justify-center gap-2 mb-14"
            >
              {featuredTags.map((tag) => (
                <motion.span
                  key={tag}
                  variants={tagVariant}
                  whileHover={{ color: 'var(--accent)', scale: 1.05, boxShadow: '0 0 0 1px rgba(99,102,241,0.4)' }}
                  transition={{ duration: 0.15 }}
                  className="px-3 py-1 rounded-full text-xs font-mono cursor-default"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-muted)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {tag}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>

          {/* ── Quick-nav cards ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mx-auto"
          >
            {quickNav.map((link) => (
              <motion.div key={link.path} whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.18 }}>
                <Link
                  to={link.path}
                  className="group flex flex-col items-center gap-1.5 p-4 rounded-2xl text-center no-underline block transition-all"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover), 0 0 0 1px var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
                >
                  <span className="text-xl">{NAV_ICON_MAP[link.path] ?? '→'}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {link.label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Analytics live teaser ── */}
          <AnalyticsTeaser />

          {/* ── Keyboard hint ── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="flex items-center justify-center gap-2 mt-10 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Press{' '}
            <kbd
              className="px-2 py-1 rounded-lg text-[10px] font-mono"
              style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-subtle)' }}
            >
              Ctrl+K
            </kbd>
            {' '}for command palette
          </motion.p>



        </Container>
      </Section>
    </PageWrapper>
  );
}
