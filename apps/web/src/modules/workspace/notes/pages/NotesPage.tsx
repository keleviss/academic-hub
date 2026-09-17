import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { StickyNote } from 'lucide-react';

import {
  fetchStudentDashboard,
  studentDashboardQueryKey,
} from '../../../../api/client';
import { useAuthenticatedUser } from '../../../../auth/authenticatedUser';
import { DashboardNoteButton } from '../../../../components/DashboardWidget';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';

export function NotesPage(): React.JSX.Element {
  const user = useAuthenticatedUser();
  const navigate = useNavigate();
  const isStudent = user.role === 'student';

  const dashboardQuery = useQuery({
    queryKey: studentDashboardQueryKey(),
    queryFn: ({ signal }) => fetchStudentDashboard(signal),
    enabled: isStudent,
  });

  return (
    <PageLayout
      title="Σημειώσεις"
      subtitle="Οι προσωπικές σου σημειώσεις πάνω στο υλικό των μαθημάτων."
    >
      <section className="dashboard-courses-anchor">
        <div className="dashboard-section-heading">
          <div>
            <div className="dashboard-section-header">
              <StickyNote aria-hidden="true" size={16} />
              <h2>Σημειώσεις</h2>
            </div>
            <p>
              Οι προσωπικές σου σημειώσεις πάνω στο υλικό των μαθημάτων σου.
            </p>
          </div>
        </div>

        {!isStudent ? (
          <p className="dashboard-anchor-empty">
            Οι σημειώσεις που προσθέτεις πάνω σε έγγραφα μαθημάτων θα
            εμφανίζονται εδώ.
          </p>
        ) : (
          <QueryState
            query={dashboardQuery}
            loadingLabel="Φόρτωση σημειώσεων…"
            onRetry={() => void dashboardQuery.refetch()}
          >
            {(response) => {
              const notes = response.data.recentNotes;

              return notes.length === 0 ? (
                <p className="dashboard-anchor-empty">
                  Δεν έχεις προσθέσει σημειώσεις ακόμα.
                </p>
              ) : (
                <div className="course-members">
                  {notes.map((note) => (
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
                </div>
              );
            }}
          </QueryState>
        )}
      </section>
    </PageLayout>
  );
}
