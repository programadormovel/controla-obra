import { useState, useEffect } from 'react';

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

export function usePagination<T>(items: T[], defaultPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // reset to page 1 whenever items or pageSize changes
  useEffect(() => { setPage(1); }, [items.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return {
    paged,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: items.length,
    start: items.length === 0 ? 0 : start + 1,
    end: Math.min(start + pageSize, items.length),
  };
}
