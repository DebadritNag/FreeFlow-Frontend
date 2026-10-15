'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  optimisticClaimTicket,
  rollbackClaimTicket,
  setCurrentTicket,
  updateTicketLocally,
} from '@/src/store/ticketsSlice';
import {
  claimTicketApi,
  fetchTicketById,
  pollUpdatesSinceApi,
  retriageTicketApi,
  unclaimTicketApi,
  updateStatusApi,
  updateTriageApi,
  ApiError,
} from '@/src/lib/api-client';
import Header from '@/src/components/navigation/Header';
import Sidebar from '@/src/components/navigation/Sidebar';
import {
  CategoryBadge,
  CustomerTierBadge,
  PriorityBadge,
  StatusBadge,
} from '@/src/components/tickets/Badges';
import CountdownCell from '@/src/components/tickets/CountdownCell';
import { isValidStatusTransition } from '@/src/lib/ticket-rules';
import { Priority, TicketCategory, TicketStatus } from '@/src/types/ticket';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Building,
  Download,
  FileText,
  Mail,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  User,
  UserCheck,
  UserMinus,
  UserRoundPlus,
  Zap,
} from 'lucide-react';

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const dispatch = useAppDispatch();
  const { currentTicket, activeAgent } = useAppSelector(
    (state) => state.tickets
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Editable fields in detail view
  const [selectedPriority, setSelectedPriority] = useState<Priority>('P2');
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory>('general');

  // Single per-second ticker feeding the SLA countdown on the detail page.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Re-run AI (retriage) in-flight state.
  const [retriaging, setRetriaging] = useState(false);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTicketById(ticketId);
      dispatch(setCurrentTicket(data));
      setSelectedPriority(data.priority);
      setSelectedCategory(data.category);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Unable to load ticket #${ticketId}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [ticketId, dispatch]);

  useEffect(() => {
    if (!ticketId) return;
    let isCancelled = false;

    async function doFetch() {
      try {
        const data = await fetchTicketById(ticketId);
        if (!isCancelled) {
          dispatch(setCurrentTicket(data));
          setSelectedPriority(data.priority);
          setSelectedCategory(data.category);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : `Unable to load ticket #${ticketId}`;
          setError(msg);
          setLoading(false);
        }
      }
    }

    doFetch();
    return () => {
      isCancelled = true;
    };
  }, [ticketId, dispatch]);

  // 10s live poll: reflects a concurrent claim/update to THIS ticket by another
  // agent (e.g. background mutation or another agent claiming it). Uses the
  // timestamp-based ?since= contract; cleaned up on unmount.
  useEffect(() => {
    if (!ticketId) return;
    let since = new Date().toISOString();
    let cancelled = false;

    const interval = setInterval(async () => {
      try {
        const data = await pollUpdatesSinceApi(since);
        if (data.timestamp) since = data.timestamp;
        if (cancelled) return;
        const match = data.updatedTickets?.find((t) => t.id === ticketId);
        if (match) {
          dispatch(setCurrentTicket(match));
          dispatch(updateTicketLocally(match));
          toast.info(`Ticket #${ticketId} was updated by live sync.`, {
            id: `live-${ticketId}`,
          });
        }
      } catch {
        // Silent polling error; retried next interval.
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ticketId, dispatch]);

  if (loading && !currentTicket) {
    return (
      <div className="min-h-screen flex bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 w-full max-w-[1120px] mx-auto px-6 lg:px-10 py-6">
            <div className="h-5 w-32 bg-secondary rounded mb-6 animate-pulse" />
            <div className="bg-card border border-border-ref rounded-xl p-6 space-y-4 animate-pulse shadow-card">
              <div className="h-8 w-2/3 bg-secondary rounded" />
              <div className="h-4 w-1/3 bg-secondary rounded" />
              <div className="h-32 bg-secondary rounded mt-6" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !currentTicket) {
    return (
      <div className="min-h-screen flex bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 w-full max-w-[720px] mx-auto px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-breached/10 text-breached mx-auto flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Ticket Not Found</h2>
            <p className="text-sm text-text-secondary mt-1 mb-6">
              {error || `Ticket #${ticketId} does not exist or could not be loaded.`}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={loadTicket}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors duration-200 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <Link
                href="/tickets"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-card text-foreground border border-border-ref text-xs font-medium hover:bg-subtle-hover transition-colors duration-200 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Tickets</span>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const isAssignedToActive = currentTicket.assignee?.id === activeAgent.id;
  const isEnterprise = currentTicket.customer.tier === 'enterprise';

  // Allowed next status options
  const statusOptions: { value: TicketStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
  ];

  // 1. Claim Ticket Handler (supports standard claim, force takeover, and simulated 409 conflict)
  const handleClaim = async (force: boolean = false, simulateConflict: boolean = false) => {
    if (!currentTicket) return;
    if (isAssignedToActive && !force) return;

    const previousTicket = { ...currentTicket };
    setActionInProgress(true);

    // Optimistic claim
    dispatch(optimisticClaimTicket({ ticketId: currentTicket.id, agent: activeAgent }));
    toast.loading(
      force
        ? `Reassigning ticket #${currentTicket.id} to ${activeAgent.name.split(' ')[0]}...`
        : simulateConflict
        ? `Simulating concurrent 409 claim conflict on #${currentTicket.id}...`
        : `Claiming ticket #${currentTicket.id}...`,
      { id: 'claim-action' }
    );

    try {
      const response = await claimTicketApi(currentTicket.id, activeAgent, { force, simulateConflict });
      if (response.success && response.ticket) {
        dispatch(setCurrentTicket(response.ticket));
        dispatch(updateTicketLocally(response.ticket));
        toast.success(
          force
            ? `Ticket successfully reassigned to ${activeAgent.name}!`
            : `Ticket claimed by ${activeAgent.name}!`,
          { id: 'claim-action' }
        );
      }
    } catch (err: unknown) {
      // Rollback optimistic update
      dispatch(rollbackClaimTicket({ originalTicket: previousTicket }));

      if (err instanceof ApiError) {
        const errorData = err.data as { conflictingAgent?: { name: string; id: string; email: string; role: string } } | undefined;
        if (err.status === 409 && errorData?.conflictingAgent) {
          toast.error(
            `Conflict: #${currentTicket.id} was already claimed by ${errorData.conflictingAgent.name}.`,
            { id: 'claim-action' }
          );
          const conflictTicket = {
            ...previousTicket,
            assignee: errorData.conflictingAgent,
            status: previousTicket.status === 'open' ? 'in_progress' : previousTicket.status,
          };
          dispatch(updateTicketLocally(conflictTicket));
          dispatch(setCurrentTicket(conflictTicket));
          return;
        }
        toast.error(err.message || 'Claim failed due to network error.', { id: 'claim-action' });
      } else {
        toast.error('Claim failed due to an unexpected error.', { id: 'claim-action' });
      }
    } finally {
      setActionInProgress(false);
    }
  };

  // 1b. Unclaim / Release Ticket Handler
  const handleUnclaim = async () => {
    if (!currentTicket) return;
    setActionInProgress(true);
    toast.loading(`Releasing ticket #${currentTicket.id}...`, { id: 'unclaim-action' });

    try {
      const response = await unclaimTicketApi(currentTicket.id);
      if (response.success && response.ticket) {
        dispatch(setCurrentTicket(response.ticket));
        dispatch(updateTicketLocally(response.ticket));
        toast.success(`Ticket #${currentTicket.id} returned to unassigned pool.`, { id: 'unclaim-action' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to release ticket.';
      toast.error(msg, { id: 'unclaim-action' });
    } finally {
      setActionInProgress(false);
    }
  };

  // 2. Status Transition Handler
  const handleStatusChange = async (nextStatus: TicketStatus) => {
    if (nextStatus === currentTicket.status) return;

    if (!isValidStatusTransition(currentTicket.status, nextStatus)) {
      toast.error(
        `Invalid status transition: Allowed flow is open → in_progress → resolved → open.`
      );
      return;
    }

    setActionInProgress(true);
    toast.loading(`Transitioning status to ${nextStatus}...`, { id: 'status-update' });

    try {
      const res = await updateStatusApi(currentTicket.id, nextStatus);
      if (res.success && res.ticket) {
        dispatch(setCurrentTicket(res.ticket));
        dispatch(updateTicketLocally(res.ticket));
        toast.success(`Status updated to ${nextStatus}!`, { id: 'status-update' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed.';
      toast.error(msg, { id: 'status-update' });
    } finally {
      setActionInProgress(false);
    }
  };

  // 3. Save Triage & Priority Updates Handler
  const handleSaveTriage = async () => {
    if (isEnterprise && (selectedPriority === 'P2' || selectedPriority === 'P3')) {
      toast.error('Enterprise customer tickets must never be assigned below P1 urgency.');
      return;
    }

    setActionInProgress(true);
    toast.loading('Updating ticket triage properties...', { id: 'triage-save' });

    try {
      const res = await updateTriageApi(currentTicket.id, {
        priority: selectedPriority,
        category: selectedCategory,
      });

      if (res.success && res.ticket) {
        dispatch(setCurrentTicket(res.ticket));
        dispatch(updateTicketLocally(res.ticket));
        toast.success('Ticket updated successfully!', { id: 'triage-save' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update ticket.';
      toast.error(msg, { id: 'triage-save' });
    } finally {
      setActionInProgress(false);
    }
  };

  // 4. Re-run AI (retriage) Handler — calls the browser-keyed retriage endpoint.
  const handleRetriage = async () => {
    if (!currentTicket) return;
    setRetriaging(true);
    toast.loading(`Re-running AI triage for #${currentTicket.id}...`, { id: 'retriage-action' });

    try {
      const res = await retriageTicketApi(currentTicket.id);
      if (res.success && res.ticket) {
        dispatch(setCurrentTicket(res.ticket));
        dispatch(updateTicketLocally(res.ticket));
        setSelectedPriority(res.ticket.priority);
        setSelectedCategory(res.ticket.category);
        toast.success(`AI triage updated for #${currentTicket.id}.`, { id: 'retriage-action' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Re-run AI failed.';
      toast.error(msg, { id: 'retriage-action' });
    } finally {
      setRetriaging(false);
    }
  };

  // Shared card chrome for the warm reference palette
  const cardClass =
    'bg-card border border-border-ref rounded-xl shadow-card';
  const sectionHeadingClass =
    'text-[12px] font-semibold text-text-secondary uppercase tracking-[0.06em]';

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 w-full max-w-[1120px] mx-auto px-5 sm:px-8 lg:px-10 pt-6 pb-10">

          {/* Utility row: back link + version */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link
              href="/tickets"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-hover transition-colors duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Tickets</span>
            </Link>

            <span className="text-[12px] text-text-secondary tabular-nums">
              Version {currentTicket.version}
            </span>
          </div>

          {/* Ticket summary card */}
          <div className={`${cardClass} p-6 mb-6`}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">

              {/* Left: metadata + title + timestamps */}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">
                    {currentTicket.id}
                  </span>
                  <PriorityBadge priority={currentTicket.priority} rawValue={currentTicket.rawPriority} />
                  <StatusBadge status={currentTicket.status} rawValue={currentTicket.rawStatus} />
                  <CategoryBadge category={currentTicket.category} rawValue={currentTicket.rawCategory} />
                  <CustomerTierBadge tier={currentTicket.customer.tier} rawValue={currentTicket.rawTier} />
                </div>

                <h1
                  dir="auto"
                  className="text-[22px] sm:text-[24px] font-bold text-foreground leading-[1.25] break-words"
                >
                  {currentTicket.subject}
                </h1>

                <div className="flex flex-wrap items-center gap-1.5 text-[12px] sm:text-[13px] text-text-secondary">
                  <span>Created {new Date(currentTicket.createdAt).toLocaleString()}</span>
                  <span aria-hidden="true">·</span>
                  <span>Last updated {new Date(currentTicket.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Right: assignment-state actions (states a / b / c) */}
              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto flex-shrink-0">
                {!currentTicket.assignee ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleClaim(false, false)}
                      disabled={actionInProgress}
                      className="inline-flex items-center gap-1.5 h-[38px] px-[15px] rounded-[10px] bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary-hover transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserRoundPlus className="w-4 h-4" />
                      <span>Claim as {activeAgent.name.split(' ')[0]}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClaim(false, true)}
                      disabled={actionInProgress}
                      title="Simulate a 409 conflict where a concurrent agent claims this ticket simultaneously"
                      className="inline-flex items-center gap-1.5 h-[38px] px-[15px] rounded-[10px] bg-card text-warning border border-amber-border font-semibold text-[13px] hover:bg-amber-surface transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Simulate 409 Conflict</span>
                    </button>
                  </>
                ) : isAssignedToActive ? (
                  <>
                    <div className="inline-flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] bg-surface-green text-primary border border-surface-green-hover text-[13px] font-semibold">
                      <UserCheck className="w-4 h-4" />
                      <span>Assigned to You</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleUnclaim}
                      disabled={actionInProgress}
                      title="Release this ticket back to the unassigned queue"
                      className="inline-flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] bg-card text-foreground hover:bg-subtle-hover border border-border-ref text-[13px] font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserMinus className="w-4 h-4 text-text-secondary" />
                      <span>Release Ticket</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] bg-card text-foreground border border-border-ref text-[13px] font-medium">
                      <User className="w-4 h-4 text-text-secondary" />
                      <span>Assigned to {currentTicket.assignee.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleClaim(true, false)}
                      disabled={actionInProgress}
                      title={`Take over ticket #${currentTicket.id} and reassign to ${activeAgent.name}`}
                      className="inline-flex items-center gap-1.5 h-[38px] px-[15px] rounded-[10px] bg-primary text-primary-foreground hover:bg-primary-hover font-semibold text-[13px] transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Take Over as {activeAgent.name.split(' ')[0]}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleUnclaim}
                      disabled={actionInProgress}
                      title="Unassign ticket back to open pool"
                      className="inline-flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] bg-card text-text-secondary hover:text-foreground hover:bg-subtle-hover border border-border-ref text-[13px] font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Unassign</span>
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>

          {/* Main two-column grid: left ~66% / right ~32% */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Left column */}
            <div className="lg:col-span-2 space-y-6 min-w-0">

              {/* Customer Message card */}
              <div className={`${cardClass} p-6`}>
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-border-ref mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-[34px] h-[34px] rounded-full bg-surface-neutral flex items-center justify-center text-[14px] font-semibold text-foreground flex-shrink-0">
                      {currentTicket.customer.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-foreground truncate">
                        {currentTicket.customer.name}
                      </h3>
                      <p className="text-[12px] text-text-secondary truncate">
                        {currentTicket.customer.email}
                      </p>
                    </div>
                  </div>

                  <CustomerTierBadge tier={currentTicket.customer.tier} />
                </div>

                {/* CRITICAL: Safe Plain Text Rendering. NO dangerouslySetInnerHTML.
                    dir="auto" so RTL (e.g. T-2007 Arabic) content aligns correctly. */}
                <div
                  dir="auto"
                  className="text-[14px] text-foreground leading-[1.65] whitespace-pre-wrap font-sans break-words bg-surface-search p-4 rounded-[11px] border border-border-ref"
                >
                  {currentTicket.description}
                </div>

                {/* Attachments Section */}
                {currentTicket.attachments && currentTicket.attachments.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border-ref">
                    <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-[0.06em] mb-2.5">
                      Attached Files ({currentTicket.attachments.length})
                    </h4>
                    <div className="space-y-2">
                      {currentTicket.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-[10px] bg-surface-search border border-border-ref text-[13px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                            <span className="font-medium text-foreground truncate max-w-[260px]">
                              {att.name}
                            </span>
                            <span className="text-[11px] text-text-secondary tabular-nums flex-shrink-0">
                              ({att.size})
                            </span>
                          </div>

                          <div className="flex-shrink-0">
                            {att.isSafe ? (
                              <a
                                href={att.url}
                                download={att.name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[12px] font-medium bg-card hover:bg-subtle-hover text-foreground border border-border-ref transition-colors duration-200 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </a>
                            ) : (
                              <span
                                title="Unsafe protocol (e.g. javascript:) blocked by security policy"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] text-[11px] font-semibold bg-breached/10 text-breached border border-breached/30"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>Blocked Link</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Triage & Properties card */}
              <div className={`${cardClass} p-5 sm:p-6`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-[18px] h-[18px] text-primary" />
                    <h3 className="text-[14px] font-semibold text-foreground">
                      Triage &amp; Properties
                    </h3>
                  </div>
                  {isEnterprise && (
                    <span className="text-[11px] text-warning font-semibold bg-amber-surface px-2 py-0.5 rounded-full border border-amber-border">
                      Enterprise SLA Floor (P0/P1)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="triage-priority" className="block text-[12px] text-text-secondary mb-1.5 font-medium">
                      Priority
                    </label>
                    <select
                      id="triage-priority"
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                      className="w-full h-[40px] px-3 rounded-[9px] bg-surface-search border border-border-ref text-foreground text-[13px] focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200 cursor-pointer"
                    >
                      <option value="P0">P0 Urgent (1h SLA)</option>
                      <option value="P1">P1 High (4h SLA)</option>
                      <option value="P2" disabled={isEnterprise}>
                        P2 Medium (24h SLA) {isEnterprise ? '— Disabled for Enterprise' : ''}
                      </option>
                      <option value="P3" disabled={isEnterprise}>
                        P3 Low (72h SLA) {isEnterprise ? '— Disabled for Enterprise' : ''}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="triage-category" className="block text-[12px] text-text-secondary mb-1.5 font-medium">
                      Category
                    </label>
                    <select
                      id="triage-category"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as TicketCategory)}
                      className="w-full h-[40px] px-3 rounded-[9px] bg-surface-search border border-border-ref text-foreground text-[13px] focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200 cursor-pointer"
                    >
                      <option value="technical">Technical</option>
                      <option value="billing">Billing</option>
                      <option value="security">Security</option>
                      <option value="account">Account</option>
                      <option value="feature_request">Feature Request</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTriage}
                  disabled={actionInProgress}
                  className="mt-4 inline-flex items-center justify-center h-[40px] px-4 rounded-[9px] bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary-hover transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Property Updates
                </button>
              </div>

              {/* AI Triage card — summary + decision + reason + Re-run AI, with
                  final-vs-AI priority shown when they differ. */}
              <div className={`${cardClass} p-5 sm:p-6`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Bot className="w-[18px] h-[18px] text-primary" />
                    <h3 className="text-[14px] font-semibold text-foreground">
                      AI Triage
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetriage}
                    disabled={retriaging}
                    title="Re-run the AI triage for this ticket"
                    className="inline-flex items-center gap-1.5 h-[36px] px-3.5 rounded-[9px] bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary-hover transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${retriaging ? 'animate-spin' : ''}`} />
                    <span>{retriaging ? 'Re-running…' : 'Re-run AI'}</span>
                  </button>
                </div>

                <div className="space-y-3 text-[13px]">
                  {/* Summary (plain text, already sanitized server-side) */}
                  <div>
                    <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-[0.06em] mb-1">
                      AI Summary
                    </p>
                    {currentTicket.summary ? (
                      <p dir="auto" className="text-foreground leading-[1.6] whitespace-pre-wrap break-words">
                        {currentTicket.summary}
                      </p>
                    ) : (
                      <p className="text-text-secondary italic">
                        No AI summary yet. Use Re-run AI to generate one.
                      </p>
                    )}
                  </div>

                  {/* AI decision (triage routing) */}
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-text-secondary">AI Decision:</span>
                    <span className="font-semibold text-foreground">
                      {currentTicket.triageDecision === 'manual_review' ? 'Manual review' : 'Automated'}
                    </span>
                  </div>

                  {/* Final vs AI-suggested priority: show BOTH only when they differ. */}
                  {currentTicket.aiPriority && currentTicket.aiPriority !== currentTicket.priority ? (
                    <div className="p-3 rounded-[10px] bg-surface-search border border-border-ref space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-text-secondary">Final:</span>
                        <PriorityBadge priority={currentTicket.priority} />
                        <span className="text-text-secondary">AI-suggested:</span>
                        <PriorityBadge priority={currentTicket.aiPriority} />
                      </div>
                      {currentTicket.reviewReason && (
                        <p dir="auto" className="text-[12px] text-foreground leading-[1.5] break-words">
                          <strong>Reason:</strong> {currentTicket.reviewReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    currentTicket.reviewReason && (
                      <p dir="auto" className="text-[12px] text-foreground leading-[1.5] break-words">
                        <strong>AI Reason:</strong> {currentTicket.reviewReason}
                      </p>
                    )
                  )}
                </div>
              </div>

              {/* Additional Notes card — presentational placeholder: no notes field exists on the Ticket model */}
              <div className={`${cardClass} p-5 sm:p-6`}>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-[18px] h-[18px] text-primary" />
                  <h3 className="text-[14px] font-semibold text-foreground">
                    Additional Notes
                  </h3>
                </div>
                <div className="min-h-[76px] p-3 rounded-[9px] bg-surface-search border border-border-ref flex items-center">
                  <p className="text-[13px] text-text-secondary">
                    No additional notes added.
                  </p>
                </div>
              </div>

              {/* AI Triage Recommendation Notice if manual review */}
              {currentTicket.triageDecision === 'manual_review' && (
                <div className="p-4 rounded-xl bg-amber-surface border border-amber-border text-[13px] space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-warning">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Manual Review Flagged</span>
                  </div>
                  {currentTicket.triageReason && (
                    <p className="text-[12px] text-foreground">
                      <strong>Reason:</strong> {currentTicket.triageReason}
                    </p>
                  )}
                  {currentTicket.aiSuggestedPriority && (
                    <p className="text-[12px] text-foreground">
                      <strong>AI Recommendation:</strong> Suggested Priority{' '}
                      <span className="font-bold">{currentTicket.aiSuggestedPriority}</span>{' '}
                      (Confidence: {Math.round((currentTicket.aiConfidence || 0.8) * 100)}%)
                    </p>
                  )}
                </div>
              )}

            </div>

            {/* Right column */}
            <div className="space-y-3.5 min-w-0">

              {/* Status Lifecycle card */}
              <div className={`${cardClass} p-5`}>
                <h3 className={sectionHeadingClass}>Status Lifecycle</h3>

                <p className="text-[12px] text-text-secondary mt-2.5 mb-3">
                  Allowed flow:{' '}
                  <span className="font-mono text-foreground">open → in_progress → resolved → open</span>
                </p>

                <div className="grid grid-cols-3 gap-1.5">
                  {statusOptions.map((opt) => {
                    const isCurrent = currentTicket.status === opt.value;
                    const isValidNext = isValidStatusTransition(currentTicket.status, opt.value);

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleStatusChange(opt.value)}
                        disabled={isCurrent || !isValidNext || actionInProgress}
                        className={`h-[30px] px-2 rounded-[8px] text-[12px] font-medium text-center transition-colors duration-200 ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground font-semibold cursor-default'
                            : isValidNext
                            ? 'bg-surface-neutral text-foreground hover:bg-subtle-hover cursor-pointer'
                            : 'bg-surface-search text-text-secondary opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Level Agreement card */}
              <div className={`${cardClass} p-5`}>
                <h3 className={sectionHeadingClass}>Service Level Agreement</h3>

                <div className="space-y-3 text-[12px] mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">SLA Status</span>
                    <CountdownCell
                      slaDeadline={currentTicket.slaDeadline}
                      slaTargetMinutes={currentTicket.slaTargetMinutes}
                      status={currentTicket.status}
                      priority={currentTicket.priority}
                      now={now}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Target Response</span>
                    <span className="text-foreground tabular-nums font-medium">
                      {Math.round(currentTicket.slaTargetMinutes / 60)} hours
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Deadline</span>
                    <span className="text-foreground text-[11px] tabular-nums font-medium text-right">
                      {new Date(currentTicket.slaDeadline).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ticket Ownership card */}
              <div className={`${cardClass} p-5`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className={sectionHeadingClass}>Ticket Ownership</h3>
                  {currentTicket.assignee ? (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isAssignedToActive
                          ? 'bg-surface-green text-primary border border-surface-green-hover'
                          : 'bg-surface-neutral text-foreground'
                      }`}
                    >
                      {isAssignedToActive ? 'Assigned to You' : 'Assigned'}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-surface text-warning border border-amber-border">
                      Unassigned
                    </span>
                  )}
                </div>

                {currentTicket.assignee ? (
                  <div className="flex items-center gap-2.5 mt-3">
                    <div className="w-9 h-9 rounded-full bg-surface-neutral flex items-center justify-center text-[13px] font-semibold text-foreground overflow-hidden flex-shrink-0">
                      {currentTicket.assignee.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentTicket.assignee.avatarUrl}
                          alt={currentTicket.assignee.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        currentTicket.assignee.name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">
                        {currentTicket.assignee.name}
                      </p>
                      <p className="text-[12px] text-text-secondary truncate">
                        {currentTicket.assignee.role || currentTicket.assignee.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-text-secondary italic mt-3">
                    This ticket has not yet been claimed by any support agent.
                  </p>
                )}
              </div>

              {/* Customer Details card */}
              <div className={`${cardClass} p-5`}>
                <h3 className={sectionHeadingClass}>Customer Details</h3>

                <div className="space-y-2.5 text-[13px] mt-3">
                  <div className="flex items-center gap-2 text-foreground">
                    <User className="w-4 h-4 text-text-secondary flex-shrink-0" />
                    <span className="font-medium truncate">{currentTicket.customer.name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-foreground">
                    <Mail className="w-4 h-4 text-text-secondary flex-shrink-0" />
                    <span className="text-[12px] break-all">{currentTicket.customer.email}</span>
                  </div>

                  {currentTicket.customer.company && (
                    <div className="flex items-center gap-2 text-foreground">
                      <Building className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      <span className="truncate">{currentTicket.customer.company}</span>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Tier Plan</span>
                    <CustomerTierBadge tier={currentTicket.customer.tier} />
                  </div>
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
