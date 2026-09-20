import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Sparkles,
  StickyNote,
} from 'lucide-react';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import {
  fetchStudentDashboard,
  studentDashboardQueryKey,
} from '../../../../api/client';
import {
  DashboardNoteButton,
  DashboardWidget,
} from '../../../../components/DashboardWidget';
import { DashboardCoursePagination } from '../../../../components/DashboardCoursePagination';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import { useDashboardCoursePagination } from '../../../../hooks/useDashboardCoursePagination';
import { formatRelativeDateTime } from '../../../../lib/format-relative-time';
import { forumThreadStatusLabels } from '../../../../lib/forum-thread-status';
import { StudentRoadmapContinueCard } from '../components/StudentRoadmapContinueCard';

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
  const coursePagination = useDashboardCoursePagination(
    dashboardQuery.data?.data.courses ?? [],
    2,
  );

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
              <div className="dashboard-student-columns">
                <div className="dashboard-student-column dashboard-student-column--primary">
                  <section className="dashboard-courses-anchor">
                    <div className="dashboard-section-heading">
                      <div>
                        <div className="dashboard-section-header">
                          <BookOpen aria-hidden="true" size={16} />
                          <h2>Τα μαθήματά μου</h2>
                        </div>
                        <p>Διάλεξε μάθημα και συνέχισε από το υλικό του.</p>
                      </div>
                      <Link
                        className="dashboard-section-link"
                        to="/app/courses"
                      >
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
                        {coursePagination.visibleItems.map((course) => {
                          const openQuestionCount =
                            openQuestionsByCourse.get(course.id) ?? 0;
                          const recentNoteCount =
                            recentNotesByCourse.get(course.id) ?? 0;

                          return (
                            <button
                              className="dashboard-course-card dashboard-course-card--student"
                              key={course.id}
                              type="button"
                              onClick={() =>
                                navigate(`/app/courses/${course.id}`)
                              }
                            >
                              <div className="dashboard-course-card-top">
                                <span className="dashboard-course-code">
                                  {course.code}
                                </span>
                                {course.hasRecentMaterial && (
                                  <span
                                    className="dashboard-course-new-badge"
                                    title="Νέο υλικό τις τελευταίες ημέρες"
                                  >
                                    <Sparkles aria-hidden="true" size={11} />
                                    Νέο υλικό
                                  </span>
                                )}
                              </div>
                              <strong>{course.title}</strong>
                              <div className="dashboard-course-roadmap-progress">
                                {course.roadmap.totalNodeCount === 0 ? (
                                  <span className="dashboard-course-roadmap-empty">
                                    Δεν έχει δημοσιευτεί χάρτης ύλης
                                  </span>
                                ) : (
                                  <>
                                    <div className="dashboard-course-roadmap-heading">
                                      <span>Πρόοδος ύλης</span>
                                      <b>
                                        {course.roadmap.completedNodeCount} /{' '}
                                        {course.roadmap.totalNodeCount}
                                      </b>
                                    </div>
                                    <div
                                      aria-label={`Πρόοδος χάρτη ${course.roadmap.completionPercentage}%`}
                                      aria-valuemax={100}
                                      aria-valuemin={0}
                                      aria-valuenow={
                                        course.roadmap.completionPercentage
                                      }
                                      className="dashboard-course-roadmap-track"
                                      role="progressbar"
                                    >
                                      <span
                                        style={{
                                          width: `${course.roadmap.completionPercentage}%`,
                                        }}
                                      />
                                    </div>
                                    {course.roadmap.needsReviewCount > 0 && (
                                      <small>
                                        {course.roadmap.needsReviewCount}{' '}
                                        {course.roadmap.needsReviewCount === 1
                                          ? 'ενότητα χρειάζεται'
                                          : 'ενότητες χρειάζονται'}{' '}
                                        επανάληψη
                                      </small>
                                    )}
                                  </>
                                )}
                              </div>
                              <span className="dashboard-course-signals">
                                <span>
                                  <b>{openQuestionCount}</b> ανοιχτές απορίες
                                </span>
                                <span>
                                  <b>{recentNoteCount}</b> πρόσφατες σημειώσεις
                                </span>
                              </span>
                            </button>
                          );
                        })}
                        <DashboardCoursePagination
                          currentPage={coursePagination.currentPage}
                          totalPages={coursePagination.totalPages}
                          onNextPage={coursePagination.goToNextPage}
                          onPreviousPage={coursePagination.goToPreviousPage}
                        />
                      </div>
                    )}
                  </section>

                  <section className="dashboard-attention-panel">
                    <div className="dashboard-attention-heading">
                      <span
                        className="dashboard-attention-icon"
                        aria-hidden="true"
                      >
                        <CircleHelp size={19} />
                      </span>
                      <div>
                        <h2>Ανοιχτές απορίες</h2>
                      </div>
                      <strong>{data.openQuestions.length}</strong>
                      <Link
                        className="dashboard-widget-viewall"
                        to="/app/activity"
                      >
                        Όλες οι απορίες
                        <ArrowRight aria-hidden="true" size={15} />
                      </Link>
                    </div>

                    {data.openQuestions.length === 0 ? (
                      <p className="dashboard-attention-empty">
                        Δεν υπάρχουν ανοιχτές απορίες.
                      </p>
                    ) : (
                      <div className="dashboard-attention-list">
                        {data.openQuestions.slice(0, 3).map((thread) => (
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
                  </section>
                </div>

                <div className="dashboard-student-column dashboard-student-column--secondary">
                  {data.continueLearning && (
                    <StudentRoadmapContinueCard node={data.continueLearning} />
                  )}

                  <DashboardWidget
                    title="Πρόσφατες σημειώσεις"
                    viewAllHref="/app/notes"
                    icon={<StickyNote size={18} />}
                    count={data.recentNotes.length}
                    tone="blue"
                    isEmpty={data.recentNotes.length === 0}
                    emptyMessage="Δεν υπάρχουν πρόσφατες σημειώσεις."
                  >
                    {data.recentNotes.slice(0, 3).map((note) => (
                      <DashboardNoteButton
                        key={note.id}
                        note={note}
                        onOpen={() =>
                          navigate(
                            `/app/courses/${note.courseId}/documents/${note.documentId}`,
                          )
                        }
                      />
                    ))}
                  </DashboardWidget>
                </div>
              </div>

              {/* {data.verifiedAnswers.length === 0 ? null : (
                <DashboardWidget
                  title="Πρόσφατες επίσημες απαντήσεις"
                  viewAllHref="/app/activity"
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
              )} */}

              {/* <DashboardWidget
                title="Συζητήσεις με νέα δραστηριότητα"
                viewAllHref="/app/activity"
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
              </DashboardWidget> */}
            </div>
          );
        }}
      </QueryState>
    </PageLayout>
  );
}
