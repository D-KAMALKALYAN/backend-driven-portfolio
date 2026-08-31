import { useState, useEffect, useCallback } from 'react';

/**
 * Generic hook for fetching data from Supabase via API functions.
 * Handles loading, error, and refetch states.
 */
export function useSupabaseQuery(queryFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await queryFn();
      setData(result);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      console.error('[useSupabaseQuery]', err);
    } finally {
      setLoading(false);
    }
    // A caller-supplied deps array cannot be statically verified, so neither
    // exhaustive-deps nor use-memo can check this hook. That is a real
    // limitation of the design: correctness depends entirely on every caller
    // passing the right deps, with no lint to catch a mistake.
    //
    // Replacing this hook with TanStack Query removes the problem rather than
    // suppressing it (roadmap 2.5) - it supplies caching, deduplication,
    // cancellation and retry, none of which exist here.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
