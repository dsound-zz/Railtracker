import * as turf from '@turf/turf';
import type { FeatureCollection, Position } from 'geojson';

export interface SnappedTrack {
  coordinates: Position;
  properties: Record<string, any>;
  distance: number;
}

const THRESHOLD_MILES = 0.031; // ~50 meters

/**
 * Snaps a user GPS coordinate to the nearest segment of the provided NARN GeoJSON.
 *
 * @param gpsCoordinate - [longitude, latitude] representing the raw GPS location
 * @param narnData - FeatureCollection containing the NARN lines
 * @param previousFeatureIndex - Optional index of the line the train was previously snapped to
 * @returns {SnappedTrack} - Object containing snapped coordinates, properties (like OWNER), distance, and line index
 */
export const snapToTrack = (
  gpsCoordinate: Position,
  narnData: FeatureCollection | null,
  previousCoordinates?: [number, number]
): SnappedTrack | null => {
  if (!narnData || narnData.features.length === 0) {
    return null;
  }

  try {
    const rawPoint = turf.point(gpsCoordinate);

    // Anti-jitter: if GPS hasn't moved beyond threshold from the last snapped position,
    // lock to the previous snapped coordinates (stable across narnData replacements).
    if (previousCoordinates) {
      const distanceToPrev = turf.distance(rawPoint, turf.point(previousCoordinates), { units: 'miles' });
      if (distanceToPrev <= THRESHOLD_MILES) {
        return {
          coordinates: previousCoordinates,
          properties: {},
          distance: distanceToPrev,
        };
      }
    }

    let minDistance = Infinity;
    let closestFeatureIndex = -1;
    let snappedCoords: Position | null = null;

    // Search all features if no previous lock was found or if we drifted far from it
    narnData.features.forEach((feature, index) => {
      if (feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
        // @ts-ignore
        const pointOnLine = turf.nearestPointOnLine(feature, rawPoint, { units: 'miles' });
        const distance = pointOnLine.properties.dist;
        
        if (distance !== undefined && distance < minDistance) {
          minDistance = distance;
          closestFeatureIndex = index;
          snappedCoords = pointOnLine.geometry.coordinates;
        }
      }
    });

    if (snappedCoords && closestFeatureIndex !== -1) {
      return {
        coordinates: snappedCoords,
        properties: narnData.features[closestFeatureIndex].properties || {},
        distance: minDistance,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to calculate track snap:', error);
    return null;
  }
};

/**
 * Interpolates the position of a 'Ghost Train' based on current time
 * relative to the start time and ETA.
 * 
 * @param startTime - UTC string or timestamp when departure happened
 * @param eta - UTC string or timestamp of estimated arrival
 * @param pathGeoJSON - LineString of the path taken
 * @returns {Position | null} - Current [lng, lat] snapped to the path
 */
export const interpolateFreightPosition = (
  startTime: string | number,
  eta: string | number,
  pathGeoJSON: any
): Position | null => {
  if (!pathGeoJSON || !pathGeoJSON.coordinates || pathGeoJSON.coordinates.length < 2) {
    return null;
  }

  const start = new Date(startTime).getTime();
  const end = new Date(eta).getTime();
  const now = Date.now();

  if (now <= start) return pathGeoJSON.coordinates[0];
  if (now >= end) return pathGeoJSON.coordinates[pathGeoJSON.coordinates.length - 1];

  const totalDuration = end - start;
  const elapsed = now - start;
  const fraction = elapsed / totalDuration;

  try {
    const totalDistance = turf.length(pathGeoJSON, { units: 'miles' });
    const alongDistance = totalDistance * fraction;
    
    const point = turf.along(pathGeoJSON, alongDistance, { units: 'miles' });
    return point.geometry.coordinates;
  } catch (error) {
    console.error('Failed to interpolate freight position:', error);
    return null;
  }
};

/**
 * Finds all nodes in the rail network that act as major junctions
 * (where 3 or more rail lines meet).
 * 
 * @param narnData - FeatureCollection of rail lines
 * @returns {Set<string>} - Set of "lng,lat" strings representing junctions
 */
export const findJunctions = (narnData: FeatureCollection | null): Set<string> => {
  if (!narnData) return new Set();

  const nodeCountMap = new Map<string, number>();

  narnData.features.forEach(feature => {
    if (feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
      const coords = feature.geometry.type === 'LineString' 
        ? feature.geometry.coordinates 
        : (feature.geometry.coordinates[0] as Position[]); // Simple MultiLineString handle

      // We only care about start/end nodes for basic topology
      const start = coords[0].join(',');
      const end = coords[coords.length - 1].join(',');

      nodeCountMap.set(start, (nodeCountMap.get(start) || 0) + 1);
      nodeCountMap.set(end, (nodeCountMap.get(end) || 0) + 1);
    }
  });

  const junctions = new Set<string>();
  for (const [coordStr, count] of nodeCountMap.entries()) {
    if (count >= 3) {
      junctions.add(coordStr);
    }
  }

  return junctions;
};

