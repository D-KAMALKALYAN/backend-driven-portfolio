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
import { fetchExperience } from '../services/api';

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

function TimelineItem({ exp, index, isFirst, isLast }) {
  const start = fmtDate(exp?.start_date);
  const end   = exp?.end_date ? fmtDate(exp.end_date) : 'Present';
  const techs = parseTechs(exp?.technologies);
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
        {/* Dot */}
        <div
          className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-200 group-hover:scale-110"
          style={{
            backgroundColor: isCurrent ? 'var(--accent-glow2)' : 'var(--bg-subtle)',
            boxShadow: isCurrent ? '0 0 0 3px var(--accent-glow), 0 0 20px var(--accent-glow)' : '0 0 0 2px var(--border)',
          }}
        >
          {isCurrent ? (
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
          )}
        </div>

        {/* Connecting line */}
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
          whileHover={{ y: -2 }}
          transition={{ duration: 0.18 }}
        >
          <Card
            className="p-5 sm:p-6"
            hover={false}
            style={{
              boxShadow: isCurrent
                ? 'var(--shadow-card), 0 0 0 1px rgba(99,102,241,0.2)'
                : 'var(--shadow-card)',
            }}
          >
            {/* Date + current badge */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                {start}{start && end ? ' — ' : ''}{end}
              </p>
              {isCurrent && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'var(--success)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Current
                </span>
              )}
            </div>

            {/* Role */}
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {exp?.title || exp?.role || 'Position'}
            </h3>

            {/* Company */}
            {(exp?.company || exp?.location) && (
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                {exp?.company || ''}
                {exp?.company && exp?.location && (
                  <span style={{ color: 'var(--text-muted)' }}> · {exp.location}</span>
                )}
                {!exp?.company && exp?.location && exp.location}
              </p>
            )}

            {/* Description */}
            {exp?.description && (
              <p className="text-sm leading-relaxed mb-4 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                {exp.description}
              </p>
            )}

            {/* Tech badges */}
            {techs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {techs.map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function Experience() {
  const { data: experience, loading, error, refetch } = useSupabaseQuery(fetchExperience);

  if (loading) return (
    <PageWrapper><Section><Container>
      <SectionHeader label="Experience" title="Career Timeline" />
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
          <SectionHeader
            label="Experience"
            title="Career Timeline"
            description="Professional milestones and engineering journey."
          />

          {list.length > 0 ? (
            <div className="max-w-3xl">
              {list.map((exp, i) => (
                <TimelineItem
                  key={exp?.id ?? i}
                  exp={exp}
                  index={i}
                  isFirst={i === 0}
                  isLast={i === list.length - 1}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon="💼" title="No experience entries" description="Add experience via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
