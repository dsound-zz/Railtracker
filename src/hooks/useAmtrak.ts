import { useState, useEffect } from 'react';

export interface AmtrakTrain {
  routeName: string;
  trainNum: string;
  trainID: string;
  lat: number;
  lon: number;
  trainState: string;
  velocity: number;
  heading: string;
  provider: string;
}

export type FeedStatus = 'live' | 'stale' | 'offline' | 'loading';

export const useAmtrak = () => {
  const [trains, setTrains] = useState<AmtrakTrain[]>([]);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('loading');

  useEffect(() => {
    let isMounted = true;

    const fetchAmtrakData = async () => {
      try {
        const response = await fetch('/api/amtrak');
        const statusHeader = response.headers.get('X-Feed-Status') ?? 'live';

        // Derive feed status from header
        const status: FeedStatus = statusHeader === 'offline'
          ? 'offline'
          : statusHeader.startsWith('stale')
          ? 'stale'
          : 'live';

        const data = await response.json();

        const allTrains: AmtrakTrain[] = [];
        for (const key in data) {
          if (Array.isArray(data[key])) {
            data[key].forEach((train: any) => {
              if (train.lat !== undefined && train.lon !== undefined) {
                allTrains.push(train);
              }
            });
          }
        }

        if (isMounted) {
          // Only replace trains if we actually got some — keeps map populated during blips
          if (allTrains.length > 0) setTrains(allTrains);
          setFeedStatus(status);
        }
      } catch (err) {
        // Network-level failure (fetch itself threw) — keep existing trains, mark offline
        console.warn('[useAmtrak] fetch failed:', err);
        if (isMounted) setFeedStatus('offline');
      }
    };

    fetchAmtrakData();
    const interval = setInterval(fetchAmtrakData, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  return { trains, feedStatus };
};
