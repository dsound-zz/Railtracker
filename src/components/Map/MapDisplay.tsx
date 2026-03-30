'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { NavigationControl, Source, Layer, LayerProps, Marker } from 'react-map-gl/mapbox';
import { TrackLayer } from './TrackLayer';
import { useAmtrak, AmtrakTrain } from '@/hooks/useAmtrak';
import { useFreight } from '@/hooks/useFreight';
import { interpolateFreightPosition } from '@/utils/geoUtils';
import { LiveFeed } from './LiveFeed';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const HEADING_TO_BEARING: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

export const MapDisplay = () => {
  const { trains, loading: trainsLoading, error: trainsError } = useAmtrak();
  const { containers, loading: freightLoading } = useFreight();

  // PMTiles URL — computed once in the browser (window.location is client-only)
  const [narnTilesUrl, setNarnTilesUrl] = useState('');

  // Dead-reckoned display positions, updated every second between API polls
  const [displayTrains, setDisplayTrains] = useState<AmtrakTrain[]>([]);

  // Tick to drive freight position updates every second
  const [tick, setTick] = useState(0);

  // Map ref for flyTo
  const mapRef = useRef<any>(null);

  // Selected asset ID (train or container)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [viewState, setViewState] = useState({
    longitude: -87.6298,
    latitude: 41.8781,
    zoom: 10,
    pitch: 45,
    bearing: 0,
  });

  // Build the XYZ tile URL once in the browser (window.location is client-only)
  useEffect(() => {
    setNarnTilesUrl(`${window.location.origin}/api/tiles/narn/{z}/{x}/{y}`);
  }, []);

  // Sync displayTrains to API truth on every poll
  useEffect(() => {
    setDisplayTrains(trains);
  }, [trains]);

  // Single 1s interval: dead-reckon trains + advance freight tick together (batched by React 18)
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayTrains(prev =>
        prev.map(train => {
          if (!train.velocity || train.velocity <= 0) return train;
          const bearing = HEADING_TO_BEARING[train.heading] ?? 0;
          const bearingRad = (bearing * Math.PI) / 180;
          const latRad = (train.lat * Math.PI) / 180;
          const dlat = (train.velocity / 3600 / 69) * Math.cos(bearingRad);
          const dlng = (train.velocity / 3600 / 69) * Math.sin(bearingRad) / Math.cos(latRad);
          return { ...train, lat: train.lat + dlat, lon: train.lon + dlng };
        })
      );
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const onMove = useCallback((evt: any) => {
    setViewState(evt.viewState);
  }, []);

  // Convert dead-reckoned train positions to GeoJSON — no snap needed, GPS is accurate enough
  const trainGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: displayTrains.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lon, t.lat] },
      properties: { trainID: t.trainID, routeName: t.routeName, velocity: t.velocity },
    })),
  }), [displayTrains]);

  // Interpolate freight positions — recalculates every second via tick
  const ghostTrains = useMemo(() => {
    if (!containers.length) return [];
    return containers.map(container => {
      const pos = interpolateFreightPosition(
        container.startTime,
        container.eta,
        container.pathGeoJSON
      );
      if (!pos) return null;
      const now = Date.now();
      const start = new Date(container.startTime).getTime();
      const end = new Date(container.eta).getTime();
      const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
      return { ...container, currentPosition: pos, progress };
    }).filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, tick]);

  const trainLayerStyle: LayerProps = {
    id: 'amtrak-trains',
    type: 'circle',
    source: 'trains-source',
    paint: {
      'circle-radius': 8,
      'circle-color': '#00FFFF',
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FFFFFF',
    },
  };

  const handleSelectTrain = useCallback((id: string) => {
    setSelectedId(id);
    const train = displayTrains.find(t => t.trainID === id);
    if (train) mapRef.current?.flyTo({ center: [train.lon, train.lat], zoom: 12 });
  }, [displayTrains]);

  const handleSelectContainer = useCallback((id: string) => {
    setSelectedId(id);
    const ghost = ghostTrains.find((g: any) => g?.containerId === id);
    if (ghost?.currentPosition) mapRef.current?.flyTo({ center: ghost.currentPosition, zoom: 12 });
  }, [ghostTrains]);

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
      <Map
        ref={mapRef}
        {...viewState}
        onMove={onMove}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" />
        <TrackLayer tilesUrl={narnTilesUrl} />

        {trainGeoJSON.features.length > 0 && (
          <Source id="trains-source" type="geojson" data={trainGeoJSON}>
            <Layer {...trainLayerStyle} />
            <Layer
              id="train-highlight"
              type="circle"
              source="trains-source"
              filter={['==', ['get', 'trainID'], selectedId ?? '']}
              paint={{
                'circle-radius': 14,
                'circle-color': 'transparent',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0,
                'circle-stroke-opacity': selectedId ? 1 : 0,
              }}
            />
          </Source>
        )}

        {ghostTrains.map((gt: any) => (
          <Marker
            key={`ghost-${gt.containerId}`}
            longitude={gt.currentPosition[0]}
            latitude={gt.currentPosition[1]}
            anchor="center"
          >
            <div
              style={{ width: 14, height: 14, position: 'relative' }}
              className={`cursor-pointer freight-marker-pulse ${selectedId === gt.containerId ? 'ring-2 ring-amber-400 rounded-full' : ''}`}
              onClick={() => handleSelectContainer(gt.containerId)}
            >
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-[10px] text-amber-500 font-mono px-2 py-1 rounded border border-amber-500/30 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                {Math.round(gt.progress)}%
              </div>
            </div>
          </Marker>
        ))}
      </Map>

      <div className="absolute top-4 left-4 z-40 w-80 max-h-[90vh] flex flex-col pointer-events-none">
        <LiveFeed
          trains={displayTrains}
          containers={ghostTrains as any}
          trainsLoading={trainsLoading}
          freightLoading={freightLoading}
          selectedId={selectedId}
          onSelectTrain={handleSelectTrain}
          onSelectContainer={handleSelectContainer}
        />
      </div>

      {trainsError && (
        <div className="absolute top-4 right-4 z-40 bg-red-900/80 px-4 py-2 border border-red-500 rounded text-white font-mono text-sm max-w-sm">
          Tracking Network Fault: {trainsError.message || 'Unable to sync dispatch.'}
        </div>
      )}
    </div>
  );
};
