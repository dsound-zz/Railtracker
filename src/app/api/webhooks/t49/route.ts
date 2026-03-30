import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Terminal49 Webhook Handler
 * 
 * Handles 'container.transport.rail_departed' and 'container.transport.rail_arrived'
 * events to track freight containers across the North American Rail Network.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { event_type, data } = payload;

    if (!data || !data.attributes) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const containerId = data.id;
    const attributes = data.attributes;

    // Task 1: Parse specific Terminal49 payloads
    if (event_type === 'container.transport.rail_departed' || event_type === 'container.transport.rail_arrived') {
      const transport = attributes.transport || {};
      
      // Extract origin and destination terminals if available
      const origin = transport.origin_terminal || {};
      const destination = transport.destination_terminal || {};

      const result = {
        containerId,
        eventType: event_type,
        origin: {
          name: origin.name,
          coordinates: origin.coordinates ? [origin.coordinates.lng, origin.coordinates.lat] : null
        },
        destination: {
          name: destination.name,
          coordinates: destination.coordinates ? [destination.coordinates.lng, destination.coordinates.lat] : null
        },
        startTime: attributes.occurred_at || new Date().toISOString(),
        eta: attributes.estimated_arrival_at || attributes.planned_arrival_at
      };

      console.log(`[T49 Webhook] Processing ${event_type} for container ${containerId}`);
      
      // Note: In a real app, we would save this to a database (Neon).
      // For now, we are returning the parsed and refined data.
      return NextResponse.json({ 
        message: 'Webhook processed successfully',
        data: result
      }, { status: 200 });
    }

    return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
  } catch (error) {
    console.error('[T49 Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
