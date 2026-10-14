import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';
import { simulateNetworkConditions } from '@/src/server/api-helpers';
import { TicketStatus } from '@/src/types/ticket';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const failureResp = await simulateNetworkConditions(req, {
    minLatency: 300,
    maxLatency: 900,
    failureRate: 0.10,
  });
  if (failureResp) return failureResp;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const newStatus = body.status as TicketStatus;

  if (!newStatus || !['open', 'in_progress', 'resolved'].includes(newStatus)) {
    return NextResponse.json(
      { error: "Invalid status value. Must be 'open', 'in_progress', or 'resolved'." },
      { status: 400 }
    );
  }

  const db = getMockDb();
  const result = db.updateTicketStatus(id, newStatus);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, code: 'INVALID_STATUS_TRANSITION' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    ticket: result.ticket,
  });
}
