import { useEffect, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';

/**
 * Search box and facet chips for the projects list.
 *
 * The text input is uncontrolled from the parent's perspective: it keeps its
 * own immediate value so typing stays responsive, and reports a debounced
 * value upward. Without that, every keystroke would re-filter and re-animate
 * the whole grid.
 *
 * `useDebounce` already existed in the codebase and had never been imported.
 */
export default function ProjectFilterBar({
  facets,
  query,
  onQueryChange,
  selectedTags,
  onToggleTag,
  onClear,
  resultCount,
  totalCount,
}) {
  const [draft, setDraft] = useState(query);
  const debounced = useDebounce(draft, 200);

  // Adopt external changes to `query` - Clear filters, or browser back -
  // without an effect. This is React's "adjusting state when a prop changes"
  // pattern: comparing against the previous prop during render re-renders
  // immediately, where an effect would paint the stale value first.
  const [lastExternalQuery, setLastExternalQuery] = useState(query);
  if (query !== lastExternalQuery) {
    setLastExternalQuery(query);
    setDraft(query);
  }

  // Report the settled value upward.
  useEffect(() => {
    if (debounced !== query) onQueryChange(debounced);
    // `query` is the value being synced *to*, so depending on it would fight
    // the draft state; onQueryChange is stable via useCallback in the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const isFiltered = resultCount !== totalCount;

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <svg
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            id="project-search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search projects, tech, or tags…"
            aria-label="Search projects"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-card)',
            }}
          />
        </div>

        {(isFiltered || selectedTags.length > 0 || query) && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-none"
            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {facets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="Filter by tag or technology">
          {facets.map(({ value, count }) => {
            const active = selectedTags.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => onToggleTag(value)}
                aria-pressed={active}
                // Visually the margin separates label from count, but the
                // accessible name would run them together as "backend4".
                aria-label={`${value}, ${count} project${count === 1 ? '' : 's'}`}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer border-none transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {value}
                <span className="ml-1 opacity-60 font-mono" aria-hidden="true">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Announced to screen readers as results change, not just shown. */}
      <p
        className="mt-3 text-xs"
        style={{ color: 'var(--text-muted)' }}
        role="status"
        aria-live="polite"
      >
        {isFiltered
          ? `${resultCount} of ${totalCount} projects`
          : `${totalCount} project${totalCount === 1 ? '' : 's'}`}
      </p>
    </div>
  );
}
