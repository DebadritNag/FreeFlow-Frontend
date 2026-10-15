'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { updateTicketLocally } from '@/src/store/ticketsSlice';
import { fetchTickets, pollUpdatesSinceApi, updateTriageApi } from '@/src/lib/api-client';
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
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

const MIN_REASON_LENGTH = 10;

/** The baseline the human reviewer is deciding against: the AI-suggested value
 * when present, otherwise the ticket's current value. A written reason is only
 * required when the draft diverges from this baseline. */
function baselineFor(ticket: Ticket): { priority: Priority; category: TicketCategory } {
  return {
    priority: ticket.aiSuggestedPriority || ticket.priority,
    category: ticket.aiSuggestedCategory || ticket.category,
  };
}

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

  // Local draft triage overrides per ticket.
  const [drafts, setDrafts] = useState<Record<string, { priority: Priority; category: TicketCategory }>>({});
  // Per-card written reason textarea state.
  const [reasons, setReasons] = useState<Record<string, string>>({});
  // Track reasons the reviewer has interacted with so we only show errors after a touch/submit attempt.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Live-poll bookkeeping. `since` advances from each response timestamp.
  // `handledIds` are tickets resolved locally — they must never be re-added by polling.
  const sinceRef = useRef<string>(new Date().toISOString());
  const handledIdsRef = useRef<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);

  const seedDraftsFor = useCallback((list: Ticket[]) => {
    const nextDrafts: Record<string, { priority: Priority; category: TicketCategory }> = {};
    list.forEach((t) => {
      nextDrafts[t.id] = baselineFor(t);
    });
    setDrafts(nextDrafts);
    setReasons({});
    setTouched({});
  }, []);

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
      // A manual refresh is a fresh view — clear the handled set and reset the poll anchor.
      handledIdsRef.current = new Set();
      sinceRef.current = new Date().toISOString();
      setNewCount(0);
      setTickets(data.tickets);
      seedDraftsFor(data.tickets);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load manual review queue.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [seedDraftsFor]);

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
          sinceRef.current = new Date().toISOString();
          setTickets(data.tickets);
          seedDraftsFor(data.tickets);
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
  }, [seedDraftsFor]);

  // 10s live poll: surface new manual_review tickets and keep handled ones gone.
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await pollUpdatesSinceApi(sinceRef.current);
        if (res.timestamp) sinceRef.current = res.timestamp;
        if (!res.updatedTickets || res.updatedTickets.length === 0) return;

        setTickets((prev) => {
          const byId = new Map(prev.map((t) => [t.id, t] as const));
          let appended = 0;

          for (const incoming of res.updatedTickets) {
            // Never re-add a ticket that was already handled/resolved locally.
            if (handledIdsRef.current.has(incoming.id)) continue;

            if (incoming.triageDecision === 'manual_review') {
              if (byId.has(incoming.id)) {
                // Refresh the existing card in place.
                byId.set(incoming.id, incoming);
              } else {
                // Brand-new manual_review ticket surfaced by background activity.
                byId.set(incoming.id, incoming);
                appended += 1;
              }
            } else if (byId.has(incoming.id)) {
              // A ticket left the manual_review queue elsewhere — drop it.
              byId.delete(incoming.id);
            }
          }

          if (appended === 0 && byId.size === prev.length) {
            // Nothing structurally changed beyond in-place refreshes; still
            // return the refreshed map so updated AI fields are reflected.
            return Array.from(byId.values());
          }

          if (appended > 0) {
            setNewCount((c) => c + appended);
            // Seed drafts for any newly surfaced tickets without clobbering
            // in-flight edits on existing cards.
            setDrafts((d) => {
              const nextD = { ...d };
              for (const incoming of res.updatedTickets) {
                if (!handledIdsRef.current.has(incoming.id) && !(incoming.id in nextD)) {
                  nextD[incoming.id] = baselineFor(incoming);
                }
              }
              return nextD;
            });
          }

          return Array.from(byId.values());
        });
      } catch {
        // Transient polling failures are non-fatal; the next tick retries.
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  const handlePriorityChange = (ticketId: string, priority: Priority) => {
    setDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        ...(prev[ticketId] || { priority, category: 'general' }),
        priority,
      },
    }));
  };

  const handleCategoryChange = (ticketId: string, category: TicketCategory) => {
    setDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        ...(prev[ticketId] || { priority: 'P2', category }),
        category,
      },
    }));
  };

  const handleReasonChange = (ticketId: string, value: string) => {
    setReasons((prev) => ({ ...prev, [ticketId]: value }));
  };

  const handleResolveTriage = async (ticket: Ticket) => {
    const baseline = baselineFor(ticket);
    const draft = drafts[ticket.id] || baseline;
    const reason = (reasons[ticket.id] || '').trim();
    const changed = draft.priority !== baseline.priority || draft.category !== baseline.category;

    // Mark touched so inline validation errors show if blocked below.
    setTouched((prev) => ({ ...prev, [ticket.id]: true }));

    // Validation: a written reason (>= 10 chars) is REQUIRED only when the
    // priority or category changes; accept-with-no-change needs no reason.
    if (changed && reason.length < MIN_REASON_LENGTH) {
      toast.error(
        `A written reason of at least ${MIN_REASON_LENGTH} characters is required when changing priority or category.`
      );
      return;
    }

    // Enterprise priority floor (client guard; server re-checks).
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
        // Use the written reason when supplied; fall back to the auto string
        // for accept-with-no-change.
        triageReason: reason.length > 0 ? reason : `Approved & triaged by ${activeAgent.name}`,
      });

      if (res.success && res.ticket) {
        dispatch(updateTicketLocally(res.ticket));
        // Handled tickets leave the queue immediately and must never be re-added by polling.
        handledIdsRef.current.add(ticket.id);
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

          {/* Live-poll banner: new manual_review tickets surfaced since load */}
          {newCount > 0 && !loading && (
            <button
              type="button"
              onClick={() => setNewCount(0)}
              className="w-full flex items-center justify-center gap-2 mb-5 h-10 rounded-[10px] text-[13px] font-semibold bg-surface-green text-[#246B4B] border border-surface-green-hover transition-colors duration-200 hover:bg-[#E0ECE2] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <Bell className="w-4 h-4" />
              <span>
                {newCount} new ticket{newCount === 1 ? '' : 's'} entered the review queue — dismiss
              </span>
            </button>
          )}

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
                Tickets in this queue were flagged by the ingestion system due to ambiguous classification, high-urgency keywords, or enterprise customer tier thresholds. Accept the AI suggestion as-is, or change the priority/category — a written reason of at least {MIN_REASON_LENGTH} characters is required whenever you override — then click <strong className="font-semibold text-[#202522]">Approve &amp; Route</strong> to release the ticket to the general support pool.
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
                const baseline = baselineFor(ticket);
                const draft = drafts[ticket.id] || baseline;
                const isResolving = resolvingId === ticket.id;

                const reason = reasons[ticket.id] || '';
                const trimmedReason = reason.trim();
                const changed =
                  draft.priority !== baseline.priority || draft.category !== baseline.category;
                const reasonRequired = changed;
                const reasonValid = !reasonRequired || trimmedReason.length >= MIN_REASON_LENGTH;
                const showReasonError = touched[ticket.id] && reasonRequired && !reasonValid;
                const enterpriseInvalid =
                  isEnterprise && (draft.priority === 'P2' || draft.priority === 'P3');
                const submitDisabled = isResolving || !reasonValid || enterpriseInvalid;

                // Final-vs-AI comparison: show BOTH when the AI-suggested
                // priority (ticket.aiPriority) differs from the final draft.
                const aiPriority = ticket.aiPriority;
                const showPriorityComparison = aiPriority != null && aiPriority !== draft.priority;
                const aiReason = ticket.reviewReason || ticket.triageReason || null;

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

                    {/* AI Triage panel: summary (sanitized plain text), decision, reason + priority comparison */}
                    <div className="mt-4 p-4 rounded-[10px] bg-background border border-border-ref space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#202522]">
                        <Sparkles className="w-4 h-4 text-[#246B4B]" />
                        <span>AI Triage Assessment</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-secondary">Decision:</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold bg-amber-surface text-warning border border-amber-border">
                            <Bot className="w-3 h-3" />
                            {ticket.triageDecision === 'manual_review' ? 'Manual review' : 'Automated'}
                          </span>
                        </div>

                        {/* Priority comparison: show BOTH final vs AI-suggested when they differ */}
                        {showPriorityComparison ? (
                          <div className="flex items-center gap-2">
                            <span className="text-text-secondary">Priority:</span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] text-text-secondary">Final</span>
                              <PriorityBadge priority={draft.priority} showIcon={false} />
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-text-secondary rotate-180" aria-hidden="true" />
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] text-text-secondary">AI&nbsp;suggested</span>
                              <PriorityBadge priority={aiPriority} showIcon={false} />
                            </span>
                          </div>
                        ) : (
                          ticket.aiSuggestedPriority && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-text-secondary">AI priority:</span>
                              <PriorityBadge priority={ticket.aiSuggestedPriority} showIcon={false} />
                              {ticket.aiConfidence != null && (
                                <span className="text-[12px] text-text-secondary">
                                  ({Math.round(ticket.aiConfidence * 100)}% confidence)
                                </span>
                              )}
                            </div>
                          )
                        )}

                        {ticket.aiSuggestedCategory && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-text-secondary">AI category:</span>
                            <CategoryBadge category={ticket.aiSuggestedCategory} />
                          </div>
                        )}
                      </div>

                      {ticket.summary ? (
                        <p dir="auto" className="text-[13px] text-text-secondary leading-[1.55] break-words">
                          <span className="font-semibold text-[#202522]">Summary: </span>
                          {ticket.summary}
                        </p>
                      ) : (
                        <p className="text-[13px] text-text-secondary italic">
                          No AI summary available for this ticket.
                        </p>
                      )}

                      {aiReason && (
                        <p dir="auto" className="text-[13px] text-text-secondary leading-[1.55] break-words">
                          <span className="font-semibold text-[#202522]">AI reason: </span>
                          {aiReason}
                        </p>
                      )}
                    </div>

                    {/* Decision controls: priority + category selects */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Priority selector */}
                      <div>
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
                      <div>
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
                    </div>

                    {/* Written reason textarea (required when overriding) */}
                    <div className="mt-4">
                      <label
                        htmlFor={`reason-${ticket.id}`}
                        className="block text-[12px] font-semibold text-text-secondary mb-1.5"
                      >
                        Decision reason{' '}
                        {reasonRequired ? (
                          <span className="text-breached">(required — min {MIN_REASON_LENGTH} characters)</span>
                        ) : (
                          <span className="text-text-secondary font-normal">(optional when accepting the AI suggestion)</span>
                        )}
                      </label>
                      <textarea
                        id={`reason-${ticket.id}`}
                        value={reason}
                        onChange={(e) => handleReasonChange(ticket.id, e.target.value)}
                        onBlur={() => setTouched((prev) => ({ ...prev, [ticket.id]: true }))}
                        rows={2}
                        aria-invalid={showReasonError}
                        placeholder={
                          reasonRequired
                            ? 'Explain why you are overriding the AI suggestion (min 10 characters)...'
                            : 'Optional note for the audit trail...'
                        }
                        className={`w-full px-3 py-2 rounded-[9px] bg-card border text-[13px] text-[#202522] resize-y transition-colors duration-200 focus:outline-hidden focus:ring-2 focus:ring-ring ${
                          showReasonError ? 'border-breached' : 'border-border-ref focus:border-primary'
                        }`}
                      />
                      {showReasonError && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-breached">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          {trimmedReason.length === 0
                            ? 'A written reason is required when changing priority or category.'
                            : `Reason is too short — ${trimmedReason.length}/${MIN_REASON_LENGTH} characters.`}
                        </p>
                      )}
                    </div>

                    {/* Approve & Route Action */}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleResolveTriage(ticket)}
                        disabled={submitDisabled}
                        className="inline-flex items-center justify-center gap-1.5 h-[41px] px-5 rounded-[9px] bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-[#1D573D] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <CircleCheck className="w-4 h-4 text-white" />
                        <span>{isResolving ? 'Routing...' : 'Approve & Route'}</span>
                      </button>
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
