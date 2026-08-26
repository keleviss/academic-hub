import { NavLink } from 'react-router';

import { AppRouter } from './router';

function getNavClassName({ isActive }: { isActive: boolean }): string {
  const baseClassName =
    'inline-flex min-h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors';

  return isActive
    ? `${baseClassName} border-emerald-600 text-emerald-700`
    : `${baseClassName} border-transparent text-slate-600 hover:text-slate-950`;
}

export function App(): React.JSX.Element {
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
            <NavLink to="/login" className={getNavClassName}>
              Σύνδεση
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8">
        <AppRouter />
      </main>
    </div>
  );
}
