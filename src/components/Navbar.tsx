'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavLinks } from '../hooks/useNavLinks';
import { useTheme } from '../hooks/useTheme';
import Button from './Button';

export default function Navbar({ onCommandPaletteOpen }: { onCommandPaletteOpen: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const pathname                    = usePathname() ?? '/';
  const { theme, toggleTheme }      = useTheme();
  const { primary, secondary, cta } = useNavLinks();

  // Close the mobile menu on navigation. This is a genuine
  // synchronise-to-external-change, not a cascading render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 glass border-b transition-all duration-200 ${
        scrolled ? 'border-line shadow-bar' : 'border-transparent'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Inner container matches page layout exactly ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo ── left side */}
          <Link
            href="/"
            className="flex items-center gap-3 no-underline shrink-0"
          >
            <span className="w-8 h-8 rounded-[var(--r-md)] bg-accent flex items-center justify-center text-on-accent font-bold shadow-sm">
              K
            </span>
            <span className="font-semibold text-primary tracking-tight">
              Kamal Kalyan
            </span>
          </Link>

          {/* Desktop nav links ── centred. Five at most; the rest are one level down. */}
          <div className="hidden lg:flex items-center gap-1">
            {primary.map((link) => {
              const active = link.path === '/'
                ? pathname === '/'
                : pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`relative px-3 py-2 rounded-[var(--r-md)] font-medium no-underline transition-colors duration-150 ${
                    active
                      ? 'text-accent-hover'
                      : 'text-secondary hover:text-primary hover:bg-subtle'
                  }`}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="nav-line"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* The one action a recruiter came for, one click from every page. */}
            <div className="hidden md:block">
              <Button as={Link} href={cta.path} size="sm">
                {cta.label}
              </Button>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-[var(--r-md)] text-secondary hover:bg-subtle hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
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

            {/* Search / Command Palette - the field in the header is the palette's front door (ADR-052) */}
            <button
              onClick={onCommandPaletteOpen}
              className="hidden sm:flex items-center gap-2 pl-3 pr-1.5 py-1.5 md:min-w-44 rounded-[var(--r-md)] border border-line text-muted hover:border-line-hover hover:text-secondary transition-colors cursor-pointer bg-transparent text-left"
              aria-label="Search or ask a question"
              aria-keyshortcuts="Control+K Meta+K /"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden md:inline flex-1 text-sm">Search or ask…</span>
              <kbd className="px-1.5 py-0.5 rounded bg-subtle text-[10px] font-mono">⌘K</kbd>
            </button>
            <button
              onClick={onCommandPaletteOpen}
              className="sm:hidden p-2 rounded-[var(--r-md)] text-secondary hover:bg-subtle hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
              aria-label="Search or ask a question"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-[var(--r-md)] text-secondary hover:bg-subtle cursor-pointer bg-transparent border-none"
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
            className="lg:hidden border-t border-line overflow-hidden bg-surface"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-0.5 max-h-[75vh] overflow-y-auto">
              {[...primary, ...secondary].map((link, i) => {
                const active = link.path === '/' ? pathname === '/' : pathname.startsWith(link.path);
                const firstSecondary = i === primary.length && secondary.length > 0;
                return (
                  <div key={link.path}>
                    {firstSecondary && (
                      <div className="mt-2 mb-1 border-t border-line pt-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                        More
                      </div>
                    )}
                    <Link
                      href={link.path}
                      className={`flex items-center px-3 py-2.5 rounded-[var(--r-md)] font-medium no-underline transition-colors ${
                        active
                          ? 'bg-accent-glow text-accent-hover'
                          : 'text-secondary hover:text-primary hover:bg-subtle'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </div>
                );
              })}
              <button
                onClick={() => { setMobileOpen(false); onCommandPaletteOpen(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-md)] text-muted hover:bg-subtle cursor-pointer bg-transparent border-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search or ask…
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
