import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  FileWarning,
  HelpCircle,
  MessageCircleWarning,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { ProfessorDashboardConfusionPoint } from '@web-app/contracts';

import {
  fetchProfessorDashboard,
  professorDashboardQueryKey,
} from '../../../../api/client';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import {
  QuestionsAnsweredChart,
  StudentProgressChart,
} from '../components/CourseAnalyticsCharts';

function ConfusionPointRow({
  point,
  onOpen,
}: {
  point: ProfessorDashboardConfusionPoint;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button className="analytics-confusion-item" type="button" onClick={onOpen}>
      <span className="analytics-confusion-icon" aria-hidden="true">
        <FileWarning size={18} />
      </span>
      <span className="analytics-confusion-copy">
        <strong>{point.documentTitle}</strong>
        <span className="analytics-confusion-course">
          {point.courseCode} · {point.courseTitle}
        </span>
      </span>
      <span className="analytics-confusion-stats">
        <span className="analytics-stat-pill is-question">
          <HelpCircle aria-hidden="true" size={12} />
          {point.questionCount} απορίες
        </span>
        <span className="analytics-stat-pill is-confusing">
          <MessageCircleWarning aria-hidden="true" size={12} />
          {point.confusingCount} δυσνόητα
        </span>
        <span className="analytics-stat-pill is-students">
          <Users aria-hidden="true" size={12} />
          {point.studentCount} φοιτητές
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={17} />
    </button>
  );
}

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
          const courseAnalytics = response.data.courseAnalytics;

          return (
            <div className="analytics-page-layout">
              <div className="analytics-charts-grid">
                <section className="dashboard-courses-anchor">
                  <div className="dashboard-section-heading">
                    <div>
                      <div className="dashboard-section-header">
                        <BarChart3 aria-hidden="true" size={16} />
                        <h2>Απορίες ανά μάθημα</h2>
                      </div>
                      <p>
                        Σύνολο αποριών και απαντημένων συζητήσεων ανά μάθημα.
                      </p>
                    </div>
                  </div>

                  {courseAnalytics.length === 0 ? (
                    <p className="dashboard-anchor-empty">
                      Δεν υπάρχουν ακόμα δεδομένα για τα μαθήματά σου.
                    </p>
                  ) : (
                    <div className="course-members">
                      <QuestionsAnsweredChart courses={courseAnalytics} />
                    </div>
                  )}
                </section>

                <section className="dashboard-courses-anchor">
                  <div className="dashboard-section-heading">
                    <div>
                      <div className="dashboard-section-header">
                        <TrendingUp aria-hidden="true" size={16} />
                        <h2>Πρόοδος φοιτητών ανά μάθημα</h2>
                      </div>
                      <p>
                        Μέση πρόοδος φοιτητών στον χάρτη ύλης κάθε μαθήματος.
                      </p>
                    </div>
                  </div>

                  {courseAnalytics.length === 0 ? (
                    <p className="dashboard-anchor-empty">
                      Δεν υπάρχουν ακόμα δεδομένα για τα μαθήματά σου.
                    </p>
                  ) : (
                    <div className="course-members">
                      <StudentProgressChart courses={courseAnalytics} />
                    </div>
                  )}
                </section>
              </div>

              <section className="dashboard-courses-anchor">
                <div className="dashboard-section-heading">
                  <div>
                    <div className="dashboard-section-header">
                      <AlertTriangle aria-hidden="true" size={16} />
                      <h2>Σημεία σύγχυσης</h2>
                    </div>
                    <p>
                      Έγγραφα με τουλάχιστον 2 απορίες ή δυσνόητα σημεία από 2
                      διαφορετικούς φοιτητές τις τελευταίες 14 ημέρες.
                    </p>
                  </div>
                </div>

                {points.length === 0 ? (
                  <p className="dashboard-anchor-empty">
                    Δεν εντοπίστηκαν σημεία σύγχυσης αυτή τη στιγμή.
                  </p>
                ) : (
                  <div className="course-members">
                    <div className="analytics-confusion-list">
                      {points.map((point) => (
                        <ConfusionPointRow
                          key={point.documentId}
                          point={point}
                          onOpen={() => openConfusionPoint(point)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          );
        }}
      </QueryState>
    </PageLayout>
  );
}
