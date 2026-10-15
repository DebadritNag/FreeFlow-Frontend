'use client';

import React from 'react';
import { Priority, TicketStatus } from '@/src/types/ticket';
import { calculateSlaStatus, formatRemainingSlaSeconds } from '@/src/lib/sla';
import { SlaIndicator } from './Badges';

interface CountdownCellProps {
  slaDeadline: string;
  slaTargetMinutes: number;
  status: TicketStatus;
  now: Date;
  /** Priority is only used to keep the cell's SLA inputs explicit; status/deadline drive classification. */
  priority?: Priority;
  className?: string;
}

/**
 * Row-isolated, per-second SLA countdown cell (addresses audit §7b row re-render isolation).
 *
 * Wrapped in React.memo: a page-level 1s ticker feeds a shared `now` Date into every
 * CountdownCell, but only the CountdownCell instances re-render on each tick — the
 * surrounding row cells (subject, badges, assignee, actions) do NOT re-render because
 * their props are unchanged. The ticket's own SLA fields (slaDeadline/slaTargetMinutes/
 * status) are stable between ticks, so React.memo's shallow prop compare only sees `now`
 * change here.
 */
function CountdownCellBase({
  slaDeadline,
  slaTargetMinutes,
  status,
  now,
  className = '',
}: CountdownCellProps) {
  const slaStatus = calculateSlaStatus(
    { status, slaDeadline, slaTargetMinutes, createdAt: slaDeadline },
    now
  );
  const remainingText = formatRemainingSlaSeconds(slaDeadline, now);

  return (
    <SlaIndicator slaStatus={slaStatus} remainingText={remainingText} className={className} />
  );
}

const CountdownCell = React.memo(CountdownCellBase);

export default CountdownCell;
