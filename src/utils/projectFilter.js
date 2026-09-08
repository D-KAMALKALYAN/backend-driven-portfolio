/**
 * Search and filtering for the projects list.
 *
 * Runs in the browser over the already-fetched list rather than as a query.
 * At five projects the whole set is in hand, so filtering server-side would
 * add a round-trip per keystroke for no benefit and lose instant feedback.
 *
 * The GIN indexes on `tags` and `tech_stack` are the right tool once the list
 * outgrows a single fetch — past roughly fifty projects, or as soon as the
 * list is paginated. Until then this is the simpler correct answer, and the
 * shape below (a query string plus a set of tags) maps directly onto a
 * PostgREST `or=` + `cs.` query when that day comes.
 */

/** Fields matched by the free-text query, in the order a user would expect. */
const TEXT_FIELDS = ['title', 'tagline', 'description'];
const ARRAY_FIELDS = ['tech_stack', 'tags'];

function normalise(value) {
  return String(value ?? '').toLowerCase().trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Every distinct tag and technology across the given projects, sorted, with
 * the number of projects carrying each. Counts let the UI hide a filter that
 * would return nothing and show how much each one narrows the list.
 *
 * @returns {Array<{value: string, count: number}>}
 */
export function collectFacets(projects) {
  if (!Array.isArray(projects)) return [];

  const counts = new Map();
  for (const project of projects) {
    // A project carrying the same term as both a tag and a technology should
    // count once, not twice.
    const terms = new Set();
    for (const field of ARRAY_FIELDS) {
      for (const term of asArray(project?.[field])) {
        if (term) terms.add(term);
      }
    }
    for (const term of terms) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count - a.count) || a.value.localeCompare(b.value));
}

/**
 * Does this project match the free-text query?
 *
 * Every whitespace-separated word must appear somewhere in the project, so
 * "spring postgres" narrows rather than widens. Matching is substring-based
 * on purpose: "postgres" should find "PostgreSQL".
 */
function matchesQuery(project, query) {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = [
    ...TEXT_FIELDS.map((f) => normalise(project?.[f])),
    ...ARRAY_FIELDS.flatMap((f) => asArray(project?.[f]).map(normalise)),
  ].join(' ');

  return words.every((word) => haystack.includes(word));
}

/**
 * Filter projects by free text and selected facets.
 *
 * Selected facets are ANDed: picking "backend" and "security" asks for
 * projects that are both, which is what a user narrowing a list expects.
 *
 * @param {Array} projects
 * @param {{ query?: string, tags?: Iterable<string> }} criteria
 */
export function filterProjects(projects, { query = '', tags = [] } = {}) {
  if (!Array.isArray(projects)) return [];

  const selected = [...tags].map(normalise).filter(Boolean);

  return projects.filter((project) => {
    if (!project) return false;
    if (!matchesQuery(project, query)) return false;

    if (selected.length > 0) {
      const owned = new Set(
        ARRAY_FIELDS.flatMap((f) => asArray(project[f]).map(normalise)),
      );
      if (!selected.every((tag) => owned.has(tag))) return false;
    }

    return true;
  });
}

/** True when any filter is active — lets the UI show a "clear" affordance. */
export function hasActiveFilters({ query = '', tags = [] } = {}) {
  return normalise(query).length > 0 || [...tags].length > 0;
}
