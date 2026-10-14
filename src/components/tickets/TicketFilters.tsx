'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { resetFilters, setFilters } from '@/src/store/ticketsSlice';
import { Priority, SlaStatus, TicketCategory, TicketStatus, TriageDecision } from '@/src/types/ticket';
import { RotateCcw, Search, X } from 'lucide-react';

export default function TicketFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { filters } = useAppSelector((state) => state.tickets);

  const [searchInput, setSearchInput] = useState(filters.search);
  const [, startTransition] = useTransition();

  // Synchronize state changes to URL search params
  const syncUrlParams = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
          if (!value || value === 'all' || (key === 'search' && !value.trim())) {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        });
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  // Debounced search effect (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== filters.search) {
        dispatch(setFilters({ search: searchInput, page: 1 }));
        syncUrlParams({ search: searchInput, page: '1' });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput, filters.search, dispatch, syncUrlParams]);

  const handleStatusChange = (status: TicketStatus | 'all') => {
    dispatch(setFilters({ status, page: 1 }));
    syncUrlParams({ status, page: '1' });
  };

  const handlePriorityChange = (priority: Priority | 'all') => {
    dispatch(setFilters({ priority, page: 1 }));
    syncUrlParams({ priority, page: '1' });
  };

  const handleCategoryChange = (category: TicketCategory | 'all') => {
    dispatch(setFilters({ category, page: 1 }));
    syncUrlParams({ category, page: '1' });
  };

  const handleTriageChange = (triageDecision: TriageDecision | 'all') => {
    dispatch(setFilters({ triageDecision, page: 1 }));
    syncUrlParams({ triageDecision, page: '1' });
  };

  const handleSlaChange = (slaStatus: SlaStatus | 'all') => {
    dispatch(setFilters({ slaStatus, page: 1 }));
    syncUrlParams({ slaStatus, page: '1' });
  };

  const handleReset = () => {
    setSearchInput('');
    dispatch(resetFilters());
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const isFiltered =
    Boolean(filters.search) ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.category !== 'all' ||
    filters.triageDecision !== 'all' ||
    filters.slaStatus !== 'all';

  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 mb-4 shadow-2xs space-y-3">
      
      {/* Search Bar + Clear button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tickets by ID, subject, customer, email, or company..."
            className="w-full pl-9 pr-8 py-2 rounded-lg text-xs sm:text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring transition-shadow"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/80 hover:bg-secondary border border-border transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Filter Select Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 text-xs">
        
        {/* Status */}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value as TicketStatus | 'all')}
            className="w-full py-1.5 px-2.5 rounded-md bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Priority
          </label>
          <select
            value={filters.priority}
            onChange={(e) => handlePriorityChange(e.target.value as Priority | 'all')}
            className="w-full py-1.5 px-2.5 rounded-md bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <option value="all">All Priorities</option>
            <option value="P0">P0 Urgent</option>
            <option value="P1">P1 High</option>
            <option value="P2">P2 Medium</option>
            <option value="P3">P3 Low</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleCategoryChange(e.target.value as TicketCategory | 'all')}
            className="w-full py-1.5 px-2.5 rounded-md bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            <option value="technical">Technical</option>
            <option value="billing">Billing</option>
            <option value="security">Security</option>
            <option value="account">Account</option>
            <option value="feature_request">Feature Request</option>
            <option value="general">General</option>
          </select>
        </div>

        {/* SLA Status */}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            SLA Status
          </label>
          <select
            value={filters.slaStatus}
            onChange={(e) => handleSlaChange(e.target.value as SlaStatus | 'all')}
            className="w-full py-1.5 px-2.5 rounded-md bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <option value="all">All SLA Timers</option>
            <option value="late">Breached / Late</option>
            <option value="at_risk">At Risk (&lt;20%)</option>
            <option value="on_track">On Track</option>
          </select>
        </div>

        {/* Triage Decision */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Triage Decision
          </label>
          <select
            value={filters.triageDecision}
            onChange={(e) => handleTriageChange(e.target.value as TriageDecision | 'all')}
            className="w-full py-1.5 px-2.5 rounded-md bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-ring focus:outline-hidden"
          >
            <option value="all">All Triage Types</option>
            <option value="automated">Automated Triage</option>
            <option value="manual_review">Manual Review Only</option>
          </select>
        </div>

      </div>
    </div>
  );
}
