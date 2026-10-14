import { NextResponse } from 'next/server';

export async function simulateNetworkConditions(
  req: Request,
  options: {
    minLatency?: number;
    maxLatency?: number;
    failureRate?: number;
  } = {}
): Promise<NextResponse | null> {
  const url = new URL(req.url);

  // Allow disabling simulations via query params or test header
  const noDelay = url.searchParams.get('nodelay') === 'true' || req.headers.get('x-no-delay') === 'true';
  const noFail = url.searchParams.get('nofail') === 'true' || req.headers.get('x-no-fail') === 'true';

  const minLatency = options.minLatency ?? 300;
  const maxLatency = options.maxLatency ?? 1500;
  const failureRate = options.failureRate ?? 0.10; // 10% simulated failure rate

  if (!noDelay) {
    const delay = Math.floor(Math.random() * (maxLatency - minLatency + 1)) + minLatency;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (!noFail && Math.random() < failureRate) {
    return NextResponse.json(
      {
        error: 'Simulated network gateway error (500). Please retry.',
        code: 'SIMULATED_TRANSIENT_FAILURE',
      },
      { status: 500 }
    );
  }

  return null;
}
