import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { StatusBadge } from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { SkeletonGrid } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchProjects } from '../services/api';
import { formatViews } from '../utils/format';
import { useSiteContent } from '../hooks/useSiteContent';

function parseTechs(t) {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  if (typeof t === 'string') return t.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

export default function Projects() {
  const { data: projects, loading, error, refetch } = useSupabaseQuery(fetchProjects);
  const { val } = useSiteContent();

  const title = val('projects.title', 'Engineering Portfolio');
  const description = val('projects.description',
    'Systems built with architecture-first thinking — depth in design, security, and scalability.');

  if (loading) return (
    <PageWrapper><Section><Container>
      <SectionHeader label="Projects" title={title} />
      <SkeletonGrid count={4} cols={2} />
    </Container></Section></PageWrapper>
  );
  if (error) return (
    <PageWrapper><Section><Container>
      <ErrorState message={error} onRetry={refetch} />
    </Container></Section></PageWrapper>
  );

  const list = Array.isArray(projects) ? projects : [];

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader label="Projects" title={title} description={description} />

          {list.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {list.map((p, i) => {
                const techs = parseTechs(p?.tech_stack);
                const isPopular = p?.meta?.is_popular === true || p?.meta?.is_popular === 'true';
                const isFeatured = p?.featured === true;
                const viewLabel = formatViews(p?.view_count);
                const metrics = Array.isArray(p?.metrics_preview) ? p.metrics_preview : [];

                return (
                  <motion.div
                    key={p?.id ?? i}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={{ y: -2 }}
                  >
                    <Card
                      glow
                      className="group relative flex flex-col p-5 sm:p-6 h-full"
                    >
                      {/* Cover image (if present) */}
                      {p?.cover_image_url && (
                        <div className="mb-4 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 overflow-hidden rounded-t-2xl">
                          <img
                            src={p.cover_image_url}
                            alt={p.title}
                            className="w-full h-36 object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                      )}

                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3
                              className="text-base font-semibold transition-colors truncate group-hover:text-[var(--accent-hover)]"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {/* Stretched link: the only card-level anchor. The
                                  ::after overlay makes the whole card clickable
                                  without nesting anchors inside it. */}
                              <Link
                                to={`/projects/${p?.slug ?? i}`}
                                className="no-underline after:absolute after:inset-0 after:content-['']"
                                style={{ color: 'inherit' }}
                              >
                                {p?.title || 'Untitled'}
                              </Link>
                            </h3>
                            {/* 🔥 Most Popular badge */}
                            {isPopular && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                              >
                                🔥 Popular
                              </span>
                            )}
                            {/* ⭐ Featured badge */}
                            {isFeatured && !isPopular && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                                style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                              >
                                ⭐ Featured
                              </span>
                            )}
                          </div>
                          <StatusBadge status={p?.status} />
                        </div>
                        <svg
                          className="w-4 h-4 shrink-0 mt-0.5 transition-colors group-hover:text-[var(--accent)]"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>

                      {/* Tagline or description */}
                      <p
                        className="text-sm leading-relaxed line-clamp-2 flex-1 mb-4"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {p?.tagline || p?.description || 'No description available.'}
                      </p>

                      {/* Tech stack */}
                      {techs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {techs.slice(0, 5).map((t) => <Badge key={t}>{t}</Badge>)}
                          {techs.length > 5 && <Badge>+{techs.length - 5}</Badge>}
                        </div>
                      )}

                      {/* Bottom row: view count + URL links */}
                      <div
                        className="flex items-center justify-between gap-3 pt-3"
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        {/* View count social proof */}
                        {viewLabel ? (
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            👁 {viewLabel}
                          </span>
                        ) : <span />}

                        {/* Quick links sit above the stretched-link overlay. */}
                        <div className="flex items-center gap-2 relative z-[1]">
                          {p?.demo_url && (
                            <a
                              href={p.demo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg no-underline transition-colors"
                              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--accent)' }}
                            >
                              Demo ↗
                            </a>
                          )}
                          {p?.repo_url && (
                            <a
                              href={p.repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg no-underline transition-colors"
                              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                            >
                              Repo ↗
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Metrics strip */}
                      {metrics.length > 0 && (
                        <div className="flex items-center gap-6 pt-3 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
                          {metrics.map((m, mi) => (
                            <div key={mi} className="text-center">
                              <div className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>{m?.value ?? '—'}</div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{m?.label ?? ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="📂" title="No projects yet" description="Add projects via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
