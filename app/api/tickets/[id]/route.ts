import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';
import { simulateNetworkConditions } from '@/src/server/api-helpers';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const failureResp = await simulateNetworkConditions(req, {
    minLatency: 200,
    maxLatency: 800,
    failureRate: 0.05,
  });
  if (failureResp) return failureResp;

  const { id } = await context.params;
  const db = getMockDb();
  const ticket = db.getTicketById(id);

  if (!ticket) {
    return NextResponse.json({ error: `Ticket #${id} not found` }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
