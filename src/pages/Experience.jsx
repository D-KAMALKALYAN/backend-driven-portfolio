import { useState, useEffect, useCallback, useMemo } from 'react';

/** True when the primary pointer is coarse (touch/mobile). */
function useIsTouchDevice() {
  return useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    []
  );
}
import { motion, AnimatePresence } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { SkeletonSection } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchExperience } from '../services/api';
import { useSiteContent } from '../hooks/useSiteContent';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }); }
  catch { return d; }
}

function parseTechs(t) {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t === 'string') return t.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function parseAchievements(exp) {
  // Try exp.achievements (jsonb array) first, then parse exp.description by newlines
  if (exp?.achievements && Array.isArray(exp.achievements) && exp.achievements.length > 0) {
    return exp.achievements;
  }
  if (exp?.description) {
    const lines = exp.description.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) return lines;
  }
  return [];
}

// ─── Experience Detail Drawer ────────────────────────────────────────────────
function ExperienceDrawer({ exp, onClose }) {
  const start    = fmtDate(exp?.start_date);
  const end      = exp?.end_date ? fmtDate(exp.end_date) : 'Present';
  const techs    = parseTechs(exp?.technologies);
  const isCurrent = !exp?.end_date;
  const achievements = parseAchievements(exp);
  const isTouch  = useIsTouchDevice();

  // Close on ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-stretch justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Drawer panel */}
        <motion.div
          className="relative z-10 flex flex-col h-full overflow-y-auto"
          style={{
            width: 'min(480px, 92vw)',
            backgroundColor: 'var(--bg-surface)',
            boxShadow: '-4px 0 40px rgba(0,0,0,0.5), -1px 0 0 var(--border)',
          }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-2">
              {isCurrent && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--success)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Current
                </span>
              )}
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {start}{start && end ? ' — ' : ''}{end}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 px-6 py-6 space-y-7">

            {/* Role + Company */}
            <div>
              <h2
                className="text-2xl font-bold mb-1.5 leading-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {exp?.title || exp?.role || 'Position'}
              </h2>
              {(exp?.company || exp?.location) && (
                <p className="text-sm flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {exp?.company && (
                    <span className="font-medium">{exp.company}</span>
                  )}
                  {exp?.company && exp?.location && (
                    <span style={{ color: 'var(--border-hover)' }}>·</span>
                  )}
                  {exp?.location && (
                    <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      📍 {exp.location}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border)' }} />

            {/* Description */}
            {exp?.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  Overview
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {exp.description.split('\n')[0]}
                </p>
              </div>
            )}

            {/* Key Achievements */}
            {achievements.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  Key Highlights
                </p>
                <ul className="space-y-2.5">
                  {achievements.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: 'var(--accent)' }}
                      />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Technologies */}
            {techs.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  Technologies
                </p>
                <motion.div
                  className="flex flex-wrap gap-2"
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                >
                  {techs.map((t) => (
                    <motion.div
                      key={t}
                      variants={{ hidden: { opacity: 0, scale: 0.85 }, show: { opacity: 1, scale: 1 } }}
                    >
                      <Badge>{t}</Badge>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}

            {/* Duration pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono"
              style={{
                backgroundColor: 'var(--accent-glow)',
                color: 'var(--accent)',
                boxShadow: '0 0 0 1px rgba(99,102,241,0.2)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {start} → {end}
            </div>
          </div>

          {/* Footer hint — device-aware */}
          <div
            className="px-6 py-4 text-center text-xs"
            style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            {isTouch ? (
              <>
                Tap{' '}
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ backgroundColor: 'var(--bg-subtle)' }}>✕</kbd>
                {' '}to close
              </>
            ) : (
              <>
                Press{' '}
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ backgroundColor: 'var(--bg-subtle)' }}>ESC</kbd>
                {' '}to close
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Timeline Item ────────────────────────────────────────────────────────────
function TimelineItem({ exp, index, isLast, onSelect }) {
  const start    = fmtDate(exp?.start_date);
  const end      = exp?.end_date ? fmtDate(exp.end_date) : 'Present';
  const techs    = parseTechs(exp?.technologies);
  const isCurrent = !exp?.end_date;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative flex gap-6 group"
    >
      {/* Timeline column */}
      <div className="hidden sm:flex flex-col items-center shrink-0 pt-1">
        <div
          className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 group-hover:scale-110"
          style={{
            backgroundColor: isCurrent ? 'var(--accent-glow2)' : 'var(--bg-subtle)',
            boxShadow: isCurrent
              ? '0 0 0 3px var(--accent-glow), 0 0 20px var(--accent-glow)'
              : '0 0 0 2px var(--border)',
          }}
        >
          {isCurrent ? (
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
          )}
        </div>
        {!isLast && (
          <div
            className="flex-1 w-px mt-1"
            style={{
              background: 'linear-gradient(to bottom, var(--accent-glow2) 0%, var(--border) 100%)',
              minHeight: '2rem',
            }}
          />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-8">
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.18 }}
        >
          <button
            className="w-full text-left"
            onClick={() => onSelect(exp)}
            aria-label={`View details for ${exp?.title}`}
          >
            <Card
              className="p-5 sm:p-6 cursor-pointer"
              hover={false}
              style={{
                boxShadow: isCurrent
                  ? 'var(--shadow-card), 0 0 0 1px rgba(99,102,241,0.2)'
                  : 'var(--shadow-card)',
                transition: 'box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = isCurrent
                  ? 'var(--shadow-hover), 0 0 0 1px rgba(99,102,241,0.4)'
                  : 'var(--shadow-hover), 0 0 0 1px var(--border-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = isCurrent
                  ? 'var(--shadow-card), 0 0 0 1px rgba(99,102,241,0.2)'
                  : 'var(--shadow-card)';
              }}
            >
              {/* Date + badge + "details" hint */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                  {start}{start && end ? ' — ' : ''}{end}
                </p>
                <div className="flex items-center gap-2">
                  {isCurrent && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--success)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Current
                    </span>
                  )}
                  {/* Click-to-expand hint */}
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
                  >
                    Details
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {exp?.title || exp?.role || 'Position'}
              </h3>

              {(exp?.company || exp?.location) && (
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {exp?.company || ''}
                  {exp?.company && exp?.location && (
                    <span style={{ color: 'var(--text-muted)' }}> · {exp.location}</span>
                  )}
                  {!exp?.company && exp?.location && exp.location}
                </p>
              )}

              {exp?.description && (
                <p className="text-sm leading-relaxed mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {exp.description.split('\n')[0]}
                </p>
              )}

              {techs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {techs.slice(0, 5).map((t) => <Badge key={t}>{t}</Badge>)}
                  {techs.length > 5 && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle)' }}>
                      +{techs.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </Card>
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Experience() {
  const { data: experience, loading, error, refetch } = useSupabaseQuery(fetchExperience);
  const { val } = useSiteContent();

  const title = val('experience.title', 'Career Timeline');
  const description = val('experience.description',
    'Professional milestones and engineering journey. Click any role for full details.');
  const [selected, setSelected] = useState(null);

  const handleClose = useCallback(() => setSelected(null), []);

  if (loading) return (
    <PageWrapper><Section><Container>
      <SectionHeader label="Experience" title={title} />
      <SkeletonSection lines={6} />
    </Container></Section></PageWrapper>
  );
  if (error) return (
    <PageWrapper><Section><Container>
      <ErrorState message={error} onRetry={refetch} />
    </Container></Section></PageWrapper>
  );

  const list = Array.isArray(experience) ? experience : [];

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader label="Experience" title={title} description={description} />

          {list.length > 0 ? (
            <div className="max-w-3xl">
              {list.map((exp, i) => (
                <TimelineItem
                  key={exp?.id ?? i}
                  exp={exp}
                  index={i}
                  isFirst={i === 0}
                  isLast={i === list.length - 1}
                  onSelect={setSelected}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon="💼" title="No experience entries" description="Add experience via Supabase." />
          )}
        </Container>
      </Section>

      {/* Detail drawer — rendered outside the timeline flow */}
      <AnimatePresence>
        {selected && <ExperienceDrawer exp={selected} onClose={handleClose} />}
      </AnimatePresence>
    </PageWrapper>
  );
}
