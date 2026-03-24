import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import { SkeletonSection } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { fetchResumeUrl, fetchProfile, fetchSkills, fetchExperience, fetchSiteContent } from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getVal(content, key, fallback = '') {
  if (!Array.isArray(content)) return fallback;
  return content.find((c) => c?.key === key)?.value ?? fallback;
}
function getJson(content, key, fallback = null) {
  if (!Array.isArray(content)) return fallback;
  const row = content.find((c) => c?.key === key);
  return row?.value_json ?? fallback;
}

// Fallback highlights if DB key is missing
const DEFAULT_HIGHLIGHTS = [
  { icon: '🔒', label: 'Security',     text: 'SAST/DAST, enterprise-grade application security' },
  { icon: '🏗',  label: 'Architecture', text: 'Scalable backend systems, microservices design'    },
  { icon: '🛠',  label: 'Full-Stack',   text: 'Java, Spring Boot, React, Node.js, PostgreSQL'     },
  { icon: '☁️', label: 'Cloud',        text: 'Supabase, Docker, CI/CD pipelines'                 },
];

// ─── Animated counter ─────────────────────────────────────────────────────────
function CountUp({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    let start = 0;
    const step = Math.ceil(value / 20);
    const t = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(t); }
      else setDisplay(start);
    }, 40);
    return () => clearInterval(t);
  }, [value]);
  return <>{display}{suffix}</>;
}

