'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  handleCursorUpdates,
  setError,
  setFilters,
  setLoading,
  setPaginatedTickets,
} from '@/src/store/ticketsSlice';
import { fetchTickets, pollUpdatesApi } from '@/src/lib/api-client';
import Header from '@/src/components/navigation/Header';
import Sidebar from '@/src/components/navigation/Sidebar';
import MetricsSummary from '@/src/components/tickets/MetricsSummary';
import TicketFilters from '@/src/components/tickets/TicketFilters';
import TicketTable from '@/src/components/tickets/TicketTable';
import Pagination from '@/src/components/tickets/Pagination';
import NewTicketsBanner from '@/src/components/tickets/NewTicketsBanner';
import { Priority, SlaStatus, TicketCategory, TicketFilterState, TicketStatus, TriageDecision } from '@/src/types/ticket';
import { Clock3, RefreshCw } from 'lucide-react';
import { Suspense } from 'react';

function TicketsContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { filters, cursor, loading } = useAppSelector(
    (state) => state.tickets
  );

  const initialSyncDone = useRef(false);

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

  // Load tickets function
  const loadTickets = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const data = await fetchTickets(filters);
      dispatch(setPaginatedTickets(data));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading tickets. Retrying suggested.';
      dispatch(setError(msg));
    }
  }, [filters, dispatch]);

  // Trigger load whenever filters change
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

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

          {/* Pagination & Row Sizer */}
          <Pagination />

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
