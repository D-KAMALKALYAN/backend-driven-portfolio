import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CommandPalette from './components/CommandPalette';
import { SkeletonSection } from './components/SkeletonLoader';
import { useCommandPalette } from './hooks/useCommandPalette';
import { ThemeProvider } from './hooks/useTheme';
import { usePageTracking } from './hooks/usePageTracking';

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const About = lazy(() => import('./pages/About'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Profiles = lazy(() => import('./pages/Profiles'));
const Skills = lazy(() => import('./pages/Skills'));
const Experience = lazy(() => import('./pages/Experience'));
const Contact = lazy(() => import('./pages/Contact'));
const Resume     = lazy(() => import('./pages/Resume'));
const Analytics  = lazy(() => import('./pages/Analytics'));

function PageFallback() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <SkeletonSection lines={5} />
    </div>
  );
}

function AppContent() {
  usePageTracking(); // auto fires page_view on every route change

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
      <Navbar onCommandPaletteOpen={open} />

      <CommandPalette
        isOpen={isOpen}
        query={query}
        setQuery={setQuery}
        filteredCommands={filteredCommands}
        executeCommand={executeCommand}
        close={close}
      />

      <div className="flex-1">
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
            <Route path="/resume"     element={<Resume />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </Suspense>
      </div>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </BrowserRouter>
  );
}
