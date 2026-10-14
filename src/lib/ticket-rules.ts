import { CustomerTier, Priority, Ticket, TicketAnomaly, TicketCategory, TicketStatus, TriageDecision } from '@/src/types/ticket';
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
 * Deterministic epoch fallback used when a date value cannot be parsed.
 * We never invent a "2h ago" value for flagged records — instead we fall back
 * to this fixed timestamp and flag it so the anomaly is visible (DECISION D1).
 */
const DATE_EPOCH_FALLBACK = '1970-01-01T00:00:00.000Z';

/**
 * Parses the three date shapes present in the source data without producing NaN:
 *  - ISO (incl. a `+05:30` offset, which Date parses natively)
 *  - non-ISO `'2026-09-20 11:30:00'` (space between date and time -> retry with 'T')
 *  - far-future years (e.g. 2027) are perfectly valid
 * If the value still cannot be parsed, returns a deterministic epoch fallback
 * with `flagged: true` so the caller can record an anomaly.
 */
export function parseFlexibleDate(raw: unknown): { iso: string; flagged: boolean } {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { iso: DATE_EPOCH_FALLBACK, flagged: true };
  }

  const value = raw.trim();

  const parsed = Date.parse(value);
  if (!isNaN(parsed)) {
    return { iso: new Date(parsed).toISOString(), flagged: false };
  }

  // Non-ISO 'YYYY-MM-DD HH:MM:SS' -> replace the space with 'T' and retry.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    const retried = Date.parse(value.replace(' ', 'T'));
    if (!isNaN(retried)) {
      return { iso: new Date(retried).toISOString(), flagged: false };
    }
  }

  return { iso: DATE_EPOCH_FALLBACK, flagged: true };
}

/**
 * Collapses tickets sharing the same `externalId` to a single entry, keeping the
 * FIRST occurrence (two identical external ids become one).
 */
export function dedupeByExternalId(tickets: Ticket[]): Ticket[] {
  const seen = new Set<string>();
  const result: Ticket[] = [];
  for (const ticket of tickets) {
    const key = ticket.externalId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ticket);
  }
  return result;
}

