import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since');

  const db = getMockDb();

  // Prefer the timestamp contract (?since=<ISO>) when present; otherwise fall
  // back to the cursor contract (?cursor=<int>) for back-compat.
  if (since) {
    const result = db.getUpdatesSinceTimestamp(since);
    return NextResponse.json({
      updatedTickets: result.updatedTickets,
      newCursor: result.newCursor,
      timestamp: result.timestamp,
    });
  }

  const cursor = searchParams.get('cursor') || '0';
  const result = db.getUpdatesSince(cursor);

  return NextResponse.json({
    updatedTickets: result.updatedTickets,
    newCursor: result.newCursor,
    timestamp: new Date().toISOString(),
  });
}
