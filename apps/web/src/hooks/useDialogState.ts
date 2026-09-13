import { useCallback, useState } from 'react';

/** Single-slot modal/dialog state, works for string enums and discriminated unions alike. */
export function useDialogState<T>() {
  const [dialog, setDialog] = useState<T | null>(null);

  const openDialog = useCallback((next: T) => setDialog(next), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  return { dialog, openDialog, closeDialog } as const;
}
