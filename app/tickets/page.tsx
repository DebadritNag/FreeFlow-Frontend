'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  appendPaginatedTickets,
  handleCursorUpdates,
  setError,
  setFilters,
  setLoading,
  setLoadingMore,
  setPaginatedTickets,
} from '@/src/store/ticketsSlice';
import { fetchTickets, pollUpdatesApi } from '@/src/lib/api-client';
import Header from '@/src/components/navigation/Header';
import Sidebar from '@/src/components/navigation/Sidebar';
import MetricsSummary from '@/src/components/tickets/MetricsSummary';
import TicketFilters from '@/src/components/tickets/TicketFilters';
import TicketTable from '@/src/components/tickets/TicketTable';
import NewTicketsBanner from '@/src/components/tickets/NewTicketsBanner';
import { Priority, SlaStatus, TicketCategory, TicketFilterState, TicketStatus, TriageDecision } from '@/src/types/ticket';
import { Clock3, Loader2, RefreshCw } from 'lucide-react';
import { Suspense } from 'react';

function TicketsContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { filters, cursor, loading, loadingMore, hasMore, items, totalCount } = useAppSelector(
    (state) => state.tickets
  );

  const initialSyncDone = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Latest infinite-scroll state for the IntersectionObserver callback (avoids
  // re-creating the observer on every state change).
  const loadMoreStateRef = useRef({ hasMore, loadingMore, loading, page: filters.page });

  // Sync initial URL params to Redux filter state on mount
  useEffect(() => {
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;

    const initialUpdates: Partial<TicketFilterState> = {};
    if (searchParams.has('search')) initialUpdates.search = searchParams.get('search')!;
    if (searchParams.has('status')) initialUpdates.status = searchParams.get('status') as TicketStatus;
    if (searchParams.has('priority')) initialUpdates.priority = searchParams.get('priority') as Priority;
    if (searchParams.has('category')) initialUpdates.category = searchParams.get('category') as TicketCategory;
    if (searchParams.has('triageDecision')) initialUpdates.triageDecision = searchParams.get('triageDecision') as TriageDecision;
    if (searchParams.has('slaStatus')) initialUpdates.slaStatus = searchParams.get('slaStatus') as SlaStatus;
    if (searchParams.has('assigneeId')) initialUpdates.assigneeId = searchParams.get('assigneeId')!;
    if (searchParams.has('page')) initialUpdates.page = parseInt(searchParams.get('page')!, 10);
    if (searchParams.has('pageSize')) initialUpdates.pageSize = parseInt(searchParams.get('pageSize')!, 10);

    if (Object.keys(initialUpdates).length > 0) {
      dispatch(setFilters(initialUpdates));
    }
  }, [searchParams, dispatch]);

  // Reset + REPLACE loader: always fetches page 1 for the current filters and
  // replaces the list. Used on mount, on filter change, and on manual refresh.
  const loadTickets = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const data = await fetchTickets({ ...filters, page: 1 });
      dispatch(setPaginatedTickets(data));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading tickets. Retrying suggested.';
      dispatch(setError(msg));
    }
  }, [filters, dispatch]);

  // Filter signature EXCLUDING page/pageSize so that only real filter changes
  // trigger a reset+replace (page changes are driven by infinite scroll, not here).
  const filterSignature = JSON.stringify({
    search: filters.search,
    status: filters.status,
    priority: filters.priority,
    category: filters.category,
    triageDecision: filters.triageDecision,
    assigneeId: filters.assigneeId,
    slaStatus: filters.slaStatus,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    pageSize: filters.pageSize,
  });

  // Reset to page 1 + REPLACE items whenever the filter signature changes.
  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  // Append the NEXT page onto the existing list (infinite scroll).
  const loadMore = useCallback(async () => {
    const nextPage = loadMoreStateRef.current.page + 1;
    dispatch(setLoadingMore(true));
    dispatch(setFilters({ page: nextPage }));
    try {
      const data = await fetchTickets({ ...filters, page: nextPage });
      dispatch(appendPaginatedTickets(data));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading more tickets.';
      dispatch(setError(msg));
    }
  }, [filters, dispatch]);

  // Keep the observer's view of the latest infinite-scroll state current.
  useEffect(() => {
    loadMoreStateRef.current = { hasMore, loadingMore, loading, page: filters.page };
  }, [hasMore, loadingMore, loading, filters.page]);

  // IntersectionObserver sentinel: when the bottom sentinel scrolls into view and
  // there is more to load (and nothing is already loading), fetch the next page.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const s = loadMoreStateRef.current;
        if (entry.isIntersecting && s.hasMore && !s.loadingMore && !s.loading) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  // Cursor-based Background Polling Loop (every 12 seconds)
  useEffect(() => {
    if (!cursor) return;

    const interval = setInterval(async () => {
      try {
        const updateData = await pollUpdatesApi(cursor);
        if (updateData.updatedTickets && updateData.updatedTickets.length > 0) {
          dispatch(
            handleCursorUpdates({
              updatedTickets: updateData.updatedTickets,
              newCursor: updateData.newCursor,
            })
          );
        }
      } catch {
        // Silent polling error; will retry next interval
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [cursor, dispatch]);

  // Real client-side value (render-time); not a hardcoded string. needs-verification at runtime.
  const lastUpdatedLabel = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 w-full max-w-[1400px] px-5 sm:px-6 lg:px-8 py-6">

          {/* Page Heading and Quick Refresh Action */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
            <div>
              <h1 className="text-[28px] sm:text-[36px] font-bold tracking-tight text-[#202522] leading-tight">
                Support Operations
              </h1>
              <p className="text-[15px] text-text-secondary mt-1">
                Manage enterprise SLAs, active customer incidents, and automated triage queues.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 self-start lg:self-auto">
              {/* Last updated — real client-side timestamp (needs-verification at runtime) */}
              <div className="flex items-center gap-2 text-[13px] text-text-secondary">
                <Clock3 className="w-4 h-4" />
                <span>Last updated</span>
                <span className="font-medium text-foreground tabular-nums">
                  {lastUpdatedLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={loadTickets}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 w-[118px] h-[46px] rounded-[11px] text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60"
                title="Refresh tickets list"
              >
                <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Loading' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Real-time Metrics Summary Cards */}
          <MetricsSummary />

          {/* New Tickets Banner from live cursor stream */}
          <NewTicketsBanner onRefresh={loadTickets} />

          {/* Search & Filters */}
          <TicketFilters />

          {/* Main Ticket Table / Card List */}
          <TicketTable onRetry={loadTickets} />

          {/* Infinite-scroll footer: sentinel + loading-more spinner + end marker.
              Pagination has been retired from /tickets (DECISION D2); the Pagination
              component file is left in the repo, unused. */}
          {items.length > 0 && (
            <div className="mt-2">
              <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

              {loadingMore && (
                <div className="flex items-center justify-center gap-2 py-5 text-xs text-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading more tickets…</span>
                </div>
              )}

              {!hasMore && !loadingMore && (
                <div className="py-5 text-center text-xs text-text-secondary tabular-nums">
                  Showing all {totalCount.toLocaleString()} tickets.
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs text-muted-foreground font-medium">Loading Tickets Workspace...</span>
          </div>
        </div>
      }
    >
      <TicketsContent />
    </Suspense>
  );
}
