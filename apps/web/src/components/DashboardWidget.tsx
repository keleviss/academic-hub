import { Link } from 'react-router';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import { formatRelativeDateTime } from '../lib/format-relative-time';
import { forumThreadStatusLabels } from '../lib/forum-thread-status';

export function DashboardWidget({
  title,
  viewAllHref,
  viewAllLabel = 'Προβολή όλων',
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="visibility-explainer dashboard-widget">
      <div className="dashboard-widget-heading">
        <h2>{title}</h2>
        {viewAllHref && (
          <Link className="dashboard-widget-viewall" to={viewAllHref}>
            {viewAllLabel}
          </Link>
        )}
      </div>
      <div className="document-activity-summary">
        <div className="document-activity-group">
          {isEmpty ? <span>{emptyMessage}</span> : children}
        </div>
      </div>
    </section>
  );
}

export function DashboardThreadButton({
  thread,
  onOpen,
}: {
  thread: DashboardForumThreadItem;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button type="button" onClick={onOpen}>
      <strong>{thread.title}</strong>
      <span>
        {thread.courseCode} · {forumThreadStatusLabels[thread.status]} ·{' '}
        {formatRelativeDateTime(thread.updatedAt)}
      </span>
    </button>
  );
}
