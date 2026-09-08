import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router';

import { ErrorNotice } from '../../components/feedback';
import { appPath, roleLabels, useLogoutMutation } from '../../auth/session';
import { useAuthenticatedUser } from '../../auth/authenticatedUser';
import { workspaceRoutesByRole } from './workspaceRoutes';

function navTarget(path: string): string {
  return path ? `${appPath}/${path}` : appPath;
}

function getNavClassName({ isActive }: { isActive: boolean }): string {
  const baseClassName =
    'inline-flex min-h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors';

  return isActive
    ? `${baseClassName} border-emerald-600 text-emerald-700`
    : `${baseClassName} border-transparent text-slate-600 hover:text-slate-950`;
}

export function LoggedLayout(): React.JSX.Element {
  const user = useAuthenticatedUser();
  const navigate = useNavigate();
  const logout = useLogoutMutation();
  const [logoutFailed, setLogoutFailed] = useState(false);
  const routes = workspaceRoutesByRole[user.role];

  async function signOut() {
    if (logout.isPending) return;
    setLogoutFailed(false);
    try {
      await logout.mutateAsync();
      navigate('/', { replace: true });
    } catch {
      setLogoutFailed(true);
    } finally {
      logout.reset();
    }
  }

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
            <p className="mt-1 text-sm text-slate-600">
              {user.fullName} · {roleLabels[user.role]}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <nav className="flex flex-wrap gap-6" aria-label="Κύρια πλοήγηση">
              {routes
                .filter((route) => route.nav)
                .map((route) => (
                  <NavLink
                    key={route.path || 'index'}
                    to={navTarget(route.path)}
                    end={route.end}
                    className={getNavClassName}
                  >
                    {route.label}
                  </NavLink>
                ))}
            </nav>
            <button
              className="text-left text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 sm:text-right"
              type="button"
              disabled={logout.isPending}
              onClick={() => void signOut()}
            >
              {logout.isPending ? 'Γίνεται αποσύνδεση...' : 'Αποσύνδεση'}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl gap-5 px-5 py-8">
        {logoutFailed && (
          <ErrorNotice>
            Η αποσύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.
          </ErrorNotice>
        )}
        <Routes>
          {routes.map((route) => (
            <Route
              key={route.path || 'index'}
              index={route.path === ''}
              path={route.path || undefined}
              element={route.element}
            />
          ))}
          <Route path="*" element={<Navigate to={appPath} replace />} />
        </Routes>
      </main>
    </div>
  );
}
