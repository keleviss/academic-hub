import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import {
  fetchStudentDashboard,
  studentDashboardQueryKey,
} from '../../../../api/client';
import { DashboardThreadButton, DashboardWidget } from '../../../../components/DashboardWidget';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';

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
      subtitle="Τα μαθήματά σου και η πρόσφατη δραστηριότητά σου με μια ματιά."
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
                emptyMessage="Δεν είσαι εγγεγραμμένος σε κάποιο μάθημα ακόμα."
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
                title="Πρόσφατες σημειώσεις"
                viewAllHref="/app/courses"
                isEmpty={data.recentNotes.length === 0}
                emptyMessage="Δεν υπάρχουν πρόσφατες σημειώσεις."
              >
                {data.recentNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/app/courses/${note.courseId}/documents/${note.documentId}`,
                      )
                    }
                  >
                    <strong>{note.body ?? 'Χωρίς κείμενο'}</strong>
                    <span>
                      {note.courseCode} · Σελίδα {note.target.pageNumber}
                    </span>
                  </button>
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Ανοιχτές απορίες"
                viewAllHref="/app/courses"
                isEmpty={data.openQuestions.length === 0}
                emptyMessage="Δεν υπάρχουν ανοιχτές απορίες."
              >
                {data.openQuestions.map((thread) => (
                  <DashboardThreadButton
                    key={thread.id}
                    thread={thread}
                    onOpen={() => openThread(thread)}
                  />
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Πρόσφατες επίσημες απαντήσεις"
                viewAllHref="/app/courses"
                isEmpty={data.verifiedAnswers.length === 0}
                emptyMessage="Δεν υπάρχουν ακόμα επίσημες απαντήσεις."
              >
                {data.verifiedAnswers.map((thread) => (
                  <DashboardThreadButton
                    key={thread.id}
                    thread={thread}
                    onOpen={() => openThread(thread)}
                  />
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Συζητήσεις με νέα δραστηριότητα"
                viewAllHref="/app/courses"
                isEmpty={data.activeDiscussions.length === 0}
                emptyMessage="Δεν υπάρχει πρόσφατη δραστηριότητα συζητήσεων."
              >
                {data.activeDiscussions.map((thread) => (
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
