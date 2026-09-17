import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight } from 'lucide-react';
import type {
  DashboardForumThreadItem,
  ProfessorDashboardConfusionPoint,
  ProfessorDashboard,
  StudentDashboard,
} from '@web-app/contracts';

import {
  fetchProfessorDashboard,
  fetchStudentDashboard,
  professorDashboardQueryKey,
  studentDashboardQueryKey,
} from '../../../../api/client';
import { useAuthenticatedUser } from '../../../../auth/authenticatedUser';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import { forumThreadStatusLabels } from '../../../../lib/forum-thread-status';

interface TimelineEntry {
  id: string;
  at: string;
  title: string;
  meta: string;
  onOpen: () => void;
}

function threadEntry(
  thread: DashboardForumThreadItem,
  openThread: (thread: DashboardForumThreadItem) => void,
): TimelineEntry {
  return {
    id: thread.id,
    at: thread.updatedAt,
    title: thread.title,
    meta: `${thread.courseCode} · ${forumThreadStatusLabels[thread.status]}`,
    onOpen: () => openThread(thread),
  };
}

function buildStudentTimeline(
  data: StudentDashboard,
  openThread: (thread: DashboardForumThreadItem) => void,
  openDocument: (courseId: string, documentId: string) => void,
): TimelineEntry[] {
  return [
    ...data.openQuestions.map((thread) => threadEntry(thread, openThread)),
    ...data.verifiedAnswers.map((thread) => threadEntry(thread, openThread)),
    ...data.activeDiscussions.map((thread) => threadEntry(thread, openThread)),
    ...data.recentNotes.map((note) => ({
      id: note.id,
      at: note.createdAt,
      title: note.body ?? 'Σημείωση χωρίς κείμενο',
      meta: `${note.courseCode} · Σελίδα ${note.target.pageNumber}`,
      onOpen: () => openDocument(note.courseId, note.documentId),
    })),
  ];
}

function buildProfessorTimeline(
  data: ProfessorDashboard,
  openThread: (thread: DashboardForumThreadItem) => void,
  openDocument: (courseId: string, documentId: string) => void,
): TimelineEntry[] {
  return [
    ...data.unansweredThreads.map((thread) => threadEntry(thread, openThread)),
    ...data.openThreads.map((thread) => threadEntry(thread, openThread)),
    ...data.confusionPoints.map((point: ProfessorDashboardConfusionPoint) => ({
      id: point.documentId,
      at: point.lastSignalAt,
      title: point.documentTitle,
      meta: `${point.courseCode} · ${point.questionCount} απορίες · ${point.confusingCount} δυσνόητα`,
      onOpen: () => openDocument(point.courseId, point.documentId),
    })),
  ];
}

function dedupeById(entries: TimelineEntry[]): TimelineEntry[] {
  const byId = new Map<string, TimelineEntry>();
  for (const entry of entries) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

function groupByDay(entries: TimelineEntry[]): [string, TimelineEntry[]][] {
  const sorted = dedupeById(entries).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  const formatter = new Intl.DateTimeFormat('el-GR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of sorted) {
    const label = formatter.format(new Date(entry.at));
    const group = groups.get(label) ?? [];
    group.push(entry);
    groups.set(label, group);
  }
  return [...groups.entries()];
}

function Timeline({ entries }: { entries: TimelineEntry[] }): React.JSX.Element {
  const groups = groupByDay(entries);

  if (groups.length === 0) {
    return (
      <p className="dashboard-anchor-empty">Δεν υπάρχει πρόσφατη δραστηριότητα.</p>
    );
  }

  return (
    <div className="course-members calendar-timeline">
      {groups.map(([day, items]) => (
        <div className="calendar-timeline-group" key={day}>
          <h3>{day}</h3>
          <div className="calendar-timeline-items">
            {items.map((entry) => (
              <button
                className="dashboard-list-item"
                key={entry.id}
                type="button"
                onClick={entry.onOpen}
              >
                <span className="dashboard-list-item-copy">
                  <strong>{entry.title}</strong>
                  <span>{entry.meta}</span>
                </span>
                <ChevronRight aria-hidden="true" size={17} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CalendarPage(): React.JSX.Element {
  const user = useAuthenticatedUser();
  const navigate = useNavigate();
  const isStudent = user.role === 'student';
  const isProfessor = user.role === 'professor';

  const studentQuery = useQuery({
    queryKey: studentDashboardQueryKey(),
    queryFn: ({ signal }) => fetchStudentDashboard(signal),
    enabled: isStudent,
  });
  const professorQuery = useQuery({
    queryKey: professorDashboardQueryKey(),
    queryFn: ({ signal }) => fetchProfessorDashboard(signal),
    enabled: isProfessor,
  });

  const openThread = (thread: DashboardForumThreadItem) =>
    navigate(`/app/courses/${thread.courseId}/discussions/${thread.id}`);
  const openDocument = (courseId: string, documentId: string) =>
    navigate(`/app/courses/${courseId}/documents/${documentId}`);

  return (
    <PageLayout
      title="Ημερολόγιο"
      subtitle="Το πρόσφατο χρονολόγιο δραστηριότητας στα μαθήματά σου."
    >
      <section className="dashboard-courses-anchor">
        <div className="dashboard-section-heading">
          <div>
            <div className="dashboard-section-header">
              <CalendarDays aria-hidden="true" size={16} />
              <h2>Πρόσφατο χρονολόγιο</h2>
            </div>
            <p>
              Οι πιο πρόσφατες συζητήσεις, απαντήσεις και σημειώσεις σου, σε
              χρονολογική σειρά.
            </p>
          </div>
        </div>

        {isStudent && (
          <QueryState
            query={studentQuery}
            loadingLabel="Φόρτωση ημερολογίου…"
            onRetry={() => void studentQuery.refetch()}
          >
            {(response) => (
              <Timeline
                entries={buildStudentTimeline(
                  response.data,
                  openThread,
                  openDocument,
                )}
              />
            )}
          </QueryState>
        )}

        {isProfessor && (
          <QueryState
            query={professorQuery}
            loadingLabel="Φόρτωση ημερολογίου…"
            onRetry={() => void professorQuery.refetch()}
          >
            {(response) => (
              <Timeline
                entries={buildProfessorTimeline(
                  response.data,
                  openThread,
                  openDocument,
                )}
              />
            )}
          </QueryState>
        )}

        {!isStudent && !isProfessor && (
          <p className="dashboard-anchor-empty">
            Το χρονολόγιο δραστηριότητας θα εμφανίζεται εδώ.
          </p>
        )}
      </section>
    </PageLayout>
  );
}
