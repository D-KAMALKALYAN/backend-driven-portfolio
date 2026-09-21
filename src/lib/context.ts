/**
 * Where the visitor is, as far as Ask cares (ADR-051, blueprint 3.1).
 *
 * The palette derives it from the pathname; the route derives it again from
 * what the client sent. One function on both sides, so the server never
 * trusts a href it would not have produced itself: three shapes, a strict
 * slug, nothing else. RLS then decides whether the href scopes anything
 * (a draft's href finds no row for the anon role). Pure, no imports - it
 * ships in the browser bundle.
 */
export type AskContextKind = 'project' | 'post' | 'page';

export interface AskContext {
  kind: AskContextKind;
  /** The page's path, as the site's own hrefs spell it. */
  href: string;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 80;

/** The context for a pathname, or null when the page is not one Ask can be scoped to. */
export function contextFromPath(pathname: string | null | undefined): AskContext | null {
  if (typeof pathname !== 'string' || pathname.length > 200) return null;
  const path = pathname.split(/[?#]/)[0]!.replace(/\/+$/, '');
  if (path === '/how-it-works') return { kind: 'page', href: path };
  const m = /^\/(projects|writing)\/([^/]+)$/.exec(path);
  if (!m) return null;
  const slug = m[2]!;
  if (slug.length > MAX_SLUG || !SLUG.test(slug)) return null;
  return { kind: m[1] === 'projects' ? 'project' : 'post', href: path };
}

/** What the chip calls the context, before the server has said what the page is titled. */
export const CONTEXT_KIND_LABEL: Record<AskContextKind, string> = {
  project: 'this project',
  post: 'this note',
  page: 'this page',
};

/**
 * The page's own title out of the document title. Titles follow the
 * layout's template "<page> · <site>", so the first segment is the page's;
 * a title without the separator is the site's alone and names no page.
 */
export function pageTitleOf(documentTitle: string | null | undefined): string | null {
  if (!documentTitle || !documentTitle.includes(' · ')) return null;
  const page = documentTitle.split(' · ')[0]!.trim();
  return page && page.length <= 80 ? page : null;
}

/** The chip's label: the kind, and the page's title when one is known. */
export function contextLabel(context: AskContext, pageTitle?: string | null): string {
  const kind = CONTEXT_KIND_LABEL[context.kind];
  return pageTitle ? `${kind} · ${pageTitle}` : kind;
}
