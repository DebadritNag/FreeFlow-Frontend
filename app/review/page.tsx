'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { updateTicketLocally } from '@/src/store/ticketsSlice';
import { fetchTickets, updateTriageApi } from '@/src/lib/api-client';
import Header from '@/src/components/navigation/Header';
import Sidebar from '@/src/components/navigation/Sidebar';
import {
  CategoryBadge,
  CustomerTierBadge,
  PriorityBadge,
} from '@/src/components/tickets/Badges';
import CountdownCell from '@/src/components/tickets/CountdownCell';
import { Priority, Ticket, TicketCategory } from '@/src/types/ticket';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
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

  // Single per-second ticker for the review-card SLA countdowns.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 w-full max-w-[1390px] mx-auto px-5 sm:px-8 lg:px-12 pt-6 pb-10">

          {/* Page Title & Status Banner */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-[#202522] leading-[1.2]">
                  Manual Triage Review Queue
                </h1>
                {!loading && (
                  <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-amber-surface text-warning tabular-nums border border-amber-border">
                    {tickets.length} items
                  </span>
                )}
              </div>
              <p className="text-[14px] sm:text-[15px] text-text-secondary mt-1.5">
                Review sentiment flags, edge cases, and high-impact enterprise escalations before routing.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start lg:self-auto">
              <button
                type="button"
                onClick={loadReviewQueue}
                disabled={loading}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-semibold bg-card hover:bg-surface-green text-[#246B4B] border border-border-ref shadow-card transition-colors duration-200 disabled:opacity-50 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh Queue'}</span>
              </button>
            </div>
          </div>

          {/* Triage Policy & Guidelines Banner */}
          <div className="flex items-start gap-4 p-4 sm:p-5 rounded-[12px] bg-card border border-border-ref shadow-card mb-6">
            <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-surface-green flex items-center justify-center mt-0.5">
              <Bot className="w-[18px] h-[18px] text-[#246B4B]" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-[14px] font-semibold text-[#202522]">
                Triage Policy &amp; Guidelines
              </h2>
              <p className="text-[12px] sm:text-[13px] text-text-secondary leading-[1.5]">
                Tickets in this queue were flagged by the ingestion system due to ambiguous classification, high-urgency keywords, or enterprise customer tier thresholds. Confirm priority and category, then click <strong className="font-semibold text-[#202522]">Approve &amp; Route</strong> to release the ticket to the general support pool.
              </p>
            </div>
            <ChevronRight
              className="hidden sm:block flex-shrink-0 w-5 h-5 text-text-secondary mt-1"
              aria-hidden="true"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 rounded-[12px] bg-card border border-border-ref shadow-card animate-pulse p-5" />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-8 text-center rounded-[12px] bg-card border border-border-ref shadow-card my-6">
              <AlertCircle className="w-8 h-8 text-breached mx-auto mb-2" />
              <h3 className="text-sm sm:text-base font-semibold text-[#202522]">
                Error Loading Queue
              </h3>
              <p className="text-xs text-text-secondary mt-1 mb-4">{error}</p>
              <button
                type="button"
                onClick={loadReviewQueue}
                className="px-4 h-10 rounded-[9px] bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-[#1D573D] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && tickets.length === 0 && (
            <div className="p-12 text-center rounded-[12px] bg-card border border-border-ref shadow-card my-6">
              <div className="w-12 h-12 rounded-full bg-surface-green text-[#246B4B] mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#202522]">Triage Queue is Clear</h3>
              <p className="text-xs sm:text-sm text-text-secondary max-w-sm mx-auto mt-1 mb-5">
                All flagged tickets have been reviewed and approved. New escalations will appear automatically.
              </p>
              <Link
                href="/tickets"
                className="inline-flex items-center gap-1.5 px-4 h-10 rounded-[9px] bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-[#1D573D] transition-colors shadow-card cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <span>Return to All Tickets</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Review Cards List */}
          {!loading && !error && tickets.length > 0 && (
            <div className="space-y-5">
              {tickets.map((ticket) => {
                const isEnterprise = ticket.customer.tier === 'enterprise';
                const draft = drafts[ticket.id] || { priority: ticket.priority, category: ticket.category };
                const isResolving = resolvingId === ticket.id;

                return (
                  <div
                    key={ticket.id}
                    className="bg-card border border-border-ref rounded-[12px] p-5 shadow-card transition-colors duration-200 hover:border-[#D9D7CE]"
                  >
                    {/* Card Header: IDs, SLA, and Links */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-border-ref">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#246B4B]">
                          {ticket.id}
                        </span>
                        <CustomerTierBadge tier={ticket.customer.tier} rawValue={ticket.rawTier} />
                        <CategoryBadge category={ticket.category} rawValue={ticket.rawCategory} />
                        <PriorityBadge priority={ticket.priority} rawValue={ticket.rawPriority} />
                      </div>

                      <div className="flex items-center gap-3">
                        <CountdownCell
                          slaDeadline={ticket.slaDeadline}
                          slaTargetMinutes={ticket.slaTargetMinutes}
                          status={ticket.status}
                          priority={ticket.priority}
                          now={now}
                        />
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="inline-flex items-center gap-1 text-[13px] text-[#246B4B] hover:underline font-medium cursor-pointer"
                        >
                          <span>Full Ticket</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Subject and Customer */}
                    <div className="mt-4">
                      <h3 dir="auto" className="text-[17px] sm:text-[18px] font-semibold text-[#202522] leading-snug">
                        {ticket.subject}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary mt-1.5">
                        <span className="font-medium text-[#202522]">{ticket.customer.name}</span>
                        {ticket.customer.company && (
                          <>
                            <span className="text-text-secondary">·</span>
                            <span>{ticket.customer.company}</span>
                          </>
                        )}
                        <span className="text-text-secondary">·</span>
                        <span className="font-mono">{ticket.customer.email}</span>
                      </div>
                    </div>

                    {/* Review Reason warning banner */}
                    <div className="mt-4 p-3.5 rounded-[10px] bg-amber-surface border border-amber-border text-[13px] text-[#202522] flex items-start gap-2.5">
                      <ShieldAlert className="w-[18px] h-[18px] text-warning flex-shrink-0 mt-px" />
                      <div className="leading-snug">
                        <span className="font-semibold text-warning">Review Reason: </span>
                        <span>{ticket.triageReason || 'Requires human verification'}</span>
                      </div>
                    </div>

                    {/* Bottom approval section: AI panel + 2 selects + button */}
                    <div className="mt-3 flex flex-col lg:flex-row lg:items-end gap-4">

                      {/* AI Suggestion panel */}
                      <div className="lg:flex-[43] p-3.5 rounded-[10px] bg-background border border-border-ref text-[13px] space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-[#202522]">
                          <Sparkles className="w-3.5 h-3.5 text-[#246B4B]" />
                          <span>AI Suggestion</span>
                        </div>
                        {ticket.aiSuggestedPriority ? (
                          <p className="text-text-secondary">
                            Recommended Priority:{' '}
                            <strong className="font-semibold text-[#202522]">{ticket.aiSuggestedPriority}</strong>
                            {ticket.aiConfidence && (
                              <span className="ml-1 text-[12px]">
                                ({Math.round(ticket.aiConfidence * 100)}% confidence)
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-text-secondary italic">No automatic AI override suggested.</p>
                        )}
                        {ticket.aiSuggestedCategory && (
                          <p className="text-text-secondary">
                            Recommended Category:{' '}
                            <strong className="font-semibold text-[#202522]">{ticket.aiSuggestedCategory}</strong>
                          </p>
                        )}
                        {ticket.summary && (
                          <p dir="auto" className="text-text-secondary leading-[1.5] break-words pt-0.5">
                            <span className="font-semibold text-[#202522]">Summary: </span>
                            {ticket.summary}
                          </p>
                        )}
                      </div>

                      {/* Priority selector */}
                      <div className="lg:flex-[20]">
                        <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                          Approve Priority
                        </label>
                        <select
                          value={draft.priority}
                          onChange={(e) => handlePriorityChange(ticket.id, e.target.value as Priority)}
                          className="w-full h-[41px] px-3 rounded-[9px] bg-card border border-border-ref text-[13px] text-[#202522] cursor-pointer transition-colors duration-200 focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-primary"
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
                      <div className="lg:flex-[20]">
                        <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                          Approve Category
                        </label>
                        <select
                          value={draft.category}
                          onChange={(e) => handleCategoryChange(ticket.id, e.target.value as TicketCategory)}
                          className="w-full h-[41px] px-3 rounded-[9px] bg-card border border-border-ref text-[13px] text-[#202522] cursor-pointer transition-colors duration-200 focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-primary"
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
                      <div className="lg:flex-[17] flex lg:items-end">
                        <button
                          type="button"
                          onClick={() => handleResolveTriage(ticket)}
                          disabled={isResolving}
                          className="w-full inline-flex items-center justify-center gap-1.5 h-[41px] px-4 rounded-[9px] bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-[#1D573D] transition-colors duration-200 disabled:opacity-50 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <CircleCheck className="w-4 h-4 text-white" />
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
    </div>
  );
}
