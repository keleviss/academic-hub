import { Link } from 'react-router';
import { ArrowRight, Route } from 'lucide-react';
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
    <section className="flex flex-col gap-5 bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-4">
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
      </div>
      <div className="flex justify-between items-center gap-4">
        <div className="dashboard-roadmap-continue-meta">
          <span>{statusLabels[node.status]}</span>
        </div>
        <Link
          className="dashboard-widget-viewall"
          to={`/app/courses/${node.courseId}?tab=roadmap&node=${node.id}`}
        >
          Συνέχεια στον χάρτη
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </section>
  );
}
