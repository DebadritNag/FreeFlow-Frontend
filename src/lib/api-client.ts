import {
  Agent,
  CursorUpdatesResponse,
  PaginatedTicketsResponse,
  Priority,
  Ticket,
  TicketCategory,
  TicketFilterState,
  TicketStatus,
  TriageDecision,
} from '@/src/types/ticket';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function fetchTickets(
  filters: Partial<TicketFilterState> = {}
): Promise<PaginatedTicketsResponse> {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.triageDecision && filters.triageDecision !== 'all') {
    params.set('triageDecision', filters.triageDecision);
  }
  if (filters.assigneeId && filters.assigneeId !== 'all') {
    params.set('assigneeId', filters.assigneeId);
  }
  if (filters.slaStatus && filters.slaStatus !== 'all') {
    params.set('slaStatus', filters.slaStatus);
  }
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const res = await fetch(`/api/tickets?${params.toString()}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(
      errorBody.error || `Failed to fetch tickets (${res.status})`,
      res.status,
      errorBody
    );
  }

  return res.json();
}

export async function fetchTicketById(id: string): Promise<Ticket> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(
      errorBody.error || `Failed to fetch ticket ${id} (${res.status})`,
      res.status,
      errorBody
    );
  }

  return res.json();
}

export async function claimTicketApi(
  id: string,
  agent: Agent,
  options: { force?: boolean; simulateConflict?: boolean } = {}
): Promise<{ success: boolean; ticket?: Ticket; conflictingAgent?: Agent; error?: string }> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent,
      force: options.force,
      simulateConflict: options.simulateConflict,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Claim failed', res.status, data);
  }

  return data;
}

export async function unclaimTicketApi(
  id: string
): Promise<{ success: boolean; ticket?: Ticket; error?: string }> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/unclaim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Unclaim failed', res.status, data);
  }

  return data;
}

export async function updateStatusApi(
  id: string,
  status: TicketStatus
): Promise<{ success: boolean; ticket: Ticket }> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Status update failed', res.status, data);
  }

  return data;
}

export async function updateTriageApi(
  id: string,
  updates: {
    priority?: Priority;
    category?: TicketCategory;
    triageDecision?: TriageDecision;
    triageReason?: string;
  }
): Promise<{ success: boolean; ticket: Ticket }> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/triage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Triage resolution failed', res.status, data);
  }

  return data;
}

export async function pollUpdatesApi(cursor: string): Promise<CursorUpdatesResponse> {
  const res = await fetch(`/api/tickets/updates?cursor=${encodeURIComponent(cursor)}`);
  if (!res.ok) {
    throw new ApiError(`Polling error (${res.status})`, res.status);
  }
  return res.json();
}
