'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { setFilters } from '@/src/store/ticketsSlice';
import { AlertTriangle, Clock, Inbox, ShieldAlert } from 'lucide-react';

export default function MetricsSummary() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { metrics } = useAppSelector((state) => state.tickets);

  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-card border border-border animate-pulse p-4"
          />
        ))}
      </div>
    );
  }

  const handleOpenClick = () => {
    dispatch(setFilters({ status: 'open', page: 1 }));
  };

  const handleInProgressClick = () => {
    dispatch(setFilters({ status: 'in_progress', page: 1 }));
  };

  const handleSlaRiskClick = () => {
    dispatch(setFilters({ slaStatus: 'at_risk', page: 1 }));
  };

  const handleManualReviewClick = () => {
    router.push('/review');
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      
      {/* 1. Open Tickets */}
      <button
        type="button"
        onClick={handleOpenClick}
        className="group flex flex-col text-left p-3.5 sm:p-4 rounded-xl bg-card hover:bg-secondary/40 border border-border shadow-2xs transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-medium text-muted-foreground">Open Backlog</span>
          <div className="w-6 h-6 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 flex items-center justify-center">
            <Inbox className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight tabular-nums">
            {metrics.openTickets.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">tickets</span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>Awaiting triage / assignment</span>
        </div>
      </button>

      {/* 2. In Progress Tickets */}
      <button
        type="button"
        onClick={handleInProgressClick}
        className="group flex flex-col text-left p-3.5 sm:p-4 rounded-xl bg-card hover:bg-secondary/40 border border-border shadow-2xs transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-medium text-muted-foreground">In Progress</span>
          <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight tabular-nums">
            {metrics.inProgressTickets.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">active</span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Claimed by specialists</span>
        </div>
      </button>

      {/* 3. SLA At Risk / Late */}
      <button
        type="button"
        onClick={handleSlaRiskClick}
        className={`group flex flex-col text-left p-3.5 sm:p-4 rounded-xl bg-card hover:bg-secondary/40 border shadow-2xs transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-ring ${
          metrics.slaRiskTickets > 0
            ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/10'
            : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-medium text-amber-900 dark:text-amber-300">
            SLA Risk & Overdue
          </span>
          <div className="w-6 h-6 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold text-amber-900 dark:text-amber-200 tracking-tight tabular-nums">
            {metrics.slaRiskTickets.toLocaleString()}
          </span>
          {metrics.slaLateTickets > 0 && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              ({metrics.slaLateTickets} breached)
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-400/80 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>Requires immediate attention</span>
        </div>
      </button>

      {/* 4. Manual Review Required */}
      <button
        type="button"
        onClick={handleManualReviewClick}
        className={`group flex flex-col text-left p-3.5 sm:p-4 rounded-xl bg-card hover:bg-secondary/40 border shadow-2xs transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-ring ${
          metrics.manualReviewTickets > 0
            ? 'border-primary/40 bg-accent/20 dark:bg-accent/10'
            : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-medium text-primary dark:text-emerald-400">
            Manual Triage Queue
          </span>
          <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold text-primary dark:text-emerald-300 tracking-tight tabular-nums">
            {metrics.manualReviewTickets.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">needs review</span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Enterprise & sentiment flags →</span>
        </div>
      </button>

    </div>
  );
}
