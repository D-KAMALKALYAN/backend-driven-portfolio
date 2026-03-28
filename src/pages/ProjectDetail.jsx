import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { SkeletonSection } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchProjectBySlug, fetchProjectSections, fetchProjectMetrics, fetchProjectStorytelling } from '../services/api';
import { trackEvent } from '../services/analytics';

/* ─── Storytelling section meta ─── */
const STORY_META = {
  why_this_project: { icon: '💡', label: 'Why This Was Built',       color: '#f59e0b' },
  problem_statement: { icon: '⚠️', label: 'The Problem',              color: '#ef4444' },
  solution_approach: { icon: '🏗',  label: 'Solution & Architecture', color: '#6366f1' },
  tradeoffs:         { icon: '⚖️', label: 'Deliberate Tradeoffs',    color: '#8b5cf6' },
  impact:            { icon: '📈', label: 'Measurable Impact',        color: '#22c55e' },
};

/* Order storytelling sections by the canonical order above */
const STORY_ORDER = Object.keys(STORY_META);

function StorytellingSection({ rows }) {
  if (!rows || rows.length === 0) return null;

  // Sort by canonical order, then by sort_order within same type
  const sorted = [...rows].sort((a, b) => {
    const ai = STORY_ORDER.indexOf(a.section_type);
    const bi = STORY_ORDER.indexOf(b.section_type);
    if (ai !== bi) return ai - bi;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  return (
    <div className="mt-10">
      {/* Section divider */}
      <div className="flex items-center gap-3 mb-6">
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
        <span className="text-xs font-semibold uppercase tracking-widest px-3"
          style={{ color: 'var(--text-muted)' }}>Case Study</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
      </div>

      <div className="space-y-4">
        {sorted.map((row, i) => {
          const meta = STORY_META[row.section_type] ?? { icon: '◈', label: row.section_type, color: 'var(--accent)' };
          const displayTitle = row.title || meta.label;
          return (
            <motion.div
              key={row.id ?? i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className="rounded-2xl p-5 sm:p-6"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  boxShadow: 'var(--shadow-card)',
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                  >
                    {meta.icon}
                  </span>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {displayTitle}
                  </h3>
                </div>
                {/* Body */}
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                  {row.body}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Typed section content renderers ─── */
function renderContent(section) {
  const c = section?.content && typeof section.content === 'object' ? section.content : {};
  switch (section?.type) {
    case 'text':
      return <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{typeof c.body === 'string' ? c.body : JSON.stringify(c)}</p>;
    case 'code':
      return (
        <pre className="overflow-x-auto text-xs p-4 rounded-xl font-mono" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
          <code>{typeof c.snippet === 'string' ? c.snippet : JSON.stringify(c, null, 2)}</code>
        </pre>
      );
    case 'image':
      return (
        <figure className="space-y-2">
          {c.url && <img src={c.url} alt={c.caption || section.title || 'Screenshot'} className="w-full rounded-xl object-cover" style={{ maxHeight: 400 }} />}
          {c.caption && <figcaption className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{c.caption}</figcaption>}
        </figure>
      );
    case 'metrics': {
      const items = Array.isArray(c.items) ? c.items : [];
      return items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map((m, i) => (
            <div key={i} className="text-center p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <p className="text-2xl font-bold font-mono" style={{ color: 'var(--accent)' }}>{m?.value ?? '—'}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>{m?.label ?? ''}</p>
            </div>
          ))}
        </div>
      ) : null;
    }
    case 'gallery': {
      const images = Array.isArray(c.images) ? c.images : [];
      return images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, i) => <img key={i} src={typeof img === 'string' ? img : img?.url} alt={typeof img === 'object' ? img?.caption : `Gallery ${i + 1}`} className="w-full aspect-video rounded-xl object-cover" />)}
        </div>
      ) : null;
    }
    default:
      return <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{typeof c.body === 'string' ? c.body : Object.values(c).filter((v) => typeof v === 'string').join('\n') || JSON.stringify(c)}</p>;
  }
}

const SECTION_ICONS = { overview: '◎', architecture: '▣', 'api design': '◆', 'api-design': '◆', 'database design': '▥', 'database-design': '▥', security: '◇', challenges: '▦', text: '◎', code: '⌥', image: '▣', metrics: '◈' };

function parseTechs(t) {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t === 'string') return t.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }); } catch { return d; }
}

function formatViews(count) {
  if (!count || count < 10) return null;
  if (count < 50)  return '10+ views';
  return `${Math.floor(count / 50) * 50}+ people viewed this`;
}

