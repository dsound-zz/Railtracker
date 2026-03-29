import * as turf from '@turf/turf';
import type { FeatureCollection, Position } from 'geojson';

export interface SnappedTrack {
  coordinates: Position;
  properties: Record<string, any>;
  distance: number;
  featureIndex: number; // Important for jitter threshold
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
  previousFeatureIndex?: number
): SnappedTrack | null => {
  if (!narnData || narnData.features.length === 0) {
    return null;
  }

  try {
    const rawPoint = turf.point(gpsCoordinate);
    
    // If we have a previously snapped track, check if the raw point is still within 50m of it.
    if (previousFeatureIndex !== undefined && previousFeatureIndex >= 0 && previousFeatureIndex < narnData.features.length) {
      const prevFeature = narnData.features[previousFeatureIndex];
      if (prevFeature.geometry && (prevFeature.geometry.type === 'LineString' || prevFeature.geometry.type === 'MultiLineString')) {
        // @ts-ignore
        const pointOnPrevLine = turf.nearestPointOnLine(prevFeature, rawPoint, { units: 'miles' });
        const distanceToPrev = pointOnPrevLine.properties.dist;
        
        // Anti-jitter: Lock to previous feature if within 50 meters
        if (distanceToPrev !== undefined && distanceToPrev <= THRESHOLD_MILES) {
          return {
            coordinates: pointOnPrevLine.geometry.coordinates,
            properties: prevFeature.properties || {},
            distance: distanceToPrev,
            featureIndex: previousFeatureIndex
          };
        }
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
        featureIndex: closestFeatureIndex
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to calculate track snap:', error);
    return null;
  }
};
