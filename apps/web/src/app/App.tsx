import { NavLink, useLocation } from 'react-router';

import { AppRouter } from './router';
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() =>
  import('../auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
import { rolePath, useSession, useSessionSync } from '../auth/session';

function getNavClassName({ isActive }: { isActive: boolean }): string {
  const baseClassName =
    'inline-flex min-h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors';

  return isActive
    ? `${baseClassName} border-emerald-600 text-emerald-700`
    : `${baseClassName} border-transparent text-slate-600 hover:text-slate-950`;
}

export function App(): React.JSX.Element {
  useSessionSync();
  const session = useSession();
  const location = useLocation();
  if (location.pathname === '/login')
    return (
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center p-5">
            <p className="session-feedback text-center" role="status">
              Φόρτωση σύνδεσης…
            </p>
          </div>
        }
      >
        <LoginPage />
      </Suspense>
    );
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Academic Hub
            </p>
            <h1 className="text-xl font-semibold text-slate-950">
              Πρωτότυπο μαθησιακής πλατφόρμας
            </h1>
          </div>
          <nav className="flex gap-6" aria-label="Κύρια πλοήγηση">
            <NavLink to="/" end className={getNavClassName}>
              Αρχική
            </NavLink>
            {session.data?.user ? (
              <NavLink
                to={rolePath(session.data.user.role)}
                className={getNavClassName}
              >
                Ο λογαριασμός μου
              </NavLink>
            ) : (
              <NavLink to="/login" className={getNavClassName}>
                Σύνδεση
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8">
        <AppRouter />
      </main>
    </div>
  );
}
