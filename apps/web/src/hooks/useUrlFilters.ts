import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Wraps useSearchParams with a merge/delete helper for filter-style URL state.
 * `resetKey`, when set, is cleared on every filter change unless explicitly included in it
 * (used to reset pagination when other filters change).
 */
export function useUrlFilters(options?: { resetKey?: string }) {
  const [params, setParams] = useSearchParams();
  const resetKey = options?.resetKey;

  const setFilter = useCallback(
    (next: Record<string, string | undefined>) => {
      const updated = new URLSearchParams(params);
      Object.entries(next).forEach(([key, value]) =>
        value ? updated.set(key, value) : updated.delete(key),
      );
      if (resetKey && !(resetKey in next)) updated.delete(resetKey);
      setParams(updated);
    },
    [params, resetKey, setParams],
  );

  return { params, setFilter } as const;
}