/* Link button component for project CTAs */
function ProjectLink({ href, icon, label, primary }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold no-underline transition-all"
      style={primary ? {
        backgroundColor: 'var(--accent)',
        color: '#fff',
        boxShadow: '0 0 24px var(--accent-glow)',
      } : {
        backgroundColor: 'var(--bg-subtle)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {icon}
      {label}
      <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

export default function ProjectDetail() {
  const { slug } = useParams();

  const { data: project, loading: lp, error: ep } = useSupabaseQuery(() => fetchProjectBySlug(slug), [slug]);
  const { data: sections, loading: ls } = useSupabaseQuery(
    () => project?.id ? fetchProjectSections(project.id) : Promise.resolve([]), [project?.id]
  );
  const { data: metrics } = useSupabaseQuery(
    () => project?.id ? fetchProjectMetrics(project.id).catch(() => []) : Promise.resolve([]),
    [project?.id]
  );
  const { data: storytelling } = useSupabaseQuery(
    () => project?.id ? fetchProjectStorytelling(project.id).catch(() => []) : Promise.resolve([]),
    [project?.id]
  );

  /* ── Fire project_view event once per project load ── */
  useEffect(() => {
    if (project?.id) {
      trackEvent('project_view', { project_id: project.id });
    }
  }, [project?.id]); // fires once per project per session load

  if (lp) return <PageWrapper><Section><Container><SkeletonSection lines={6} /></Container></Section></PageWrapper>;
  if (ep) return <PageWrapper><Section><Container><ErrorState message={ep} /></Container></Section></PageWrapper>;
  if (!project) return <PageWrapper><Section><Container><EmptyState title="Project not found" /></Container></Section></PageWrapper>;

  const techs       = parseTechs(project.tech_stack);
  const tags        = Array.isArray(project.tags) ? project.tags : [];
  const metricList  = Array.isArray(metrics) ? metrics : [];
  const sectionList = Array.isArray(sections) ? sections : [];
  const isPopular   = project.meta?.is_popular === true || project.meta?.is_popular === 'true';
  const isFeatured  = project.featured === true;
  const viewLabel   = formatViews(project.view_count);
  const startDate   = fmtDate(project.start_date);
  const endDate     = project.end_date ? fmtDate(project.end_date) : 'Present';
  const hasDates    = startDate || endDate;

  return (
    <PageWrapper>
      <Section>
        <Container>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 mb-6 text-xs" style={{ color: 'var(--text-muted)' }} aria-label="Breadcrumb">
            <Link to="/projects" className="no-underline transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.target.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={(e) => { e.target.style.color = 'var(--text-muted)'; }}
            >
              Projects
            </Link>
            <span>/</span>
            <span className="truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{project.title || 'Untitled'}</span>
          </nav>

          {/* Cover image hero */}
          {project.cover_image_url && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 rounded-2xl overflow-hidden"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <img
                src={project.cover_image_url}
                alt={project.title}
                className="w-full object-cover"
                style={{ maxHeight: '320px' }}
              />
            </motion.div>
          )}

          {/* ── Two-column header layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">

            {/* Left: title + meta */}
            <div className="lg:col-span-2">
              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {project.status && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent-glow2)', color: 'var(--accent)' }}
                  >
                    {project.status}
                  </span>
                )}
                {isPopular && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                    🔥 Most Popular
                  </span>
                )}
                {isFeatured && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    ⭐ Featured
                  </span>
                )}
                {viewLabel && (
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    👁 {viewLabel}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                {project.title || 'Untitled Project'}
              </h1>

              {project.tagline && (
                <p className="text-base font-medium mb-3" style={{ color: 'var(--accent)' }}>
                  {project.tagline}
                </p>
              )}

              {project.description && (
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {project.description}
                </p>
              )}

              {/* Tech stack + tags */}
              {techs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {techs.map((t) => <Badge key={t} color="var(--accent)">{t}</Badge>)}
                </div>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: sidebar info card */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl p-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}>

                {/* CTA links */}
                <div className="flex flex-col gap-2">
                  <ProjectLink
                    href={project.demo_url}
                    label="Live Demo"
                    primary
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    }
                  />
                  <ProjectLink
                    href={project.repo_url}
                    label="Source Code"
                    icon={
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    }
                  />
                  <ProjectLink
                    href={project.case_study_url}
                    label="Case Study"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    }
                  />
                </div>

                {/* Divider */}
                {(hasDates || project.view_count > 0) && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    {hasDates && (
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {startDate}{startDate && ' — '}{endDate}
                        </span>
                      </div>
                    )}
                    {project.view_count > 0 && (
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {project.view_count.toLocaleString()} views
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Engineering Metrics ── */}
          {metricList.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Engineering Metrics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {metricList.map((m, i) => (
                  <div key={i} className="text-center p-5 rounded-2xl" style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}>
                    <p className="text-2xl font-bold font-mono" style={{ color: 'var(--accent)' }}>{m?.value ?? '—'}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>{m?.label ?? ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Content Sections ── */}
          {ls ? (
            <div className="space-y-4">
              <SkeletonSection lines={5} />
              <SkeletonSection lines={3} />
            </div>
          ) : sectionList.length > 0 ? (
            <div className="space-y-4">
              {sectionList.map((s, i) => {
                const iconKey = (s?.type || s?.title || '').toLowerCase();
                return (
                  <motion.div key={s?.id ?? i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                    <Card className="p-5 sm:p-6" hover={false}>
                      {s?.title && (
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-sm" style={{ color: 'var(--accent)' }}>{SECTION_ICONS[iconKey] ?? '◈'}</span>
                          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</h2>
                          {s?.type && s.type !== 'text' && (
                            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                              {s.type}
                            </span>
                          )}
                        </div>
                      )}
                      {renderContent(s)}
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No sections" description="Add project sections via Supabase." />
          )}

          {/* ── Storytelling / Case Study sections ── */}
          <StorytellingSection rows={storytelling} />

          {/* ── Footer actions ── */}
          <div className="flex flex-wrap items-center gap-3 mt-10">
            <Button as={Link} to="/projects" variant="ghost" size="sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              All Projects
            </Button>
            {project.repo_url && (
              <Button
                as="a"
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="sm"
                onClick={() => trackEvent('github_click', { project_id: project.id })}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Source Code
              </Button>
            )}
            {project.demo_url && (
              <Button
                as="a"
                href={project.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                onClick={() => trackEvent('demo_click', { project_id: project.id })}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Live Demo
              </Button>
            )}
          </div>
        </Container>
      </Section>
    </PageWrapper>
  );
}
