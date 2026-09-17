import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import type { ProfessorDashboardConfusionPoint } from '@web-app/contracts';

import {
  fetchProfessorDashboard,
  professorDashboardQueryKey,
} from '../../../../api/client';
import { DashboardConfusionPointButton } from '../../../../components/DashboardWidget';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';

export function ProfessorAnalyticsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const dashboardQuery = useQuery({
    queryKey: professorDashboardQueryKey(),
    queryFn: ({ signal }) => fetchProfessorDashboard(signal),
  });

  const openConfusionPoint = (point: ProfessorDashboardConfusionPoint) =>
    navigate(`/app/courses/${point.courseId}/documents/${point.documentId}`);

  return (
    <PageLayout
      title="Analytics"
      subtitle="Ενδείξεις μάθησης που οδηγούν σε συγκεκριμένες διδακτικές ενέργειες."
    >
      <QueryState
        query={dashboardQuery}
        loadingLabel="Φόρτωση analytics…"
        onRetry={() => void dashboardQuery.refetch()}
      >
        {(response) => {
          const points = response.data.confusionPoints;

          return (
            <div className="course-list-card">
              <div className="course-members">
                <div className="course-section-heading">
                  <div className="dashboard-section-header">
                    <AlertTriangle aria-hidden="true" size={16} />
                    <h2>Σημεία σύγχυσης</h2>
                  </div>
                  <p>
                    Έγγραφα με τουλάχιστον 2 απορίες ή δυσνόητα σημεία από 2
                    διαφορετικούς φοιτητές τις τελευταίες 14 ημέρες.
                  </p>
                </div>

                {points.length === 0 ? (
                  <p className="dashboard-anchor-empty">
                    Δεν εντοπίστηκαν σημεία σύγχυσης αυτή τη στιγμή.
                  </p>
                ) : (
                  points.map((point) => (
                    <DashboardConfusionPointButton
                      key={point.documentId}
                      point={point}
                      onOpen={() => openConfusionPoint(point)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        }}
      </QueryState>
    </PageLayout>
  );
}
