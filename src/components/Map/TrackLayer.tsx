'use client';

import { Source, Layer, LayerProps } from 'react-map-gl/mapbox';

// Must match the -l flag used in the tippecanoe conversion
const TRACKS_SOURCE_LAYER = 'tracks';

const trackGlowStyle: LayerProps = {
  id: 'narn-tracks-glow',
  type: 'line',
  'source-layer': TRACKS_SOURCE_LAYER,
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': [
      'match', ['get', 'RROWNER1'],
      'UP', '#FFD700',
      'BNSF', '#EC7014',
      'CSX', '#00529B',
      '#666666',
    ],
    'line-width': 10,
    'line-blur': 6,
    'line-opacity': 0.4,
  },
};

const trackLineStyle: LayerProps = {
  id: 'narn-tracks-line',
  type: 'line',
  'source-layer': TRACKS_SOURCE_LAYER,
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': [
      'match', ['get', 'RROWNER1'],
      'UP', '#FFD700',
      'BNSF', '#EC7014',
      'CSX', '#00529B',
      '#666666',
    ],
    'line-width': 4,
    'line-opacity': 0.8,
  },
};

export const TrackLayer = ({ tilesUrl }: { tilesUrl: string }) => {
  if (!tilesUrl) return null;

  // Use tiles array (XYZ template) rather than a TileJSON url — no protocol handler needed
  return (
    <Source
      id="narn-source"
      type="vector"
      tiles={[tilesUrl]}
      minzoom={4}
      maxzoom={14}
    >
      <Layer {...trackGlowStyle} />
      <Layer {...trackLineStyle} />
    </Source>
  );
};
