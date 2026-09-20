import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DashboardCoursePagination({
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
}: {
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Σελιδοποίηση μαθημάτων"
      className="dashboard-course-pagination"
    >
      <button
        aria-label="Προηγούμενη σελίδα μαθημάτων"
        disabled={currentPage <= 1}
        type="button"
        onClick={onPreviousPage}
      >
        <ChevronLeft aria-hidden="true" size={16} />
      </button>
      <span aria-label={`Σελίδα ${currentPage} από ${totalPages}`}>
        {currentPage}
      </span>
      <button
        aria-label="Επόμενη σελίδα μαθημάτων"
        disabled={currentPage >= totalPages}
        type="button"
        onClick={onNextPage}
      >
        <ChevronRight aria-hidden="true" size={16} />
      </button>
    </nav>
  );
}
