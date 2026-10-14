import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';
import { simulateNetworkConditions } from '@/src/server/api-helpers';

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

  const db = getMockDb();
  const result = db.updateTicketTriage(id, {
    priority: body.priority,
    category: body.category,
    triageDecision: body.triageDecision,
    triageReason: body.triageReason,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, code: 'INVALID_TRIAGE_ACTION' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    ticket: result.ticket,
  });
}
