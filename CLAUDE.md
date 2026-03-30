@AGENTS.md

# RailTracker - Project Context

## Overview
RailTracker is a high-performance geospatial dispatch application for tracking the North American Rail Network (NARN). It features a neon "Dispatch Mode" UI, real-time Amtrak tracking, and a "Freight Ghost" logistics layer for interpolated container tracking.

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: TailwindCSS v4 (@import syntax)
- **Maps / Geospatial**: `mapbox-gl`, `react-map-gl/mapbox` v8, and `@turf/turf` for freight path interpolation.
- **Data Pipeline**: PMTiles vector tiles served via a Next.js API route (`/api/tiles/narn/[z]/[x]/[y]`). The route reads tiles directly from `public/data/narn.pmtiles` using a Node.js file-based `Source` for the `pmtiles` library. No GeoJSON is ever sent to the client.
- **Audio**: Removed (was ATC-style squelch — caused noise bugs, can be re-added later).

## Current State & Features

### 1. The Rail Network (NARN)
- **PMTiles Dataset**: The 345MB NARN GeoJSON has been converted to `public/data/narn.pmtiles` (316MB) using tippecanoe (`-z14 -Z4 -l tracks`). This file is gitignored.
- **Tile Server**: `src/app/api/tiles/narn/[z]/[x]/[y]/route.ts` serves tiles on demand. A module-level `PMTiles` singleton caches the file header and root directory across requests. Mapbox GL fetches only the tiles it needs for the current viewport.
- **Property Mapping**: Uses standard NARN fields: `RROWNER1` (Line Owner) and `FRADISTRCT` (FRA Region/District).
- **Neon Visualization**: Class I railroads (UP, BNSF, CSX) are color-coded with glowing neon styles in `TrackLayer.tsx`. Source layer name is `tracks` (matches the tippecanoe `-l` flag).

### 2. Live Amtrak Tracking
- **Polling Engine**: `useAmtrak` hook polls live telemetry every 30 seconds.
- **Dead-Reckoning**: Between polls, `MapDisplay` advances each train's position every second using `velocity` (mph) and `heading` (8-compass string → bearing degrees via `HEADING_TO_BEARING` map). Positions snap back to API truth on each poll.
- **Rendering**: Trains render as cyan dots at their GPS coordinates directly (no snap-to-track). NARN data is never loaded into client JS, so snap is not available — GPS accuracy is sufficient for visual alignment.

### 3. The 'Ghost Train' Interpolator
- **Logistics Layer**: Data-source agnostic freight interpolation. Terminal49 webhook was removed — T49 only provides departure/arrival events with no routing data, making it insufficient to drive this layer.
- **Time-Based Interpolation**: Positions are calculated in real-time based on `(Now - Departure) / (ETA - Departure)` and moved smoothly along a `LineString` using `turf.along`.
- **Animation**: A `tick` state in `MapDisplay` increments every second and is included in the `ghostTrains` useMemo deps, driving continuous position updates without an external animation loop.
- **Pulse Markers**: Interpolated positions are marked with an amber "Ghost Pulse" to distinguish them from live GPS feeds.
- **Mock Data**: Three seeded containers — Long Beach→Chicago (~97% complete), Seattle→Kansas City (50%), and Gary Intermodal→Chicago Union Station (~50%). The Gary→Chicago path routes through Hammond → South Chicago → Bridgeport to stay west of Lake Michigan.

### 4. Dispatcher Audio Engine
- **Removed**: Was causing constant noise due to region boundary flickering. `src/utils/audio.ts` has been deleted. Can be re-added later with proper debouncing.

### 5. Dispatch Sidebar (LiveFeed)
- **Click-to-Highlight**: Clicking a train or container card flies the map to zoom 12 on that asset, highlights the card (cyan glow for Amtrak, amber for freight), and renders a white selection ring on the Amtrak map dot via a filtered Mapbox layer.
- **Live Progress**: Containers display a progress bar and ETA that update every second (driven by the `tick` state passed from `MapDisplay`).

### 6. Performance Architecture
- **PMTiles tile streaming**: Mapbox GL fetches only the tiles for the current viewport via HTTP. No GeoJSON is ever parsed or held in client memory.
- **Single 1s interval**: Dead-reckoning and freight tick share one `setInterval`. React 18 batches both `setState` calls into a single render.

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
- **Production tile hosting**: The 316MB PMTiles file is too large to deploy with the app (Vercel function limit). Move `narn.pmtiles` to object storage (S3, Cloudflare R2) and update the tile URL in `MapDisplay` to point there instead of the local API route.
- **Persistent Storage**: Move Freight/Amtrak state into a database (e.g., Neon) to track historical transits.
- **Ghost Train data input**: Build a manual input form or CSV import to define origin/destination/time for shipments, replacing mock data.
- **Routing Engine**: Implement A* search on the NARN nodes to generate accurate paths between terminals for Ghost transits. DuckDB WASM is a good candidate for running spatial graph queries client-side for this use case.
