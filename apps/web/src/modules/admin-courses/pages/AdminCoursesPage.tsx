import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CourseCreateRequest,
  CourseDetail,
  CourseInstructorRole,
  CourseMemberCandidate,
  EnrollmentStatus,
} from '@web-app/contracts';

import {
  ApiClientError,
  assignCourseInstructor,
  createAdminCourse,
  enrollCourseStudent,
  fetchAdminCourse,
  fetchAdminCourses,
  fetchCourseMemberCandidates,
  removeCourseInstructor,
  updateAdminCourse,
  updateCourseEnrollmentStatus,
} from '../../../api/client';
import { ErrorNotice } from '../../../components/feedback';

const courseListKey = ['admin', 'courses'] as const;
const semesters = Array.from({ length: 12 }, (_, index) => index + 1);

type Notice = { kind: 'success'; text: string } | null;
type CourseFormValue = CourseCreateRequest;

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) {
    const messages: Record<string, string> = {
      COURSE_CODE_ALREADY_EXISTS: 'Υπάρχει ήδη μάθημα με αυτόν τον κωδικό.',
      COURSE_INSTRUCTOR_ALREADY_ASSIGNED: 'Ο διδάσκων είναι ήδη ανατεθειμένος.',
      STUDENT_ALREADY_ENROLLED: 'Ο φοιτητής είναι ήδη εγγεγραμμένος.',
    };
    return messages[error.code ?? ''] ?? error.message;
  }
  return 'Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά.';
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): React.JSX.Element {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="course-dialog-layer"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        aria-modal="true"
        aria-labelledby="course-dialog-title"
        className="course-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="course-dialog-header">
          <h2 id="course-dialog-title">{title}</h2>
          <button
            aria-label="Κλείσιμο"
            className="icon-button"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function CourseForm({
  initial,
  label,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  initial?: CourseDetail;
  label: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (value: CourseFormValue) => void;
}): React.JSX.Element {
  const [value, setValue] = useState<CourseFormValue>(() => ({
    code: initial?.code ?? '',
    title: initial?.title ?? '',
    semester: initial?.semester ?? 1,
    ectsCredits: initial?.ectsCredits ?? 6,
    description: initial?.description ?? null,
  }));
  const set = <K extends keyof CourseFormValue>(
    key: K,
    next: CourseFormValue[K],
  ) => setValue((previous) => ({ ...previous, [key]: next }));

  return (
    <form
      className="course-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...value,
          code: value.code.trim().toUpperCase(),
          title: value.title.trim(),
        });
      }}
    >
      <label>
        Τίτλος μαθήματος
        <input
          required
          value={value.title}
          onChange={(event) => set('title', event.target.value)}
        />
      </label>
      <div className="course-form-grid">
        <label>
          Κωδικός μαθήματος
          <input
            required
            value={value.code}
            onChange={(event) => set('code', event.target.value)}
          />
        </label>
        <label>
          Εξάμηνο
          <select
            value={value.semester}
            onChange={(event) => set('semester', Number(event.target.value))}
          >
            {semesters.map((semester) => (
              <option key={semester} value={semester}>
                {semester}ο εξάμηνο
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Πιστωτικές μονάδες (ECTS)
        <input
          min="1"
          max="60"
          required
          type="number"
          value={value.ectsCredits}
          onChange={(event) => set('ectsCredits', Number(event.target.value))}
        />
      </label>
      <label>
        Περιγραφή <span className="field-optional">Προαιρετική</span>
        <textarea
          value={value.description ?? ''}
          onChange={(event) => set('description', event.target.value || null)}
        />
      </label>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <footer className="course-dialog-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          Ακύρωση
        </button>
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? 'Αποθήκευση…' : label}
        </button>
      </footer>
    </form>
  );
}

