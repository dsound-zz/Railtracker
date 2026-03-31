@AGENTS.md

# RailTracker - Project Context

## Overview
RailTracker is a high-performance geospatial dispatch application for tracking the North American Rail Network (NARN). It features a neon "Dispatch Mode" UI, real-time Amtrak tracking, a "Freight Ghost" logistics layer for interpolated container tracking, Chicago rail node hotspots, and a slide-over Media Drawer for regional scanner and camera access.

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: TailwindCSS v4 (@import syntax)
- **Maps / Geospatial**: `mapbox-gl`, `react-map-gl/mapbox` v8, and `@turf/turf` for freight path interpolation.
- **Data Pipeline**: PMTiles vector tiles served via a Next.js API route (`/api/tiles/narn/[z]/[x]/[y]`). The route reads tiles directly from `public/data/narn.pmtiles` using a Node.js file-based `Source` for the `pmtiles` library. No GeoJSON is ever sent to the client.
- **Audio**: Removed (was ATC-style squelch — caused noise bugs, can be re-added later).

## Current State & Features

### 1. The Rail Network (NARN)
- **PMTiles Dataset**: The 345MB NARN GeoJSON has been converted to `public/data/narn.pmtiles` (316MB) using tippecanoe (`-z14 -Z4 -l tracks`). This file is gitignored.
- **Tile Server**: `src/app/api/tiles/narn/[z]/[x]/[y]/route.ts` serves tiles on demand. A module-level `PMTiles` singleton caches the file header and root directory across requests.
- **Property Mapping**: Uses standard NARN fields: `RROWNER1` (Line Owner) and `FRADISTRCT` (FRA Region/District).
- **Neon Visualization**: Class I railroads are color-coded in `TrackLayer.tsx`:
  - UP → `#FFD700` (gold), BNSF → `#EC7014` (amber), CSX → `#00529B` (blue)
  - NS → `#6B21A8` (purple), CN → `#DC2626` (red), CP → `#B91C1C` (dark red), KCS → `#854d0e`
  - **Default / short branches / unknown**: `#8B4513` (Industrial Brown)
- Source layer name is `tracks` (matches the tippecanoe `-l` flag).

### 2. Live Amtrak Tracking
- **Proxy Route**: `src/app/api/amtrak/route.ts` proxies Amtraker v3 (`api.amtraker.com`) server-side to avoid CORS. Tries a second CDN URL (`api-v3.amtraker.com`) if the primary fails. Always returns HTTP 200 — never a 502 to the client. When both upstreams fail and there is no stale cache, returns `{}` with `X-Feed-Status: offline`. Stale cache (last successful response) is held in a module-level variable between requests.
- **Polling Hook**: `useAmtrak` polls `/api/amtrak` every 30 seconds. Returns `feedStatus: 'live' | 'stale' | 'offline' | 'loading'` — no error/boolean flags. Keeps existing trains in state during outages so the map stays populated.
- **Dead-Reckoning**: Between polls, `MapDisplay` advances each train's position every second using `velocity` (mph) and `heading` (8-compass string → bearing degrees via `HEADING_TO_BEARING` map). Positions snap back to API truth on each poll.
- **Feed Status Pill**: A small top-right pill shows amber ("STALE") or red ("FEED OFFLINE") only when warranted. Hidden when live.

### 3. Train Graphics (SymbolLayer)
- **Icon**: A 24×12 px SVG rounded-rectangle built as a data URI and registered with Mapbox via `map.addImage()` on the `load` event.
  - Cyan (`#00FFFF`) = Amtrak, Amber (`#F59E0B`) = Ghost freight, Green (`#22C55E`) = other/fallback.
- **Rendering**: `iconsReady` state gates the SymbolLayer render. Icons are registered in `handleMapLoad`.
- **Rotation**: `icon-rotate: ['get', 'bearing']` + `icon-rotation-alignment: 'map'` aligns each rectangle to the train's NARN track bearing.
- **Click guard**: `handleMapClick` calls `map.getLayer(id)` before each `queryRenderedFeatures` call. This prevents a hard Mapbox error when layers haven't been added yet (e.g., no trains due to API outage).

### 4. Chicago Hotspots (`src/data/hotspots.ts`)
- A `Map<string, Hotspot>` of 5 major Chicago rail nodes:
  - BNSF Corwith Yard, UP Global IV, Blue Island Junction, Elmhurst (UP West), La Grange (BNSF)