// ─── PDF inline preview ───────────────────────────────────────────────────────
function PdfPreview({ url }) {
  const [show, setShow] = useState(false);
  if (!url) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: show ? 1 : 0, height: show ? 500 : 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="overflow-hidden rounded-2xl mt-6"
      style={{ boxShadow: show ? 'var(--shadow-card)' : 'none' }}
    >
      {show && (
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
          title="Resume Preview"
          className="w-full"
          style={{ height: 500, border: 'none', backgroundColor: 'var(--bg-subtle)' }}
        />
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Resume() {
  const [url, setUrl]         = useState(null);
  const [loading, setL]       = useState(true);
  const [error, setErr]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [skillCount, setSkills] = useState(null);
  const [expCount, setExp]    = useState(null);
  const [content, setContent] = useState(null);
  const [showPdf, setShowPdf] = useState(false);

  useEffect(() => {
    let done = false;
    Promise.allSettled([
      fetchResumeUrl(),
      fetchProfile(),
      fetchSkills(),
      fetchExperience(),
      fetchSiteContent(),
    ]).then(([urlRes, profRes, skillsRes, expRes, contentRes]) => {
      if (done) return;
      if (urlRes.status    === 'fulfilled') setUrl(urlRes.value);
      else setErr('Resume not available');
      if (profRes.status   === 'fulfilled') setProfile(profRes.value);
      if (skillsRes.status === 'fulfilled') setSkills(Array.isArray(skillsRes.value) ? skillsRes.value.length : 0);
      if (expRes.status    === 'fulfilled') setExp(Array.isArray(expRes.value) ? expRes.value.length : 0);
      if (contentRes.status === 'fulfilled') setContent(contentRes.value);
      setL(false);
    });
    return () => { done = true; };
  }, []);

  if (loading) return <PageWrapper><Section><Container><SkeletonSection lines={4} /></Container></Section></PageWrapper>;
  if (error && !url) return <PageWrapper><Section><Container><ErrorState message={error} /></Container></Section></PageWrapper>;

  // ── DB-driven content ─────────────────────────────────────────────────────
  const highlightsJson = getJson(content, 'resume.highlights', null);
  const highlights = Array.isArray(highlightsJson?.items) && highlightsJson.items.length > 0
    ? highlightsJson.items
    : DEFAULT_HIGHLIGHTS;

  const resumeUrl = url || getVal(content, 'resume.url', null);
  const yearsExp  = profile?.years_experience ?? null;

  const STATS = [
    yearsExp   != null ? { value: yearsExp,   suffix: '+', label: 'Years'  } : null,
    skillCount != null ? { value: skillCount, suffix: '',  label: 'Skills' } : null,
    expCount   != null ? { value: expCount,   suffix: '',  label: 'Roles'  } : null,
  ].filter(Boolean);

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="Resume"
            title="Resume / CV"
            description="A snapshot of my engineering journey, skills, and accomplishments."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── Left: Download card ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-8" hover={false}>
                {/* Gradient doc icon */}
                <motion.div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'linear-gradient(135deg, var(--accent-glow2) 0%, var(--accent-glow) 100%)' }}
                  whileHover={{ scale: 1.08, rotate: 2 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </motion.div>

                <h3 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {profile?.full_name || getVal(content, 'profile.name', 'Kamal Kalyan')}
                </h3>
                <p className="text-sm mb-1" style={{ color: 'var(--accent)' }}>
                  {profile?.headline || getVal(content, 'profile.role', 'Backend Engineer')}
                </p>
                <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                  PDF · Supabase Storage · Always up-to-date
                </p>

                {resumeUrl ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button as="a" href={resumeUrl} target="_blank" rel="noopener noreferrer" size="md" id="resume-view">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Online
                    </Button>
                    <Button as="a" href={resumeUrl} download variant="secondary" size="md" id="resume-download">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </Button>
                    <Button
                      variant="secondary" size="md"
                      onClick={() => setShowPdf((v) => !v)}
                      id="resume-preview"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                      {showPdf ? 'Hide' : 'Preview'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>No resume uploaded yet.</p>
                )}

                {/* Stats */}
                {STATS.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                    {STATS.map((s) => (
                      <div key={s.label} className="text-center">
                        <p className="text-2xl font-bold font-mono" style={{ color: 'var(--accent)' }}>
                          <CountUp value={s.value} suffix={s.suffix} />
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Inline PDF preview — expands below card */}
              {showPdf && resumeUrl && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0.9 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  style={{ transformOrigin: 'top', overflow: 'hidden', borderRadius: '1rem', marginTop: '1rem' }}
                >
                  <iframe
                    src={`${resumeUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    title="Resume Preview"
                    className="w-full"
                    style={{ height: 520, border: 'none', borderRadius: '1rem', backgroundColor: 'var(--bg-subtle)', boxShadow: 'var(--shadow-card)' }}
                  />
                </motion.div>
              )}

              {/* Storage badge */}
              <p className="flex items-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Served via Supabase Storage with CDN caching
              </p>
            </motion.div>

            {/* ── Right: Highlights + CTA ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                What&apos;s Inside
              </p>

              <div className="space-y-3">
                {highlights.map((h, i) => (
                  <motion.div
                    key={h.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.08 }}
                    whileHover={{ x: 4 }}
                  >
                    <div
                      className="flex items-center gap-4 p-4 rounded-2xl transition-all cursor-default"
                      style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-hover), 0 0 0 1px rgba(99,102,241,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                      }}
                    >
                      <span className="text-xl shrink-0">{h.icon}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{h.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{h.text}</p>
                      </div>
                      <svg className="w-4 h-4 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* CTA with gradient shimmer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="rounded-2xl p-5 mt-2 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(99,102,241,0.06) 100%)',
                  boxShadow: '0 0 0 1px rgba(99,102,241,0.18)',
                }}
              >
                {/* Shimmer overlay */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)',
                    backgroundSize: '200% 100%',
                  }}
                  animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
                />
                <p className="text-sm font-semibold mb-1 relative z-10" style={{ color: 'var(--text-primary)' }}>
                  Interested in collaborating?
                </p>
                <p className="text-xs mb-4 relative z-10" style={{ color: 'var(--text-muted)' }}>
                  View my projects or get in touch directly.
                </p>
                <div className="flex gap-3 relative z-10">
                  <Button as={Link} to="/projects" size="sm" variant="primary">Projects</Button>
                  <Button as={Link} to="/contact" size="sm" variant="secondary">Contact</Button>
                </div>
              </motion.div>
            </motion.div>

          </div>
        </Container>
      </Section>
    </PageWrapper>
  );
}
