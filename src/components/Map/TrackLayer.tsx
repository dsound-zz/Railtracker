'use client';

import { Source, Layer, LayerProps } from 'react-map-gl/mapbox';

// Must match the -l flag used in the tippecanoe conversion
const TRACKS_SOURCE_LAYER = 'tracks';

/**
 * Class I railroads — colour-coded with neon dispatch palette.
 * Anything not in this list (short branches, unknowns) receives
 * Industrial Brown (#8B4513) per the NARN styling spec.
 */
const CLASS_I_COLORS: mapboxgl.ExpressionSpecification = [
  'match', ['get', 'RROWNER1'],
  'UP',   '#FFD700',   // Union Pacific — gold
  'BNSF', '#EC7014',   // BNSF — amber-orange
  'CSX',  '#00529B',   // CSX — corporate blue
  'NS',   '#6B21A8',   // Norfolk Southern — purple
  'CN',   '#DC2626',   // Canadian National — red
  'CP',   '#B91C1C',   // Canadian Pacific — dark red
  'KCS',  '#854d0e',   // Kansas City Southern — brown-gold
  '#8B4513',           // default: Industrial Brown (short branches / unknown)
];

const trackGlowStyle: LayerProps = {
  id: 'narn-tracks-glow',
  type: 'line',
  'source-layer': TRACKS_SOURCE_LAYER,
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': CLASS_I_COLORS,
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
    'line-color': CLASS_I_COLORS,
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
