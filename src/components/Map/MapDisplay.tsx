'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { NavigationControl, Source, Layer, LayerProps, Marker } from 'react-map-gl/mapbox';
import { TrackLayer } from './TrackLayer';
import { useTrackContext } from '@/context/TrackContext';
import { useAmtrak } from '@/hooks/useAmtrak';
import { useFreight } from '@/hooks/useFreight';
import { snapToTrack, interpolateFreightPosition, findJunctions } from '@/utils/geoUtils';
import { playSquelchSound } from '@/utils/audio';
import { LiveFeed } from './LiveFeed';
import 'mapbox-gl/dist/mapbox-gl.css';

// You will provide this in your .env.local file
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export const MapDisplay = () => {
  const { narnData, loading: trackLoading, error: trackError, updateBounds } = useTrackContext();
  const { trains, loading: trainsLoading, error: trainsError } = useAmtrak();
  const { containers, loading: freightLoading } = useFreight();
  
  // Track regions for audio triggers
  const previousRegionsRef = useRef<Record<string, string>>({});

  // Ref to track where a train was previously snapped to reduce jumping
  const previousSnapsRef = useRef<Record<string, { owner: string; featureIndex: number }>>({});
  
  // Starting viewport near Chicago where our dummy tracks reside
  const [viewState, setViewState] = useState({
    longitude: -87.6298,
    latitude: 41.8781,
    zoom: 10,
    pitch: 45,
    bearing: 0
  });

  const onMove = useCallback((evt: any) => {
    setViewState(evt.viewState);
  }, []);

  // Fetch only tracks in the current view bounding box to maximize performance
  const onMapBoundsChange = useCallback((evt: any) => {
    const map = evt.target;
    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ];
    updateBounds(bbox);
  }, [updateBounds]);

  // Compute snapped train positions
  const snappedTrains = useMemo(() => {
    if (!narnData || trains.length === 0) return [];
    
    return trains.map(train => {
      const prevSnap = previousSnapsRef.current[train.trainID];
      const snapped = snapToTrack([train.lon, train.lat], narnData, prevSnap?.featureIndex);
      
      const newOwner = snapped?.properties?.RROWNER1 || '';

      // Play ATC sound if crossing into a distinctly new Class 1 Railroad block
      if (newOwner && prevSnap && prevSnap.owner && prevSnap.owner !== newOwner) {
        playSquelchSound();
      }

      if (snapped) {
        previousSnapsRef.current[train.trainID] = { 
          owner: newOwner, 
          featureIndex: snapped.featureIndex 
        };
      }

      return { ...train, snapped };
    });
  }, [trains, narnData]);

  // Task: INTERPOLATE FREIGHT POSITIONS
  // Task: DISTRICT-BASED AUDIO TRIGGER (FRA_REGION)
  const ghostTrains = useMemo(() => {
    if (!containers.length) return [];

    return containers.map(container => {
      const pos = interpolateFreightPosition(
        container.startTime,
        container.eta,
        container.pathGeoJSON
      );

      if (pos) {
        // Calculate Progress Percentage for the dispatcher
        const now = Date.now();
        const start = new Date(container.startTime).getTime();
        const end = new Date(container.eta).getTime();
        const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

        // Use snapToTrack to find the closest segment's FRADISTRCT
        // This helps simulate a real dispatcher hearing a squelch upon region handoff
        const snapped = snapToTrack(pos, narnData);
        const currentRegion = snapped?.properties?.FRADISTRCT || 'Unknown/Buffer';
        const previousRegion = previousRegionsRef.current[container.containerId];

        if (currentRegion !== 'Unknown/Buffer' && previousRegion && previousRegion !== currentRegion) {
          playSquelchSound();
          console.log(`[Dispatch] Container ${container.containerId} entering District: ${currentRegion}`);
        }

        previousRegionsRef.current[container.containerId] = currentRegion;

        return {
          ...container,
          currentPosition: pos,
          progress,
          region: currentRegion
        };
      }
      return null;
    }).filter(Boolean);
  }, [containers, narnData]);

  // Convert snapped trains into GeoJSON format for Mapbox Source
  const trainGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: snappedTrains
        .filter((t: any) => t.snapped !== null)
        .map((t: any) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: t.snapped!.coordinates
          },
          properties: {
            trainID: t.trainID,
            routeName: t.routeName,
            velocity: t.velocity,
            owner: t.snapped!.properties?.RROWNER1 || 'Unknown'
          }
        }))
    };
  }, [snappedTrains]);

  const freightGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: ghostTrains.map((gt: any) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: gt!.currentPosition
        },
        properties: {
          containerId: gt!.containerId,
          region: gt!.region,
          isArrived: gt!.eventType === 'container.transport.rail_arrived'
        }
      }))
    };
  }, [ghostTrains]);

  // Layer Styles
  const trainLayerStyle: LayerProps = {
    id: 'amtrak-trains',
    type: 'circle',
    source: 'trains-source',
    paint: {
      'circle-radius': 8,
      'circle-color': '#00FFFF',
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF'
    }
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white flex-col gap-4">
        <h1 className="text-2xl font-bold">Missing Mapbox Token</h1>
        <p>Please add NEXT_PUBLIC_MAPBOX_TOKEN to a .env.local file</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {trackLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cyan-400 font-mono text-xl animate-pulse pointer-events-none">
          LOADING DISPATCH DIRECTORY...
        </div>
      )}
      
      <Map
        {...viewState}
        onMove={onMove}
        onMoveEnd={onMapBoundsChange}
        onLoad={onMapBoundsChange}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" />
        <TrackLayer />
        
        {trainGeoJSON.features.length > 0 && (
          <Source id="trains-source" type="geojson" data={trainGeoJSON}>
            <Layer {...trainLayerStyle} />
          </Source>
        )}

        {/* Task 3: PULSE MARKERS FOR GHOST TRAINS */}
        {ghostTrains.map((gt: any) => (
           <Marker 
             key={`ghost-${gt.containerId}`} 
             longitude={gt.currentPosition[0]} 
             latitude={gt.currentPosition[1]}
             anchor="center"
           >
             <div className={gt.eventType === 'container.transport.rail_arrived' ? 'ping-animation w-12 h-12' : 'freight-marker-pulse'}>
               {/* Tooltip for Region */}
               <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-[10px] text-amber-500 font-mono px-2 py-1 rounded border border-amber-500/30 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                 {gt.region} | {Math.round(gt.progress)}%
               </div>
             </div>
           </Marker>
        ))}
      </Map>

      {/* Task 3: UPDATED LOGISTICS SIDEBAR */}
      <div className="absolute top-4 left-4 z-40 w-80 max-h-[90vh] flex flex-col pointer-events-none">
        <LiveFeed 
          trains={snappedTrains} 
          containers={ghostTrains as any} 
          trainsLoading={trainsLoading} 
          freightLoading={freightLoading} 
        />
      </div>
      
      {(trackError || trainsError) && (
        <div className="absolute top-4 right-4 z-40 bg-red-900/80 px-4 py-2 border border-red-500 rounded text-white font-mono text-sm max-w-sm">
          Tracking Network Fault: {(trackError?.message || trainsError?.message) || 'Unable to sync dispatch.'}
        </div>
      )}
    </div>
  );
};


