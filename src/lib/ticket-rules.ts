import { CustomerTier, Priority, Ticket, TicketCategory, TicketStatus, TriageDecision } from '@/src/types/ticket';
import { calculateSlaDeadline, getSlaTargetMinutes } from './sla';

/**
 * Allowed status transitions strictly follow:
 * open -> in_progress -> resolved -> open
 */
export function isValidStatusTransition(current: TicketStatus, next: TicketStatus): boolean {
  if (current === next) return true;

  if (current === 'open' && next === 'in_progress') return true;
  if (current === 'in_progress' && next === 'resolved') return true;
  if (current === 'resolved' && next === 'open') return true;

  return false;
}

/**
 * Enterprise tickets must never be assigned a priority below P1 urgency (only P0 or P1 allowed).
 */
export function isValidEnterprisePriority(tier: CustomerTier, priority: Priority): boolean {
  if (tier === 'enterprise') {
    return priority === 'P0' || priority === 'P1';
  }
  return true;
}

/**
 * Safe attachment URL validation.
 * Rejects javascript:, data:, vbscript:, and relative malicious vectors.
 */
export function isSafeAttachmentUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Explicitly disallow script/data protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // Relative URLs starting with / (e.g. /attachments/sample.pdf) can be safe if local
    return trimmed.startsWith('/attachments/') || trimmed.startsWith('/samples/');
  }
}

/**
 * Strips HTML tags and normalizes customer-supplied content to prevent XSS / markup injection.
 */
