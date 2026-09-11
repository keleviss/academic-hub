import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';

import { SessionFeedback } from '../components/feedback';
import { useSession } from './session';
import { AuthenticatedUserContext } from './authenticatedUser';

const LoginPage = lazy(() =>
  import('./LoginPage').then((module) => ({ default: module.LoginPage })),
);

function LoginFallback(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <p className="session-feedback text-center" role="status">
        Φόρτωση σύνδεσης...
      </p>
    </div>
  );
}

export function LoginRoute(): React.JSX.Element {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPage />
    </Suspense>
  );
}

export function RequireSession({
  children,
}: {
  children: React.ReactElement;
}): React.JSX.Element {
  const session = useSession();

  if (session.isPending || session.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-5">
        <SessionFeedback
          pending={session.isPending}
          retry={() => void session.refetch()}
          retrying={session.isFetching}
        />
      </div>
    );
  }

  if (!session.data.user) return <Navigate to="/" replace />;

  return (
    <AuthenticatedUserContext.Provider value={session.data.user}>
      {children}
    </AuthenticatedUserContext.Provider>
  );
}
