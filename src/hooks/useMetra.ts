import { useState, useEffect, useRef } from 'react';
import * as turf from '@turf/turf';

export interface MetraTrain {
  id: string;
  lat: number;
  lon: number;
  routeId: string;
  tripId: string;
  bearing?: number;
  speed?: number;
  delay?: number;
  timestamp: number;
}

export type FeedStatus = 'live' | 'offline' | 'loading';

export const useMetra = () => {
  const [trains, setTrains] = useState<MetraTrain[]>([]);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('loading');
  const prevTrainsRef = useRef<Map<string, { lat: number; lon: number; timestamp: number }>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const fetchMetraData = async () => {
      try {
        const response = await fetch('/api/metra');
        if (!response.ok) {
          throw new Error(`Metra feed unavailable (${response.status})`);
        }
        const feedStatusHeader = response.headers.get('X-Feed-Status');
        const data = await response.json();

        if (isMounted) {
          if (Array.isArray(data)) {
            const newTrains: MetraTrain[] = data.filter(t => t.lat && t.lon).map(newTrain => {
              const prev = prevTrainsRef.current.get(newTrain.id);
              let speed = 0;

              if (prev && newTrain.timestamp > prev.timestamp) {
                const distKm = turf.distance(
                  [prev.lon, prev.lat],
                  [newTrain.lon, newTrain.lat],
                  { units: 'kilometers' }
                );
                
                const dtSeconds = (newTrain.timestamp - prev.timestamp);
                if (dtSeconds > 0) {
                  const mps = (distKm * 1000) / dtSeconds;
                  // Sanity check: max 40 m/s (~90 mph) to filter out GPS jumps
                  speed = mps < 40 ? mps : 0;
                }
              }

              // Update ref
              prevTrainsRef.current.set(newTrain.id, {
                lat: newTrain.lat,
                lon: newTrain.lon,
                timestamp: newTrain.timestamp
              });

              return { ...newTrain, speed };
            });

            setTrains(newTrains);
          }
          
          if (feedStatusHeader && feedStatusHeader !== 'live') {
            setFeedStatus('offline');
          } else {
            setFeedStatus('live');
          }
        }
      } catch (err) {
        console.warn('[useMetra] fetch failed:', err);
        if (isMounted) setFeedStatus('offline');
      }
    };

    fetchMetraData();
    const interval = setInterval(fetchMetraData, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  return { trains, feedStatus };
};
