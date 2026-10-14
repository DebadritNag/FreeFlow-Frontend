import { NextResponse } from 'next/server';
import { DEFAULT_AGENTS } from '@/src/store/ticketsSlice';

export async function GET() {
  return NextResponse.json(DEFAULT_AGENTS);
}
