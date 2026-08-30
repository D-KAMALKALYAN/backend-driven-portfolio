import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CommandPalette from './components/CommandPalette';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonSection } from './components/SkeletonLoader';
import { useCommandPalette } from './hooks/useCommandPalette';
import { ThemeProvider } from './hooks/useTheme';
import { usePageTracking } from './hooks/usePageTracking';
import { useDocumentMeta } from './hooks/useDocumentMeta';

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const About = lazy(() => import('./pages/About'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Profiles = lazy(() => import('./pages/Profiles'));
const Skills = lazy(() => import('./pages/Skills'));
const Experience = lazy(() => import('./pages/Experience'));
const Contact = lazy(() => import('./pages/Contact'));
const Resume = lazy(() => import('./pages/Resume'));
const Analytics = lazy(() => import('./pages/Analytics'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <SkeletonSection lines={5} />
    </div>
  );
}

function AppContent() {
  usePageTracking();  // fires page_view on genuine route changes
  useDocumentMeta();  // per-route <title> and meta, driven by site_content

  const location = useLocation();

  const {
    isOpen,
    query,
    setQuery,
    filteredCommands,
    executeCommand,
    open,
    close,
  } = useCommandPalette();

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Keyboard users can reach content without traversing 8 nav links. */}
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-[100] px-4 py-2 rounded-[var(--r-md)] text-sm font-medium
                   -translate-y-24 focus:translate-y-0 transition-transform no-underline"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
      >
        Skip to content
      </a>

      <Navbar onCommandPaletteOpen={open} />

      <CommandPalette
        isOpen={isOpen}
        query={query}
        setQuery={setQuery}
        filteredCommands={filteredCommands}
        executeCommand={executeCommand}
        close={close}
      />

      <main id="main-content" className="flex-1">
        {/* Keyed on pathname so navigating away from a crashed page recovers. */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<About />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:slug" element={<ProjectDetail />} />
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/experience" element={<Experience />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/resume" element={<Resume />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* reducedMotion="user" makes every motion component respect the OS
          setting, which nothing previously did. */}
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
