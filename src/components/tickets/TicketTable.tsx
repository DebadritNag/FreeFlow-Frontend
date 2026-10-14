'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  optimisticClaimTicket,
  rollbackClaimTicket,
  updateTicketLocally,
} from '@/src/store/ticketsSlice';
import { Ticket } from '@/src/types/ticket';
import { calculateSlaStatus, formatRemainingSla } from '@/src/lib/sla';
import { claimTicketApi } from '@/src/lib/api-client';
import {
  CategoryBadge,
  CustomerTierBadge,
  PriorityBadge,
  SlaIndicator,
  StatusBadge,
} from './Badges';
import { toast } from 'sonner';
import {
  AlertCircle,
  ChevronRight,
  Inbox,
  RefreshCw,
  ShieldAlert,
  UserPlus,
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
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-8 text-center my-6">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-3">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h3 className="text-base font-semibold text-red-900 dark:text-red-300">
          Failed to load tickets
        </h3>
        <p className="text-xs sm:text-sm text-red-700/80 dark:text-red-400/80 max-w-md mx-auto mt-1 mb-4">
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-2xs"
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
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs divide-y divide-border">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
            <div className="w-16 h-4 bg-muted rounded" />
            <div className="w-12 h-4 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-muted rounded" />
              <div className="w-1/3 h-3 bg-muted rounded" />
            </div>
            <div className="w-20 h-4 bg-muted rounded hidden sm:block" />
            <div className="w-24 h-4 bg-muted rounded hidden md:block" />
          </div>
        ))}
      </div>
    );
  }

  // Empty State
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center my-4 shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground mx-auto flex items-center justify-center mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-foreground">
          No matching tickets found
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
          Try clearing your search query or adjusting your status, priority, or category filters.
        </p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
      
      {/* Desktop Table View (hidden on small screens) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3.5 w-24">Ticket ID</th>
              <th className="py-2.5 px-3.5 min-w-[280px]">Subject & Customer</th>
              <th className="py-2.5 px-3.5 w-24">Priority</th>
              <th className="py-2.5 px-3.5 w-28">Status</th>
              <th className="py-2.5 px-3.5 w-24">Category</th>
              <th className="py-2.5 px-3.5 min-w-[150px]">Assignee</th>
              <th className="py-2.5 px-3.5 w-32">SLA Target</th>
              <th className="py-2.5 px-3.5 w-20 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {items.map((ticket) => {
              const slaStatus = calculateSlaStatus(ticket, now);
              const remainingSla = formatRemainingSla(ticket.slaDeadline, now);
              const isAssignedToMe = ticket.assignee?.id === activeAgent.id;

              return (
                <tr
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="group hover:bg-secondary/40 cursor-pointer transition-colors"
                >
                  {/* ID */}
                  <td className="py-2.5 px-3.5 font-mono font-medium text-foreground whitespace-nowrap">
                    <span className="group-hover:text-primary transition-colors">
                      {ticket.id}
                    </span>
                  </td>

                  {/* Subject & Customer */}
                  <td className="py-2.5 px-3.5 min-w-0 max-w-md">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate max-w-sm group-hover:text-primary transition-colors">
                          {ticket.subject}
                        </span>
                        {ticket.triageDecision === 'manual_review' && (
                          <span
                            title="Flagged for manual triage review"
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 flex-shrink-0"
                          >
                            <ShieldAlert className="w-2.5 h-2.5" />
                            Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
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
                        <CustomerTierBadge tier={ticket.customer.tier} />
                      </div>
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <PriorityBadge priority={ticket.priority} />
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <StatusBadge status={ticket.status} />
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <CategoryBadge category={ticket.category} />
                  </td>

                  {/* Assignee */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    {ticket.assignee ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-medium overflow-hidden flex-shrink-0">
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-secondary hover:bg-accent text-foreground hover:text-accent-foreground border border-border transition-colors"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Claim</span>
                      </button>
                    )}
                  </td>

                  {/* SLA */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <SlaIndicator slaStatus={slaStatus} remainingText={remainingSla} />
                  </td>

                  {/* Row Link arrow */}
                  <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="p-1 rounded text-muted-foreground group-hover:text-primary transition-colors inline-block"
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
      <div className="lg:hidden divide-y divide-border">
        {items.map((ticket) => {
          const slaStatus = calculateSlaStatus(ticket, now);
          const remainingSla = formatRemainingSla(ticket.slaDeadline, now);
          const isAssignedToMe = ticket.assignee?.id === activeAgent.id;

          return (
            <div
              key={ticket.id}
              onClick={() => router.push(`/tickets/${ticket.id}`)}
              className="p-3.5 hover:bg-secondary/40 active:bg-secondary/60 cursor-pointer transition-colors space-y-2.5"
            >
              {/* Header: ID, Priority, SLA */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {ticket.id}
                  </span>
                  <PriorityBadge priority={ticket.priority} showIcon={false} />
                  {ticket.triageDecision === 'manual_review' && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex-shrink-0">
                      Review
                    </span>
                  )}
                </div>
                <SlaIndicator slaStatus={slaStatus} remainingText={remainingSla} />
              </div>

              {/* Subject */}
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                  {ticket.subject}
                </h4>
              </div>

              {/* Customer Info & Category */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
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
                <CustomerTierBadge tier={ticket.customer.tier} />
                <span>•</span>
                <CategoryBadge category={ticket.category} />
              </div>

              {/* Footer: Status, Assignee, Claim */}
              <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                <StatusBadge status={ticket.status} />

                <div className="flex items-center gap-2">
                  {ticket.assignee ? (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                      {isAssignedToMe ? (
                        <strong className="text-primary font-medium">You</strong>
                      ) : (
                        ticket.assignee.name
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleClaim(e, ticket)}
                      className="px-2.5 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
                    >
                      Claim Ticket
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
