'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { NavigationControl, Source, Layer, LayerProps, Marker, MapMouseEvent } from 'react-map-gl/mapbox';
import { TrackLayer } from './TrackLayer';
import { useAmtrak, AmtrakTrain } from '@/hooks/useAmtrak';
import { useMetra, MetraTrain } from '@/hooks/useMetra';
import { useFreight } from '@/hooks/useFreight';
import { interpolateFreightPosition } from '@/utils/geoUtils';
import { LiveFeed } from './LiveFeed';
import { MediaDrawer, DrawerTrigger } from './MediaDrawer';
import { hotspotsGeoJSON, getNearestHotspot, HOTSPOTS, Hotspot } from '@/data/hotspots';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const HEADING_TO_BEARING: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

// ---------------------------------------------------------------------------
// Train SVG icon — 24×12 px neon rectangle rendered to a data URI.
// We create THREE versions (cyan, amber, generic green) and register each
// as a Mapbox image once the map style loads.
// ---------------------------------------------------------------------------
interface IconSpec {
  id: string;
  color: string;
  strokeColor: string;
}

const TRAIN_ICONS: IconSpec[] = [
  { id: 'train-v2-amtrak', color: '#00FFFF', strokeColor: '#FFFFFF' },   // cyan — Amtrak
  { id: 'train-v2-metra',  color: '#F472B6', strokeColor: '#FDF2F8' },   // pink — Metra
  { id: 'train-v2-ghost',  color: '#F59E0B', strokeColor: '#FDE68A' },   // amber — Ghost
  { id: 'train-v2-other',  color: '#22C55E', strokeColor: '#86EFAC' },   // green — other
];

