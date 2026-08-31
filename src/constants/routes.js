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
};

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
export const NAV_LINKS = [
  { label: 'Home',       path: ROUTES.HOME,       contentKey: 'nav.home' },
  { label: 'About',      path: ROUTES.ABOUT,      contentKey: 'nav.about' },
  { label: 'Projects',   path: ROUTES.PROJECTS,   contentKey: 'nav.projects' },
  { label: 'Skills',     path: ROUTES.SKILLS,     contentKey: 'nav.skills' },
  { label: 'Experience', path: ROUTES.EXPERIENCE, contentKey: 'nav.experience' },
  { label: 'Profiles',   path: ROUTES.PROFILES,   contentKey: 'nav.profiles' },
  { label: 'Contact',    path: ROUTES.CONTACT,    contentKey: 'nav.contact' },
  { label: 'Resume',     path: ROUTES.RESUME,     contentKey: 'nav.resume' },
];
