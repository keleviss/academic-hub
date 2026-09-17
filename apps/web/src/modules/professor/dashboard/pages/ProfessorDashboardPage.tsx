import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  MessageCircleWarning,
  MessagesSquare,
} from 'lucide-react';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import {
  fetchProfessorDashboard,
  professorDashboardQueryKey,
} from '../../../../api/client';
import {
  DashboardThreadButton,
  DashboardWidget,
} from '../../../../components/DashboardWidget';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import { formatRelativeDateTime } from '../../../../lib/format-relative-time';

export function ProfessorDashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const dashboardQuery = useQuery({
    queryKey: professorDashboardQueryKey(),
    queryFn: ({ signal }) => fetchProfessorDashboard(signal),
  });

  const openThread = (thread: DashboardForumThreadItem) =>
    navigate(`/app/courses/${thread.courseId}/discussions/${thread.id}`);

  return (
    <PageLayout
      title="Επισκόπηση"
      subtitle="Η εικόνα των μαθημάτων σου και ό,τι χρειάζεται παρέμβαση."
    >
      <QueryState
        query={dashboardQuery}
        loadingLabel="Φόρτωση επισκόπησης…"
        onRetry={() => void dashboardQuery.refetch()}
      >
        {(response) => {
          const data = response.data;
          const countersByCourse = new Map(
            data.perCourseCounters.map((counters) => [
              counters.courseId,
              counters,
            ]),
          );

          return (
            <div className="dashboard-layout dashboard-layout--professor">
              <div className="dashboard-professor-primary-grid">
                <section className="dashboard-courses-anchor dashboard-courses-anchor--professor">
                  <div className="dashboard-section-heading">
                    <div>
                      <div className="dashboard-section-header">
                        <BookOpen aria-hidden="true" size={16} />
                        <h2>Τα μαθήματά μου</h2>
                      </div>
                      <p>Η κατάσταση κάθε μαθήματος με μια ματιά.</p>
                    </div>
                    <Link className="dashboard-section-link" to="/app/courses">
                      Όλα τα μαθήματα
                      <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  </div>

                  {data.courses.length === 0 ? (
                    <p className="dashboard-anchor-empty">
                      Δεν έχεις αναθέσεις μαθημάτων ακόμα.
                    </p>
                  ) : (
                    <div className="dashboard-professor-course-list">
                      {data.courses.map((course) => {
                        const counters = countersByCourse.get(course.id);

                        return (
                          <button
                            className="dashboard-course-card dashboard-course-card--professor"
                            key={course.id}
                            type="button"
                            onClick={() =>
                              navigate(`/app/courses/${course.id}`)
                            }
                          >
                            <span className="dashboard-professor-course-copy">
                              <span className="dashboard-course-code">
                                {course.code}
                              </span>
                              <strong>{course.title}</strong>
                            </span>
                            <span className="dashboard-course-health">
                              <span>
                                <b>{counters?.openCount ?? 0}</b>
                                ανοιχτές
                              </span>
                              <span className="is-attention">
                                <b>{counters?.unansweredCount ?? 0}</b>
                                χρειάζονται απάντηση
                              </span>
                              <span className="is-positive">
                                <b>{counters?.recentlyVerifiedCount ?? 0}</b>
                                πρόσφατα verified
                              </span>
                            </span>
                            <span className="dashboard-course-action">
                              Προβολή
                              <ArrowRight aria-hidden="true" size={16} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="dashboard-attention-panel dashboard-attention-panel--professor">
                  <div className="dashboard-attention-heading">
                    <span
                      className="dashboard-attention-icon"
                      aria-hidden="true"
                    >
                      <MessageCircleWarning size={19} />
                    </span>
                    <div>
                      <span>Προτεραιότητα</span>
                      <h2>Χρειάζονται απάντηση</h2>
                    </div>
                    <strong>{data.unansweredThreads.length}</strong>
                  </div>

                  {data.unansweredThreads.length === 0 ? (
                    <p className="dashboard-attention-empty">
                      Δεν υπάρχουν αναπάντητες συζητήσεις.
                    </p>
                  ) : (
                    <div className="dashboard-attention-list">
                      {data.unansweredThreads.slice(0, 4).map((thread) => (
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
                              {formatRelativeDateTime(thread.updatedAt)}
                            </small>
                          </span>
                          <ChevronRight aria-hidden="true" size={17} />
                        </button>
                      ))}
                    </div>
                  )}

                  <Link className="dashboard-attention-link" to="/app/courses">
                    Προβολή όλων
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </section>
              </div>

              <div className="dashboard-support-grid">
                <DashboardWidget
                  title="Ανοιχτές απορίες"
                  viewAllHref="/app/courses"
                  icon={<CircleHelp size={18} />}
                  count={data.openThreads.length}
                  tone="teal"
                  isEmpty={data.openThreads.length === 0}
                  emptyMessage="Δεν υπάρχουν ανοιχτές συζητήσεις."
                >
                  {data.openThreads.slice(0, 3).map((thread) => (
                    <DashboardThreadButton
                      key={thread.id}
                      thread={thread}
                      onOpen={() => openThread(thread)}
                    />
                  ))}
                </DashboardWidget>
                <DashboardWidget
                  title="Πρόσφατη δραστηριότητα"
                  viewAllHref="/app/courses"
                  icon={<MessagesSquare size={18} />}
                  count={data.recentActivity.length}
                  tone="blue"
                  isEmpty={data.recentActivity.length === 0}
                  emptyMessage="Δεν υπάρχει πρόσφατη δραστηριότητα."
                >
                  {data.recentActivity.slice(0, 3).map((thread) => (
                    <DashboardThreadButton
                      key={thread.id}
                      thread={thread}
                      onOpen={() => openThread(thread)}
                    />
                  ))}
                </DashboardWidget>
              </div>
            </div>
          );
        }}
      </QueryState>
    </PageLayout>
  );
}
