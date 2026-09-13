export function Pagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}): React.JSX.Element | null {
  if (totalPages <= 1) return null;

  return (
    <nav className="course-pagination" aria-label={ariaLabel}>
      <button
        disabled={page <= 1}
        type="button"
        onClick={() => onPageChange(page - 1)}
      >
        Προηγούμενη
      </button>
      <span>
        Σελίδα {page} από {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        type="button"
        onClick={() => onPageChange(page + 1)}
      >
        Επόμενη
      </button>
    </nav>
  );
}
