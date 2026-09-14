import type { UseQueryResult } from '@tanstack/react-query';

import { getErrorMessage } from '../lib/api-error';
import { ErrorNotice } from './feedback';

/** Renders the shared loading / error / empty triad around a react-query result. */
export function QueryState<T>({
  query,
  loadingLabel,
  emptyMessage,
  isEmpty,
  errorOptions,
  onRetry,
  children,
}: {
  query: UseQueryResult<T>;
  loadingLabel: React.ReactNode;
  emptyMessage?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  errorOptions?: Parameters<typeof getErrorMessage>[1];
  onRetry?: () => void;
  children: (data: T) => React.ReactNode;
}): React.JSX.Element {
  if (query.isPending) return <p role="status">{loadingLabel}</p>;

  if (query.isError || query.data === undefined) {
    const message = query.isError
      ? getErrorMessage(query.error, errorOptions)
      : (emptyMessage ?? 'Δεν βρέθηκαν δεδομένα.');

    return (
      <ErrorNotice>
        <span>{message}</span>
        {onRetry && (
          <button
            className="secondary-button error-notice-action"
            type="button"
            onClick={onRetry}
          >
            Δοκίμασε ξανά
          </button>
        )}
      </ErrorNotice>
    );
  }

  if (emptyMessage && isEmpty?.(query.data)) {
    return <p className="course-empty">{emptyMessage}</p>;
  }

  return <>{children(query.data)}</>;
}