- Each entry has: `coordinates [lat, lng]`, `broadcastifyFeedId`, `youtubeVideoId` (nullable), `operator`.
- `getNearestHotspot(lat, lng)` — Euclidean nearest-node lookup used to auto-select the correct regional feed when a train is clicked.
- `hotspotsGeoJSON` — pre-built FeatureCollection for the Mapbox circle + label layers.
- Rendered on the map as emerald circles with text labels.

### 5. The 'Ghost Train' Interpolator
- **Logistics Layer**: Data-source agnostic freight interpolation. Terminal49 webhook was removed.
- **Time-Based Interpolation**: Positions are calculated in real-time based on `(Now - Departure) / (ETA - Departure)` and moved smoothly along a `LineString` using `turf.along`.
- **Animation**: A `tick` state in `MapDisplay` increments every second, driving continuous position updates.
- **Mock Data**: Three seeded containers — Long Beach→Chicago (~97%), Seattle→Kansas City (50%), Gary Intermodal→Chicago Union Station (~50%).

### 6. Media Drawer (`src/components/Map/MediaDrawer.tsx`)
- **Trigger**: Clicking an Amtrak train, Ghost train, or Hotspot node opens a slide-over panel from the right. Closes on Escape or backdrop click.
- **Amtrak trigger** shows a Live Asset Status card: speed, heading, train state, train number.
- **Ghost trigger** shows a transit card with origin → destination and a live progress bar.
- **All triggers** show:
  - Nearest Rail Node metadata (name, operator, coordinates, scanner feed ID)
  - "Open Broadcastify" button that launches `broadcastify.com/listen/feed/{id}` in a new tab.
  - "Virtual Railfan — Live Streams" button linking to their YouTube channel streams page.
  - Operator-specific resource links (BNSF/UP/NS/CSX/Metra tracking portals).
- **Note**: Broadcastify and Virtual Railfan both require authentication/membership for iframe embedding. Direct-link buttons are the correct UX approach.

### 7. Dispatch Sidebar (LiveFeed)
- Three tabs: **Network** (Amtrak), **Ghosts** (freight), **Hotspots**.
- **Network**: Lists live Amtrak trains. Click flies the map to zoom 12 and opens the Media Drawer for the nearest hotspot.
- **Ghosts**: Lists containers with progress bar and ETA. Click flies the map and opens the Media Drawer.
- **Hotspots**: Lists all 5 Chicago rail nodes with operator color-coding and camera/scanner indicators. Click opens the Media Drawer directly.
- **Click-to-Highlight**: Cyan glow for Amtrak selection, amber for freight, emerald for hotspots.

### 8. Performance Architecture
- **PMTiles tile streaming**: Mapbox GL fetches only the tiles for the current viewport via HTTP. No GeoJSON is ever parsed or held in client memory.
- **Single 1s interval**: Dead-reckoning and freight tick share one `setInterval`. React 18 batches both `setState` calls into a single render.
- **Icon registration**: Train icons are registered once on map load and cached by Mapbox GL internally.

## Key Developer Commands
- `npm run dev`: Starts the Next.js dev server with Turbopack.
- `NEXT_PUBLIC_MAPBOX_TOKEN`: Required in `.env.local` for map rendering.

## Important Property Maps (NARN)
| UI Label    | NARN Property |
| :---------- | :------------ |
| Line Owner  | `RROWNER1`    |
| District    | `FRADISTRCT`  |
| Track Miles | `MILES`       |

## Known Limitations
- **Amtraker API**: Unofficial scraper that returns 502 when Amtrak's own systems change or rate-limit. The proxy handles this gracefully (stale cache → empty feed → `feedStatus: 'offline'`) but live train positions are unavailable during outages. No official Amtrak public API exists.
- **Ghost train routing**: Paths are hand-drawn LineStrings in mock data, not true rail-graph routes. A* search on the NARN graph would be needed for accurate paths.

## Next Development Steps
- **Production tile hosting**: The 316MB PMTiles file is too large to deploy with the app (Vercel function limit). Move `narn.pmtiles` to object storage (S3, Cloudflare R2) and update the tile URL in `MapDisplay` to point there instead of the local API route.
- **Persistent Storage**: Move Freight/Amtrak state into a database (e.g., Neon) to track historical transits.
- **Ghost Train data input**: Build a manual input form or CSV import to define origin/destination/time for shipments, replacing mock data.
- **Routing Engine**: Implement A* search on the NARN nodes to generate accurate paths between terminals for Ghost transits. DuckDB WASM is a good candidate for running spatial graph queries client-side.
- **Alternative Amtrak source**: If Amtraker stays down, consider scraping `amtrak.com/track-your-train` directly or consuming GTFS static schedules for schedule-based position estimation.
