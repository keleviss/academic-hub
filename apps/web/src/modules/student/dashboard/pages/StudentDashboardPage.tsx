import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  BookOpen,
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
                icon={<BookOpen size={18} />}
                count={data.courses.length}
                isEmpty={data.courses.length === 0}
                emptyMessage="Δεν είσαι εγγεγραμμένος σε κάποιο μάθημα ακόμα."
              >
                {data.courses.map((course) => (
                  <button
                    className="dashboard-list-item"
                    key={course.id}
                    type="button"
                    onClick={() => navigate(`/app/courses/${course.id}`)}
                  >
                    <span className="dashboard-list-item-copy">
                      <strong>{course.title}</strong>
                      <span>{course.code}</span>
                    </span>
                    <ChevronRight aria-hidden="true" size={17} />
                  </button>
                ))}
              </DashboardWidget>
              <DashboardWidget
                title="Πρόσφατες σημειώσεις"
                viewAllHref="/app/courses"
                icon={<StickyNote size={18} />}
                count={data.recentNotes.length}
                isEmpty={data.recentNotes.length === 0}
                emptyMessage="Δεν υπάρχουν πρόσφατες σημειώσεις."
              >
                {data.recentNotes.map((note) => (
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
              <DashboardWidget
                title="Ανοιχτές απορίες"
                viewAllHref="/app/courses"
                icon={<CircleHelp size={18} />}
                count={data.openQuestions.length}
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
                icon={<BadgeCheck size={18} />}
                count={data.verifiedAnswers.length}
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
                icon={<MessagesSquare size={18} />}
                count={data.activeDiscussions.length}
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
