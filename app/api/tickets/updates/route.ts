import { NextRequest, NextResponse } from 'next/server';
import { getMockDb } from '@/src/server/mock-db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor') || '0';

  const db = getMockDb();
  const result = db.getUpdatesSince(cursor);

  return NextResponse.json({
    updatedTickets: result.updatedTickets,
    newCursor: result.newCursor,
    timestamp: new Date().toISOString(),
  });
}
