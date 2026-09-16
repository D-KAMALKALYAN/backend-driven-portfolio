export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  PROJECTS: '/projects',
  PROJECT_DETAIL: '/projects/:slug',
  PROFILES: '/profiles',
  SKILLS: '/skills',
  EXPERIENCE: '/experience',
  CONTACT: '/contact',
  RESUME: '/resume',
  ANALYTICS: '/analytics',
  HOW_IT_WORKS: '/how-it-works',
  WRITING: '/writing',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export type NavTier = 'primary' | 'secondary';

export interface NavLink {
  label: string;
  path: RoutePath;
  contentKey: string;
  /**
   * `primary` is the top bar: the five questions a visitor arrives with.
   * `secondary` is one level down - reachable from About, the mobile menu,
   * the footer and the palette - so the bar stays readable (ADR-039).
   */
  tier: NavTier;
  /**
   * Render only when the deployment has this content. A nav item that leads
   * to an empty page is worse than no item; the server decides per request.
   */
  requires?: 'writing';
}

/**
 * Navigation.
 *
 * The path -> component mapping stays in code, because a route with no
 * component is a 404 and that is a code change, not content. What the DB
 * controls is the LABEL: `contentKey` names a site_content row, and `label`
 * is the fallback when that row is absent.
 *
 * This is the balance recorded in developer-notes/backend-driven-scorecard.md:
 * backend-drive what changes independently of code (copy, ordering,
 * visibility); keep in code what only changes when the code changes.
 */
export const NAV_LINKS: NavLink[] = [
  // Primary: who, what have they built, what do they think, how do I reach them.
  { label: 'Home',       path: ROUTES.HOME,       contentKey: 'nav.home',       tier: 'primary' },
  { label: 'Projects',   path: ROUTES.PROJECTS,   contentKey: 'nav.projects',   tier: 'primary' },
  { label: 'Writing',    path: ROUTES.WRITING,    contentKey: 'nav.writing',    tier: 'primary', requires: 'writing' },
  { label: 'About',      path: ROUTES.ABOUT,      contentKey: 'nav.about',      tier: 'primary' },
  { label: 'Contact',    path: ROUTES.CONTACT,    contentKey: 'nav.contact',    tier: 'primary' },
  // Secondary: the detail pages behind About. Resume is also the bar's CTA.
  { label: 'Skills',     path: ROUTES.SKILLS,     contentKey: 'nav.skills',     tier: 'secondary' },
  { label: 'Experience', path: ROUTES.EXPERIENCE, contentKey: 'nav.experience', tier: 'secondary' },
  { label: 'Profiles',   path: ROUTES.PROFILES,   contentKey: 'nav.profiles',   tier: 'secondary' },
  { label: 'Resume',     path: ROUTES.RESUME,     contentKey: 'nav.resume',     tier: 'secondary' },
];

/** The one action a recruiter came for; rendered as a button, not a link. */
export const NAV_CTA: NavLink = { label: 'Resume', path: ROUTES.RESUME, contentKey: 'nav.resume', tier: 'secondary' };
