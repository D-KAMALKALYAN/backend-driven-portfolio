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
import { fetchResumeUrl, fetchProfile, fetchSkills, fetchExperience } from '../services/api';

const HIGHLIGHTS = [
  { icon: '🔒', label: 'Security', text: 'SAST/DAST, enterprise-grade application security' },
  { icon: '🏗', label: 'Architecture', text: 'Scalable backend systems, microservices design' },
  { icon: '🛠', label: 'Full-Stack', text: 'Java, Spring Boot, React, Node.js, PostgreSQL' },
  { icon: '☁️', label: 'Cloud', text: 'Supabase, Docker, CI/CD pipelines' },
];

export default function Resume() {
  const [url, setUrl] = useState(null);
  const [loading, setL] = useState(true);
  const [error, setErr] = useState(null);
  const [profile, setProfile] = useState(null);
  const [skillCount, setSkills] = useState(null);
  const [expCount, setExp] = useState(null);

  useEffect(() => {
    let done = false;
    Promise.allSettled([
      fetchResumeUrl(),
      fetchProfile(),
      fetchSkills(),
      fetchExperience(),
    ]).then(([urlRes, profRes, skillsRes, expRes]) => {
      if (done) return;
      if (urlRes.status === 'fulfilled') setUrl(urlRes.value);
      else setErr('Resume not available');
      if (profRes.status === 'fulfilled') setProfile(profRes.value);
      if (skillsRes.status === 'fulfilled') setSkills(Array.isArray(skillsRes.value) ? skillsRes.value.length : 0);
      if (expRes.status === 'fulfilled') setExp(Array.isArray(expRes.value) ? expRes.value.length : 0);
      setL(false);
    });
    return () => { done = true; };
  }, []);

  if (loading) return <PageWrapper><Section><Container><SkeletonSection lines={4} /></Container></Section></PageWrapper>;
  if (error && !url) return <PageWrapper><Section><Container><ErrorState message={error} /></Container></Section></PageWrapper>;

  const yearsExp = profile?.years_experience ?? (expCount != null ? expCount : null);

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

            {/* ── Left: Download card + storage info ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-8" hover={false}>
                {/* Doc icon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'var(--accent-glow)' }}
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                <h3 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {profile?.full_name || 'Kamal Kalyan'}
                </h3>
                <p className="text-sm mb-1" style={{ color: 'var(--accent)' }}>
                  {profile?.headline || 'Full-Stack Engineer & System Designer'}
                </p>
                <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                  PDF · Supabase Storage · Always up-to-date
                </p>

                {url ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button as="a" href={url} target="_blank" rel="noopener noreferrer" size="md" id="resume-view">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Online
                    </Button>
                    <Button as="a" href={url} download variant="secondary" size="md" id="resume-download">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>No resume uploaded yet.</p>
                )}

                {/* Quick stats */}
                {(yearsExp != null || skillCount != null || expCount != null) && (
                  <div
                    className="grid grid-cols-3 gap-4 mt-8 pt-6"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    {yearsExp != null && (
                      <div className="text-center">
                        <p className="text-2xl font-bold font-mono" style={{ color: 'var(--accent)' }}>{yearsExp}+</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>Years</p>
                      </div>
                    )}
                    {skillCount != null && (
                      <div className="text-center">
                        <p className="text-2xl font-bold font-mono" style={{ color: 'var(--accent)' }}>{skillCount}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>Skills</p>
                      </div>
                    )}
                    {expCount != null && (
                      <div className="text-center">
                        <p className="text-2xl font-bold font-mono" style={{ color: 'var(--accent)' }}>{expCount}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>Roles</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Storage badge */}
              <p className="flex items-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Served via Supabase Storage with CDN caching
              </p>
            </motion.div>

            {/* ── Right: What's Inside ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              {/* What's inside label */}
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                What&apos;s Inside
              </p>

              {/* Highlight cards */}
              <div className="space-y-3">
                {HIGHLIGHTS.map((h, i) => (
                  <motion.div
                    key={h.label}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                  >
                    <div
                      className="flex items-center gap-4 p-4 rounded-2xl"
                      style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}
                    >
                      <span className="text-xl shrink-0">{h.icon}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{h.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{h.text}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* CTA to explore */}
              <div
                className="rounded-2xl p-5 mt-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.04) 100%)',
                  boxShadow: '0 0 0 1px rgba(99,102,241,0.15)',
                }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Interested in collaborating?
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  View my projects or get in touch directly.
                </p>
                <div className="flex gap-3">
                  <Button as={Link} to="/projects" size="sm" variant="primary">
                    Projects
                  </Button>
                  <Button as={Link} to="/contact" size="sm" variant="secondary">
                    Contact
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </PageWrapper>
  );
}
