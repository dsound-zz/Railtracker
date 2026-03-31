import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const METRA_POSITIONS_URL = 'https://gtfspublic.metrarr.com/gtfs/public/positions';
const METRA_TRIP_UPDATES_URL = 'https://gtfspublic.metrarr.com/gtfs/public/tripupdates';

export async function GET() {
  const apiKey = process.env.METRA_API_KEY;
  const positionsUrl = apiKey ? `${METRA_POSITIONS_URL}?api_token=${apiKey}` : METRA_POSITIONS_URL;
  const tripUpdatesUrl = apiKey ? `${METRA_TRIP_UPDATES_URL}?api_token=${apiKey}` : METRA_TRIP_UPDATES_URL;

  try {
    const fetchOptions = {
      cache: 'no-store' as RequestCache,
      headers: {
        Accept: 'application/x-protobuf',
        'User-Agent': 'RailTracker/1.0',
      },
      signal: AbortSignal.timeout(10000),
    };

    // Fetch both feeds in parallel
    const [posRes, tripRes] = await Promise.all([
      fetch(positionsUrl, fetchOptions),
      fetch(tripUpdatesUrl, fetchOptions).catch(() => null) // Trip updates are optional for resilience
    ]);

    if (!posRes.ok) {
      console.error(`[metra] Positions upstream error: ${posRes.status}`);
      return NextResponse.json([], { 
        status: 200, 
        headers: { 'X-Feed-Status': 'upstream-error' } 
      });
    }

    const [posBuffer, tripBuffer] = await Promise.all([
      posRes.arrayBuffer(),
      tripRes?.ok ? tripRes.arrayBuffer() : Promise.resolve(null)
    ]);

    const posFeed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(posBuffer));
    const tripFeed = tripBuffer 
      ? GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(tripBuffer))
      : null;

    // Create a map of tripId -> delay for easy lookup
    const delayMap = new Map<string, number>();
    if (tripFeed) {
      tripFeed.entity.forEach(entity => {
        if (entity.tripUpdate && entity.tripUpdate.trip?.tripId) {
          // Typically, we take the delay from the first available stopTimeUpdate
          const firstUpdate = entity.tripUpdate.stopTimeUpdate?.[0];
          const delay = firstUpdate?.arrival?.delay ?? firstUpdate?.departure?.delay ?? 0;
          delayMap.set(entity.tripUpdate.trip.tripId, delay);
        }
      });
    }

    const trains = posFeed.entity
      .filter((entity) => entity.vehicle)
      .map((entity) => {
        const v = entity.vehicle!;
        const tripId = v.trip?.tripId ?? '';
        return {
          id: entity.id,
          lat: v.position?.latitude,
          lon: v.position?.longitude,
          routeId: v.trip?.routeId,
          tripId: tripId,
          bearing: v.position?.bearing,
          speed: v.position?.speed, // m/s (usually missing/0 in Metra feed)
          delay: delayMap.get(tripId) ?? 0, // seconds
          timestamp: v.timestamp
            ? (typeof v.timestamp === 'object' && 'toNumber' in v.timestamp)
              ? (v.timestamp as any).toNumber()
              : Number(v.timestamp)
            : Date.now(),
        };
      });

    return NextResponse.json(trains, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=25, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    console.error('[metra] fetch failed:', err);
    return NextResponse.json([], { 
      status: 200, 
      headers: { 'X-Feed-Status': 'timeout-or-crash' } 
    });
  }
}
