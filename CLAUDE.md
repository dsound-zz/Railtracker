@AGENTS.md

# RailTracker - Project Context

## Overview
RailTracker is a high-performance geospatial dispatch application for tracking the North American Rail Network (NARN). It features a neon "Dispatch Mode" UI, real-time Amtrak tracking, and a "Freight Ghost" logistics layer for interpolated container tracking.

## Technology Stack
- **Framework**: Next.js 15+ (App Router)
- **Styling**: TailwindCSS v4 (@import syntax)
- **Maps / Geospatial**: `mapbox-gl`, `react-map-gl/mapbox` v8, and `@turf/turf` for spatial interpolation and snapping.
- **Data Pipeline**: Server Actions for high-speed GeoJSON bounding-box filtering (handling 150MB+ datasets).
- **Audio**: Web Audio API for dispatcher squelch/ATC feedback.

## Current State & Features

### 1. The Rail Network (NARN)
- **Full Dataset**: Integration of the complete 150MB+ Federal Rail Network dataset.
- **Server-Side Filtering**: `fetchTracksInBounds` Server Action prevents browser crashes by only sending track segments within the current viewport.
- **Property Mapping**: Uses standard NARN fields: `RROWNER1` (Line Owner) and `FRADISTRCT` (FRA Region/District).
- **Neon Visualization**: Class I railroads (UP, BNSF, CSX) are color-coded with glowing neon styles in `TrackLayer.tsx`.

### 2. Live Amtrak Tracking
- **Polling Engine**: `useAmtrak` hook polls live telemetry every 30 seconds.
- **Dead-Reckoning**: Between polls, `MapDisplay` advances each train's position every second using `velocity` (mph) and `heading` (8-compass string → bearing degrees via `HEADING_TO_BEARING` map). Positions snap back to API truth on each poll.
- **Snap-to-Track**: GPS coordinates are mathematically "locked" to the nearest physical rail segment using `nearestPointOnLine` logic.
- **Snap Cache**: Anti-jitter cache stores actual snapped `[lng, lat]` coordinates (not feature array indices) so it remains correct across `narnData` replacements on each pan.

### 3. The 'Ghost Train' Interpolator
- **Logistics Layer**: Tracks Terminal49 container events (Rail Departed/Arrived).
- **Time-Based Interpolation**: Since freight lacks live GPS, positions are calculated in real-time based on `(Now - Departure) / (ETA - Departure)` and moved smoothly along a `LineString` using `turf.along`.
- **Animation**: A `tick` state in `MapDisplay` increments every second and is included in the `ghostTrains` useMemo deps, driving continuous position updates without an external animation loop.
- **Pulse Markers**: Interpolated positions are marked with an amber "Ghost Pulse" to distinguish them from live GPS feeds.
- **Mock Data**: Three seeded containers — Long Beach→Chicago (~97% complete, visible near Hammond IL), Seattle→Kansas City (50%), and Gary Intermodal→Chicago Union Station (~50%, fully visible in Chicago viewport).

### 4. Dispatcher Audio Engine
- **Region Squelch**: The system monitors `FRADISTRCT` boundaries. When a tracked asset (Amtrak or Ghost) crosses into a new FRA region, a radio squelch sound triggers to notify the dispatcher.

### 5. Dispatch Sidebar (LiveFeed)
- **Click-to-Highlight**: Clicking a train or container card flies the map to zoom 12 on that asset, highlights the card (cyan glow for Amtrak, amber for freight), and renders a white selection ring on the Amtrak map dot via a filtered Mapbox layer.
- **Live Progress**: Containers display a progress bar and ETA that update every second (driven by the `tick` state passed from `MapDisplay`).

### 6. Performance Architecture
- **Debounced Bounds Updates**: `TrackContext.updateBounds` debounces 500ms so rapid panning triggers only one server request after the pan settles.
- **Non-Blocking Loading**: Old `narnData` stays visible while new data loads. The full-screen blocking overlay is replaced with a small "SYNCING" badge (bottom-right corner). `TrackLayer` guards only on `!narnData`, not on `loading`.
- **⚠️ Known Bottleneck**: Track rendering still uses GeoJSON-over-the-wire via Server Action. For a flight-tracker-smooth experience, convert NARN to PMTiles (`tippecanoe` + `mapbox-pmtiles`) to eliminate all server round-trips. See Next Development Steps below.

## Key Developer Commands
- `npm run dev`: Starts the Next.js dev server with Turbopack.
- `NEXT_PUBLIC_MAPBOX_TOKEN`: Required in `.env.local` for map rendering.

## Important Property Maps (NARN)
| UI Label | NARN Property |
| :--- | :--- |
| Line Owner | `RROWNER1` |
| District | `FRADISTRCT` |
| Track Miles | `MILES` |

## Next Development Steps
- **PMTiles Track Rendering** *(highest priority for performance)*: `brew install tippecanoe`, then `tippecanoe -o public/data/narn.pmtiles -z14 -l tracks <NARN_FILE>.geojson`, then `npm install mapbox-pmtiles` and register the protocol handler in `MapDisplay`. Eliminates all server round-trips for track data.
- **Persistent Storage**: Move Freight/Amtrak state into a database (e.g., Neon) to track historical transits.
- **Real-Time Webhooks**: Transition from Simulation to live Terminal49 webhooks.
- **Routing Engine**: Implement A* search on the NARN nodes to generate accurate paths between terminals for Ghost transits. DuckDB WASM is a good candidate for running spatial graph queries client-side for this use case.
