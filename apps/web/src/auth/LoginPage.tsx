import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginRequestSchema, type LoginRequest } from '@web-app/contracts';

import { ApiClientError } from '../api/client';
import { ErrorNotice, SessionFeedback } from '../components/feedback';
import { appPath, useLoginMutation, useSession } from './session';

function loginMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.code === 'INVALID_CREDENTIALS') {
    return 'Δεν ήταν δυνατή η σύνδεση. Έλεγξε το email και τον κωδικό σου.';
  }
  return 'Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά σε λίγο.';
}

function LoginForm() {
  const navigate = useNavigate();
  const mutation = useLoginMutation();
  const submitting = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  async function submit(values: LoginRequest) {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const session = await mutation.mutateAsync(values);
      if (session.user) navigate(appPath, { replace: true });
    } catch (cause) {
      setError(loginMessage(cause));
    } finally {
      resetField('password');
      setShowPassword(false);
      mutation.reset();
      submitting.current = false;
    }
  }

  return (
    <form
      className="login-card"
      noValidate
      onSubmit={(event) => void handleSubmit(submit)(event)}
      aria-label="Σύνδεση στο Academic Hub"
      aria-busy={isSubmitting}
    >
      <div className="form-heading">
        <h2>Στοιχεία σύνδεσης</h2>
        <p>Χρησιμοποίησε τον λογαριασμό σου.</p>
      </div>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <div className="form-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Το email σου"
          {...register('email')}
          readOnly={isSubmitting}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="field-error" role="alert">
            Συμπλήρωσε ένα έγκυρο email.
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="login-password">Κωδικός</label>
        <div className="password-control">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Ο κωδικός σου"
            {...register('password')}
            readOnly={isSubmitting}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          <button
            type="button"
            className="password-toggle"
            aria-controls="login-password"
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'Απόκρυψη' : 'Εμφάνιση'}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="field-error" role="alert">
            Ο κωδικός πρέπει να έχει από 8 έως 256 χαρακτήρες.
          </p>
        )}
      </div>
      <button type="submit" className="primary-button" disabled={isSubmitting}>
        {isSubmitting ? 'Γίνεται σύνδεση…' : 'Σύνδεση στο Academic Hub'}
      </button>
      {isSubmitting && (
        <p role="status" className="form-status">
          Η σύνδεση βρίσκεται σε εξέλιξη.
        </p>
      )}
    </form>
  );
}

export function LoginPage() {
  const session = useSession();
  if (!session.isError && session.data?.authenticated && session.data.user) {
    return <Navigate to={appPath} replace />;
  }
  return (
    <div className="auth-layout">
      <aside className="auth-institution" aria-label="Academic Hub">
        <div className="auth-brand">
          <span>UNIWA</span>
          <p>Academic Hub</p>
        </div>
        <div className="auth-introduction">
          <span className="status-pill">Ακαδημαϊκό περιβάλλον</span>
          <h2>Ο χώρος σου για μελέτη και αλληλεπίδραση.</h2>
          <p>
            Το εκπαιδευτικό υλικό, οι απορίες και η μαθησιακή σου πορεία σε ένα
            κοινό περιβάλλον.
          </p>
        </div>
        <p className="institution-footer">Πανεπιστήμιο Δυτικής Αττικής</p>
      </aside>
      <header className="auth-mobile-header">
        <div className="auth-brand">
          <span>UNIWA</span>
          <p>Academic Hub</p>
        </div>
      </header>
      <main className="auth-main" id="main-content">
        <div className="auth-audience">
          Φοιτητές · Διδάσκοντες · Διαχειριστές
        </div>
        <div className="auth-content">
          <div className="auth-heading">
            <p className="auth-kicker">Σύνδεση</p>
            <h1>Καλώς ήρθες ξανά</h1>
            <p>Συνδέσου για να συνεχίσεις στο Academic Hub.</p>
          </div>
          {session.isPending || session.isError ? (
            <SessionFeedback
              pending={session.isPending}
              retry={() => void session.refetch()}
              retrying={session.isFetching}
            />
          ) : (
            <LoginForm />
          )}
        </div>
      </main>
    </div>
  );
}
