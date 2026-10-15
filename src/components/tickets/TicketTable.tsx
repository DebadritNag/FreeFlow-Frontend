'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  optimisticClaimTicket,
  rollbackClaimTicket,
  updateTicketLocally,
} from '@/src/store/ticketsSlice';
import { Ticket } from '@/src/types/ticket';
import { claimTicketApi } from '@/src/lib/api-client';
import {
  CategoryBadge,
  CustomerTierBadge,
  PriorityBadge,
  StatusBadge,
} from './Badges';
import CountdownCell from './CountdownCell';
import { toast } from 'sonner';
import {
  AlertCircle,
  ChevronRight,
  Inbox,
  RefreshCw,
  ShieldAlert,
  UserRoundPlus,
} from 'lucide-react';
import { ApiError } from '@/src/lib/api-client';

interface TicketTableProps {
  onRetry?: () => void;
}

export default function TicketTable({ onRetry }: TicketTableProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { items, loading, error, activeAgent } = useAppSelector(
    (state) => state.tickets
  );

  // Net-new LOCAL selection state (no Redux reducers for selection).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Single 1-second ticker per page: one shared `now` fed into every memoized
  // CountdownCell so only those cells re-render each tick (row cells stay stable).
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((t) => t.id)));
    }
  };

  const handleToggleRow = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClaim = async (e: React.MouseEvent, ticket: Ticket) => {
    e.preventDefault();
    e.stopPropagation();

    // Already assigned to active agent
    if (ticket.assignee?.id === activeAgent.id) {
      toast.info(`Ticket #${ticket.id} is already assigned to you.`);
      return;
    }

    const previousTicket = { ...ticket };

    // 1. Optimistic Update
    dispatch(optimisticClaimTicket({ ticketId: ticket.id, agent: activeAgent }));
    toast.loading(`Claiming ticket #${ticket.id}...`, { id: `claim-${ticket.id}` });

    try {
      const response = await claimTicketApi(ticket.id, activeAgent);
      if (response.success && response.ticket) {
        dispatch(updateTicketLocally(response.ticket));
        toast.success(`Claimed #${ticket.id} successfully!`, { id: `claim-${ticket.id}` });
      }
    } catch (err: unknown) {
      // Rollback on conflict or failure
      dispatch(rollbackClaimTicket({ originalTicket: previousTicket }));

      if (err instanceof ApiError) {
        const errorData = err.data as { conflictingAgent?: { name: string; id: string; email: string; role: string } } | undefined;
        if (err.status === 409 && errorData?.conflictingAgent) {
          toast.error(
            `Conflict: #${ticket.id} was already claimed by ${errorData.conflictingAgent.name}.`,
            { id: `claim-${ticket.id}` }
          );
          // Reflect the conflicting agent assignment in local state
          dispatch(
            updateTicketLocally({
              ...previousTicket,
              assignee: errorData.conflictingAgent,
              status: previousTicket.status === 'open' ? 'in_progress' : previousTicket.status,
            })
          );
          return;
        }
        toast.error(err.message || 'Failed to claim ticket. Rolled back.', {
          id: `claim-${ticket.id}`,
        });
      } else {
        toast.error('An unexpected error occurred. Rolled back.', {
          id: `claim-${ticket.id}`,
        });
      }
    }
  };

  // Error State
  if (error && items.length === 0) {
    return (
      <div className="rounded-[14px] border border-breached/30 bg-breached/5 p-8 text-center my-6 shadow-card">
        <div className="w-10 h-10 rounded-full bg-breached/10 text-breached mx-auto flex items-center justify-center mb-3">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold text-breached">
          Failed to load tickets
        </h3>
        <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto mt-1 mb-4">
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shadow-card cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  // Loading Skeletons
  if (loading && items.length === 0) {
    return (
      <div className="bg-card border border-border-ref rounded-[14px] overflow-hidden shadow-card divide-y divide-border-ref">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
            <div className="w-4 h-4 bg-secondary rounded" />
            <div className="w-16 h-4 bg-secondary rounded" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-secondary rounded" />
              <div className="w-1/3 h-3 bg-secondary rounded" />
            </div>
            <div className="w-20 h-4 bg-secondary rounded hidden sm:block" />
            <div className="w-24 h-4 bg-secondary rounded hidden md:block" />
          </div>
        ))}
      </div>
    );
  }

  // Empty State
  if (items.length === 0) {
    return (
      <div className="rounded-[14px] border border-border-ref bg-card p-12 text-center my-4 shadow-card">
        <div className="w-12 h-12 rounded-full bg-surface-green text-primary mx-auto flex items-center justify-center mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-foreground">
          No matching tickets found
        </h3>
        <p className="text-xs sm:text-sm text-text-secondary max-w-sm mx-auto mt-1 mb-4">
          Try clearing your search query or adjusting your status, priority, or category filters.
        </p>
      </div>
    );
  }

  const checkboxClass =
    'w-4 h-4 rounded border-border-ref text-primary accent-primary cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring';

  return (
    <div className="bg-card border border-border-ref rounded-[14px] shadow-card overflow-hidden">

      {/* Desktop Table View (hidden on small screens) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr className="h-[40px] border-b border-border-ref bg-surface-search text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {/* 1 Selection */}
              <th className="px-3">
                <input
                  type="checkbox"
                  aria-label="Select all tickets"
                  className={checkboxClass}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onClick={stop}
                  onChange={handleToggleAll}
                />
              </th>
              {/* 2 Ticket ID */}
              <th className="px-3">Ticket ID</th>
              {/* 3 Subject & Customer */}
              <th className="px-4">Subject &amp; Customer</th>
              {/* 4 Priority */}
              <th className="px-3">Priority</th>
              {/* 5 Status */}
              <th className="px-3">Status</th>
              {/* 6 Category */}
              <th className="px-3">Category</th>
              {/* 7 Assignee */}
              <th className="px-3">Assignee</th>
              {/* 8 SLA Target */}
              <th className="px-3">SLA Target</th>
              {/* 9 Action */}
              <th className="px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-ref text-xs">
            {items.map((ticket) => {
              const isAssignedToMe = ticket.assignee?.id === activeAgent.id;
              const isSelected = selectedIds.has(ticket.id);

              return (
                <tr
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className={`group h-[52px] cursor-pointer transition-colors ${
                    isSelected ? 'bg-surface-green/50' : 'hover:bg-[#FAFBF8]'
                  }`}
                >
                  {/* 1 Selection checkbox (local state, stopPropagation) */}
                  <td className="px-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ticket ${ticket.id}`}
                      className={checkboxClass}
                      checked={isSelected}
                      onClick={stop}
                      onChange={(e) => handleToggleRow(e, ticket.id)}
                    />
                  </td>

                  {/* 2 Ticket ID — green semibold */}
                  <td className="px-3 font-mono text-[13px] font-semibold text-primary whitespace-nowrap">
                    {ticket.id}
                  </td>

                  {/* 3 Subject & Customer — two separate lines, vertically centered */}
                  <td className="px-4 min-w-0">
                    <div className="flex flex-col justify-center min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          dir="auto"
                          className="text-[12px] font-medium text-foreground truncate group-hover:text-primary transition-colors"
                        >
                          {ticket.subject}
                        </span>
                        {ticket.triageDecision === 'manual_review' && (
                          <span
                            title="Flagged for manual triage review"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-surface text-warning border border-amber-border flex-shrink-0"
                          >
                            <ShieldAlert className="w-2.5 h-2.5" />
                            Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-0.5 min-w-0">
                        <span className="font-medium text-foreground/80 truncate">
                          {ticket.customer.name}
                        </span>
                        {ticket.customer.company && (
                          <>
                            <span>•</span>
                            <span className="truncate">{ticket.customer.company}</span>
                          </>
                        )}
                        <span>•</span>
                        <CustomerTierBadge tier={ticket.customer.tier} rawValue={ticket.rawTier} />
                      </div>
                    </div>
                  </td>

                  {/* 4 Priority */}
                  <td className="px-3 whitespace-nowrap">
                    <PriorityBadge priority={ticket.priority} rawValue={ticket.rawPriority} />
                  </td>

                  {/* 5 Status */}
                  <td className="px-3 whitespace-nowrap">
                    <StatusBadge status={ticket.status} rawValue={ticket.rawStatus} />
                  </td>

                  {/* 6 Category */}
                  <td className="px-3 whitespace-nowrap">
                    <CategoryBadge category={ticket.category} rawValue={ticket.rawCategory} />
                  </td>

                  {/* 7 Assignee — avatar + name, or compact Claim pill */}
                  <td className="px-3 whitespace-nowrap">
                    {ticket.assignee ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-5 h-5 rounded-full bg-secondary border border-border-ref flex items-center justify-center text-[10px] font-medium overflow-hidden flex-shrink-0">
                          {ticket.assignee.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ticket.assignee.avatarUrl}
                              alt={ticket.assignee.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            ticket.assignee.name.charAt(0)
                          )}
                        </div>
                        <span className={`truncate max-w-[110px] ${isAssignedToMe ? 'font-semibold text-primary' : 'text-foreground'}`}>
                          {isAssignedToMe ? 'Assigned to You' : ticket.assignee.name}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleClaim(e, ticket)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-green text-primary border border-surface-green-hover hover:bg-surface-green-hover transition-colors cursor-pointer"
                      >
                        <UserRoundPlus className="w-3.5 h-3.5 text-primary" />
                        <span>Claim</span>
                      </button>
                    )}
                  </td>

                  {/* 8 SLA Target — row-isolated per-second countdown */}
                  <td className="px-3 whitespace-nowrap">
                    <CountdownCell
                      slaDeadline={ticket.slaDeadline}
                      slaTargetMinutes={ticket.slaTargetMinutes}
                      status={ticket.status}
                      priority={ticket.priority}
                      now={now}
                    />
                  </td>

                  {/* 9 Action — ChevronRight link to detail */}
                  <td className="px-3 text-right whitespace-nowrap">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded text-text-secondary group-hover:text-primary transition-colors inline-block"
                      title="View details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (optimized down to 375px without horizontal overflow) */}
      <div className="lg:hidden divide-y divide-border-ref">
        {items.map((ticket) => {
          const isAssignedToMe = ticket.assignee?.id === activeAgent.id;
          const isSelected = selectedIds.has(ticket.id);

          return (
            <div
              key={ticket.id}
              onClick={() => router.push(`/tickets/${ticket.id}`)}
              className={`p-4 active:bg-surface-green/60 cursor-pointer transition-colors space-y-2.5 ${
                isSelected ? 'bg-surface-green/50' : 'hover:bg-[#FAFBF8]'
              }`}
            >
              {/* Header: checkbox, ID, Priority, SLA */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    aria-label={`Select ticket ${ticket.id}`}
                    className="w-4 h-4 min-w-[16px] rounded border-border-ref text-primary accent-primary cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
                    checked={isSelected}
                    onClick={stop}
                    onChange={(e) => handleToggleRow(e, ticket.id)}
                  />
                  <span className="font-mono text-[13px] font-semibold text-primary">
                    {ticket.id}
                  </span>
                  <PriorityBadge priority={ticket.priority} rawValue={ticket.rawPriority} showIcon={false} />
                  {ticket.triageDecision === 'manual_review' && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-surface text-warning border border-amber-border flex-shrink-0">
                      <ShieldAlert className="w-2.5 h-2.5" />
                      Review
                    </span>
                  )}
                </div>
                <CountdownCell
                  slaDeadline={ticket.slaDeadline}
                  slaTargetMinutes={ticket.slaTargetMinutes}
                  status={ticket.status}
                  priority={ticket.priority}
                  now={now}
                />
              </div>

              {/* Subject */}
              <div className="min-w-0">
                <h4 dir="auto" className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                  {ticket.subject}
                </h4>
              </div>

              {/* Customer Info & Category */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                <span className="font-medium text-foreground truncate max-w-[130px]">
                  {ticket.customer.name}
                </span>
                {ticket.customer.company && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[120px]">{ticket.customer.company}</span>
                  </>
                )}
                <span>•</span>
                <CustomerTierBadge tier={ticket.customer.tier} rawValue={ticket.rawTier} />
                <span>•</span>
                <CategoryBadge category={ticket.category} rawValue={ticket.rawCategory} />
              </div>

              {/* Footer: Status, Assignee, Claim */}
              <div className="flex items-center justify-between pt-1 border-t border-border-ref/60 text-xs">
                <StatusBadge status={ticket.status} rawValue={ticket.rawStatus} />

                <div className="flex items-center gap-2">
                  {ticket.assignee ? (
                    <span className="text-[11px] text-text-secondary truncate max-w-[120px]">
                      {isAssignedToMe ? (
                        <strong className="text-primary font-semibold">You</strong>
                      ) : (
                        ticket.assignee.name
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleClaim(e, ticket)}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-xs font-medium bg-surface-green text-primary border border-surface-green-hover hover:bg-surface-green-hover transition-colors cursor-pointer"
                    >
                      <UserRoundPlus className="w-3.5 h-3.5 text-primary" />
                      <span>Claim</span>
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
