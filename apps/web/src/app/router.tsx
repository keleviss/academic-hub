import { Route, Routes } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { ApiClientError, fetchHealth } from '../api/client';
import { RolePage } from '../auth/RolePage';

function HomePage(): React.JSX.Element {
  const healthQuery = useQuery({
    queryKey: ['api-health'],
    queryFn: fetchHealth,
  });

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        <p className="text-sm font-medium text-emerald-700">
          Content-centered LMS
        </p>
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold text-slate-950">
            Βάση για το web περιβάλλον του Academic Hub
          </h2>
          <p className="max-w-2xl text-base leading-7 text-slate-700">
            Το αρχικό shell είναι έτοιμο για τις επόμενες οθόνες ρόλων,
            αυθεντικοποίησης και αλληλεπίδρασης με το εκπαιδευτικό υλικό.
          </p>
        </div>
      </div>

      <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Κατάσταση API
        </h3>
        {healthQuery.isPending ? (
          <p className="mt-4 text-sm text-slate-600">
            Έλεγχος σύνδεσης με το API...
          </p>
        ) : null}
        {healthQuery.isError ? (
          <div className="mt-4 space-y-2">
            <p className="font-medium text-red-700">Το API δεν απάντησε.</p>
            <p className="text-sm text-slate-600">
              {getErrorMessage(healthQuery.error)}
            </p>
          </div>
        ) : null}
        {healthQuery.isSuccess ? (
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Σήμα</dt>
              <dd className="font-medium text-emerald-700">API ενεργό</dd>
            </div>
            <div>
              <dt className="text-slate-500">Υπηρεσία</dt>
              <dd className="font-medium text-slate-900">
                {healthQuery.data.service}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Χρόνος</dt>
              <dd className="font-medium text-slate-900">
                {new Date(healthQuery.data.timestamp).toLocaleString('el-GR')}
              </dd>
            </div>
          </dl>
        ) : null}
      </aside>
    </section>
  );
}

function NotFoundPage(): React.JSX.Element {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-950">
        Η σελίδα δεν βρέθηκε.
      </h2>
    </section>
  );
}

function getErrorMessage(error: Error): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return 'Προέκυψε μη αναμενόμενο σφάλμα.';
}

export function AppRouter(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<RolePage role="admin" />} />
      <Route path="/professor" element={<RolePage role="professor" />} />
      <Route path="/student" element={<RolePage role="student" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
