import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';
import { simulateNetworkConditions } from '@/src/server/api-helpers';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const failureResp = await simulateNetworkConditions(req, {
    minLatency: 350,
    maxLatency: 1100,
    failureRate: 0.10, // ~10% network/server failure
  });
  if (failureResp) return failureResp;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const claimingAgent = body.agent;
  const force = Boolean(body.force);
  const simulateConflict = Boolean(body.simulateConflict);

  if (!claimingAgent || !claimingAgent.id) {
    return NextResponse.json({ error: 'Valid agent payload is required to claim a ticket.' }, { status: 400 });
  }

  const db = getMockDb();
  // When simulateConflict is explicitly requested, guarantee a 409 collision; otherwise 0 so normal claims succeed cleanly
  const conflictRate = simulateConflict ? 1.0 : (body.simulateConflictRate ?? 0);
  const result = db.claimTicket(id, claimingAgent, conflictRate, force);

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error || 'Ticket could not be claimed.',
        conflictingAgent: result.conflictAgent,
        code: 'CLAIM_CONFLICT',
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    ticket: result.ticket,
  });
}
