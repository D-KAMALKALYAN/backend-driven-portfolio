import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { SkeletonGrid } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchSkills } from '../services/api';

/* Category → accent colour */
const COLORS = {
  frontend:  '#3b82f6',
  backend:   '#22c55e',
  database:  '#f59e0b',
  devops:    '#8b5cf6',
  security:  '#ef4444',
  tools:     '#6366f1',
  tool:      '#6366f1',
  language:  '#ec4899',
  framework: '#14b8a6',
  platform:  '#14b8a6',
  cloud:     '#06b6d4',
  testing:   '#fb923c',
  other:     '#9898b0',
};

const CATEGORY_ICONS = {
  frontend:  '🖥',
  backend:   '⚙️',
  database:  '🗄',
  devops:    '🚀',
  security:  '🔒',
  tools:     '🛠',
  tool:      '🛠',
  language:  '💬',
  framework: '📦',
  platform:  '☁️',
  cloud:     '☁️',
  testing:   '🧪',
  other:     '◈',
};

function catColor(cat) {
  if (!cat) return '#9898b0';
  const k = cat.toLowerCase();
  return COLORS[k] ?? Object.entries(COLORS).find(([key]) => k.includes(key))?.[1] ?? '#9898b0';
}

function catIcon(cat) {
  if (!cat) return '◈';
  const k = cat.toLowerCase();
  return CATEGORY_ICONS[k] ?? Object.entries(CATEGORY_ICONS).find(([key]) => k.includes(key))?.[1] ?? '◈';
}

function CategoryCard({ category, skills, color, icon, index }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '1rem',
        backgroundColor: 'var(--bg-card)',
        boxShadow: hovered ? 'var(--shadow-hover)' : 'var(--shadow-card)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {/* Icon bubble */}
        <span
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '0.5rem',
            backgroundColor: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>

        <h3 style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600 }} className="capitalize">
          {category}
        </h3>

        {/* Count */}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-subtle)',
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
          }}
        >
          {skills.length}
        </span>
      </div>

      {/* Skill progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {skills.map((skill, i) => {
          const proficiency = skill?.proficiency ?? 75; // default if not set
          return (
            <div key={skill?.id ?? i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{skill?.name || 'Skill'}</span>
                {skill?.proficiency != null && (
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {skill.proficiency}%
                  </span>
                )}
              </div>
              {skill?.proficiency != null && (
                <div style={{ height: '3px', backgroundColor: 'var(--bg-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(Math.max(proficiency, 0), 100)}%` }}
                    transition={{ delay: index * 0.06 + i * 0.04 + 0.3, duration: 0.6, ease: 'easeOut' }}
                    style={{ height: '100%', backgroundColor: color, borderRadius: '999px' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tags row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '-0.25rem' }}>
        {skills.map((skill, i) => (
          skill?.proficiency == null && (
            <Badge key={skill?.id ?? i} color={color}>
              {skill?.name || 'Skill'}
            </Badge>
          )
        ))}
      </div>
    </motion.div>
  );
}

export default function Skills() {
  const { data: skills, loading, error, refetch } = useSupabaseQuery(fetchSkills);
  const [activeFilter, setActiveFilter] = useState('All');

  if (loading) return (
    <PageWrapper><Section><Container>
      <SectionHeader label="Skills" title="Technical Arsenal" />
      <SkeletonGrid count={6} cols={3} />
    </Container></Section></PageWrapper>
  );
  if (error) return (
    <PageWrapper><Section><Container>
      <ErrorState message={error} onRetry={refetch} />
    </Container></Section></PageWrapper>
  );

  const skillList = Array.isArray(skills) ? skills : [];
  const grouped   = skillList.reduce((acc, s) => {
    if (!s) return acc;
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const categories = ['All', ...Object.keys(grouped)];
  const entries    = Object.entries(grouped).filter(([cat]) => activeFilter === 'All' || cat === activeFilter);
  const totalCount = skillList.length;

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="Skills"
            title="Technical Arsenal"
            description="Technologies, frameworks, and tools across the full stack."
          />

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div
              className="flex items-center gap-4 px-4 py-2 rounded-xl text-xs font-mono"
              style={{ backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
            >
              <span style={{ color: 'var(--text-muted)' }}>
                Total:{' '}
                <strong style={{ color: 'var(--accent)' }}>{totalCount}</strong>
              </span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span style={{ color: 'var(--text-muted)' }}>
                Categories:{' '}
                <strong style={{ color: 'var(--accent)' }}>{Object.keys(grouped).length}</strong>
              </span>
            </div>
          </div>

          {/* Category filter pills */}
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((cat) => {
                const isActive = cat === activeFilter;
                const color    = cat === 'All' ? 'var(--accent)' : catColor(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all border-none cursor-pointer"
                    style={{
                      backgroundColor: isActive ? color : 'var(--bg-card)',
                      color:           isActive ? '#fff' : 'var(--text-secondary)',
                      boxShadow:       'var(--shadow-card)',
                      transform:       isActive ? 'none' : 'none',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {entries.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFilter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {entries.map(([cat, catSkills], i) => (
                  <CategoryCard
                    key={cat}
                    category={cat}
                    skills={catSkills}
                    color={catColor(cat)}
                    icon={catIcon(cat)}
                    index={i}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          ) : (
            <EmptyState icon="🛠" title="No skills listed" description="Add skills via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
