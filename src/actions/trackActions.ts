'use server';

import { promises as fs } from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import type { FeatureCollection } from 'geojson';

// Cache the huge GeoJSON in memory on the server so we aren't re-parsing 150MB every pan/zoom
let narnCache: FeatureCollection | null = null;

// The current mock dataset, which will later be replaced by the 150MB file
const NARN_DATA_PATH = path.join(process.cwd(), 'public', 'data', 'NTAD_North_American_Rail_Network_Lines_-2809319059146035817.geojson');

/**
 * Server Action to fetch and filter the NARN dataset strictly to the user's viewport bounding box.
 * 
 * @param bbox - [minLng, minLat, maxLng, maxLat]
 * @returns Filtered FeatureCollection
 */
export async function fetchTracksInBounds(bbox: [number, number, number, number]): Promise<FeatureCollection> {
  try {
    if (!narnCache) {
      const fileData = await fs.readFile(NARN_DATA_PATH, 'utf-8');
      narnCache = JSON.parse(fileData) as FeatureCollection;
    }

    const [minLng, minLat, maxLng, maxLat] = bbox;
    const searchPolygon = turf.bboxPolygon([minLng, minLat, maxLng, maxLat]);

    // Filter features that intersect with the bounding box.
    // We use a lightweight bbox collision check for performance before doing full intersections
    const filteredFeatures = narnCache.features.filter(feature => {
      // Get the bounding box of the feature itself
      const fBbox = turf.bbox(feature);
      
      // Simple AABB (Axis-Aligned Bounding Box) collision detection
      const intersects = !(
        fBbox[0] > maxLng || 
        fBbox[2] < minLng || 
        fBbox[1] > maxLat || 
        fBbox[3] < minLat
      );
      
      return intersects;
    });

    return {
      type: 'FeatureCollection',
      features: filteredFeatures
    };

  } catch (error) {
    console.error('Error fetching tracks on server:', error);
    // Return empty collection if file fails
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
}
