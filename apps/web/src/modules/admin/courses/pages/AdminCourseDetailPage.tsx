import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  CourseDetail,
  CourseInstructorRole,
  CourseMemberCandidate,
  EnrollmentStatus,
} from '@web-app/contracts';

import {
  assignCourseInstructor,
  enrollCourseStudent,
  fetchAdminCourse,
  fetchCourseMemberCandidates,
  removeCourseInstructor,
  updateAdminCourse,
  updateCourseEnrollmentStatus,
} from '../../../../api/client';
import { messageFor } from '../utils/AdminCoursesUtils';
import { Dialog } from '../../../../components/Dialog';
import { ErrorNotice } from '../../../../components/feedback';
import { EmptyState } from '../../../../components/EmptyState';
import { QueryState } from '../../../../components/QueryState';
import { Tabs } from '../../../../components/Tabs';
import { useDialogState } from '../../../../hooks/useDialogState';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';
import { useParams } from 'react-router';
import { courseListKey } from '../utils/AdminCourses.const';
import { CourseForm } from '../components/AdminCourseForm';
import { PageLayout } from '../../../../components/PageLayout';
import { StatusBadge } from '../../../../components/StatusBadge';
import { useSetWorkspaceBreadcrumb } from '../../../../components/workspaceBreadcrumb';

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

