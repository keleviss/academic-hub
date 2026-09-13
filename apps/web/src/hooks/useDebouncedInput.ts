import { useEffect, useState } from 'react';

/**
 * Local draft state for an input backed by a committed value (e.g. a URL search param),
 * committing the draft via `onCommit` after `delayMs` of inactivity.
 */
export function useDebouncedInput(
  committedValue: string,
  onCommit: (value: string) => void,
  delayMs = 300,
): [string, (next: string) => void] {
  const [draftState, setDraftState] = useState(() => ({
    source: committedValue,
    value: committedValue,
  }));
  const draft =
    draftState.source === committedValue ? draftState.value : committedValue;

  useEffect(() => {
    if (draft === committedValue) return;

    const timeoutId = window.setTimeout(() => {
      onCommit(draft);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [committedValue, draft, delayMs, onCommit]);

  const setDraft = (next: string) =>
    setDraftState({ source: committedValue, value: next });

  return [draft, setDraft];
}
