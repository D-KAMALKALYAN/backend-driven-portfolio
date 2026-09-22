import { ROUTES, type RoutePath } from './routes';
import type { PaletteAction } from '../utils/palette';

export interface Command {
  id: string;
  label: string;
  /** What the visitor can type to find it; shown as the hint for an action. */
  shortcut: string;
  /** Where it goes; an action has none. */
  path?: RoutePath;
  /** What it does instead of navigating (ADR-052). */
  action?: PaletteAction;
  group: 'Tools' | 'Navigation';
  /** Same gate as the nav item: only offered when the content exists. */
  requires?: 'writing';
}

/**
 * Everything that exists in the product and is worth a row: the pages, and
 * the two actions a visitor takes without leaving one. Nothing is invented
 * for the palette - no "Create…", no "Summarize" outside Ask.
 */
export const COMMANDS: Command[] = [
  {
    id: 'action-toggle-theme',
    label: 'Toggle theme',
    shortcut: '> theme',
    action: 'toggle-theme',
    group: 'Tools',
  },
  {
    id: 'action-copy-link',
    label: 'Copy link to this page',
    shortcut: '> copy',
    action: 'copy-link',
    group: 'Tools',
  },
  {
    id: 'tools-analytics',
    label: 'System Analytics',
    shortcut: '/analytics',
    path: ROUTES.ANALYTICS,
    group: 'Tools',
  },
  {
    id: 'tools-how-it-works',
    label: 'How this site works',
    shortcut: '/how-it-works',
    path: ROUTES.HOW_IT_WORKS,
    group: 'Tools',
  },
  {
    id: 'nav-writing',
    label: 'Writing',
    shortcut: '/writing',
    path: ROUTES.WRITING,
    group: 'Navigation',
    requires: 'writing',
  },
  {
    id: 'nav-home',
    label: 'Go to Home',
    shortcut: '/home',
    path: ROUTES.HOME,
    group: 'Navigation',
  },
  {
    id: 'nav-about',
    label: 'Go to About',
    shortcut: '/about',
    path: ROUTES.ABOUT,
    group: 'Navigation',
  },
  {
    id: 'nav-projects',
    label: 'Go to Projects',
    shortcut: '/projects',
    path: ROUTES.PROJECTS,
    group: 'Navigation',
  },
  {
    id: 'nav-skills',
    label: 'Go to Skills',
    shortcut: '/skills',
    path: ROUTES.SKILLS,
    group: 'Navigation',
  },
  {
    id: 'nav-experience',
    label: 'Go to Experience',
    shortcut: '/experience',
    path: ROUTES.EXPERIENCE,
    group: 'Navigation',
  },
  {
    id: 'nav-profiles',
    label: 'Go to Profiles',
    shortcut: '/profiles',
    path: ROUTES.PROFILES,
    group: 'Navigation',
  },
  {
    id: 'nav-contact',
    label: 'Go to Contact',
    shortcut: '/contact',
    path: ROUTES.CONTACT,
    group: 'Navigation',
  },
  {
    id: 'nav-resume',
    label: 'View Resume',
    shortcut: '/resume',
    path: ROUTES.RESUME,
    group: 'Navigation',
  },
];
