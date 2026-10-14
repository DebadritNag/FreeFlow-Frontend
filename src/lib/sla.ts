import { Priority, SlaStatus, Ticket } from '@/src/types/ticket';

export const SLA_TARGETS_MINUTES: Record<Priority, number> = {
  P0: 60, // 1 hour
  P1: 240, // 4 hours
  P2: 1440, // 24 hours
  P3: 4320, // 72 hours
};

export function getSlaTargetMinutes(priority: Priority): number {
  return SLA_TARGETS_MINUTES[priority] ?? 1440;
}

export function calculateSlaDeadline(createdAtIso: string, priority: Priority): string {
  const createdDate = new Date(createdAtIso);
  const minutes = getSlaTargetMinutes(priority);
  const deadlineDate = new Date(createdDate.getTime() + minutes * 60 * 1000);
  return deadlineDate.toISOString();
}

export function calculateSlaStatus(
  ticket: Pick<Ticket, 'status' | 'createdAt' | 'slaDeadline' | 'slaTargetMinutes'>,
  now: Date = new Date()
): SlaStatus {
  const deadline = new Date(ticket.slaDeadline).getTime();
  const nowMs = now.getTime();

  // If already resolved, check if it was completed before deadline
  // In our schema, resolved tickets can be classified as on_track if resolved before deadline
  if (ticket.status === 'resolved') {
    return 'on_track';
  }

  if (nowMs > deadline) {
    return 'late';
  }

  const remainingMs = deadline - nowMs;
  const totalMs = (ticket.slaTargetMinutes || 1440) * 60 * 1000;
  const ratio = remainingMs / totalMs;

  if (ratio < 0.2) {
    return 'at_risk';
  }

  return 'on_track';
}

export function formatRemainingSla(slaDeadline: string, now: Date = new Date()): string {
  const deadline = new Date(slaDeadline).getTime();
  const diffMs = deadline - now.getTime();

  if (diffMs < 0) {
    const overdueMinutes = Math.abs(Math.floor(diffMs / (60 * 1000)));
    if (overdueMinutes < 60) return `${overdueMinutes}m overdue`;
    const overdueHours = Math.floor(overdueMinutes / 60);
    const remainingMins = overdueMinutes % 60;
    if (overdueHours < 24) return `${overdueHours}h ${remainingMins}m overdue`;
    const days = Math.floor(overdueHours / 24);
    return `${days}d overdue`;
  }

  const remainingMinutes = Math.floor(diffMs / (60 * 1000));
  if (remainingMinutes < 60) return `${remainingMinutes}m left`;
  const remainingHours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;
  if (remainingHours < 24) return `${remainingHours}h ${mins}m left`;
  const days = Math.floor(remainingHours / 24);
  return `${days}d ${remainingHours % 24}h left`;
}
