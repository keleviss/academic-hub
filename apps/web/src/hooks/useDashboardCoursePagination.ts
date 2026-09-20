import { useState } from 'react';

export function useDashboardCoursePagination<T>(
  items: readonly T[],
  itemsPerPage = 2,
): {
  currentPage: number;
  totalPages: number;
  visibleItems: readonly T[];
  goToPreviousPage: () => void;
  goToNextPage: () => void;
} {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageSize = Math.max(1, itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    visibleItems: items.slice(pageStart, pageStart + pageSize),
    goToPreviousPage: () => setRequestedPage((page) => Math.max(1, page - 1)),
    goToNextPage: () =>
      setRequestedPage((page) => Math.min(totalPages, page + 1)),
  };
}
