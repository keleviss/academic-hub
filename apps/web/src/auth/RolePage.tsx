import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { CurrentUser, UserRole } from '@web-app/contracts';

import { ErrorNotice, SessionFeedback } from '../components/feedback';
import { roleLabels, rolePath, useLogoutMutation, useSession } from './session';

function Identity({ user }: { user: CurrentUser }) {
  const mutation = useLogoutMutation();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  async function signOut() {
    if (mutation.isPending) return;
    setFailed(false);
    try {
      await mutation.mutateAsync();
      navigate('/login', { replace: true });
    } catch {
      setFailed(true);
    } finally {
      mutation.reset();
    }
  }
  return (
    <section className="identity-card">
      <p className="auth-kicker">{roleLabels[user.role]}</p>
      <h2>Καλώς ήρθες, {user.fullName}</h2>
      <p>Έχεις συνδεθεί στο Academic Hub.</p>
      <dl>
        <div>
          <dt>Όνομα</dt>
          <dd>{user.fullName}</dd>
        </div>
        <div>
          <dt>Ρόλος</dt>
          <dd>{roleLabels[user.role]}</dd>
        </div>
      </dl>
      {failed && (
        <ErrorNotice>Η αποσύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.</ErrorNotice>
      )}
      <button
        className="primary-button"
        type="button"
        disabled={mutation.isPending}
        onClick={() => void signOut()}
      >
        {mutation.isPending ? 'Γίνεται αποσύνδεση…' : 'Αποσύνδεση'}
      </button>
    </section>
  );
}

export function RolePage({ role }: { role: UserRole }) {
  const session = useSession();
  if (session.isPending || session.isError)
    return (
      <SessionFeedback
        pending={session.isPending}
        retry={() => void session.refetch()}
        retrying={session.isFetching}
      />
    );
  if (!session.data.user) return <Navigate to="/login" replace />;
  if (session.data.user.role !== role)
    return <Navigate to={rolePath(session.data.user.role)} replace />;
  return <Identity key={session.data.user.id} user={session.data.user} />;
}
