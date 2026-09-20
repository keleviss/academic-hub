import { useState } from 'react';

const coursesPerPage = 2;

export function useDashboardCoursePagination<T>(items: readonly T[]): {
  currentPage: number;
  totalPages: number;
  visibleItems: readonly T[];
  goToPreviousPage: () => void;
  goToNextPage: () => void;
} {
  const [requestedPage, setRequestedPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / coursesPerPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * coursesPerPage;

  return {
    currentPage,
    totalPages,
    visibleItems: items.slice(pageStart, pageStart + coursesPerPage),
    goToPreviousPage: () => setRequestedPage((page) => Math.max(1, page - 1)),
    goToNextPage: () =>
      setRequestedPage((page) => Math.min(totalPages, page + 1)),
  };
}
