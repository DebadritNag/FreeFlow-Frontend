import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';
import { simulateNetworkConditions } from '@/src/server/api-helpers';
import { Priority, SlaStatus, TicketCategory, TicketFilterState, TicketStatus, TriageDecision } from '@/src/types/ticket';

export async function GET(req: NextRequest) {
  const failureResp = await simulateNetworkConditions(req, {
    minLatency: 300,
    maxLatency: 1200,
    failureRate: 0.10, // ~10% simulated failure
  });
  if (failureResp) return failureResp;

  const { searchParams } = new URL(req.url);

  const filters: Partial<TicketFilterState> = {
    search: searchParams.get('search') || undefined,
    status: (searchParams.get('status') as TicketStatus | 'all') || 'all',
    priority: (searchParams.get('priority') as Priority | 'all') || 'all',
    category: (searchParams.get('category') as TicketCategory | 'all') || 'all',
    triageDecision: (searchParams.get('triageDecision') as TriageDecision | 'all') || 'all',
    assigneeId: searchParams.get('assigneeId') || 'all',
    slaStatus: (searchParams.get('slaStatus') as SlaStatus | 'all') || 'all',
    sortBy: (searchParams.get('sortBy') as TicketFilterState['sortBy']) || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as TicketFilterState['sortOrder']) || 'desc',
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '25', 10),
  };

  const db = getMockDb();
  const response = db.getTickets(filters);

  return NextResponse.json(response);
}
