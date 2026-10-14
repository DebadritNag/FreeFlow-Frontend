'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { updateTicketLocally } from '@/src/store/ticketsSlice';
import { fetchTickets, updateTriageApi } from '@/src/lib/api-client';
import Header from '@/src/components/navigation/Header';
import {
  CategoryBadge,
  CustomerTierBadge,
  PriorityBadge,
  SlaIndicator,
} from '@/src/components/tickets/Badges';
import { calculateSlaStatus, formatRemainingSla } from '@/src/lib/sla';
import { Priority, Ticket, TicketCategory } from '@/src/types/ticket';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export default function ReviewQueuePage() {
  const dispatch = useAppDispatch();
  const { activeAgent } = useAppSelector((state) => state.tickets);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Local draft triage overrides per ticket: { [ticketId]: { priority: Priority; category: TicketCategory } }
  const [drafts, setDrafts] = useState<Record<string, { priority: Priority; category: TicketCategory }>>({});

  const loadReviewQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTickets({
        triageDecision: 'manual_review',
        pageSize: 100,
        sortBy: 'priority',
        sortOrder: 'asc',
      });
      setTickets(data.tickets);

      const initialDrafts: Record<string, { priority: Priority; category: TicketCategory }> = {};
      data.tickets.forEach((t) => {
        initialDrafts[t.id] = {
          priority: t.aiSuggestedPriority || t.priority,
          category: t.aiSuggestedCategory || t.category,
        };
      });
      setDrafts(initialDrafts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load manual review queue.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function doFetch() {
      try {
        const data = await fetchTickets({
          triageDecision: 'manual_review',
          pageSize: 100,
          sortBy: 'priority',
          sortOrder: 'asc',
        });
        if (!isCancelled) {
          setTickets(data.tickets);
          const initialDrafts: Record<string, { priority: Priority; category: TicketCategory }> = {};
          data.tickets.forEach((t) => {
            initialDrafts[t.id] = {
              priority: t.aiSuggestedPriority || t.priority,
              category: t.aiSuggestedCategory || t.category,
            };
          });
          setDrafts(initialDrafts);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load manual review queue.';
          setError(msg);
          setLoading(false);
        }
      }
    }

    doFetch();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handlePriorityChange = (ticketId: string, priority: Priority) => {
    setDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        priority,
      },
    }));
  };

  const handleCategoryChange = (ticketId: string, category: TicketCategory) => {
    setDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        category,
      },
    }));
  };

  const handleResolveTriage = async (ticket: Ticket) => {
    const draft = drafts[ticket.id] || { priority: ticket.priority, category: ticket.category };

    // Enforce enterprise rule
    if (ticket.customer.tier === 'enterprise' && (draft.priority === 'P2' || draft.priority === 'P3')) {
      toast.error('Enterprise tickets must never be assigned below P1 urgency (only P0 or P1 allowed).');
      return;
    }

    setResolvingId(ticket.id);
    toast.loading(`Resolving triage for #${ticket.id}...`, { id: `resolve-${ticket.id}` });

    try {
      const res = await updateTriageApi(ticket.id, {
        priority: draft.priority,
        category: draft.category,
        triageDecision: 'automated', // Resolves review queue item
        triageReason: `Approved & triaged by ${activeAgent.name}`,
      });

      if (res.success && res.ticket) {
        dispatch(updateTicketLocally(res.ticket));
        // Remove from local review queue
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
        toast.success(`Ticket #${ticket.id} approved and routed!`, { id: `resolve-${ticket.id}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve triage.';
      toast.error(msg, { id: `resolve-${ticket.id}` });
    } finally {
      setResolvingId(null);
    }
  };

  const now = new Date();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Page Title & Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Manual Triage Review Queue
              </h1>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 tabular-nums border border-amber-300 dark:border-amber-800">
                  {tickets.length} items
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Review sentiment flags, edge cases, and high-impact enterprise escalations before routing.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={loadReviewQueue}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-secondary text-foreground border border-border shadow-2xs transition-all duration-150 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Queue'}</span>
            </button>
          </div>
        </div>

        {/* Informational Guidance Notice */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-2xs mb-6 text-xs sm:text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Bot className="w-4 h-4 text-primary" />
            <span>Triage Policy & Guidelines</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Tickets in this queue were flagged by the ingestion system due to ambiguous classification, high-urgency keywords, or enterprise customer tier thresholds. Confirm priority and category, then click <strong>Approve & Route</strong> to release the ticket to the general support pool.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-xl bg-card border border-border animate-pulse p-6" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-8 text-center rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 my-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
            <h3 className="text-sm sm:text-base font-semibold text-red-900 dark:text-red-300">
              Error Loading Queue
            </h3>
            <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1 mb-4">{error}</p>
            <button
              type="button"
              onClick={loadReviewQueue}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tickets.length === 0 && (
          <div className="p-12 text-center rounded-xl bg-card border border-border shadow-2xs my-6">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Triage Queue is Clear</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-5">
              All flagged tickets have been reviewed and approved. New escalations will appear automatically.
            </p>
            <Link
              href="/tickets"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
            >
              <span>Return to All Tickets</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Review Cards List */}
        {!loading && !error && tickets.length > 0 && (
          <div className="space-y-4">
            {tickets.map((ticket) => {
              const slaStatus = calculateSlaStatus(ticket, now);
              const remainingSla = formatRemainingSla(ticket.slaDeadline, now);
              const isEnterprise = ticket.customer.tier === 'enterprise';
              const draft = drafts[ticket.id] || { priority: ticket.priority, category: ticket.category };
              const isResolving = resolvingId === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-2xs hover:border-muted-foreground/30 transition-all space-y-4"
                >
                  {/* Card Header: IDs, SLA, and Links */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {ticket.id}
                      </span>
                      <CustomerTierBadge tier={ticket.customer.tier} />
                      <CategoryBadge category={ticket.category} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>

                    <div className="flex items-center gap-3">
                      <SlaIndicator slaStatus={slaStatus} remainingText={remainingSla} />
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        <span>Full Ticket</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Subject and Customer */}
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      {ticket.subject}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground">{ticket.customer.name}</span>
                      {ticket.customer.company && (
                        <>
                          <span>•</span>
                          <span>{ticket.customer.company}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-mono">{ticket.customer.email}</span>
                    </div>
                  </div>

                  {/* Flag Reason Callout */}
                  <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Review Reason: </span>
                      <span>{ticket.triageReason || 'Requires human verification'}</span>
                    </div>
                  </div>

                  {/* AI Suggested vs Controls Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    
                    {/* Left: AI Recommendation display (if present) */}
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>AI Suggestion</span>
                      </div>
                      {ticket.aiSuggestedPriority ? (
                        <p className="text-muted-foreground">
                          Recommended Priority:{' '}
                          <strong className="text-foreground">{ticket.aiSuggestedPriority}</strong>
                          {ticket.aiConfidence && (
                            <span className="ml-1 text-[11px] font-mono">
                              ({Math.round(ticket.aiConfidence * 100)}% confidence)
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-muted-foreground italic">No automatic AI override suggested.</p>
                      )}
                      {ticket.aiSuggestedCategory && (
                        <p className="text-muted-foreground">
                          Recommended Category:{' '}
                          <strong className="text-foreground">{ticket.aiSuggestedCategory}</strong>
                        </p>
                      )}
                    </div>

                    {/* Right: Review Decision Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                      
                      {/* Priority selector */}
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Approve Priority
                        </label>
                        <select
                          value={draft.priority}
                          onChange={(e) => handlePriorityChange(ticket.id, e.target.value as Priority)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
                        >
                          <option value="P0">P0 Urgent (1h SLA)</option>
                          <option value="P1">P1 High (4h SLA)</option>
                          <option value="P2" disabled={isEnterprise}>
                            P2 Medium (24h SLA) {isEnterprise ? '— Enterprise min P1' : ''}
                          </option>
                          <option value="P3" disabled={isEnterprise}>
                            P3 Low (72h SLA) {isEnterprise ? '— Enterprise min P1' : ''}
                          </option>
                        </select>
                      </div>

                      {/* Category selector */}
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Approve Category
                        </label>
                        <select
                          value={draft.category}
                          onChange={(e) => handleCategoryChange(ticket.id, e.target.value as TicketCategory)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
                        >
                          <option value="technical">Technical</option>
                          <option value="billing">Billing</option>
                          <option value="security">Security</option>
                          <option value="account">Account</option>
                          <option value="feature_request">Feature</option>
                          <option value="general">General</option>
                        </select>
                      </div>

                      {/* Approve & Route Action */}
                      <button
                        type="button"
                        onClick={() => handleResolveTriage(ticket)}
                        disabled={isResolving}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-2xs disabled:opacity-50 flex-shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isResolving ? 'Routing...' : 'Approve & Route'}</span>
                      </button>

                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
