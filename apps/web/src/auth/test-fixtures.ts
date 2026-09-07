import type { CurrentSession, UserRole } from '@web-app/contracts';

export const guest: CurrentSession = { authenticated: false, user: null };
export function signedIn(role: UserRole = 'student'): CurrentSession {
  return {
    authenticated: true,
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'student@example.com',
      fullName: 'Δοκιμαστικός Χρήστης',
      role,
      isActive: true,
    },
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
