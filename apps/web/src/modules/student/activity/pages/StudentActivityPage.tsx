import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CircleHelp, MessagesSquare, StickyNote } from 'lucide-react';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import {
  fetchStudentDashboard,
  studentDashboardQueryKey,
} from '../../../../api/client';
import {
  DashboardNoteButton,
  DashboardThreadButton,
  DashboardWidget,
} from '../../../../components/DashboardWidget';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';

export function StudentActivityPage(): React.JSX.Element {
  const navigate = useNavigate();
  const dashboardQuery = useQuery({
    queryKey: studentDashboardQueryKey(),
    queryFn: ({ signal }) => fetchStudentDashboard(signal),
  });

  const openThread = (thread: DashboardForumThreadItem) =>
    navigate(`/app/courses/${thread.courseId}/discussions/${thread.id}`);

  return (
    <PageLayout
      title="Δραστηριότητα"
      subtitle="Οι απορίες, σημειώσεις και συζητήσεις σου σε όλα τα μαθήματα."
    >
      <QueryState
        query={dashboardQuery}
        loadingLabel="Φόρτωση δραστηριότητας…"
        onRetry={() => void dashboardQuery.refetch()}
      >
        {(response) => {
          const data = response.data;

          return (
            <div className="dashboard-layout">
              <div className="dashboard-support-grid">
                <DashboardWidget
                  title="Ανοιχτές απορίες"
                  icon={<CircleHelp size={18} />}
                  count={data.openQuestions.length}
                  tone="teal"
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
                  title="Πρόσφατες σημειώσεις"
                  icon={<StickyNote size={18} />}
                  count={data.recentNotes.length}
                  tone="blue"
                  isEmpty={data.recentNotes.length === 0}
                  emptyMessage="Δεν υπάρχουν πρόσφατες σημειώσεις."
                >
                  {data.recentNotes.map((note) => (
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

              <DashboardWidget
                title="Πρόσφατες επίσημες απαντήσεις"
                icon={<BadgeCheck size={18} />}
                count={data.verifiedAnswers.length}
                tone="green"
                wide
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
                icon={<MessagesSquare size={18} />}
                count={data.activeDiscussions.length}
                tone="blue"
                wide
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
