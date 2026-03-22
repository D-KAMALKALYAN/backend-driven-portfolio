import { Link } from 'react-router-dom';
import { NAV_LINKS } from '../constants/routes';

const LINKS_LEFT  = NAV_LINKS.filter((l) => ['/', '/about', '/projects', '/skills'].includes(l.path));
const LINKS_RIGHT = NAV_LINKS.filter((l) => ['/experience', '/profiles', '/contact', '/resume'].includes(l.path));

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Main row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold"
              >K</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Kamal Kalyan</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              System design · Security · Engineering depth
            </p>
          </div>

          {/* Nav links — two columns in one cell */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Navigate
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[...LINKS_LEFT, ...LINKS_RIGHT].map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-xs no-underline transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.target.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.target.style.color = 'var(--text-muted)'; }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Quick access */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Quick Access
            </p>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ backgroundColor: 'var(--bg-subtle)', boxShadow: 'var(--shadow-card)' }}>Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ backgroundColor: 'var(--bg-subtle)', boxShadow: 'var(--shadow-card)' }}>K</kbd>
              <span>Command Palette</span>
            </div>
          </div>
        </div>

        {/* Backend-driven note */}
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
          style={{ backgroundColor: 'var(--bg-subtle)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
        >
          <span className="text-sm shrink-0 mt-px">⚙️</span>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>100% backend-driven.</strong>{' '}
            Every piece of data — projects, skills, experience, profiles — lives in Supabase. The UI is a pure renderer; no content is hardcoded. Kamal intentionally built this so he never needs to touch the frontend to update his portfolio — just insert a row.
          </p>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 text-[11px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>© {year} Kamal Kalyan — All rights reserved.</span>
          <span>React · Supabase · Tailwind · Framer Motion</span>
        </div>
      </div>
    </footer>
  );
}