function buildTrainIconDataUri(color: string, strokeColor: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="12" viewBox="0 0 24 12">
      <rect x="1" y="1" width="22" height="10" rx="2" ry="2"
            fill="${color}" fill-opacity="0.85"
            stroke="${strokeColor}" stroke-width="1.2"/>
      <rect x="3" y="3" width="18" height="6" rx="1" ry="1"
            fill="${color}" fill-opacity="0.4"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Registers all three train icons with Mapbox GL and calls onReady when done.
 */
function registerTrainIcons(map: mapboxgl.Map, onReady: () => void): void {
  let loaded = 0;
  for (const spec of TRAIN_ICONS) {
    if (map.hasImage(spec.id)) {
      loaded++;
      if (loaded === TRAIN_ICONS.length) onReady();
      continue;
    }
    const img = new Image(24, 12);
    img.onload = () => {
      if (!map.hasImage(spec.id)) map.addImage(spec.id, img);
      loaded++;
      if (loaded === TRAIN_ICONS.length) onReady();
    };
    img.src = buildTrainIconDataUri(spec.color, spec.strokeColor);
  }
}

export const MapDisplay = () => {
  const { trains: amtrakTrains, feedStatus: amtrakStatus } = useAmtrak();
  const { trains: metraTrains, feedStatus: metraStatus } = useMetra();
  const { containers, loading: freightLoading } = useFreight();

  // PMTiles URL — computed once in the browser
  const [narnTilesUrl, setNarnTilesUrl] = useState('');

  // Dead-reckoned display positions
  const [displayTrains, setDisplayTrains] = useState<AmtrakTrain[]>([]);
  const [displayMetraTrains, setDisplayMetraTrains] = useState<MetraTrain[]>([]);

  // Tick to drive freight position updates every second
  const [tick, setTick] = useState(0);

  // Whether train icons have been registered with Mapbox
  const [iconsReady, setIconsReady] = useState(false);

  // Map ref for flyTo + image registration
  const mapRef = useRef<any>(null);

  // Selected asset ID (train or container)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Media drawer trigger
  const [drawerTrigger, setDrawerTrigger] = useState<DrawerTrigger | null>(null);

  const [viewState, setViewState] = useState({
    longitude: -87.6298,
    latitude: 41.8781,
    zoom: 10,
    pitch: 45,
    bearing: 0,
  });

  // Build the XYZ tile URL once in the browser
  useEffect(() => {
    setNarnTilesUrl(`${window.location.origin}/api/tiles/narn/{z}/{x}/{y}`);
  }, []);

  // Sync displayTrains to API truth on every poll
  useEffect(() => {
    setDisplayTrains(amtrakTrains);
  }, [amtrakTrains]);

  useEffect(() => {
    setDisplayMetraTrains(metraTrains);
  }, [metraTrains]);

  // Single 1s interval: dead-reckon trains + advance freight tick
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
      setDisplayMetraTrains(prev =>
        prev.map(train => {
          const speedMph = (train.speed || 0) * 2.237;
          if (speedMph <= 0) return train;
          const bearingRad = ((train.bearing || 0) * Math.PI) / 180;
          const latRad = (train.lat * Math.PI) / 180;
          const dlat = (speedMph / 3600 / 69) * Math.cos(bearingRad);
          const dlng = (speedMph / 3600 / 69) * Math.sin(bearingRad) / Math.cos(latRad);
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

  // ── GeoJSON sources ────────────────────────────────────────────────────── //

  /**
   * Amtrak train positions as GeoJSON.
   * Properties include `bearing` so icon-rotate works correctly.
   */
  const trainGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: displayTrains.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lon, t.lat] },
      properties: {
        id: t.trainID,
        type: 'amtrak',
        routeName: t.routeName,
        velocity: t.velocity,
        bearing: HEADING_TO_BEARING[t.heading] ?? 0,
        icon: 'train-v2-amtrak',
      },
    })),
  }), [displayTrains]);

  /** Metra train positions as GeoJSON */
  const metraGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: displayMetraTrains.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lon, t.lat] },
      properties: {
        id: t.id,
        type: 'metra',
        routeId: t.routeId,
        tripId: t.tripId,
        velocity: (t.speed || 0) * 2.237, // m/s to mph
        bearing: t.bearing || 0,
        icon: 'train-v2-metra',
      },
    })),
  }), [displayMetraTrains]);

  /** Ghost train GeoJSON with amber icon */
  const ghostGeoJSON = useMemo(() => {
    if (!containers.length) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: containers.map(container => {
        const pos = interpolateFreightPosition(
          container.startTime,
          container.eta,
          container.pathGeoJSON
        );
        if (!pos) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: pos },
          properties: {
            containerId: container.containerId,
            origin: container.origin.name,
            destination: container.destination.name,
            icon: 'train-v2-ghost',
            bearing: 0, // ghosts don't have heading data; face north
          },
        };
      }).filter(Boolean),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, tick]);

  // ── Layer styles ──────────────────────────────────────────────────────── //

  const trainSymbolLayer: LayerProps = {
    id: 'amtrak-trains',
    type: 'symbol',
    source: 'trains-source',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': 1.5,
    },
    paint: {
      'icon-opacity': 0.92,
    },
  };

  const trainHighlightLayer: LayerProps = {
    id: 'train-highlight',
    type: 'circle',
    source: 'trains-source',
    filter: ['==', ['get', 'id'], selectedId ?? ''],
    paint: {
      'circle-radius': 18,
      'circle-color': 'transparent',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#FFFFFF',
      'circle-opacity': 0,
      'circle-stroke-opacity': selectedId ? 1 : 0,
    },
  };

  const metraSymbolLayer: LayerProps = {
    id: 'metra-trains',
    type: 'symbol',
    source: 'metra-source',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': 1.4,
    },
    paint: { 'icon-opacity': 0.9 },
  };

  const metraHighlightLayer: LayerProps = {
    id: 'metra-highlight',
    type: 'circle',
    source: 'metra-source',
    filter: ['==', ['get', 'id'], selectedId ?? ''],
    paint: {
        'circle-radius': 18,
        'circle-color': 'transparent',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#F472B6',
        'circle-stroke-opacity': selectedId ? 1 : 0,
    },
  };

  const ghostSymbolLayer: LayerProps = {
    id: 'ghost-trains',
    type: 'symbol',
    source: 'ghost-source',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': 1.4,
    },
    paint: {
      'icon-opacity': 0.85,
    },
  };

  const hotspotCircleLayer: LayerProps = {
    id: 'hotspots-circle',
    type: 'circle',
    source: 'hotspots-source',
    paint: {
      'circle-radius': 7,
      'circle-color': '#10B981',
      'circle-opacity': 0.9,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#6EE7B7',
    },
  };

  const hotspotLabelLayer: LayerProps = {
    id: 'hotspots-labels',
    type: 'symbol',
    source: 'hotspots-source',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#6EE7B7',
      'text-halo-color': '#0a0a0a',
      'text-halo-width': 1.5,
    },
  };

  // ── Freight ghost state (for LiveFeed) ─────────────────────────────────── //

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

  // ── Event handlers ────────────────────────────────────────────────────── //

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    registerTrainIcons(map, () => setIconsReady(true));
  }, []);

  /** Amtrak train click — find nearest hotspot, open drawer */
  const handleSelectTrain = useCallback((id: string) => {
    setSelectedId(id);
    const train = displayTrains.find(t => t.trainID === id);
    if (!train) return;
    mapRef.current?.flyTo({ center: [train.lon, train.lat], zoom: 12 });
    const hotspot = getNearestHotspot(train.lat, train.lon);
    setDrawerTrigger({
      type: 'amtrak',
      trainId: train.trainID,
      routeName: train.routeName,
      velocity: train.velocity,
      heading: train.heading,
      trainState: train.trainState,
      hotspot,
    });
  }, [displayTrains]);

  /** Metra train click */
  const handleSelectMetraTrain = useCallback((id: string) => {
    setSelectedId(id);
    const train = displayMetraTrains.find(t => t.id === id);
    if (!train) return;
    mapRef.current?.flyTo({ center: [train.lon, train.lat], zoom: 12 });
    const hotspot = getNearestHotspot(train.lat, train.lon);
    setDrawerTrigger({
      type: 'metra',
      trainId: train.id,
      routeId: train.routeId,
      tripId: train.tripId,
      velocity: (train.speed || 0) * 2.237,
      heading: train.bearing?.toString(),
      hotspot,
    });
  }, [displayMetraTrains]);

  /** Ghost container click — nearest hotspot, open drawer */
  const handleSelectContainer = useCallback((id: string) => {
    setSelectedId(id);
    const ghost = ghostTrains.find((g: any) => g?.containerId === id);
    if (!ghost?.currentPosition) return;
    mapRef.current?.flyTo({ center: ghost.currentPosition, zoom: 12 });
    const hotspot = getNearestHotspot(
      ghost.currentPosition[1],
      ghost.currentPosition[0]
    );
    setDrawerTrigger({
      type: 'ghost',
      containerId: ghost.containerId,
      origin: ghost.origin.name,
      destination: ghost.destination.name,
      progress: ghost.progress ?? 0,
      hotspot,
    });
  }, [ghostTrains]);

  /** Click on an Amtrak symbol layer feature */
  const handleMapClick = useCallback((evt: MapMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Guard: queryRenderedFeatures throws if the layer doesn't exist in the style yet.
    // Layers are only added once iconsReady=true and there is data to render,
    // so we must check map.getLayer() before querying each one.

    if (map.getLayer('amtrak-trains')) {
      const trainFeatures = map.queryRenderedFeatures(evt.point, { layers: ['amtrak-trains'] });
      if (trainFeatures.length > 0) {
        const props = trainFeatures[0].properties ?? {};
        handleSelectTrain(props.id);
        return;
      }
    }

    if (map.getLayer('metra-trains')) {
      const metraFeatures = map.queryRenderedFeatures(evt.point, { layers: ['metra-trains'] });
      if (metraFeatures.length > 0) {
        const props = metraFeatures[0].properties ?? {};
        handleSelectMetraTrain(props.id);
        return;
      }
    }

    if (map.getLayer('ghost-trains')) {
      const ghostFeatures = map.queryRenderedFeatures(evt.point, { layers: ['ghost-trains'] });
      if (ghostFeatures.length > 0) {
        const props = ghostFeatures[0].properties ?? {};
        handleSelectContainer(props.containerId);
        return;
      }
    }

    if (map.getLayer('hotspots-circle')) {
      const hotspotFeatures = map.queryRenderedFeatures(evt.point, { layers: ['hotspots-circle'] });
      if (hotspotFeatures.length > 0) {
        const props = hotspotFeatures[0].properties ?? {};
        const hotspot = HOTSPOTS.get(props.key);
        if (hotspot) {
          setSelectedId(props.key);
          setDrawerTrigger({ type: 'hotspot', hotspot });
        }
        return;
      }
    }
  }, [handleSelectTrain, handleSelectContainer]);

  /** Change cursor to pointer over interactive layers */
  const handleMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = 'pointer';
  }, []);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = '';
  }, []);

  // ── Render ────────────────────────────────────────────────────────────── //

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
        onClick={handleMapClick}
        onLoad={handleMapLoad}
        interactiveLayerIds={['amtrak-trains', 'metra-trains', 'ghost-trains', 'hotspots-circle']}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" />
        <TrackLayer tilesUrl={narnTilesUrl} />

        {/* ── Hotspot nodes ──────────────────────────────────────── */}
        <Source id="hotspots-source" type="geojson" data={hotspotsGeoJSON}>
          <Layer {...hotspotCircleLayer} />
          <Layer {...hotspotLabelLayer} />
        </Source>

        {/* ── Amtrak trains (SymbolLayer) ────────────────────────── */}
        {iconsReady && trainGeoJSON.features.length > 0 && (
          <Source id="trains-source" type="geojson" data={trainGeoJSON}>
            <Layer {...trainSymbolLayer} />
            <Layer {...trainHighlightLayer} />
          </Source>
        )}

        {/* ── Metra trains (SymbolLayer) ─────────────────────────── */}
        {iconsReady && metraGeoJSON.features.length > 0 && (
          <Source id="metra-source" type="geojson" data={metraGeoJSON}>
            <Layer {...metraSymbolLayer} />
            <Layer {...metraHighlightLayer} />
          </Source>
        )}

        {/* ── Ghost trains (SymbolLayer) ─────────────────────────── */}
        {iconsReady && (
          <Source id="ghost-source" type="geojson" data={ghostGeoJSON as any}>
            <Layer {...ghostSymbolLayer} />
          </Source>
        )}
      </Map>

      {/* ── Dispatch sidebar ────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-40 w-80 max-h-[90vh] flex flex-col pointer-events-none">
        <LiveFeed
          trains={displayTrains}
          metraTrains={displayMetraTrains}
          metraLoading={metraStatus === 'loading'}
          containers={ghostTrains as any}
          trainsLoading={amtrakStatus === 'loading'}
          freightLoading={freightLoading}
          selectedId={selectedId}
          onSelectTrain={handleSelectTrain}
          onSelectMetraTrain={handleSelectMetraTrain}
          onSelectContainer={handleSelectContainer}
          onSelectHotspot={(hotspot: Hotspot) => {
            setSelectedId(hotspot.name);
            setDrawerTrigger({ type: 'hotspot', hotspot });
          }}
        />
      </div>

      {/* ── Media drawer ────────────────────────────────────────── */}
      <MediaDrawer
        trigger={drawerTrigger}
        onClose={() => {
          setDrawerTrigger(null);
          setSelectedId(null);
        }}
      />

      {/* ── Feed status pill ─────────────────────────────────── */}
      {(amtrakStatus !== 'live' || metraStatus === 'offline') && (amtrakStatus !== 'loading' && metraStatus !== 'loading') && (
        <div className={`absolute top-4 right-4 z-40 px-3 py-1.5 border rounded font-mono text-xs flex items-center gap-2 ${
          (amtrakStatus === 'offline' || metraStatus === 'offline')
            ? 'bg-red-950/80 border-red-700 text-red-300'
            : 'bg-amber-950/80 border-amber-700 text-amber-300'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            (amtrakStatus === 'offline' || metraStatus === 'offline') ? 'bg-red-400' : 'bg-amber-400'
          }`} />
          {amtrakStatus === 'offline' || metraStatus === 'offline' ? 'FEED OFFLINE — Check Status' : 'STALE — serving cached positions'}
        </div>
      )}
    </div>
  );
};
