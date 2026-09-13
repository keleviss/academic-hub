import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminCourse,
  fetchAdminCourses,
} from '../../../../api/client';
import { Dialog } from '../../../../components/Dialog';
import { ErrorNotice } from '../../../../components/feedback';
import { useNotification } from '../../../../components/notifications';
import { messageFor } from '../utils/AdminCoursesUtils';
import { courseListKey, semesters } from '../utils/AdminCourses.const';
import { CourseForm } from '../components/AdminCourseForm';

export function AdminCoursesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { notify } = useNotification();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = Number(params.get('page') ?? '1');
  const requestedStatus = params.get('status');

  const status: 'all' | 'active' | 'inactive' =
    requestedStatus === 'active' || requestedStatus === 'inactive'
      ? requestedStatus
      : 'all';
  const search = useMemo(() => params.get('search') ?? '', [params]);
  const [searchDraftState, setSearchDraftState] = useState(() => ({
    source: search,
    value: search,
  }));
  const searchDraft =
    searchDraftState.source === search ? searchDraftState.value : search;
  const semester = params.get('semester')
    ? Number(params.get('semester'))
    : undefined;

  const setFilter = useCallback(
    (next: Record<string, string | undefined>) => {
      const updated = new URLSearchParams(params);
      Object.entries(next).forEach(([key, value]) =>
        value ? updated.set(key, value) : updated.delete(key),
      );
      if (!('page' in next)) updated.delete('page');
      setParams(updated);
    },
    [params, setParams],
  );

  useEffect(() => {
    if (searchDraft === search) return;

    const timeoutId = window.setTimeout(() => {
      setFilter({ search: searchDraft || undefined });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search, searchDraft, setFilter]);

  const list = useQuery({
    queryKey: [...courseListKey, { page, search, semester, status }],
    queryFn: ({ signal }) =>
      fetchAdminCourses(
        { page, search: search || undefined, semester, status },
        signal,
      ),
    placeholderData: (previousData) => previousData,
  });

  const create = useMutation({
    mutationFn: createAdminCourse,
    onSuccess: ({ data }) => {
      void client.invalidateQueries({ queryKey: courseListKey });
      setCreateOpen(false);
      notify({
        kind: 'success',
        message: 'Το νέο μάθημα δημιουργήθηκε.',
      });
      navigate(`/app/courses/${data.id}`);
    },
  });

  return (
    <section className="admin-courses-page">
      <header className="course-page-header">
        <div>
          <p className="auth-kicker">Ακαδημαϊκή διαχείριση</p>
          <h1>Μαθήματα</h1>
          <p>Οργάνωση μαθημάτων, διδασκόντων και εγγραφών φοιτητών.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          + Νέο μάθημα
        </button>
      </header>
      {list.isError && <ErrorNotice>{messageFor(list.error)}</ErrorNotice>}
      {list.isPending ? (
        <p role="status">Φόρτωση μαθημάτων…</p>
      ) : (
        list.data && (
          <>
            <div className="course-stat-grid">
              <article>
                <span>Σύνολο μαθημάτων</span>
                <strong>{list.data.summary.totalCourses}</strong>
              </article>
              <article>
                <span>Ενεργά μαθήματα</span>
                <strong>{list.data.summary.activeCourses}</strong>
              </article>
              <article>
                <span>Χωρίς διδάσκοντα</span>
                <strong>{list.data.summary.unassignedCourses}</strong>
              </article>
            </div>
            <div className="course-list-card">
              <div
                className="course-filter-tabs"
                role="tablist"
                aria-label="Κατάσταση μαθημάτων"
              >
                {(
                  [
                    ['all', 'Όλα'],
                    ['active', 'Ενεργά'],
                    ['inactive', 'Ανενεργά'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={status === value ? 'is-active' : ''}
                    type="button"
                    onClick={() =>
                      setFilter({ status: value === 'all' ? undefined : value })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="course-filter-row text-sm">
                <input
                  aria-label="Αναζήτηση μαθημάτων"
                  placeholder="Αναζήτηση τίτλου, κωδικού ή διδάσκοντα…"
                  value={searchDraft}
                  onChange={(event) =>
                    setSearchDraftState({
                      source: search,
                      value: event.target.value,
                    })
                  }
                />
                <select
                  aria-label="Φίλτρο εξαμήνου"
                  value={semester ?? ''}
                  onChange={(event) =>
                    setFilter({ semester: event.target.value || undefined })
                  }
                >
                  <option value="">Όλα τα εξάμηνα</option>
                  {semesters.map((item) => (
                    <option key={item} value={item}>
                      {item}ο εξάμηνο
                    </option>
                  ))}
                </select>
              </div>
              {list.data.data.length === 0 ? (
                <p className="course-empty">
                  Δεν υπάρχουν μαθήματα για τα επιλεγμένα φίλτρα.
                </p>
              ) : (
                <div className="course-table-wrap">
                  <table>
                    <thead>
                      <tr className="course-table-header">
                        <th>Μάθημα</th>
                        <th>Εξάμηνο</th>
                        <th>Διδάσκων</th>
                        <th>Φοιτητές</th>
                        <th>Κατάσταση</th>
                        <th>
                          <span className="sr-only">Ενέργειες</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.data.data.map((course) => (
                        <tr key={course.id}>
                          <td data-label="Μάθημα">
                            <strong>{course.title}</strong>
                            <span>
                              {course.code} · {course.ectsCredits} ECTS
                            </span>
                          </td>
                          <td data-label="Εξάμηνο">{course.semester}ο</td>
                          <td data-label="Διδάσκων">
                            {course.primaryInstructor?.fullName ?? '—'}
                          </td>
                          <td data-label="Φοιτητές">
                            {course.counts.studentCount}
                          </td>
                          <td data-label="Κατάσταση">
                            <span
                              className={
                                course.isActive
                                  ? 'status-badge is-active'
                                  : 'status-badge is-inactive'
                              }
                            >
                              {course.isActive ? 'Ενεργό' : 'Ανενεργό'}
                            </span>
                          </td>
                          <td data-label="Ενέργειες">
                            <Link
                              className="course-row-link"
                              to={`/app/courses/${course.id}`}
                            >
                              Προβολή
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {list.data.meta.totalPages > 1 && (
                <nav
                  className="course-pagination"
                  aria-label="Σελίδες μαθημάτων"
                >
                  <button
                    disabled={page <= 1}
                    type="button"
                    onClick={() => setFilter({ page: String(page - 1) })}
                  >
                    Προηγούμενη
                  </button>
                  <span>
                    Σελίδα {page} από {list.data.meta.totalPages}
                  </span>
                  <button
                    disabled={page >= list.data.meta.totalPages}
                    type="button"
                    onClick={() => setFilter({ page: String(page + 1) })}
                  >
                    Επόμενη
                  </button>
                </nav>
              )}
            </div>
          </>
        )
      )}
      {createOpen && (
        <Dialog title="Νέο μάθημα" onClose={() => setCreateOpen(false)}>
          <CourseForm
            label="Δημιουργία μαθήματος"
            pending={create.isPending}
            error={create.isError ? messageFor(create.error) : null}
            onCancel={() => setCreateOpen(false)}
            onSubmit={(value) => create.mutate(value)}
          />
        </Dialog>
      )}
    </section>
  );
}