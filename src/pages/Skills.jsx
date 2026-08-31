import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import { SkeletonGrid } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchSkills } from '../services/api';
import { useSiteContent } from '../hooks/useSiteContent';

/* ── Category colour map ───────────────────────────────────────── */
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

/* ── Skill tag visual ──────────────────────────────────────────── */
/**
 * Each skill is shown as a styled pill/tag with:
 * - A tinted coloured dot indicator
 * - Name text
 * - Optional level label (derived from proficiency if present, otherwise hidden)
 * No raw percentages are shown anywhere.
 */
const LEVEL_LABELS = [
  { min: 90, label: 'Expert',        dot: 3 },
  { min: 75, label: 'Advanced',      dot: 2 },
  { min: 50, label: 'Intermediate',  dot: 2 },
  { min: 0,  label: 'Familiar',      dot: 1 },
];

function getLevel(proficiency) {
  if (proficiency == null) return null;
  return LEVEL_LABELS.find((l) => proficiency >= l.min) ?? LEVEL_LABELS[LEVEL_LABELS.length - 1];
}

function SkillTag({ skill, color }) {
  const level = getLevel(skill?.proficiency);
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, scale: 0.88 }, show: { opacity: 1, scale: 1 } }}
      className="group flex items-center gap-2 px-3 py-2 rounded-xl cursor-default select-none transition-all"
      style={{
        backgroundColor: `${color}10`,
        border: `1px solid ${color}28`,
      }}
      whileHover={{
        backgroundColor: `${color}1e`,
        borderColor: `${color}55`,
        scale: 1.03,
      }}
      transition={{ duration: 0.15 }}
    >
      {/* Animated dot — size reflects level */}
      <span
        className="shrink-0 rounded-full transition-all duration-300 group-hover:scale-125"
        style={{
          width: level?.dot === 3 ? '7px' : level?.dot === 2 ? '6px' : '5px',
          height: level?.dot === 3 ? '7px' : level?.dot === 2 ? '6px' : '5px',
          backgroundColor: color,
          boxShadow: `0 0 ${level?.dot === 3 ? '6px' : '4px'} ${color}80`,
        }}
      />
      <span
        className="text-xs font-medium leading-none"
        style={{ color: 'var(--text-primary)' }}
      >
        {skill?.name || 'Skill'}
      </span>
      {/* Level label shown only if proficiency data is available */}
      {level && (
        <span
          className="ml-auto pl-2 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color }}
        >
          {level.label}
        </span>
      )}
    </motion.div>
  );
}

/* ── Category Card ─────────────────────────────────────────────── */
function CategoryCard({ category, skills, color, icon, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl p-5 flex flex-col gap-4 h-full transition-all duration-200"
      style={{
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-card)',
      }}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-hover)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {icon}
        </span>
        <h3
          className="text-sm font-semibold capitalize flex-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {category}
        </h3>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
        >
          {skills.length}
        </span>
      </div>

      {/* Skill tags — staggered animation */}
      <motion.div
        className="flex flex-col gap-2"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: index * 0.06 + 0.15 } } }}
      >
        {skills.map((skill, i) => (
          <SkillTag key={skill?.id ?? i} skill={skill} color={color} />
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function Skills() {
  const { val } = useSiteContent();
  const title = val('skills.title', 'Technical Arsenal');
  const description = val('skills.description',
    'Technologies, frameworks, and tools across the full stack.');
  const { data: skills, loading, error, refetch } = useSupabaseQuery(fetchSkills);
  const [activeFilter, setActiveFilter] = useState('All');

  if (loading) return (
    <PageWrapper><Section><Container>
      <SectionHeader label="Skills" title={title} />
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
          <SectionHeader label="Skills" title={title} description={description} />

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