export function sanitizePlainText(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  // Replace HTML tag brackets and control chars
  return text
    .replace(/<[^>]*>?/gm, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Normalizes malformed or partially corrupt ticket records so the UI and server never crash.
 */
export function normalizeTicket(raw: Record<string, unknown> | null | undefined, indexFallback: number = 1): Ticket {
  const record = raw && typeof raw === 'object' ? raw : {};
  const validStatuses: TicketStatus[] = ['open', 'in_progress', 'resolved'];
  const validPriorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];
  const validCategories: TicketCategory[] = [
    'billing',
    'technical',
    'account',
    'feature_request',
    'security',
    'general',
  ];
  const validTiers: CustomerTier[] = ['enterprise', 'business', 'pro', 'free'];

  const rawId = typeof record.id === 'string' ? record.id.trim() : '';
  const id = rawId || `FF-${1000 + indexFallback}`;
  const rawSubject = typeof record.subject === 'string' ? record.subject.trim() : '';
  const subject = rawSubject ? sanitizePlainText(rawSubject) : `Support Ticket #${id}`;
  const description = typeof record.description === 'string' ? sanitizePlainText(record.description) : 'No description provided.';

  const rawCustomer = record.customer && typeof record.customer === 'object' ? (record.customer as Record<string, unknown>) : null;
  const rawTier = rawCustomer?.tier as CustomerTier;
  const tier: CustomerTier = validTiers.includes(rawTier) ? rawTier : 'free';

  const customer = {
    id: typeof rawCustomer?.id === 'string' ? rawCustomer.id : `cust-${indexFallback}`,
    name: typeof rawCustomer?.name === 'string' ? sanitizePlainText(rawCustomer.name) : 'Anonymous Customer',
    email: typeof rawCustomer?.email === 'string' ? sanitizePlainText(rawCustomer.email) : 'customer@example.com',
    tier,
    company: typeof rawCustomer?.company === 'string' ? sanitizePlainText(rawCustomer.company) : undefined,
    avatarUrl: typeof rawCustomer?.avatarUrl === 'string' ? rawCustomer.avatarUrl : undefined,
  };

  const status: TicketStatus = validStatuses.includes(record.status as TicketStatus)
    ? (record.status as TicketStatus)
    : 'open';

  let priority: Priority = validPriorities.includes(record.priority as Priority)
    ? (record.priority as Priority)
    : 'P2';

  // Enforce enterprise priority rule during normalization
  if (tier === 'enterprise' && (priority === 'P2' || priority === 'P3')) {
    priority = 'P1';
  }

  const category: TicketCategory = validCategories.includes(record.category as TicketCategory)
    ? (record.category as TicketCategory)
    : 'general';

  const triageDecision: TriageDecision =
    record.triageDecision === 'manual_review' || record.triage_decision === 'manual_review'
      ? 'manual_review'
      : 'automated';

  const rawCreatedAt = typeof record.createdAt === 'string' ? record.createdAt : '';
  const createdAt = rawCreatedAt && !isNaN(Date.parse(rawCreatedAt))
    ? new Date(rawCreatedAt).toISOString()
    : new Date(Date.now() - 3600000 * 2).toISOString();

  const rawUpdatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : '';
  const updatedAt = rawUpdatedAt && !isNaN(Date.parse(rawUpdatedAt))
    ? new Date(rawUpdatedAt).toISOString()
    : createdAt;

  const slaTargetMinutes = typeof record.slaTargetMinutes === 'number'
    ? record.slaTargetMinutes
    : getSlaTargetMinutes(priority);

  const rawDeadline = typeof record.slaDeadline === 'string' ? record.slaDeadline : '';
  const slaDeadline = rawDeadline && !isNaN(Date.parse(rawDeadline))
    ? new Date(rawDeadline).toISOString()
    : calculateSlaDeadline(createdAt, priority);

  // Normalize attachments and verify URL safety
  const attachments = Array.isArray(record.attachments)
    ? record.attachments.map((att: unknown, attIdx: number) => {
        const item = att && typeof att === 'object' ? (att as Record<string, unknown>) : {};
        const attUrl = typeof item.url === 'string' ? item.url : '#';
        return {
          id: typeof item.id === 'string' ? item.id : `att-${attIdx}`,
          name: typeof item.name === 'string' ? sanitizePlainText(item.name) : `file-${attIdx + 1}.dat`,
          size: typeof item.size === 'string' ? item.size : '1.2 MB',
          url: attUrl,
          isSafe: isSafeAttachmentUrl(attUrl),
        };
      })
    : [];

  const rawAssignee = record.assignee && typeof record.assignee === 'object' ? (record.assignee as Record<string, unknown>) : null;

  return {
    id,
    subject,
    description,
    customer,
    status,
    priority,
    category,
    assignee: rawAssignee
      ? {
          id: typeof rawAssignee.id === 'string' ? rawAssignee.id : 'agent-default',
          name: typeof rawAssignee.name === 'string' ? sanitizePlainText(rawAssignee.name) : 'Support Agent',
          email: typeof rawAssignee.email === 'string' ? rawAssignee.email : 'agent@freeflow.internal',
          role: typeof rawAssignee.role === 'string' ? rawAssignee.role : 'Tier 2 Specialist',
          avatarUrl: typeof rawAssignee.avatarUrl === 'string' ? rawAssignee.avatarUrl : undefined,
        }
      : null,
    triageDecision,
    triageReason: typeof record.triageReason === 'string' ? record.triageReason : (triageDecision === 'manual_review' ? 'Ambiguous sentiment or enterprise threshold reached' : undefined),
    aiSuggestedPriority: validPriorities.includes(record.aiSuggestedPriority as Priority) ? (record.aiSuggestedPriority as Priority) : undefined,
    aiSuggestedCategory: validCategories.includes(record.aiSuggestedCategory as TicketCategory) ? (record.aiSuggestedCategory as TicketCategory) : undefined,
    aiConfidence: typeof record.aiConfidence === 'number' ? Math.min(1, Math.max(0, record.aiConfidence)) : undefined,
    createdAt,
    updatedAt,
    slaTargetMinutes,
    slaDeadline,
    attachments,
    version: typeof record.version === 'number' ? record.version : 1,
  };
}
