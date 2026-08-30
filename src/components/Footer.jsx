import { Link } from 'react-router-dom';
import { useSiteContent } from '../hooks/useSiteContent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getVal(content, key, fallback = '') {
  if (!Array.isArray(content)) return fallback;
  return content.find((c) => c?.key === key)?.value ?? fallback;
}

function getJson(content, key, fallback = null) {
  if (!Array.isArray(content)) return fallback;
  const row = content.find((c) => c?.key === key);
  return row?.value_json ?? fallback;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Footer() {
  const { content } = useSiteContent();

  // Brand
  const brandInitial = getVal(content, 'footer.brand_initial', 'K');
  const name         = getVal(content, 'footer.name',          'Kamal Kalyan');
  const tagline      = getVal(content, 'footer.tagline',       'System design · Security · Engineering depth');

  // Navigate section
  const navTitle     = getVal(content, 'footer.nav_title', 'Navigate');
  const navJson      = getJson(content, 'footer.nav_links', null);
  const navLinks     = Array.isArray(navJson?.links) ? navJson.links : [];

  // Quick access section
  const qaTitle      = getVal(content, 'footer.quick_access_title', 'Quick Access');
  const qaJson       = getJson(content, 'footer.quick_access', null);
  // Parse "Ctrl + K" style shortcut into individual key tokens
  const qaShortcut   = qaJson?.shortcut ?? 'Ctrl + K';
  const qaLabel      = qaJson?.label    ?? 'Command Palette';
  const shortcutKeys = qaShortcut.split('+').map((k) => k.trim());

  // Backend-driven note
  const noteJson     = getJson(content, 'footer.backend_note', null);
  const noteTitle    = noteJson?.title       ?? '100% backend-driven.';
  const noteDesc     = noteJson?.description ?? '';

  // Bottom bar
  const copyright    = getVal(content, 'footer.copyright', `© ${name} — All rights reserved.`);
  const techStack    = getVal(content, 'footer.tech_stack', 'React · Supabase');

  return (
    <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Main row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                {brandInitial}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {name}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {tagline}
            </p>
          </div>

          {/* Nav links — two columns in one cell */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
              {navTitle}
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {navLinks.map((link) => (
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
              {qaTitle}
            </p>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {shortcutKeys.map((key, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span>+</span>}
                  <kbd
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                    style={{ backgroundColor: 'var(--bg-subtle)', boxShadow: 'var(--shadow-card)' }}
                  >
                    {key}
                  </kbd>
                </span>
              ))}
              <span>{qaLabel}</span>
            </div>
          </div>
        </div>

        {/* Backend-driven note */}
        {(noteTitle || noteDesc) && (
          <div
            className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
            style={{ backgroundColor: 'var(--bg-subtle)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
          >
            <span className="text-sm shrink-0 mt-px">⚙️</span>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {noteTitle && (
                <strong style={{ color: 'var(--text-secondary)' }}>{noteTitle}{' '}</strong>
              )}
              {noteDesc}
            </p>
          </div>
        )}

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 text-[11px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>{copyright}</span>
          <span>{techStack}</span>
        </div>

      </div>
    </footer>
  );
}
