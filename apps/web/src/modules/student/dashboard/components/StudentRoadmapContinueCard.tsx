import { Link } from 'react-router';
import { ArrowRight, Clock3, Route } from 'lucide-react';
import type { StudentDashboardContinueNode } from '@web-app/contracts';

const statusLabels = {
  not_started: 'Επόμενο βήμα',
  in_progress: 'Σε εξέλιξη',
  needs_review: 'Χρειάζεται επανάληψη',
} as const;

export function StudentRoadmapContinueCard({
  node,
}: {
  node: StudentDashboardContinueNode;
}): React.JSX.Element {
  return (
    <section className="dashboard-roadmap-continue">
      <span className="dashboard-roadmap-continue-icon" aria-hidden="true">
        <Route size={21} />
      </span>
      <div className="dashboard-roadmap-continue-copy">
        <span>Συνέχισε τη μελέτη</span>
        <h2>{node.title}</h2>
        <p>
          {node.courseCode} · {node.courseTitle}
        </p>
      </div>
      <div className="dashboard-roadmap-continue-meta">
        <span>{statusLabels[node.status]}</span>
        {node.estimatedMinutes && (
          <span>
            <Clock3 aria-hidden="true" size={14} />
            {node.estimatedMinutes} λεπτά
          </span>
        )}
      </div>
      <Link
        className="secondary-button dashboard-roadmap-continue-action"
        to={`/app/courses/${node.courseId}?tab=roadmap&node=${node.id}`}
      >
        Συνέχεια στον χάρτη
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </section>
  );
}