function MemberPicker({
  courseId,
  role,
  onSelect,
}: {
  courseId: string;
  role: 'professor' | 'student';
  onSelect: (candidate: CourseMemberCandidate) => void;
}): React.JSX.Element {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'courses', courseId, 'candidates', role, search],
    queryFn: ({ signal }) =>
      fetchCourseMemberCandidates(courseId, role, search, signal),
    enabled: search.trim().length >= 2,
    staleTime: 30_000,
  });
  return (
    <div className="member-picker">
      <label>
        Αναζήτηση {role === 'professor' ? 'διδάσκοντα' : 'φοιτητή'}
        <input
          autoFocus
          value={search}
          placeholder="Όνομα ή email (τουλάχιστον 2 χαρακτήρες)"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {search.trim().length >= 2 && (
        <div
          className="member-picker-results"
          role="listbox"
          aria-label="Αποτελέσματα αναζήτησης"
        >
          {query.isPending && <p>Αναζήτηση…</p>}
          {query.isError && (
            <ErrorNotice>{messageFor(query.error)}</ErrorNotice>
          )}
          {query.data?.data.length === 0 && <p>Δεν βρέθηκε διαθέσιμο μέλος.</p>}
          {query.data?.data.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => {
                onSelect(candidate);
                setSearch('');
              }}
            >
              <strong>{candidate.fullName}</strong>
              <span>{candidate.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({ course }: { course: CourseDetail }): React.JSX.Element {
  return (
    <aside className="course-summary" aria-label="Σύνοψη μαθήματος">
      <h2>Με μια ματιά</h2>
      <dl>
        <div>
          <dt>Διδάσκοντες</dt>
          <dd>{course.counts.instructorCount}</dd>
        </div>
        <div>
          <dt>Εγγεγραμμένοι φοιτητές</dt>
          <dd>{course.counts.studentCount}</dd>
        </div>
        <div>
          <dt>Έγγραφα μαθήματος</dt>
          <dd>{course.counts.documentCount}</dd>
        </div>
        <div>
          <dt>Πιστωτικές μονάδες</dt>
          <dd>{course.ectsCredits} ECTS</dd>
        </div>
      </dl>
    </aside>
  );
}

export function AdminCoursesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = Number(params.get('page') ?? '1');
  const requestedStatus = params.get('status');

  const status: 'all' | 'active' | 'inactive' =
    requestedStatus === 'active' || requestedStatus === 'inactive'
      ? requestedStatus
      : 'all';
  const search = useMemo(() => params.get('search') ?? '', [params]);
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
  });

  const create = useMutation({
    mutationFn: createAdminCourse,
    onSuccess: ({ data }) => {
      void client.invalidateQueries({ queryKey: courseListKey });
      setCreateOpen(false);
      navigate(`/app/courses/${data.id}`);
    },
  });

  const setFilter = useCallback((next: Record<string, string | undefined>) => {
    const updated = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) =>
      value ? updated.set(key, value) : updated.delete(key),
    );
    if (!('page' in next)) updated.delete('page');
    setParams(updated);
  }, [params, setParams]);

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
                  value={search}
                  onChange={(event) =>
                    setFilter({ search: event.target.value || undefined })
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

export function AdminCourseDetailPage(): React.JSX.Element {
  const { courseId = '' } = useParams();
  const client = useQueryClient();
  const [tab, setTab] = useState<'details' | 'instructors' | 'students'>(
    'details',
  );
  const [dialog, setDialog] = useState<
    'edit' | 'activation' | 'instructor' | 'student' | null
  >(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const courseQuery = useQuery({
    queryKey: [...courseListKey, courseId],
    queryFn: ({ signal }) => fetchAdminCourse(courseId, signal),
    enabled: !!courseId,
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: [...courseListKey, courseId] });
    await client.invalidateQueries({ queryKey: courseListKey });
  };
  const update = useMutation({
    mutationFn: (input: Parameters<typeof updateAdminCourse>[1]) =>
      updateAdminCourse(courseId, input),
    onSuccess: async () => {
      await refresh();
      setDialog(null);
      setNotice({ kind: 'success', text: 'Οι αλλαγές αποθηκεύτηκαν.' });
    },
  });
  const assign = useMutation({
    mutationFn: (input: Parameters<typeof assignCourseInstructor>[1]) =>
      assignCourseInstructor(courseId, input),
    onSuccess: async () => {
      await refresh();
      setDialog(null);
      setNotice({ kind: 'success', text: 'Ο διδάσκων ανατέθηκε στο μάθημα.' });
    },
  });
  const enroll = useMutation({
    mutationFn: (input: Parameters<typeof enrollCourseStudent>[1]) =>
      enrollCourseStudent(courseId, input),
    onSuccess: async () => {
      await refresh();
      setDialog(null);
      setNotice({ kind: 'success', text: 'Ο φοιτητής εγγράφηκε στο μάθημα.' });
    },
  });
  const detail = courseQuery.data?.data;
  if (courseQuery.isPending) return <p role="status">Φόρτωση μαθήματος…</p>;
  if (courseQuery.isError || !detail)
    return (
      <ErrorNotice>
        {courseQuery.isError
          ? messageFor(courseQuery.error)
          : 'Το μάθημα δεν βρέθηκε.'}
      </ErrorNotice>
    );
  const normalizedStudentSearch = studentSearch
    .trim()
    .toLocaleLowerCase('el-GR');
  const visibleEnrollments = detail.enrollments.filter(
    (enrollment) =>
      !normalizedStudentSearch ||
      [enrollment.fullName, enrollment.email]
        .join(' ')
        .toLocaleLowerCase('el-GR')
        .includes(normalizedStudentSearch),
  );
  const changeEnrollment = async (userId: string, status: EnrollmentStatus) => {
    try {
      setActionError(null);
      await updateCourseEnrollmentStatus(courseId, userId, { status });
      await refresh();
      setNotice({ kind: 'success', text: 'Η κατάσταση εγγραφής ενημερώθηκε.' });
    } catch (error) {
      setNotice(null);
      setActionError(messageFor(error));
    }
  };
  const removeInstructor = async (userId: string) => {
    try {
      setActionError(null);
      await removeCourseInstructor(courseId, userId);
      await refresh();
      setNotice({
        kind: 'success',
        text: 'Ο διδάσκων αφαιρέθηκε από το μάθημα.',
      });
    } catch (error) {
      setActionError(messageFor(error));
    }
  };
  return (
    <section className="admin-courses-page course-detail-page">
      <Link className="back-link" to="/app/courses">
        ← Όλα τα μαθήματα
      </Link>
      <header className="course-detail-header">
        <div>
          <p className="auth-kicker">
            {detail.code} · {detail.semester}ο εξάμηνο
          </p>
          <h1>{detail.title}</h1>
        </div>
        <span
          className={
            detail.isActive
              ? 'status-badge is-active'
              : 'status-badge is-inactive'
          }
        >
          {detail.isActive ? 'Ενεργό' : 'Ανενεργό'}
        </span>
      </header>
      {notice && (
        <p className="success-notice" role="status">
          {notice.text}
        </p>
      )}
      {actionError && <ErrorNotice>{actionError}</ErrorNotice>}
      <div className="course-detail-layout">
        <div className="course-list-card">
          <div className="course-filter-tabs" role="tablist">
            {(
              [
                ['details', 'Στοιχεία'],
                ['instructors', `Διδάσκοντες (${detail.instructors.length})`],
                ['students', `Φοιτητές (${detail.enrollments.length})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? 'is-active' : ''}
                type="button"
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'details' && (
            <div className="course-details">
              <div className="course-section-heading">
                <h2>Βασικά στοιχεία</h2>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setDialog('edit')}
                >
                  Επεξεργασία
                </button>
              </div>
              <dl>
                <div>
                  <dt>Τίτλος μαθήματος</dt>
                  <dd>{detail.title}</dd>
                </div>
                <div>
                  <dt>Κωδικός</dt>
                  <dd>{detail.code}</dd>
                </div>
                <div>
                  <dt>Εξάμηνο</dt>
                  <dd>{detail.semester}ο εξάμηνο</dd>
                </div>
                <div>
                  <dt>Πιστωτικές μονάδες</dt>
                  <dd>{detail.ectsCredits} ECTS</dd>
                </div>
              </dl>
              <section
                className="course-description-section"
                aria-labelledby="course-description-heading"
              >
                <h2 id="course-description-heading">Περιγραφή</h2>
                <p>{detail.description ?? 'Δεν έχει προστεθεί περιγραφή.'}</p>
              </section>
              <div className="danger-row">
                <div>
                  <h2>Κατάσταση μαθήματος</h2>
                  <p>
                    {detail.isActive
                      ? 'Η απενεργοποίηση διατηρεί τις εγγραφές, τις αναθέσεις και τα στοιχεία του μαθήματος.'
                      : 'Η ενεργοποίηση επαναφέρει το μάθημα στη διαθέσιμη κατάσταση, χωρίς να αλλάξει τις εγγραφές ή τις αναθέσεις.'}
                  </p>
                </div>
                <button
                  className={
                    detail.isActive ? 'danger-button' : 'primary-button'
                  }
                  type="button"
                  onClick={() => setDialog('activation')}
                >
                  {detail.isActive ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
                </button>
              </div>
            </div>
          )}
          {tab === 'instructors' && (
            <div className="course-members">
              <div className="course-section-heading">
                <h2>Διδάσκοντες μαθήματος</h2>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setDialog('instructor')}
                >
                  + Ανάθεση διδάσκοντα
                </button>
              </div>
              {detail.instructors.length === 0 ? (
                <p className="course-empty">Δεν έχουν ανατεθεί διδάσκοντες.</p>
              ) : (
                detail.instructors.map((item) => (
                  <div className="member-row" key={item.userId}>
                    <div>
                      <strong>{item.fullName}</strong>
                      <span>
                        {item.role === 'owner'
                          ? 'Υπεύθυνος μαθήματος'
                          : 'Συνεργάτης διδάσκων'}{' '}
                        · {item.email}
                      </span>
                    </div>
                    <button
                      className="text-danger-button"
                      type="button"
                      onClick={() => void removeInstructor(item.userId)}
                    >
                      Αφαίρεση
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'students' && (
            <div className="course-members">
              <div className="course-section-heading">
                <h2>Εγγραφές φοιτητών</h2>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setDialog('student')}
                >
                  + Εγγραφή φοιτητή
                </button>
              </div>
              {detail.enrollments.length === 0 ? (
                <p className="course-empty">
                  Δεν υπάρχουν εγγεγραμμένοι φοιτητές.
                </p>
              ) : (
                <>
                  <label className="course-member-search">
                    <span className="sr-only">
                      Αναζήτηση εγγεγραμμένων φοιτητών
                    </span>
                    <input
                      value={studentSearch}
                      placeholder="Αναζήτηση ονόματος ή email…"
                      onChange={(event) => setStudentSearch(event.target.value)}
                    />
                  </label>
                  {visibleEnrollments.length === 0 ? (
                    <p className="course-empty">
                      Δεν βρέθηκαν φοιτητές με αυτά τα στοιχεία.
                    </p>
                  ) : (
                    visibleEnrollments.map((item) => (
                      <div className="member-row" key={item.studentId}>
                        <div>
                          <strong>{item.fullName}</strong>
                          <span>{item.email}</span>
                        </div>
                        <label
                          className="sr-only"
                          htmlFor={`enrollment-${item.studentId}`}
                        >
                          Κατάσταση εγγραφής {item.fullName}
                        </label>
                        <select
                          id={`enrollment-${item.studentId}`}
                          value={item.status}
                          onChange={(event) => {
                            event.currentTarget.blur();
                            void changeEnrollment(
                              item.studentId,
                              event.target.value as EnrollmentStatus,
                            );
                          }}
                        >
                          <option value="active">Ενεργή</option>
                          <option value="inactive">Ανενεργή</option>
                          <option value="completed">Ολοκληρωμένη</option>
                        </select>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <Summary course={detail} />
      </div>
      {dialog === 'edit' && (
        <Dialog title="Επεξεργασία μαθήματος" onClose={() => setDialog(null)}>
          <CourseForm
            initial={detail}
            label="Αποθήκευση αλλαγών"
            pending={update.isPending}
            error={update.isError ? messageFor(update.error) : null}
            onCancel={() => setDialog(null)}
            onSubmit={(value) => update.mutate(value)}
          />
        </Dialog>
      )}
      {dialog === 'activation' && (
        <Dialog
          title={
            detail.isActive
              ? 'Απενεργοποίηση μαθήματος'
              : 'Ενεργοποίηση μαθήματος'
          }
          onClose={() => setDialog(null)}
        >
          <div className="confirm-dialog">
            <p>
              {detail.isActive
                ? 'Το μάθημα θα πάψει να είναι ενεργό. Οι εγγραφές, οι αναθέσεις και τα στοιχεία του θα διατηρηθούν.'
                : 'Το μάθημα θα γίνει ξανά ενεργό. Οι εγγραφές, οι αναθέσεις και τα στοιχεία του θα διατηρηθούν.'}
            </p>
            {update.isError && (
              <ErrorNotice>{messageFor(update.error)}</ErrorNotice>
            )}
            <footer className="course-dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDialog(null)}
              >
                Ακύρωση
              </button>
              <button
                className="primary-button"
                disabled={update.isPending}
                type="button"
                onClick={() => update.mutate({ isActive: !detail.isActive })}
              >
                Επιβεβαίωση
              </button>
            </footer>
          </div>
        </Dialog>
      )}
      {dialog === 'instructor' && (
        <MemberDialog
          title="Ανάθεση διδάσκοντα"
          courseId={courseId}
          role="professor"
          pending={assign.isPending}
          error={assign.isError ? messageFor(assign.error) : null}
          onClose={() => setDialog(null)}
          onSubmit={(candidate, instructorRole) =>
            assign.mutate({ instructorId: candidate.id, role: instructorRole })
          }
        />
      )}
      {dialog === 'student' && (
        <MemberDialog
          title="Εγγραφή φοιτητή"
          courseId={courseId}
          role="student"
          pending={enroll.isPending}
          error={enroll.isError ? messageFor(enroll.error) : null}
          onClose={() => setDialog(null)}
          onSubmit={(candidate) =>
            enroll.mutate({ studentId: candidate.id, status: 'active' })
          }
        />
      )}
    </section>
  );
}

function MemberDialog({
  title,
  courseId,
  role,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  courseId: string;
  role: 'professor' | 'student';
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (
    candidate: CourseMemberCandidate,
    role: CourseInstructorRole,
  ) => void;
}): React.JSX.Element {
  const [candidate, setCandidate] = useState<CourseMemberCandidate | null>(
    null,
  );
  const [instructorRole, setInstructorRole] =
    useState<CourseInstructorRole>('owner');
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="member-dialog">
        <MemberPicker courseId={courseId} role={role} onSelect={setCandidate} />
        {candidate && (
          <p className="selected-member">
            Επιλογή: <strong>{candidate.fullName}</strong> · {candidate.email}
          </p>
        )}
        {role === 'professor' && (
          <label>
            Ρόλος ανάθεσης
            <select
              value={instructorRole}
              onChange={(event) =>
                setInstructorRole(event.target.value as CourseInstructorRole)
              }
            >
              <option value="owner">Υπεύθυνος μαθήματος</option>
              <option value="assistant">Συνεργάτης διδάσκων</option>
            </select>
          </label>
        )}
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <footer className="course-dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Ακύρωση
          </button>
          <button
            className="primary-button"
            disabled={!candidate || pending}
            type="button"
            onClick={() => candidate && onSubmit(candidate, instructorRole)}
          >
            {pending
              ? 'Αποθήκευση…'
              : role === 'professor'
                ? 'Ανάθεση'
                : 'Εγγραφή'}
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
