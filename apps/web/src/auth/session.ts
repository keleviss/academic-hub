import { useEffect, useRef } from 'react';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { CurrentSession, UserRole } from '@web-app/contracts';

import { fetchCurrentSession, login, logout } from '../api/client';

export const sessionKey = ['auth', 'session'] as const;
const transitionKey = ['auth', 'transition'] as const;
const isSessionKey = (key: readonly unknown[]) =>
  key[0] === 'auth' && key[1] === 'session';

export const roleLabels: Record<UserRole, string> = {
  admin: 'Διαχειριστής',
  professor: 'Διδάσκων',
  student: 'Φοιτητής',
};

export const appPath = '/app';

export function useSession() {
  const changingSession = useIsMutating({ mutationKey: transitionKey }) > 0;
  return useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => fetchCurrentSession(signal),
    enabled: !changingSession,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}

async function clearUserQueries(client: QueryClient) {
  const filter = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      !isSessionKey(query.queryKey),
  };
  await client.cancelQueries(filter);
  client.removeQueries(filter);
}

// Covers server-side expiry/revocation and identity changes discovered on focus.
export function useSessionSync() {
  const session = useSession();
  const client = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!session.data) return;
    const nextUser = session.data.user?.id ?? null;
    if (
      previousUser.current !== undefined &&
      previousUser.current !== nextUser
    ) {
      void clearUserQueries(client);
      for (const mutation of client.getMutationCache().getAll()) {
        if (mutation.state.status !== 'pending')
          client.getMutationCache().remove(mutation);
      }
    }
    previousUser.current = nextUser;
  }, [client, session.data]);
}

function useAuthTransition<T>(action: (input: T) => Promise<CurrentSession>) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: transitionKey,
    mutationFn: action,
    gcTime: 0,
    retry: false,
    onMutate: async () => {
      await client.cancelQueries();
    },
    onSuccess: async (session) => {
      await client.cancelQueries();
      await clearUserQueries(client);
      // Clear cached mutations, which may contain the previous user's data.
      client.getMutationCache().clear();
      client.setQueryData(sessionKey, session);
    },
    onSettled: () => {
      // Failed credentials must not survive in TanStack's mutation cache either.
      for (const mutation of client
        .getMutationCache()
        .findAll({ mutationKey: transitionKey })) {
        client.getMutationCache().remove(mutation);
      }
    },
  });
}

export function useLoginMutation() {
  return useAuthTransition(login);
}
export function useLogoutMutation() {
  return useAuthTransition(logout);
}
