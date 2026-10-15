import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';
import { simulateNetworkConditions } from '@/src/server/api-helpers';
import { runFakeTriage } from '@/src/server/triage-ai';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const failureResp = await simulateNetworkConditions(req, {
    minLatency: 400,
    maxLatency: 1200,
    failureRate: 0.10,
  });
  if (failureResp) return failureResp;

  const { id } = await context.params;

  // Secret-key gate. The key is read from the `x-triage-api-key` header, with an
  // `Authorization: Bearer <key>` fallback. We return 401 for BOTH a missing
  // server key (TRIAGE_API_KEY unset) AND a provided key that does not match —
  // the client can never tell which, by design.
  const serverKey = process.env.TRIAGE_API_KEY;
  const headerKey = req.headers.get('x-triage-api-key');
  const authHeader = req.headers.get('authorization');
  const bearerKey = authHeader && authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const providedKey = headerKey ?? bearerKey;

  if (!serverKey || providedKey !== serverKey) {
    return NextResponse.json(
      { error: 'Unauthorized: a valid triage API key is required.', code: 'INVALID_TRIAGE_KEY' },
      { status: 401 }
    );
  }

  const db = getMockDb();
  const ticket = db.getTicketById(id);
  if (!ticket) {
    return NextResponse.json(
      { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
      { status: 404 }
    );
  }

  const ai = runFakeTriage(ticket);
  const result = db.applyRetriage(id, ai);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Retriage failed', code: 'RETRIAGE_FAILED' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, ticket: result.ticket });
}
