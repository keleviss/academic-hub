import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import {
  fetchProfessorDashboard,
  professorDashboardQueryKey,
} from '../../../../api/client';
import { DashboardThreadButton, DashboardWidget } from '../../../../components/DashboardWidget';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';

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
      subtitle="Τα μαθήματά σου και η κατάσταση των συζητήσεών τους."
    >
      <QueryState
        query={dashboardQuery}
        loadingLabel="Φόρτωση επισκόπησης…"
        onRetry={() => void dashboardQuery.refetch()}
      >
        {(response) => {
          const data = response.data;
          return (
            <div className="dashboard-grid">
              <DashboardWidget
                title="Τα μαθήματά μου"
                viewAllHref="/app/courses"
                isEmpty={data.courses.length === 0}
                emptyMessage="Δεν έχεις αναθέσεις μαθημάτων ακόμα."
              >
                {data.courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => navigate(`/app/courses/${course.id}`)}
                  >
                    <strong>{course.title}</strong>
                    <span>{course.code}</span>
                  </button>
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Χρειάζονται απάντηση"
                viewAllHref="/app/courses"
                isEmpty={data.unansweredThreads.length === 0}
                emptyMessage="Δεν υπάρχουν αναπάντητες συζητήσεις."
              >
                {data.unansweredThreads.map((thread) => (
                  <DashboardThreadButton
                    key={thread.id}
                    thread={thread}
                    onOpen={() => openThread(thread)}
                  />
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Ανοιχτές απορίες"
                viewAllHref="/app/courses"
                isEmpty={data.openThreads.length === 0}
                emptyMessage="Δεν υπάρχουν ανοιχτές συζητήσεις."
              >
                {data.openThreads.map((thread) => (
                  <DashboardThreadButton
                    key={thread.id}
                    thread={thread}
                    onOpen={() => openThread(thread)}
                  />
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Πρόσφατη δραστηριότητα συζητήσεων"
                viewAllHref="/app/courses"
                isEmpty={data.recentActivity.length === 0}
                emptyMessage="Δεν υπάρχει πρόσφατη δραστηριότητα."
              >
                {data.recentActivity.map((thread) => (
                  <DashboardThreadButton
                    key={thread.id}
                    thread={thread}
                    onOpen={() => openThread(thread)}
                  />
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Αριθμοί ανά μάθημα"
                isEmpty={data.perCourseCounters.length === 0}
                emptyMessage="Δεν έχεις αναθέσεις μαθημάτων ακόμα."
              >
                <table className="dashboard-counters-table">
                  <thead>
                    <tr>
                      <th>Μάθημα</th>
                      <th>Αναπάντητες</th>
                      <th>Ανοιχτές</th>
                      <th>Πρόσφατα verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perCourseCounters.map((row) => (
                      <tr key={row.courseId}>
                        <td>
                          <button
                            type="button"
                            onClick={() => navigate(`/app/courses/${row.courseId}`)}
                          >
                            {row.courseCode}
                          </button>
                        </td>
                        <td>{row.unansweredCount}</td>
                        <td>{row.openCount}</td>
                        <td>{row.recentlyVerifiedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DashboardWidget>
            </div>
          );
        }}
      </QueryState>
    </PageLayout>
  );
}
