'use client';

import React from 'react';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { setFilters } from '@/src/store/ticketsSlice';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination() {
  const dispatch = useAppDispatch();
  const { totalCount, page, pageSize, totalPages, loading } = useAppSelector(
    (state) => state.tickets
  );

  if (totalCount === 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      dispatch(setFilters({ page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    dispatch(setFilters({ pageSize: newSize, page: 1 }));
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-2 text-xs text-muted-foreground border-t border-border mt-2">
      
      {/* Range and Total */}
      <div className="flex items-center gap-3">
        <span>
          Showing{' '}
          <strong className="font-semibold text-foreground tabular-nums">
            {startItem.toLocaleString()}
          </strong>{' '}
          to{' '}
          <strong className="font-semibold text-foreground tabular-nums">
            {endItem.toLocaleString()}
          </strong>{' '}
          of{' '}
          <strong className="font-semibold text-foreground tabular-nums">
            {totalCount.toLocaleString()}
          </strong>{' '}
          tickets
        </span>

        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5 ml-2">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="py-1 px-1.5 rounded bg-background border border-border text-foreground text-xs focus:ring-1 focus:ring-ring"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Page Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handlePageChange(1)}
          disabled={page <= 1 || loading}
          className="p-1.5 rounded hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1 || loading}
          className="p-1.5 rounded hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-2 font-mono text-xs text-foreground">
          Page <strong className="tabular-nums font-semibold">{page}</strong> of{' '}
          <span className="tabular-nums">{totalPages}</span>
        </span>

        <button
          type="button"
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages || loading}
          className="p-1.5 rounded hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handlePageChange(totalPages)}
          disabled={page >= totalPages || loading}
          className="p-1.5 rounded hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
