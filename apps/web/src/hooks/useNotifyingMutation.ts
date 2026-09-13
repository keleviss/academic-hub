import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { useNotification } from '../components/notifications';
import { getErrorMessage } from '../lib/api-error';

/**
 * useMutation wrapper that, on success, invalidates the given query keys, shows a
 * success notification, then runs an optional callback (e.g. closing a dialog).
 * Pass `notifyOnError` for fire-and-forget mutations that have no dialog to show
 * an inline error in (e.g. row actions).
 */
export function useNotifyingMutation<TData, TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successMessage: string | ((data: TData, variables: TVariables) => string);
  invalidateKeys?: QueryKey[];
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  notifyOnError?: boolean | ((error: unknown) => string);
}) {
  const client = useQueryClient();
  const { notify } = useNotification();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, variables) => {
      if (options.invalidateKeys) {
        await Promise.all(
          options.invalidateKeys.map((queryKey) =>
            client.invalidateQueries({ queryKey }),
          ),
        );
      }
      notify({
        kind: 'success',
        message:
          typeof options.successMessage === 'function'
            ? options.successMessage(data, variables)
            : options.successMessage,
      });
      await options.onSuccess?.(data, variables);
    },
    onError: options.notifyOnError
      ? (error) => {
          notify({
            kind: 'error',
            message:
              typeof options.notifyOnError === 'function'
                ? options.notifyOnError(error)
                : getErrorMessage(error),
          });
        }
      : undefined,
  });
}

