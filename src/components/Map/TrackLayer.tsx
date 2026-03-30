import React, { useMemo } from 'react';
import { Source, Layer, LayerProps } from 'react-map-gl/mapbox';
import { useTrackContext } from '@/context/TrackContext';

export const TrackLayer = () => {
  const { narnData, loading } = useTrackContext();

  // If we don't have data yet, don't render the source
  if (loading || !narnData) {
    return null;
  }

  // Neon glowing styles for Class I railroads in "Dispatch Mode"
  // UP: #FFD700 (Gold/Yellow Neon)
  // BNSF: #EC7014 (Orange Neon)
  // CSX: #00529B (Blue Neon)
  // Default: #666666
  
  const trackLineStyle: LayerProps = {
    id: 'narn-tracks-line',
    type: 'line',
    source: 'narn-source',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': [
        'match',
        ['get', 'RROWNER1'],
        'UP', '#FFD700',
        'BNSF', '#EC7014',
        'CSX', '#00529B',
        '#666666' // Fallback for other railroads
      ],
      'line-width': 4,
      // Add neon glow effect with opacity
      'line-opacity': 0.8
    }
  };

  // Optional: A broader, slightly blurred underlying line to act as a "glow"
  const trackGlowStyle: LayerProps = {
    id: 'narn-tracks-glow',
    type: 'line',
    source: 'narn-source',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': [
        'match',
        ['get', 'RROWNER1'],
        'UP', '#FFD700',
        'BNSF', '#EC7014',
        'CSX', '#00529B',
        '#666666'
      ],
      'line-width': 10,
      'line-blur': 6,
      'line-opacity': 0.4
    }
  };

  return (
    <Source id="narn-source" type="geojson" data={narnData}>
      {/* Render the glow layer first so it is underneath */}
      <Layer {...trackGlowStyle} />
      {/* Render the solid core line on top */}
      <Layer {...trackLineStyle} />
    </Source>
  );
};
