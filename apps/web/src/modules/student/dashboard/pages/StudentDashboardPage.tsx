import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  MessagesSquare,
  StickyNote,
} from 'lucide-react';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import {
  fetchStudentDashboard,
  studentDashboardQueryKey,
} from '../../../../api/client';
import {
  DashboardThreadButton,
  DashboardWidget,
} from '../../../../components/DashboardWidget';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import { formatRelativeDateTime } from '../../../../lib/format-relative-time';
import { forumThreadStatusLabels } from '../../../../lib/forum-thread-status';

function countItemsByCourse(
  items: ReadonlyArray<{ courseId: string }>,
): Map<string, number> {
  return items.reduce((counts, item) => {
    counts.set(item.courseId, (counts.get(item.courseId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

export function StudentDashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const dashboardQuery = useQuery({
    queryKey: studentDashboardQueryKey(),
    queryFn: ({ signal }) => fetchStudentDashboard(signal),
  });

  const openThread = (thread: DashboardForumThreadItem) =>
    navigate(`/app/courses/${thread.courseId}/discussions/${thread.id}`);

  return (
    <PageLayout
      title="Επισκόπηση"
      subtitle="Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου."
    >
      <QueryState
        query={dashboardQuery}
        loadingLabel="Φόρτωση επισκόπησης…"
        onRetry={() => void dashboardQuery.refetch()}
      >
        {(response) => {
          const data = response.data;
          const openQuestionsByCourse = countItemsByCourse(data.openQuestions);
          const recentNotesByCourse = countItemsByCourse(data.recentNotes);

          return (
            <div className="dashboard-layout dashboard-layout--student">
              <section className="dashboard-courses-anchor">
                <div className="dashboard-section-heading">
                  <div>
                    <div className="dashboard-section-header">
                      <BookOpen aria-hidden="true" size={16} />
                      <h2>Τα μαθήματά μου</h2>
                    </div>
                    <p>Διάλεξε μάθημα και συνέχισε από το υλικό του.</p>
                  </div>
                  <Link className="dashboard-section-link" to="/app/courses">
                    Όλα τα μαθήματα
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>

                {data.courses.length === 0 ? (
                  <p className="dashboard-anchor-empty">
                    Δεν είσαι εγγεγραμμένος σε κάποιο μάθημα ακόμα.
                  </p>
                ) : (
                  <div className="dashboard-student-course-grid">
                    {data.courses.map((course, index) => {
                      const openQuestionCount =
                        openQuestionsByCourse.get(course.id) ?? 0;
                      const recentNoteCount =
                        recentNotesByCourse.get(course.id) ?? 0;

                      return (
                        <button
                          className="dashboard-course-card dashboard-course-card--student"
                          data-accent={String((index % 4) + 1)}
                          key={course.id}
                          type="button"
                          onClick={() => navigate(`/app/courses/${course.id}`)}
                        >
                          <span className="dashboard-course-code">
                            {course.code}
                          </span>
                          <strong>{course.title}</strong>
                          <span className="dashboard-course-meta">
                            {course.semester} · {course.counts.documentCount}{' '}
                            {course.counts.documentCount === 1
                              ? 'έγγραφο'
                              : 'έγγραφα'}
                          </span>
                          <span className="dashboard-course-signals">
                            <span>
                              <b>{openQuestionCount}</b> ανοιχτές απορίες
                            </span>
                            <span>
                              <b>{recentNoteCount}</b> πρόσφατες σημειώσεις
                            </span>
                          </span>
                          <span className="dashboard-course-action">
                            Άνοιγμα μαθήματος
                            <ArrowRight aria-hidden="true" size={16} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="dashboard-student-priority-grid">
                <section className="dashboard-attention-panel">
                  <div className="dashboard-attention-heading">
                    <span
                      className="dashboard-attention-icon"
                      aria-hidden="true"
                    >
                      <CircleHelp size={19} />
                    </span>
                    <div>
                      <span>Χρειάζονται την προσοχή σου</span>
                      <h2>Ανοιχτές απορίες</h2>
                    </div>
                    <strong>{data.openQuestions.length}</strong>
                  </div>

                  {data.openQuestions.length === 0 ? (
                    <p className="dashboard-attention-empty">
                      Δεν υπάρχουν ανοιχτές απορίες.
                    </p>
                  ) : (
                    <div className="dashboard-attention-list">
                      {data.openQuestions.slice(0, 4).map((thread) => (
                        <button
                          className="dashboard-attention-item"
                          key={thread.id}
                          type="button"
                          onClick={() => openThread(thread)}
                        >
                          <span>
                            <strong>{thread.title}</strong>
                            <small>
                              {thread.courseCode} ·{' '}
                              {forumThreadStatusLabels[thread.status]} ·{' '}
                              {formatRelativeDateTime(thread.updatedAt)}
                            </small>
                          </span>
                          <ChevronRight aria-hidden="true" size={17} />
                        </button>
                      ))}
                    </div>
                  )}

                  <Link className="dashboard-attention-link" to="/app/courses">
                    Όλες οι απορίες
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </section>

                <DashboardWidget
                  title="Πρόσφατες σημειώσεις"
                  viewAllHref="/app/courses"
                  icon={<StickyNote size={18} />}
                  count={data.recentNotes.length}
                  tone="blue"
                  isEmpty={data.recentNotes.length === 0}
                  emptyMessage="Δεν υπάρχουν πρόσφατες σημειώσεις."
                >
                  {data.recentNotes.slice(0, 3).map((note) => (
                    <button
                      className="dashboard-list-item"
                      key={note.id}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/app/courses/${note.courseId}/documents/${note.documentId}`,
                        )
                      }
                    >
                      <span className="dashboard-list-item-copy">
                        <strong>{note.body ?? 'Χωρίς κείμενο'}</strong>
                        <span>
                          {note.courseCode} · Σελίδα {note.target.pageNumber}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" size={17} />
                    </button>
                  ))}
                </DashboardWidget>
              </div>

              {data.verifiedAnswers.length === 0 ? (
                <div className="dashboard-info-strip">
                  <CheckCircle2 aria-hidden="true" size={19} />
                  <span>Δεν έχεις νέες επίσημες απαντήσεις.</span>
                </div>
              ) : (
                <DashboardWidget
                  title="Πρόσφατες επίσημες απαντήσεις"
                  viewAllHref="/app/courses"
                  icon={<BadgeCheck size={18} />}
                  count={data.verifiedAnswers.length}
                  tone="green"
                  wide
                  isEmpty={false}
                  emptyMessage=""
                >
                  {data.verifiedAnswers.slice(0, 3).map((thread) => (
                    <DashboardThreadButton
                      key={thread.id}
                      thread={thread}
                      onOpen={() => openThread(thread)}
                    />
                  ))}
                </DashboardWidget>
              )}

              <DashboardWidget
                title="Συζητήσεις με νέα δραστηριότητα"
                viewAllHref="/app/courses"
                icon={<MessagesSquare size={18} />}
                count={data.activeDiscussions.length}
                tone="blue"
                wide
                isEmpty={data.activeDiscussions.length === 0}
                emptyMessage="Δεν υπάρχει πρόσφατη δραστηριότητα συζητήσεων."
              >
                {data.activeDiscussions.slice(0, 3).map((thread) => (
                  <DashboardThreadButton
                    key={thread.id}
                    thread={thread}
                    onOpen={() => openThread(thread)}
                  />
                ))}
              </DashboardWidget>
            </div>
          );
        }}
      </QueryState>
    </PageLayout>
  );
}
