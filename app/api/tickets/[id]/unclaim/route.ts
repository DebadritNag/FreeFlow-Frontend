import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';
import { simulateNetworkConditions } from '@/src/server/api-helpers';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const failureResp = await simulateNetworkConditions(req, {
    minLatency: 200,
    maxLatency: 600,
    failureRate: 0.05,
  });
  if (failureResp) return failureResp;

  const { id } = await context.params;
  const db = getMockDb();
  const result = db.unclaimTicket(id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to unclaim ticket' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    ticket: result.ticket,
  });
}