export function AdminCourseDetailPage(): React.JSX.Element {
  const { courseId = '' } = useParams();
  const [tab, setTab] = useState<'details' | 'instructors' | 'students'>(
    'details',
  );
  const { dialog, openDialog, closeDialog } = useDialogState<
    'edit' | 'activation' | 'instructor' | 'student'
  >();
  const [studentSearch, setStudentSearch] = useState('');
  const courseQuery = useQuery({
    queryKey: [...courseListKey, courseId],
    queryFn: ({ signal }) => fetchAdminCourse(courseId, signal),
    enabled: !!courseId,
  });
  useSetWorkspaceBreadcrumb(
    courseQuery.data
      ? [
          { label: 'Μαθήματα', to: '/app/courses' },
          { label: courseQuery.data.data.code },
        ]
      : null,
  );
  const invalidateKeys = [courseListKey, [...courseListKey, courseId]];
  const update = useNotifyingMutation({
    mutationFn: (input: Parameters<typeof updateAdminCourse>[1]) =>
      updateAdminCourse(courseId, input),
    invalidateKeys,
    successMessage: (_data, input) =>
      typeof input.isActive === 'boolean'
        ? input.isActive
          ? 'Το μάθημα ενεργοποιήθηκε.'
          : 'Το μάθημα απενεργοποιήθηκε.'
        : 'Οι αλλαγές αποθηκεύτηκαν.',
    onSuccess: closeDialog,
  });
  const assign = useNotifyingMutation({
    mutationFn: (input: Parameters<typeof assignCourseInstructor>[1]) =>
      assignCourseInstructor(courseId, input),
    invalidateKeys,
    successMessage: 'Ο διδάσκων ανατέθηκε στο μάθημα.',
    onSuccess: closeDialog,
  });
  const enroll = useNotifyingMutation({
    mutationFn: (input: Parameters<typeof enrollCourseStudent>[1]) =>
      enrollCourseStudent(courseId, input),
    invalidateKeys,
    successMessage: 'Ο φοιτητής εγγράφηκε στο μάθημα.',
    onSuccess: closeDialog,
  });
  const removeInstructorMutation = useNotifyingMutation({
    mutationFn: (userId: string) => removeCourseInstructor(courseId, userId),
    invalidateKeys,
    successMessage: 'Ο διδάσκων αφαιρέθηκε από το μάθημα.',
    notifyOnError: true,
  });
  const updateEnrollmentMutation = useNotifyingMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: EnrollmentStatus;
    }) => updateCourseEnrollmentStatus(courseId, userId, { status }),
    invalidateKeys,
    successMessage: 'Η κατάσταση εγγραφής ενημερώθηκε.',
    notifyOnError: true,
  });

  return (
    <QueryState
      query={courseQuery}
      loadingLabel="Φόρτωση μαθήματος…"
      errorOptions={{ fallback: 'Το μάθημα δεν βρέθηκε.' }}
    >
      {(course) => {
        const detail = course.data;
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
        return (
          <PageLayout
            title={detail.title}
            subtitle={
              <div className="flex items-center gap-2">
                <StatusBadge
                  active={detail.isActive}
                  activeLabel="Ενεργό"
                  inactiveLabel="Ανενεργό"
                />
                <span>{`${detail.code} · ${detail.semester}ο εξάμηνο`}</span>
              </div>
            }
            actions={
              <button
                className="primary-button"
                type="button"
                onClick={() => openDialog('edit')}
              >
                Επεξεργασία
              </button>
            }
          >
            <div className="course-detail-layout">
              <div className="course-list-card">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  items={[
                    { value: 'details', label: 'Στοιχεία' },
                    {
                      value: 'instructors',
                      label: `Διδάσκοντες (${detail.instructors.length})`,
                    },
                    {
                      value: 'students',
                      label: `Φοιτητές (${detail.enrollments.length})`,
                    },
                  ]}
                />
                {tab === 'details' && (
                  <div className="course-details">
                    <div className="course-section-heading">
                      <h2>Βασικά στοιχεία</h2>
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
                      <p>
                        {detail.description ?? 'Δεν έχει προστεθεί περιγραφή.'}
                      </p>
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
                        onClick={() => openDialog('activation')}
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
                        onClick={() => openDialog('instructor')}
                      >
                        + Ανάθεση διδάσκοντα
                      </button>
                    </div>
                    {detail.instructors.length === 0 ? (
                      <EmptyState message="Δεν έχουν ανατεθεί διδάσκοντες." />
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
                            onClick={() =>
                              removeInstructorMutation.mutate(item.userId)
                            }
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
                        onClick={() => openDialog('student')}
                      >
                        + Εγγραφή φοιτητή
                      </button>
                    </div>
                    {detail.enrollments.length === 0 ? (
                      <EmptyState message="Δεν υπάρχουν εγγεγραμμένοι φοιτητές." />
                    ) : (
                      <>
                        <label className="course-member-search">
                          <span className="sr-only">
                            Αναζήτηση εγγεγραμμένων φοιτητών
                          </span>
                          <input
                            value={studentSearch}
                            placeholder="Αναζήτηση ονόματος ή email…"
                            onChange={(event) =>
                              setStudentSearch(event.target.value)
                            }
                          />
                        </label>
                        {visibleEnrollments.length === 0 ? (
                          <EmptyState message="Δεν βρέθηκαν φοιτητές με αυτά τα στοιχεία." />
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
                                  updateEnrollmentMutation.mutate({
                                    userId: item.studentId,
                                    status: event.target
                                      .value as EnrollmentStatus,
                                  });
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
              <CourseForm
                title="Επεξεργασία μαθήματος"
                initial={detail}
                submitLabel="Αποθήκευση αλλαγών"
                pending={update.isPending}
                error={update.isError ? messageFor(update.error) : null}
                onCancel={closeDialog}
                onSubmit={(value) => update.mutate(value)}
              />
            )}
            {dialog === 'activation' && (
              <Dialog
                title={
                  detail.isActive
                    ? 'Απενεργοποίηση μαθήματος'
                    : 'Ενεργοποίηση μαθήματος'
                }
                onClose={closeDialog}
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
                      onClick={closeDialog}
                    >
                      Ακύρωση
                    </button>
                    <button
                      className="primary-button"
                      disabled={update.isPending}
                      type="button"
                      onClick={() =>
                        update.mutate({ isActive: !detail.isActive })
                      }
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
                onClose={closeDialog}
                onSubmit={(candidate, instructorRole) =>
                  assign.mutate({
                    instructorId: candidate.id,
                    role: instructorRole,
                  })
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
                onClose={closeDialog}
                onSubmit={(candidate) =>
                  enroll.mutate({ studentId: candidate.id, status: 'active' })
                }
              />
            )}
          </PageLayout>
        );
      }}
    </QueryState>
  );
}
