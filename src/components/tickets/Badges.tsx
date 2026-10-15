import React from 'react';
import { CustomerTier, Priority, SlaStatus, TicketCategory, TicketStatus } from '@/src/types/ticket';
import { AlertCircle, AlertTriangle, Clock3 } from 'lucide-react';

/**
 * Visible amber flag appended to a badge when the ticket carried an
 * invalid/unknown raw enum value that was safe-coerced for math/sorting
 * (DECISION D1). `kind` controls the wording ('invalid' vs 'unknown').
 */
function RawValueFlag({ rawValue, kind = 'invalid' }: { rawValue: string; kind?: 'invalid' | 'unknown' }) {
  return (
    <span
      title={`Original value "${rawValue}" is ${kind} and was coerced to a safe fallback`}
      className="inline-flex items-center gap-0.5 ml-1 px-1 py-px rounded text-[10px] font-semibold bg-amber-surface text-warning border border-amber-border align-middle"
    >
      <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
      <span>· {kind}</span>
    </span>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
  showIcon?: boolean;
  /** Original raw value preserved when the source enum was invalid (DECISION D1). */
  rawValue?: string;
}

const VALID_PRIORITIES: readonly string[] = ['P0', 'P1', 'P2', 'P3'];
const VALID_STATUSES: readonly string[] = ['open', 'in_progress', 'resolved'];
const VALID_CATEGORIES: readonly string[] = [
  'billing',
  'technical',
  'account',
  'feature_request',
  'security',
  'general',
];
const VALID_TIERS: readonly string[] = ['enterprise', 'business', 'pro', 'free'];

export function PriorityBadge({ priority, className = '', showIcon = true, rawValue }: PriorityBadgeProps) {
  const styles: Record<Priority, { bg: string; text: string; border: string; label: string }> = {
    P0: {
      bg: 'bg-breached/10',
      text: 'text-breached',
      border: 'border-breached/30',
      label: 'P0 Urgent',
    },
    P1: {
      bg: 'bg-amber-surface',
      text: 'text-warning',
      border: 'border-amber-border',
      label: 'P1 High',
    },
    P2: {
      bg: 'bg-surface-green',
      text: 'text-accent-foreground',
      border: 'border-surface-green-hover',
      label: 'P2 Medium',
    },
    P3: {
      bg: 'bg-secondary',
      text: 'text-text-secondary',
      border: 'border-border-ref',
      label: 'P3 Low',
    },
  };

  const style = styles[priority] || styles.P2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide border flex-shrink-0 ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {showIcon && priority === 'P0' && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
      {showIcon && priority === 'P1' && <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />}
      <span>{style.label}</span>
      {rawValue && !VALID_PRIORITIES.includes(rawValue) && <RawValueFlag rawValue={rawValue} />}
    </span>
  );
}

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
  rawValue?: string;
}

export function StatusBadge({ status, className = '', rawValue }: StatusBadgeProps) {
  const styles: Record<TicketStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
    open: {
      bg: 'bg-surface-green',
      text: 'text-accent-foreground',
      border: 'border-surface-green-hover',
      dot: 'bg-primary',
      label: 'Open',
    },
    in_progress: {
      bg: 'bg-amber-surface',
      text: 'text-warning',
      border: 'border-amber-border',
      dot: 'bg-warning animate-pulse',
      label: 'In Progress',
    },
    resolved: {
      bg: 'bg-secondary',
      text: 'text-text-secondary',
      border: 'border-border-ref',
      dot: 'bg-primary',
      label: 'Resolved',
    },
  };

  const style = styles[status] || styles.open;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      <span>{style.label}</span>
      {rawValue && !VALID_STATUSES.includes(rawValue) && <RawValueFlag rawValue={rawValue} />}
    </span>
  );
}

interface SlaIndicatorProps {
  slaStatus: SlaStatus;
  remainingText: string;
  className?: string;
}

export function SlaIndicator({ slaStatus, remainingText, className = '' }: SlaIndicatorProps) {
  if (slaStatus === 'late') {
    return (
      <span
        title="SLA Breached"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-breached/10 text-breached border border-breached/30 flex-shrink-0 ${className}`}
      >
        <Clock3 className="w-3 h-3 text-breached flex-shrink-0" />
        <span className="tabular-nums font-semibold">{remainingText}</span>
      </span>
    );
  }

  if (slaStatus === 'at_risk') {
    return (
      <span
        title="SLA At Risk (< 20% remaining)"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-green text-accent-foreground border border-surface-green-hover flex-shrink-0 ${className}`}
      >
        <Clock3 className="w-3 h-3 text-primary flex-shrink-0" />
        <span className="tabular-nums font-medium">{remainingText}</span>
      </span>
    );
  }

  return (
    <span
      title="SLA On Track"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-green text-accent-foreground border border-surface-green-hover flex-shrink-0 ${className}`}
    >
      <Clock3 className="w-3 h-3 text-primary flex-shrink-0" />
      <span className="tabular-nums">{remainingText}</span>
    </span>
  );
}

export function CategoryBadge({
  category,
  className = '',
  rawValue,
}: {
  category: TicketCategory;
  className?: string;
  rawValue?: string;
}) {
  const labels: Record<TicketCategory, string> = {
    technical: 'Technical',
    billing: 'Billing',
    security: 'Security',
    account: 'Account',
    feature_request: 'Feature',
    general: 'General',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs text-text-secondary bg-secondary border border-border-ref font-medium whitespace-nowrap flex-shrink-0 ${className}`}
    >
      <span>{labels[category] || category}</span>
      {rawValue && !VALID_CATEGORIES.includes(rawValue) && <RawValueFlag rawValue={rawValue} kind="unknown" />}
    </span>
  );
}

export function CustomerTierBadge({
  tier,
  className = '',
  rawValue,
}: {
  tier: CustomerTier;
  className?: string;
  rawValue?: string;
}) {
  const flag =
    rawValue && !VALID_TIERS.includes(rawValue) ? <RawValueFlag rawValue={rawValue} kind="unknown" /> : null;

  if (tier === 'enterprise') {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface-green text-accent-foreground border border-surface-green-hover tracking-wide uppercase flex-shrink-0 ${className}`}
      >
        Enterprise
        {flag}
      </span>
    );
  }

  if (tier === 'business') {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-text-secondary border border-border-ref flex-shrink-0 ${className}`}
      >
        Business
        {flag}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium text-text-secondary bg-secondary/60 border border-border-ref flex-shrink-0 ${className}`}
    >
      {tier.toUpperCase()}
      {flag}
    </span>
  );
}
