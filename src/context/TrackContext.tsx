'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { FeatureCollection } from 'geojson';
import { fetchTracksInBounds } from '@/actions/trackActions';

interface TrackContextType {
  narnData: FeatureCollection | null;
  loading: boolean;
  error: Error | null;
  updateBounds: (bbox: [number, number, number, number]) => void;
}

const TrackContext = createContext<TrackContextType | undefined>(undefined);

export const TrackProvider = ({ children }: { children: ReactNode }) => {
  const [narnData, setNarnData] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const updateBounds = useCallback(async (bbox: [number, number, number, number]) => {
    try {
      setLoading(true);
      // Calls the internal Server Action instead of downloading massive JSON
      const filteredData = await fetchTracksInBounds(bbox);
      setNarnData(filteredData);
      setError(null);
    } catch (err: any) {
      console.error('Failed to sync NARN block logic:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <TrackContext.Provider value={{ narnData, loading, error, updateBounds }}>
      {children}
    </TrackContext.Provider>
  );
};

export const useTrackContext = () => {
  const context = useContext(TrackContext);
  if (context === undefined) {
    throw new Error('useTrackContext must be used within a TrackProvider');
  }
  return context;
};
