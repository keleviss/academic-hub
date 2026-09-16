import type { ReactNode } from 'react';

import { Spinner } from './Spinner';

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div className="error-notice" role="alert">
      {children}
    </div>
  );
}

export function SessionFeedback({
  pending,
  retry,
  retrying = false,
}: {
  pending: boolean;
  retry: () => void;
  retrying?: boolean;
}) {
  return (
    <section className="session-feedback" aria-label="Κατάσταση σύνδεσης">
      {pending ? (
        <Spinner label="Έλεγχος σύνδεσης…" />
      ) : (
        <>
          <ErrorNotice>
            Δεν ήταν δυνατός ο έλεγχος της σύνδεσης. Δοκίμασε ξανά.
          </ErrorNotice>
          <button
            className="primary-button"
            type="button"
            disabled={retrying}
            onClick={retry}
          >
            {retrying ? 'Έλεγχος…' : 'Επανάληψη ελέγχου'}
          </button>
        </>
      )}
    </section>
  );
}
