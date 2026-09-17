import { Link } from 'react-router';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import type { DashboardForumThreadItem } from '@web-app/contracts';

import { formatRelativeDateTime } from '../lib/format-relative-time';
import { forumThreadStatusLabels } from '../lib/forum-thread-status';

export function DashboardWidget({
  title,
  viewAllHref,
  viewAllLabel = 'Προβολή όλων',
  icon,
  count,
  wide = false,
  tone = 'teal',
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  icon: React.ReactNode;
  count: number;
  wide?: boolean;
  tone?: 'teal' | 'blue' | 'amber' | 'green' | 'navy';
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      className={`dashboard-widget dashboard-widget--${tone}${wide ? ' is-wide' : ''}`}
    >
      <div className="dashboard-widget-heading">
        <div className="dashboard-widget-title">
          <span className="dashboard-widget-icon" aria-hidden="true">
            {icon}
          </span>
          <h2>{title}</h2>
          <span className="dashboard-widget-count">{count}</span>
        </div>
        {viewAllHref && (
          <Link className="dashboard-widget-viewall" to={viewAllHref}>
            {viewAllLabel}
            <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        )}
      </div>
      <div className="dashboard-widget-content">
        {isEmpty ? (
          <p className="dashboard-widget-empty">{emptyMessage}</p>
        ) : (
          children
        )}
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
    <button className="dashboard-list-item" type="button" onClick={onOpen}>
      <span className="dashboard-list-item-copy">
        <strong>{thread.title}</strong>
        <span>
          {thread.courseCode} · {forumThreadStatusLabels[thread.status]} ·{' '}
          {formatRelativeDateTime(thread.updatedAt)}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={17} />
    </button>
  );
}
