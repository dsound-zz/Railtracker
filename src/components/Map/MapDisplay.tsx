'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, LayerProps } from 'react-map-gl/mapbox';
import { TrackLayer } from './TrackLayer';
import { useTrackContext } from '@/context/TrackContext';
import { useAmtrak } from '@/hooks/useAmtrak';
import { snapToTrack } from '@/utils/geoUtils';
import { playSquelchSound } from '@/utils/audio';
import 'mapbox-gl/dist/mapbox-gl.css';

// You will provide this in your .env.local file
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export const MapDisplay = () => {
  const { narnData, loading: trackLoading, error: trackError, updateBounds } = useTrackContext();
  const { trains, loading: trainsLoading, error: trainsError } = useAmtrak();
  
  // Ref to track where a train was previously snapped to reduce jumping
  // and detect when it moves to a completely new block (OWNER)
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
      
      const newOwner = snapped?.properties?.OWNER || '';

      // Play ATC sound if crossing into a distinctly new Class 1 Railroad block
      if (newOwner && prevSnap && prevSnap.owner && prevSnap.owner !== newOwner) {
        playSquelchSound();
      }

      // Record snapshot state for anti-jitter tracking
      if (snapped) {
        previousSnapsRef.current[train.trainID] = { 
          owner: newOwner, 
          featureIndex: snapped.featureIndex 
        };
      }

      return {
        ...train,
        snapped
      };
    });
  }, [trains, narnData]);

  // Convert snapped trains into GeoJSON format for Mapbox Source
  const trainGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: snappedTrains
        .filter(t => t.snapped !== null)
        .map(t => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: t.snapped!.coordinates
          },
          properties: {
            trainID: t.trainID,
            routeName: t.routeName,
            velocity: t.velocity,
            owner: t.snapped!.properties?.OWNER || 'Unknown'
          }
        }))
    };
  }, [snappedTrains]);

  // Glowing Circle Layer style for active trains
  const trainLayerStyle: LayerProps = {
    id: 'amtrak-trains',
    type: 'circle',
    source: 'trains-source',
    paint: {
      'circle-radius': 8,
      'circle-color': '#00FFFF', // Cyan pulsing color
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF'
    }
  };

  const trainGlowStyle: LayerProps = {
    id: 'amtrak-trains-glow',
    type: 'circle',
    source: 'trains-source',
    paint: {
      'circle-radius': 16,
      'circle-color': '#00FFFF',
      'circle-opacity': 0.3,
      'circle-blur': 0.5
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

  const isLoading = trackLoading;
  const error = trackError || trainsError;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cyan-400 font-mono text-xl animate-pulse pointer-events-none">
          LOADING DISPATCH DIRECTORY...
        </div>
      )}
      
      {/* Mapbox Canvas */}
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
        
        {/* Render trains if we have them */}
        {trainGeoJSON.features.length > 0 && (
          <Source id="trains-source" type="geojson" data={trainGeoJSON}>
            <Layer {...trainGlowStyle} />
            <Layer {...trainLayerStyle} />
          </Source>
        )}
      </Map>

      {/* Decorative Overlay for HUD */}
      <div className="absolute top-4 left-4 z-40 bg-zinc-900/80 p-4 rounded border border-zinc-700 backdrop-blur pointer-events-none w-80 max-h-[80vh] flex flex-col">
        <h2 className="text-emerald-400 font-mono text-lg font-bold tracking-widest uppercase">RailTracker Dispatch</h2>
        
        <div className="text-xs font-mono text-zinc-400 mt-2 flex flex-col gap-1 shrink-0 pb-4 border-b border-zinc-700">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#FFD700] shadow-[0_0_8px_#FFD700]"></span> UP Mainline</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#EC7014] shadow-[0_0_8px_#EC7014]"></span> BNSF Transcon</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#00529B] shadow-[0_0_8px_#00529B]"></span> CSX Eastern Line</div>
        </div>

        {/* List Active Amtrak Trains */}
        <div className="mt-4 flex-1 overflow-y-auto pointer-events-auto pr-2 custom-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-cyan-400 font-mono text-sm leading-none">Active network assets</h3>
            {trainsLoading && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>}
          </div>
          
          <div className="flex flex-col gap-2">
            {snappedTrains.slice(0, 15).map(train => {
              const owner = train.snapped?.properties?.OWNER;
              return (
                <div key={train.trainID} className="bg-zinc-800/80 border border-zinc-700 p-2 rounded text-xs flex flex-col gap-1 transition hover:bg-zinc-700">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-200">{train.routeName} #{train.trainNum}</span>
                    <span className="text-emerald-400">{Math.round(train.velocity)} mph</span>
                  </div>
                  <div className="text-zinc-400 flex justify-between items-center text-[10px] uppercase">
                    <span>{owner ? `ON ${owner}` : 'OFF GRID'}</span>
                    <span className="text-cyan-600 font-mono">{train.heading}</span>
                  </div>
                </div>
              );
            })}
            {snappedTrains.length > 15 && (
              <div className="text-zinc-500 text-xs text-center py-2 italic font-mono">
                + {snappedTrains.length - 15} others tracked...
              </div>
            )}
            {snappedTrains.length === 0 && !trainsLoading && (
              <div className="text-zinc-500 text-xs italic py-2">No active assets found.</div>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="absolute top-4 right-4 z-40 bg-red-900/80 px-4 py-2 border border-red-500 rounded text-white font-mono text-sm max-w-sm">
          Tracking Network Fault: {error.message || 'Unable to sync dispatch.'}
        </div>
      )}
    </div>
  );
};
