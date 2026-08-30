import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavLinks } from '../hooks/useNavLinks';
import { useTheme } from '../hooks/useTheme';

export default function Navbar({ onCommandPaletteOpen }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const location                    = useLocation();
  const { theme, toggleTheme }      = useTheme();
  const navLinks                    = useNavLinks();

  // Close the mobile menu on navigation. This is a genuine
  // synchronise-to-external-change, not a cascading render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 glass border-b transition-all duration-200 ${
        scrolled ? 'border-[var(--border)] shadow-[0_2px_12px_rgba(0,0,0,0.25)]' : 'border-transparent'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Inner container matches page layout exactly ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo ── left side */}
          <Link
            to="/"
            className="flex items-center gap-3 no-underline shrink-0"
          >
            <span className="w-8 h-8 rounded-[var(--r-md)] bg-[var(--accent)] flex items-center justify-center text-white t-sm font-bold shadow-sm">
              K
            </span>
            <span className="t-body font-semibold text-[var(--text-primary)] tracking-tight">
              Kamal Kalyan
            </span>
          </Link>

          {/* Desktop nav links ── centred */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = link.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-3 py-2 rounded-[var(--r-md)] t-sm font-medium no-underline transition-colors duration-150 ${
                    active
                      ? 'text-[var(--accent-hover)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="nav-line"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-[var(--r-md)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-transparent border-none"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Search / Command Palette */}
            <button
              onClick={onCommandPaletteOpen}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] t-caption text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer bg-transparent"
              aria-label="Open command palette"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden md:inline">Search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[10px] font-mono">⌘K</kbd>
            </button>

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-[var(--r-md)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer bg-transparent border-none"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-[var(--border)] overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-0.5 max-h-[75vh] overflow-y-auto">
              {navLinks.map((link) => {
                const active = link.path === '/' ? location.pathname === '/' : location.pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center px-3 py-2.5 rounded-[var(--r-md)] t-sm font-medium no-underline transition-colors ${
                      active
                        ? 'bg-[var(--accent-glow)] text-[var(--accent-hover)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <button
                onClick={() => { setMobileOpen(false); onCommandPaletteOpen(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-md)] t-sm text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer bg-transparent border-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Command Palette
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
