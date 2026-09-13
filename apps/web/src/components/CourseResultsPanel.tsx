import { Fragment } from 'react';

/**
 * Shared filters/header/card-or-list layout for course listing pages (professor, student, ...).
 * Callers own the item type, filter controls, and card/row rendering.
 */
export function CourseResultsPanel<T>({
  view,
  items,
  getKey,
  renderCard,
  renderRow,
  filters,
  header,
  emptyState,
}: {
  view: 'cards' | 'list';
  items: T[];
  getKey: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  renderRow: (item: T) => React.ReactNode;
  filters?: React.ReactNode;
  header?: React.ReactNode;
  emptyState?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="course-results">
      {filters}
      {header}
      {emptyState ??
        (view === 'cards' ? (
          <div className="course-card-grid">
            {items.map((item) => (
              <Fragment key={getKey(item)}>{renderCard(item)}</Fragment>
            ))}
          </div>
        ) : (
          <div className="course-list-rows">
            {items.map((item) => (
              <Fragment key={getKey(item)}>{renderRow(item)}</Fragment>
            ))}
          </div>
        ))}
    </section>
  );
}
