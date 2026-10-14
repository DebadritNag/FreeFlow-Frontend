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
  unclaimTicketApi,
  updateStatusApi,
  updateTriageApi,
  ApiError,
} from '@/src/lib/api-client';
import Header from '@/src/components/navigation/Header';
import {
  CategoryBadge,
  CustomerTierBadge,
  PriorityBadge,
  SlaIndicator,
  StatusBadge,
} from '@/src/components/tickets/Badges';
import { calculateSlaStatus, formatRemainingSla } from '@/src/lib/sla';
import { isValidStatusTransition } from '@/src/lib/ticket-rules';
import { Priority, TicketCategory, TicketStatus } from '@/src/types/ticket';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  Building,
  Download,
  FileText,
  Mail,
  RefreshCw,
  ShieldAlert,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
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

  if (loading && !currentTicket) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
          <div className="h-6 w-32 bg-muted rounded mb-6 animate-pulse" />
          <div className="bg-card border border-border rounded-xl p-8 space-y-4 animate-pulse">
            <div className="h-8 w-2/3 bg-muted rounded" />
            <div className="h-4 w-1/3 bg-muted rounded" />
            <div className="h-32 bg-muted rounded mt-6" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !currentTicket) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 mx-auto flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Ticket Not Found</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {error || `Ticket #${ticketId} does not exist or could not be loaded.`}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={loadTicket}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <Link
              href="/tickets"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Tickets</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const now = new Date();
  const slaStatus = calculateSlaStatus(currentTicket, now);
  const remainingSla = formatRemainingSla(currentTicket.slaDeadline, now);
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

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Tickets</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              Version {currentTicket.version}
            </span>
          </div>
        </div>

        {/* Top Header Card */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 mb-6 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs sm:text-sm font-bold text-foreground">
                  {currentTicket.id}
                </span>
                <PriorityBadge priority={currentTicket.priority} />
                <StatusBadge status={currentTicket.status} />
                <CategoryBadge category={currentTicket.category} />
                <CustomerTierBadge tier={currentTicket.customer.tier} />
              </div>

              <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight break-words">
                {currentTicket.subject}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Created {new Date(currentTicket.createdAt).toLocaleString()}</span>
                <span>•</span>
                <span>Last updated {new Date(currentTicket.updatedAt).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Quick Action Buttons: Claim, Conflict Simulation, Take Over, and Release */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              {!currentTicket.assignee ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleClaim(false, false)}
                    disabled={actionInProgress}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Claim as {activeAgent.name.split(' ')[0]}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClaim(false, true)}
                    disabled={actionInProgress}
                    title="Simulate a 409 conflict where a concurrent agent claims this ticket simultaneously"
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60 font-medium text-xs hover:bg-amber-100 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Simulate 409 Conflict</span>
                  </button>
                </>
              ) : isAssignedToActive ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 text-xs font-semibold">
                    <UserCheck className="w-4 h-4" />
                    <span>Assigned to You</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleUnclaim}
                    disabled={actionInProgress}
                    title="Release this ticket back to the unassigned queue"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border text-xs font-medium transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <UserMinus className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Release Ticket</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground border border-border text-xs font-medium">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Assigned to {currentTicket.assignee.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClaim(true, false)}
                    disabled={actionInProgress}
                    title={`Take over ticket #${currentTicket.id} and reassign to ${activeAgent.name}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Take Over as {activeAgent.name.split(' ')[0]}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUnclaim}
                    disabled={actionInProgress}
                    title="Unassign ticket back to open pool"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground border border-border text-xs font-medium transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <UserMinus className="w-3 h-3" />
                    <span>Unassign</span>
                  </button>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Main Grid: Details & Customer Message (Left) + Metadata & Actions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (2 Cols): Customer Message & Conversation */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Customer Message Box (Safe plain text rendering) */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-foreground">
                    {currentTicket.customer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                      {currentTicket.customer.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {currentTicket.customer.email}
                    </p>
                  </div>
                </div>

                <CustomerTierBadge tier={currentTicket.customer.tier} />
              </div>

              {/* CRITICAL: Safe Plain Text Rendering. NO dangerouslySetInnerHTML */}
              <div className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans break-words bg-background/50 p-4 rounded-lg border border-border/60">
                {currentTicket.description}
              </div>

              {/* Attachments Section */}
              {currentTicket.attachments && currentTicket.attachments.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                    Attached Files ({currentTicket.attachments.length})
                  </h4>
                  <div className="space-y-2">
                    {currentTicket.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 border border-border text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-foreground truncate max-w-xs">
                            {att.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            ({att.size})
                          </span>
                        </div>

                        <div>
                          {att.isSafe ? (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-card hover:bg-secondary text-foreground border border-border transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </a>
                          ) : (
                            <span
                              title="Unsafe protocol (e.g. javascript:) blocked by security policy"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 border border-red-300"
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

            {/* AI Triage Recommendation Notice if manual review */}
            {currentTicket.triageDecision === 'manual_review' && (
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs sm:text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Manual Review Flagged</span>
                </div>
                {currentTicket.triageReason && (
                  <p className="text-xs text-amber-900/90 dark:text-amber-300/90">
                    <strong>Reason:</strong> {currentTicket.triageReason}
                  </p>
                )}
                {currentTicket.aiSuggestedPriority && (
                  <p className="text-xs text-amber-900/90 dark:text-amber-300/90">
                    <strong>AI Recommendation:</strong> Suggested Priority{' '}
                    <span className="font-bold">{currentTicket.aiSuggestedPriority}</span>{' '}
                    (Confidence: {Math.round((currentTicket.aiConfidence || 0.8) * 100)}%)
                  </p>
                )}
              </div>
            )}

          </div>

          {/* Right Column (1 Col): Ticket Metadata & Actions Panel */}
          <div className="space-y-6">
            
            {/* Status Transition Card */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status Lifecycle
              </h3>

              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground">
                  Allowed flow: <span className="font-mono text-foreground font-medium">open → in_progress → resolved → open</span>
                </p>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {statusOptions.map((opt) => {
                    const isCurrent = currentTicket.status === opt.value;
                    const isValidNext = isValidStatusTransition(currentTicket.status, opt.value);

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleStatusChange(opt.value)}
                        disabled={isCurrent || !isValidNext || actionInProgress}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                            : isValidNext
                            ? 'bg-secondary hover:bg-accent text-foreground hover:text-accent-foreground border border-border'
                            : 'bg-muted/40 text-muted-foreground opacity-40 cursor-not-allowed border border-dashed border-border'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SLA Metadata Card */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Service Level Agreement
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SLA Status</span>
                  <SlaIndicator slaStatus={slaStatus} remainingText={remainingSla} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Target Response</span>
                  <span className="font-mono text-foreground tabular-nums">
                    {Math.round(currentTicket.slaTargetMinutes / 60)} hours
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="font-mono text-foreground text-[11px] tabular-nums">
                    {new Date(currentTicket.slaDeadline).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Ticket Ownership Card */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ticket Ownership
                </h3>
                {currentTicket.assignee ? (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isAssignedToActive
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-secondary text-foreground'
                  }`}>
                    {isAssignedToActive ? 'Assigned to You' : 'Assigned'}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Unassigned
                  </span>
                )}
              </div>

              {currentTicket.assignee ? (
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
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
                    <p className="text-xs font-semibold text-foreground truncate">
                      {currentTicket.assignee.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {currentTicket.assignee.role || currentTicket.assignee.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  This ticket has not yet been claimed by any support agent.
                </p>
              )}
            </div>

            {/* Customer Details Card */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Customer Details
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-foreground">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{currentTicket.customer.name}</span>
                </div>

                <div className="flex items-center gap-2 text-foreground">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-mono text-xs truncate">{currentTicket.customer.email}</span>
                </div>

                {currentTicket.customer.company && (
                  <div className="flex items-center gap-2 text-foreground">
                    <Building className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{currentTicket.customer.company}</span>
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Tier Plan</span>
                  <CustomerTierBadge tier={currentTicket.customer.tier} />
                </div>
              </div>
            </div>

            {/* Triage & Priority Controls Card */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Triage & Properties
                </h3>
                {isEnterprise && (
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Enterprise SLA Floor (P0/P1)
                  </span>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Priority
                  </label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-ring focus:outline-hidden"
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
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as TicketCategory)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:ring-2 focus:ring-ring focus:outline-hidden"
                  >
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="security">Security</option>
                    <option value="account">Account</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTriage}
                  disabled={actionInProgress}
                  className="w-full py-2 px-3 rounded-lg bg-secondary hover:bg-accent text-foreground hover:text-accent-foreground font-medium text-xs border border-border transition-colors shadow-2xs mt-2"
                >
                  Save Property Updates
                </button>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
