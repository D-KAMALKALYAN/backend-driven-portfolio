import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import Button from '../components/Button';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchSiteContent } from '../services/api';
import { NAV_LINKS } from '../constants/routes';

const STATUS_ITEMS = [
  { label: 'System',   value: 'Online',  color: 'var(--success)' },
  { label: 'Uptime',   value: '99.9%',   color: 'var(--success)' },
  { label: 'Security', value: 'Active',  color: 'var(--accent)'  },
  { label: 'Latency',  value: '<100ms',  color: 'var(--info)'    },
];

const QUICK_NAV = NAV_LINKS.filter((l) => ['/about', '/projects', '/skills', '/experience'].includes(l.path));

const FEATURED_TAGS = ['Java', 'Spring Boot', 'React', 'Supabase', 'PostgreSQL', 'Docker'];

function getVal(content, key, fallback) {
  if (!Array.isArray(content)) return fallback;
  return content.find((c) => c?.key === key)?.value || fallback;
}

export default function Landing() {
  const { data: content } = useSupabaseQuery(fetchSiteContent);

  const name    = getVal(content, 'name',    'Kamal Kalyan');
  const role    = getVal(content, 'role',    'Full-Stack Engineer & System Designer');
  const tagline = getVal(content, 'tagline', 'Building systems that scale, stay secure, and stand the test of time.');

  return (
    <PageWrapper>
      <Section>
        <Container className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center">

          {/* Status bar */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="inline-flex flex-wrap items-center justify-center gap-4 mb-12 px-5 py-2.5 rounded-full"
            style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}
          >
            {STATUS_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: item.color }} />
                <span style={{ color: 'var(--text-muted)' }}>{item.label}:</span>
                <span className="font-mono font-semibold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </motion.div>

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
            className="w-full max-w-2xl mx-auto"
          >
            <h1 className="text-5xl sm:text-7xl font-extrabold leading-tight tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
              {name}
            </h1>

            {/* Monospace role */}
            <p className="text-lg sm:text-xl font-semibold font-mono mb-5" style={{ color: 'var(--accent)' }}>
              {role}
            </p>

            <p className="text-base leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {tagline}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
              <Button as={Link} to="/projects" size="lg">
                View Projects
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
              <Button as={Link} to="/contact" variant="secondary" size="lg">
                Get in Touch
              </Button>
            </div>

            {/* Tech tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-2 mb-12"
            >
              {FEATURED_TAGS.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-mono"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-muted)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Quick nav cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mx-auto"
          >
            {QUICK_NAV.map((link, i) => {
              const ICONS = {
                '/about':      '👤',
                '/projects':   '📂',
                '/skills':     '⚡',
                '/experience': '💼',
              };
              return (
                <motion.div key={link.path} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
                  <Link
                    to={link.path}
                    className="group flex flex-col items-center gap-1.5 p-4 rounded-2xl text-center no-underline block transition-all"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
                  >
                    <span className="text-lg">{ICONS[link.path] ?? '→'}</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {link.label}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Keyboard hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
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