/**
 * Normalizes malformed or partially corrupt ticket records so the UI and server never crash.
 *
 * Invalid/unknown enum values are coerced to a safe fallback for math/sorting but the
 * original raw string is preserved in the matching `raw*` field and recorded in
 * `anomalies` so the UI can flag it (DECISION D1 — safe-fallback, NOT union widening).
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
  const validTriageDecisions: TriageDecision[] = ['automated', 'manual_review'];

  const anomalies: TicketAnomaly[] = [];

  const rawId = typeof record.id === 'string' ? record.id.trim() : '';
  const id = rawId || `FF-${1000 + indexFallback}`;

  const externalIdRaw =
    (typeof record.external_id === 'string' && record.external_id.trim()) ||
    (typeof record.externalId === 'string' && record.externalId.trim()) ||
    '';
  const externalId = externalIdRaw || id;

  const rawSubject = typeof record.subject === 'string' ? record.subject.trim() : '';
  const subject = rawSubject ? sanitizePlainText(rawSubject) : `Support Ticket #${id}`;
  const description = typeof record.description === 'string' ? sanitizePlainText(record.description) : 'No description provided.';

  const summaryRaw = record.summary;
  const summary = summaryRaw !== undefined && summaryRaw !== null && String(summaryRaw).trim() !== ''
    ? sanitizePlainText(String(summaryRaw))
    : null;

  const rawCustomer = record.customer && typeof record.customer === 'object' ? (record.customer as Record<string, unknown>) : null;
  const rawTierValue = rawCustomer?.tier;
  const rawTierStr = typeof rawTierValue === 'string' ? rawTierValue : '';
  const tier: CustomerTier = validTiers.includes(rawTierValue as CustomerTier) ? (rawTierValue as CustomerTier) : 'free';
  let rawTier: string | undefined;
  if (rawTierStr && !validTiers.includes(rawTierStr as CustomerTier)) {
    rawTier = rawTierStr;
    anomalies.push({ field: 'tier', rawValue: rawTierStr, message: `Unknown customer tier '${rawTierStr}' — coerced to '${tier}'.` });
  }

  const customer = {
    id: typeof rawCustomer?.id === 'string' ? rawCustomer.id : `cust-${indexFallback}`,
    name: typeof rawCustomer?.name === 'string' ? sanitizePlainText(rawCustomer.name) : 'Anonymous Customer',
    email: typeof rawCustomer?.email === 'string' ? sanitizePlainText(rawCustomer.email) : 'customer@example.com',
    tier,
    company: typeof rawCustomer?.company === 'string' ? sanitizePlainText(rawCustomer.company) : undefined,
    avatarUrl: typeof rawCustomer?.avatarUrl === 'string' ? rawCustomer.avatarUrl : undefined,
  };

  const rawStatusStr = typeof record.status === 'string' ? record.status : '';
  const status: TicketStatus = validStatuses.includes(record.status as TicketStatus)
    ? (record.status as TicketStatus)
    : 'open';
  let rawStatus: string | undefined;
  if (rawStatusStr && !validStatuses.includes(rawStatusStr as TicketStatus)) {
    rawStatus = rawStatusStr;
    anomalies.push({ field: 'status', rawValue: rawStatusStr, message: `Unknown status '${rawStatusStr}' — coerced to '${status}'.` });
  }

  const rawPriorityStr = typeof record.priority === 'string' ? record.priority : '';
  let priority: Priority = validPriorities.includes(record.priority as Priority)
    ? (record.priority as Priority)
    : 'P2';
  let rawPriority: string | undefined;
  if (rawPriorityStr && !validPriorities.includes(rawPriorityStr as Priority)) {
    rawPriority = rawPriorityStr;
    anomalies.push({ field: 'priority', rawValue: rawPriorityStr, message: `Invalid priority '${rawPriorityStr}' — coerced to '${priority}'.` });
  }

  // Enforce enterprise priority rule during normalization
  if (tier === 'enterprise' && (priority === 'P2' || priority === 'P3')) {
    priority = 'P1';
  }

  const rawCategoryStr = typeof record.category === 'string' ? record.category : '';
  const category: TicketCategory = validCategories.includes(record.category as TicketCategory)
    ? (record.category as TicketCategory)
    : 'general';
  let rawCategory: string | undefined;
  if (rawCategoryStr && !validCategories.includes(rawCategoryStr as TicketCategory)) {
    rawCategory = rawCategoryStr;
    anomalies.push({ field: 'category', rawValue: rawCategoryStr, message: `Unknown category '${rawCategoryStr}' — coerced to '${category}'.` });
  }

  const triageRawValue = record.triageDecision ?? record.triage_decision;
  const triageRawStr = typeof triageRawValue === 'string' ? triageRawValue : '';
  const triageDecision: TriageDecision = triageRawStr === 'manual_review'
    ? 'manual_review'
    : 'automated';
  let rawTriageDecision: string | undefined;
  if (triageRawStr && !validTriageDecisions.includes(triageRawStr as TriageDecision)) {
    rawTriageDecision = triageRawStr;
    anomalies.push({ field: 'triageDecision', rawValue: triageRawStr, message: `Unknown triage decision '${triageRawStr}' — coerced to '${triageDecision}'.` });
  }

  const createdResult = parseFlexibleDate(record.createdAt ?? record.created_at);
  const createdAt = createdResult.iso;
  if (createdResult.flagged) {
    const rawCreatedStr = String(record.createdAt ?? record.created_at ?? '');
    anomalies.push({ field: 'createdAt', rawValue: rawCreatedStr, message: `Unparseable createdAt '${rawCreatedStr}' — using epoch fallback.` });
  }

  const updatedResult = parseFlexibleDate(record.updatedAt ?? record.updated_at);
  const updatedAt = updatedResult.flagged ? createdAt : updatedResult.iso;

  const slaTargetMinutes = typeof record.slaTargetMinutes === 'number'
    ? record.slaTargetMinutes
    : getSlaTargetMinutes(priority);

  const rawDeadline = typeof record.slaDeadline === 'string' ? record.slaDeadline : '';
  const slaDeadline = rawDeadline && !isNaN(Date.parse(rawDeadline))
    ? new Date(rawDeadline).toISOString()
    : calculateSlaDeadline(createdAt, priority);

  // Normalize attachments and verify URL safety. Support single `attachment_url`
  // snake_case input (assignment records) in addition to an attachments array.
  let attachments = Array.isArray(record.attachments)
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

  const singleAttachmentUrl = typeof record.attachment_url === 'string' ? record.attachment_url : (typeof record.attachmentUrl === 'string' ? record.attachmentUrl : '');
  if (singleAttachmentUrl && attachments.length === 0) {
    attachments = [
      {
        id: `att-${id}-1`,
        name: sanitizePlainText(singleAttachmentUrl.split('/').pop() || 'attachment'),
        size: '1.0 MB',
        url: singleAttachmentUrl,
        isSafe: isSafeAttachmentUrl(singleAttachmentUrl),
      },
    ];
  }

  const rawAssignee = record.assignee && typeof record.assignee === 'object' ? (record.assignee as Record<string, unknown>) : null;

  const aiPriorityValue = record.aiPriority ?? record.ai_priority;
  const aiPriority: Priority | null = validPriorities.includes(aiPriorityValue as Priority) ? (aiPriorityValue as Priority) : null;

  const reviewReasonValue = record.reviewReason ?? record.review_reason;
  const reviewReason = reviewReasonValue !== undefined && reviewReasonValue !== null && String(reviewReasonValue).trim() !== ''
    ? sanitizePlainText(String(reviewReasonValue))
    : null;

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
    externalId,
    summary,
    aiPriority,
    reviewReason,
    rawPriority,
    rawStatus,
    rawCategory,
    rawTier,
    rawTriageDecision,
    anomalies,
  };
}
