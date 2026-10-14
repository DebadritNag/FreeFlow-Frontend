'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { setFilters } from '@/src/store/ticketsSlice';
import { Inbox, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react';

// Minimal inline-SVG line sparkline (no axes / grid). Decorative design element.
function Sparkline({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 72 28"
      className="w-16 h-7 flex-shrink-0"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polyline
        points="0,22 12,18 24,20 36,10 48,13 60,6 72,9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">

      {/* 1. Open Backlog */}
      <button
        type="button"
        onClick={handleOpenClick}
        className="group min-h-[148px] flex flex-col text-left p-5 rounded-xl bg-card border border-border shadow-card hover:bg-surface-green-hover/30 transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        <div className="flex items-center justify-between w-full">
          <span className="w-9 h-9 rounded-full bg-surface-green text-primary flex items-center justify-center">
            <Inbox className="w-4 h-4" />
          </span>
          <span className="text-xs font-medium text-primary tabular-nums">↓12%</span>
        </div>
        <div className="mt-3 text-[13px] font-medium text-text-secondary">Open Backlog</div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[32px] leading-none font-bold text-foreground tracking-tight tabular-nums whitespace-nowrap">
              {metrics.openTickets.toLocaleString()}
            </span>
            <span className="text-xs text-text-secondary">tickets</span>
          </div>
          <Sparkline color="var(--primary)" />
        </div>
        <div className="mt-2 text-[11px] text-text-secondary">Awaiting triage / assignment</div>
      </button>

      {/* 2. In Progress */}
      <button
        type="button"
        onClick={handleInProgressClick}
        className="group min-h-[148px] flex flex-col text-left p-5 rounded-xl bg-card border border-border shadow-card hover:bg-surface-green-hover/30 transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        <div className="flex items-center justify-between w-full">
          <span className="w-9 h-9 rounded-full bg-surface-green text-primary flex items-center justify-center">
            <UserRound className="w-4 h-4" />
          </span>
          <span className="text-xs font-medium text-primary tabular-nums">↓8%</span>
        </div>
        <div className="mt-3 text-[13px] font-medium text-text-secondary">In Progress</div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[32px] leading-none font-bold text-foreground tracking-tight tabular-nums whitespace-nowrap">
              {metrics.inProgressTickets.toLocaleString()}
            </span>
            <span className="text-xs text-text-secondary">active</span>
          </div>
          <Sparkline color="var(--primary)" />
        </div>
        <div className="mt-2 text-[11px] text-text-secondary">Claimed by specialists</div>
      </button>

      {/* 3. SLA Risk & Overdue — the ONLY card with a prominent amber border */}
      <button
        type="button"
        onClick={handleSlaRiskClick}
        className="group min-h-[148px] flex flex-col text-left p-5 rounded-xl bg-card border-2 border-amber-border shadow-card hover:bg-amber-surface/40 transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        <div className="flex items-center justify-between w-full">
          <span className="w-9 h-9 rounded-full bg-amber-surface text-warning flex items-center justify-center">
            <TriangleAlert className="w-4 h-4" />
          </span>
          <span className="text-xs font-medium text-warning tabular-nums">↑15%</span>
        </div>
        <div className="mt-3 text-[13px] font-medium text-text-secondary">SLA Risk &amp; Overdue</div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[32px] leading-none font-bold text-foreground tracking-tight tabular-nums whitespace-nowrap">
              {metrics.slaRiskTickets.toLocaleString()}
            </span>
            {metrics.slaLateTickets > 0 && (
              <span className="text-xs font-medium text-breached whitespace-nowrap">
                ({metrics.slaLateTickets} breached)
              </span>
            )}
          </div>
          <Sparkline color="var(--warning)" />
        </div>
        <div className="mt-2 text-[11px] text-text-secondary">Requires immediate attention</div>
      </button>

      {/* 4. Manual Triage Queue */}
      <button
        type="button"
        onClick={handleManualReviewClick}
        className="group min-h-[148px] flex flex-col text-left p-5 rounded-xl bg-card border border-border shadow-card hover:bg-surface-green-hover/30 transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        <div className="flex items-center justify-between w-full">
          <span className="w-9 h-9 rounded-full bg-surface-green text-primary flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <span className="text-xs font-medium text-primary tabular-nums">↓5%</span>
        </div>
        <div className="mt-3 text-[13px] font-medium text-text-secondary">Manual Triage Queue</div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[32px] leading-none font-bold text-foreground tracking-tight tabular-nums whitespace-nowrap">
              {metrics.manualReviewTickets.toLocaleString()}
            </span>
            <span className="text-xs text-text-secondary">needs review</span>
          </div>
          <Sparkline color="var(--primary)" />
        </div>
        <div className="mt-2 text-[11px] text-text-secondary">Enterprise &amp; sentiment flags →</div>
      </button>

    </div>
  );
}
