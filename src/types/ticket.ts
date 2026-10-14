export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type CustomerTier = 'enterprise' | 'business' | 'pro' | 'free';
export type TicketCategory =
  | 'billing'
  | 'technical'
  | 'account'
  | 'feature_request'
  | 'security'
  | 'general';
export type TriageDecision = 'automated' | 'manual_review';

export type SlaStatus = 'on_track' | 'at_risk' | 'late';

export interface Customer {
  id: string;
  name: string;
  email: string;
  tier: CustomerTier;
  company?: string;
  avatarUrl?: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  activeTicketsCount?: number;
}

export interface TicketAttachment {
  id: string;
  name: string;
  size: string;
  url: string;
  isSafe: boolean;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  customer: Customer;
  status: TicketStatus;
  priority: Priority;
  category: TicketCategory;
  assignee: Agent | null;
  triageDecision: TriageDecision;
  triageReason?: string;
  aiSuggestedPriority?: Priority;
  aiSuggestedCategory?: TicketCategory;
  aiConfidence?: number;
  createdAt: string;
  updatedAt: string;
  slaTargetMinutes: number;
  slaDeadline: string;
  attachments?: TicketAttachment[];
  version: number;
}

export interface TicketMetrics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  slaRiskTickets: number; // at_risk + late
  slaLateTickets: number;
  manualReviewTickets: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
}

export interface TicketFilterState {
  search: string;
  status: TicketStatus | 'all';
  priority: Priority | 'all';
  category: TicketCategory | 'all';
  triageDecision: TriageDecision | 'all';
  assigneeId: string | 'all';
  slaStatus: SlaStatus | 'all';
  sortBy: 'createdAt' | 'priority' | 'slaDeadline' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface PaginatedTicketsResponse {
  tickets: Ticket[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  metrics: TicketMetrics;
  cursor: string;
}

export interface TicketUpdatePayload {
  status?: TicketStatus;
  priority?: Priority;
  category?: TicketCategory;
  triageDecision?: TriageDecision;
  triageReason?: string;
  assigneeId?: string | null;
}

export interface TicketClaimResponse {
  success: boolean;
  ticket?: Ticket;
  error?: string;
  conflictingAgent?: Agent;
}

export interface CursorUpdatesResponse {
  updatedTickets: Ticket[];
  newCursor: string;
  timestamp: string;
}
