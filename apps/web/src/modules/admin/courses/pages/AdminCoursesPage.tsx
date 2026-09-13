import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { createAdminCourse, fetchAdminCourses } from '../../../../api/client';
import { EmptyState } from '../../../../components/EmptyState';
import { Pagination } from '../../../../components/Pagination';
import { QueryState } from '../../../../components/QueryState';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Tabs } from '../../../../components/Tabs';
import { useDebouncedInput } from '../../../../hooks/useDebouncedInput';
import { useDialogState } from '../../../../hooks/useDialogState';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';
import { useUrlFilters } from '../../../../hooks/useUrlFilters';
import { messageFor } from '../utils/AdminCoursesUtils';
import { courseListKey, semesters } from '../utils/AdminCourses.const';
import { CourseForm } from '../components/AdminCourseForm';
import { PageLayout } from '../../../../components/PageLayout';

export function AdminCoursesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { params, setFilter } = useUrlFilters({ resetKey: 'page' });
  const {
    dialog: createOpen,
    openDialog,
    closeDialog,
  } = useDialogState<true>();

  const page = Number(params.get('page') ?? '1');
  const requestedStatus = params.get('status');

  const status: 'all' | 'active' | 'inactive' =
    requestedStatus === 'active' || requestedStatus === 'inactive'
      ? requestedStatus
      : 'all';
  const search = useMemo(() => params.get('search') ?? '', [params]);
  const [searchDraft, setSearchDraft] = useDebouncedInput(search, (value) =>
    setFilter({ search: value || undefined }),
  );
  const semester = params.get('semester')
    ? Number(params.get('semester'))
    : undefined;

  const list = useQuery({
    queryKey: [...courseListKey, { page, search, semester, status }],
    queryFn: ({ signal }) =>
      fetchAdminCourses(
        { page, search: search || undefined, semester, status },
        signal,
      ),
    placeholderData: (previousData) => previousData,
  });

  const create = useNotifyingMutation({
    mutationFn: createAdminCourse,
    invalidateKeys: [courseListKey],
    successMessage: 'Το νέο μάθημα δημιουργήθηκε.',
    onSuccess: ({ data }) => {
      closeDialog();
      navigate(`/app/courses/${data.id}`);
    },
  });

  return (
    <PageLayout
      title="Μαθήματα"
      subtitle="Οργάνωση μαθημάτων, διδασκόντων και εγγραφών φοιτητών."
      actions={[
        <button
          className="primary-button"
          type="button"
          onClick={() => openDialog(true)}
        >
          + Νέο μάθημα
        </button>,
      ]}
    >
      <QueryState
        query={list}
        loadingLabel="Φόρτωση μαθημάτων…"
        errorOptions={{
          fallback: 'Η φόρτωση των μαθημάτων απέτυχε. Δοκίμασε ξανά.',
        }}
      >
        {(data) => (
          <>
            <div className="course-stat-grid">
              <article>
                <span>Σύνολο μαθημάτων</span>
                <strong>{data.summary.totalCourses}</strong>
              </article>
              <article>
                <span>Ενεργά μαθήματα</span>
                <strong>{data.summary.activeCourses}</strong>
              </article>
              <article>
                <span>Χωρίς διδάσκοντα</span>
                <strong>{data.summary.unassignedCourses}</strong>
              </article>
            </div>
            <div className="course-list-card">
              <Tabs
                ariaLabel="Κατάσταση μαθημάτων"
                value={status}
                onChange={(value) =>
                  setFilter({ status: value === 'all' ? undefined : value })
                }
                items={[
                  { value: 'all', label: 'Όλα' },
                  { value: 'active', label: 'Ενεργά' },
                  { value: 'inactive', label: 'Ανενεργά' },
                ]}
              />
              <div className="course-filter-row text-sm">
                <input
                  aria-label="Αναζήτηση μαθημάτων"
                  placeholder="Αναζήτηση τίτλου, κωδικού ή διδάσκοντα…"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
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
              {data.data.length === 0 ? (
                <EmptyState message="Δεν υπάρχουν μαθήματα για τα επιλεγμένα φίλτρα." />
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
                      {data.data.map((course) => (
                        <tr key={course.id}>
                          <td data-label="Μάθημα">
                            <Link
                              className="font-semibold hover:underline"
                              to={`/app/courses/${course.id}`}
                            >
                              {course.title}
                            </Link>
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
                            <StatusBadge
                              active={course.isActive}
                              activeLabel="Ενεργό"
                              inactiveLabel="Ανενεργό"
                            />
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
              <Pagination
                ariaLabel="Σελίδες μαθημάτων"
                page={page}
                totalPages={data.meta.totalPages}
                onPageChange={(nextPage) =>
                  setFilter({ page: String(nextPage) })
                }
              />
            </div>
          </>
        )}
      </QueryState>
      {createOpen && (
        <CourseForm
          title="Νέο μάθημα"
          submitLabel="Δημιουργία μαθήματος"
          pending={create.isPending}
          error={create.isError ? messageFor(create.error) : null}
          onCancel={closeDialog}
          onSubmit={(value) => create.mutate(value)}
        />
      )}
    </PageLayout>
  );
}
