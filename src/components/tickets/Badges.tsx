import React from 'react';
import { CustomerTier, Priority, SlaStatus, TicketCategory, TicketStatus } from '@/src/types/ticket';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
  showIcon?: boolean;
}

export function PriorityBadge({ priority, className = '', showIcon = true }: PriorityBadgeProps) {
  const styles: Record<Priority, { bg: string; text: string; border: string; label: string }> = {
    P0: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      label: 'P0 Urgent',
    },
    P1: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-800 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      label: 'P1 High',
    },
    P2: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      label: 'P2 Medium',
    },
    P3: {
      bg: 'bg-neutral-100 dark:bg-neutral-800',
      text: 'text-neutral-700 dark:text-neutral-300',
      border: 'border-neutral-200 dark:border-neutral-700',
      label: 'P3 Low',
    },
  };

  const style = styles[priority] || styles.P2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide border flex-shrink-0 ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {showIcon && priority === 'P0' && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
      {showIcon && priority === 'P1' && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
      <span>{style.label}</span>
    </span>
  );
}

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const styles: Record<TicketStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
    open: {
      bg: 'bg-neutral-100 dark:bg-neutral-800/80',
      text: 'text-neutral-800 dark:text-neutral-200',
      border: 'border-neutral-200 dark:border-neutral-700',
      dot: 'bg-sky-500',
      label: 'Open',
    },
    in_progress: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-900 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800/60',
      dot: 'bg-amber-500 animate-pulse',
      label: 'In Progress',
    },
    resolved: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      text: 'text-emerald-800 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      dot: 'bg-emerald-600',
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
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900 flex-shrink-0 ${className}`}
      >
        <Clock className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0" />
        <span className="tabular-nums font-semibold">{remainingText}</span>
      </span>
    );
  }

  if (slaStatus === 'at_risk') {
    return (
      <span
        title="SLA At Risk (< 20% remaining)"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex-shrink-0 ${className}`}
      >
        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="tabular-nums font-medium">{remainingText}</span>
      </span>
    );
  }

  return (
    <span
      title="SLA On Track"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 flex-shrink-0 ${className}`}
    >
      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      <span className="tabular-nums">{remainingText}</span>
    </span>
  );
}

export function CategoryBadge({ category, className = '' }: { category: TicketCategory; className?: string }) {
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
      className={`inline-block px-2 py-0.5 rounded text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/60 font-medium whitespace-nowrap flex-shrink-0 ${className}`}
    >
      {labels[category] || category}
    </span>
  );
}

export function CustomerTierBadge({ tier, className = '' }: { tier: CustomerTier; className?: string }) {
  if (tier === 'enterprise') {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 tracking-wide uppercase flex-shrink-0 ${className}`}
      >
        Enterprise
      </span>
    );
  }

  if (tier === 'business') {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 flex-shrink-0 ${className}`}
      >
        Business
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 flex-shrink-0 ${className}`}
    >
      {tier.toUpperCase()}
    </span>
  );
}
