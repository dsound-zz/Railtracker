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

export const useAmtrak = () => {
  const [trains, setTrains] = useState<AmtrakTrain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAmtrakData = async () => {
      try {
        const response = await fetch('https://api.amtraker.com/v3/trains');
        if (!response.ok) {
          throw new Error(`Amtrak API error: ${response.statusText}`);
        }
        const data = await response.json();
        
        // The Amtraker v3 API returns an object where keys are train numbers (or IDs)
        // and values are arrays of train objects. We need to flatten this.
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
          setTrains(allTrains);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to fetch Amtrak data:', err);
          setError(err);
          setLoading(false);
        }
      }
    };

    fetchAmtrakData();
    
    // Fetch every 30 seconds
    const interval = setInterval(fetchAmtrakData, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { trains, loading, error };
};
