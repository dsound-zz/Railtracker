import { NextResponse } from 'next/server';

const UPSTREAM_URLS = [
  'https://api.amtraker.com/v3/trains',
  'https://api-v3.amtraker.com/v3/trains',
];

let staleCache: { data: unknown; fetchedAt: number } | null = null;

async function fetchWithFallback(): Promise<unknown | null> {
  for (const url of UPSTREAM_URLS) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json', 'User-Agent': 'RailTracker/1.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return await res.json();
      console.warn(`[amtrak] ${url} → ${res.status}`);
    } catch (err) {
      console.warn(`[amtrak] ${url} threw:`, (err as Error).message);
    }
  }
  return null;
}

export async function GET() {
  const fresh = await fetchWithFallback();

  if (fresh !== null) {
    staleCache = { data: fresh, fetchedAt: Date.now() };
    return NextResponse.json(fresh, {
      status: 200,
      headers: {
        'X-Feed-Status': 'live',
        'Cache-Control': 'public, s-maxage=25, stale-while-revalidate=30',
      },
    });
  }

  // Upstream is down — serve stale cache if we have it
  if (staleCache) {
    const age = Math.round((Date.now() - staleCache.fetchedAt) / 1000);
    console.warn(`[amtrak] upstream down, serving stale data (${age}s old)`);
    return NextResponse.json(staleCache.data, {
      status: 200,
      headers: {
        'X-Feed-Status': `stale:${age}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // No cache at all (cold start + upstream down) — return empty payload, never 502
  console.warn('[amtrak] upstream down, no cache — returning empty feed');
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'X-Feed-Status': 'offline',
        'Cache-Control': 'no-store',
      },
    }
  );
}
