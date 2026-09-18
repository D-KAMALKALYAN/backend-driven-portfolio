'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Cog, Database, FlaskConical, Layers, Lock, MessageSquare, Monitor, Package, Rocket, Wrench, type LucideIcon,
} from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import { useSiteContent } from '../hooks/useSiteContent';
import { enterAt } from '../utils/enter';
import { hue, hueStyle, type Hue } from '../lib/palette';
import type { Skill } from '../types/rows';

/* ── Category → hue + glyph ────────────────────────────────────── */
const CATEGORY: Record<string, { hue: Hue; icon: LucideIcon }> = {
  frontend:  { hue: 'blue',   icon: Monitor },
  backend:   { hue: 'green',  icon: Cog },
  database:  { hue: 'amber',  icon: Database },
  devops:    { hue: 'violet', icon: Rocket },
  security:  { hue: 'red',    icon: Lock },
  tools:     { hue: 'indigo', icon: Wrench },
  tool:      { hue: 'indigo', icon: Wrench },
  language:  { hue: 'pink',   icon: MessageSquare },
  framework: { hue: 'teal',   icon: Package },
  platform:  { hue: 'teal',   icon: Cloud },
  cloud:     { hue: 'cyan',   icon: Cloud },
  testing:   { hue: 'orange', icon: FlaskConical },
  other:     { hue: 'slate',  icon: Layers },
};
const OTHER = CATEGORY.other!;

/** Exact key first, then a category that contains a known word ("Backend Frameworks" → framework). */
function catMeta(cat: string | null | undefined): { hue: Hue; icon: LucideIcon } {
  if (!cat) return OTHER;
  const k = cat.toLowerCase();
  return CATEGORY[k] ?? Object.entries(CATEGORY).find(([key]) => k.includes(key))?.[1] ?? OTHER;
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

function getLevel(proficiency: number | null | undefined) {
  if (proficiency == null) return null;
  return LEVEL_LABELS.find((l) => proficiency >= l.min) ?? LEVEL_LABELS[LEVEL_LABELS.length - 1] ?? null;
}

function SkillTag({ skill, hue: h, delayMs }: { skill: Skill; hue: Hue; delayMs: number }) {
  const level = getLevel(skill?.proficiency);
  // The tag's tints (rest and hover) live in .hue-tag; motion only scales.
  return (
    <motion.div
      className="enter group flex items-center gap-2 px-3 py-2 rounded-xl cursor-default select-none transition-colors duration-150 hue-tag"
      style={hueStyle(h, enterAt(delayMs))}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.15 }}
    >
      {/* Dot — size and glow reflect level */}
      <span
        className="shrink-0 rounded-full transition-all duration-300 group-hover:scale-125 hue-dot"
        style={{
          width: level?.dot === 3 ? '7px' : level?.dot === 2 ? '6px' : '5px',
          height: level?.dot === 3 ? '7px' : level?.dot === 2 ? '6px' : '5px',
          ['--dot-glow' as string]: level?.dot === 3 ? '6px' : '4px',
        }}
      />
      <span
        className="text-xs font-medium leading-none text-primary"
      >
        {skill?.name || 'Skill'}
      </span>
      {/* Level label shown only if proficiency data is available */}
      {level && (
        <span className="ml-auto pl-2 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200 hue-text">
          {level.label}
        </span>
      )}
    </motion.div>
  );
}

/* ── Category Card ─────────────────────────────────────────────── */
interface CategoryCardProps {
  category: string;
  skills: Skill[];
  hue: Hue;
  icon: LucideIcon;
  index: number;
}

function CategoryCard({ category, skills, hue: h, icon: Glyph, index }: CategoryCardProps) {
  return (
    <motion.div
      className="enter rounded-2xl p-5 flex flex-col gap-4 h-full transition-all duration-200"
      style={{
        ...enterAt(index * 60),
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-card)',
      }}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-hover)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 hue-chip"
          style={hueStyle(h)}
        >
          <Glyph size={16} aria-hidden />
        </span>
        <h3
          className="text-sm font-semibold capitalize flex-1 text-primary"
        >
          {category}
        </h3>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-subtle text-muted"
        >
          {skills.length}
        </span>
      </div>

      {/* Skill tags — staggered by CSS delay */}
      <div className="flex flex-col gap-2">
        {skills.map((skill, i) => (
          <SkillTag key={skill.id} skill={skill} hue={h} delayMs={index * 60 + 150 + i * 50} />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function Skills({ skills }: { skills: Skill[] }) {
  const { val } = useSiteContent();
  const title = val('skills.title', 'Technical Arsenal');
  const description = val('skills.description',
    'Technologies, frameworks, and tools across the full stack.');
  const [activeFilter, setActiveFilter] = useState('All');

  const skillList = Array.isArray(skills) ? skills : [];
  const grouped   = skillList.reduce<Record<string, Skill[]>>((acc, s) => {
    if (!s) return acc;
    const cat = s.category || 'Other';
    (acc[cat] ??= []).push(s);
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
              className="flex items-center gap-4 px-4 py-2 rounded-xl text-xs font-mono bg-card shadow-card"
            >
              <span className="text-muted">
                Total:{' '}
                <strong className="text-accent">{totalCount}</strong>
              </span>
              <span className="text-line">|</span>
              <span className="text-muted">
                Categories:{' '}
                <strong className="text-accent">{Object.keys(grouped).length}</strong>
              </span>
            </div>
          </div>

          {/* Category filter pills */}
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((cat) => {
                const isActive = cat === activeFilter;
                const color    = cat === 'All' ? 'var(--accent)' : hue(catMeta(cat).hue);
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all border-none cursor-pointer"
                    style={{
                      backgroundColor: isActive ? color : 'var(--bg-card)',
                      color:           isActive ? 'var(--on-accent)' : 'var(--text-secondary)',
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
            <AnimatePresence mode="wait" initial={false}>
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
                    hue={catMeta(cat).hue}
                    icon={catMeta(cat).icon}
                    index={i}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          ) : (
            <EmptyState icon={<Wrench size={24} aria-hidden />} title="No skills listed" description="Add skills via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
