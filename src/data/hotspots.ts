/**
 * Chicago-area major rail node hotspots.
 *
 * Each entry drives three behaviours:
 *   1. A rendered marker on the map (cyan ◆ diamond).
 *   2. MediaDrawer Broadcastify scanner feed (Action Card).
 *   3. MediaDrawer YouTube Virtual Railfan live stream (Action Card).
 */

export interface Hotspot {
  /** Display name shown in the sidebar and drawer header */
  name: string;
  /** [latitude, longitude] — WGS-84 */
  coordinates: [number, number];
  /** Verified Broadcastify web player URL */
  broadcastifyPlayerUrl: string;
  /**
   * YouTube video ID for a Virtual Railfan live stream.
   * Falls back to null if no nearby camera exists.
   */
  youtubeVideoId: string | null;
  /** Primary railroad operator at this node */
  operator: 'BNSF' | 'UP' | 'NS' | 'CSX' | 'Metra' | 'CPKC' | 'Mixed';
}

export const HOTSPOTS: Map<string, Hotspot> = new Map([
  [
    'BNSF Corwith Yard',
    {
      name: 'BNSF Corwith Yard',
      coordinates: [41.815, -87.724],
      broadcastifyPlayerUrl: 'https://www.broadcastify.com/webPlayer/46024',
      // Virtual Railfan — Rochelle IL (nearby major junction)
      youtubeVideoId: 'LhNpn9L5ndM',
      operator: 'BNSF',
    },
  ],
  [
    'UP Global IV',
    {
      name: 'UP Global IV',
      coordinates: [41.442, -88.113],
      broadcastifyPlayerUrl: 'https://www.broadcastify.com/webPlayer/38825',
      youtubeVideoId: null,
      operator: 'UP',
    },
  ],
  [
    'Blue Island Junction',
    {
      name: 'Blue Island Junction',
      coordinates: [41.657, -87.683],
      broadcastifyPlayerUrl: 'https://www.broadcastify.com/webPlayer/30297',
      // Virtual Railfan — Blue Island
      youtubeVideoId: 'GKjSoXuZ0hU',
      operator: 'Mixed',
    },
  ],
  [
    'Elmhurst (UP West)',
    {
      name: 'Elmhurst (UP West)',
      coordinates: [41.899, -87.940],
      broadcastifyPlayerUrl: 'https://www.broadcastify.com/webPlayer/38825',
      // Virtual Railfan — Lombard (next station)
      youtubeVideoId: 'maNelsYKzjk',
      operator: 'UP',
    },
  ],
  [
    'La Grange (BNSF)',
    {
      name: 'La Grange (BNSF)',
      coordinates: [41.816, -87.869],
      broadcastifyPlayerUrl: 'https://www.broadcastify.com/webPlayer/46024',
      youtubeVideoId: null,
      operator: 'BNSF',
    },
  ],
  [
    'CPKC Elgin',
    {
      name: 'CPKC Elgin',
      coordinates: [41.986, -88.188],
      broadcastifyPlayerUrl: 'https://www.broadcastify.com/webPlayer/41871',
      youtubeVideoId: null,
      operator: 'CPKC',
    },
  ],
  [
    'NS Elkhart / South Bend',
    {
      name: 'NS Elkhart / South Bend',
      coordinates: [41.681, -85.976],
      broadcastifyPlayerUrl: 'https://www.broadcastify.com/webPlayer/36573',
      youtubeVideoId: null,
      operator: 'NS',
    },
  ],
]);

/**
 * Returns the closest hotspot to a given [lat, lng] coordinate pair.
 * Uses simple Euclidean distance.
 */
export function getNearestHotspot(lat: number, lng: number): Hotspot {
  let nearest: Hotspot | null = null;
  let minDist = Infinity;

  for (const hotspot of HOTSPOTS.values()) {
    const dlat = hotspot.coordinates[0] - lat;
    const dlng = hotspot.coordinates[1] - lng;
    const dist = Math.sqrt(dlat * dlat + dlng * dlng);
    if (dist < minDist) {
      minDist = dist;
      nearest = hotspot;
    }
  }

  return nearest!;
}

/**
 * GeoJSON FeatureCollection built from HOTSPOTS.
 */
export const hotspotsGeoJSON = {
  type: 'FeatureCollection' as const,
  features: Array.from(HOTSPOTS.entries()).map(([key, h]) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [h.coordinates[1], h.coordinates[0]], // GeoJSON is [lng, lat]
    },
    properties: {
      key,
      name: h.name,
      operator: h.operator,
      broadcastifyPlayerUrl: h.broadcastifyPlayerUrl,
      youtubeVideoId: h.youtubeVideoId,
    },
  })),
};
