import { createContext, useContext } from 'react';
import type { CurrentUser } from '@web-app/contracts';

export const AuthenticatedUserContext = createContext<CurrentUser | null>(null);

export function useAuthenticatedUser(): CurrentUser {
  const user = useContext(AuthenticatedUserContext);

  if (!user) {
    throw new Error('useAuthenticatedUser must be used inside RequireSession');
  }

  return user;
}
