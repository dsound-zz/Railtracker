@AGENTS.md

# RailTracker - Project Context

## Overview
RailTracker is a high-performance geospatial web application designed to track and visualize railway elements. The goal is to render the North American Rail Network (NARN) with a neon "Dispatch Mode" UI, and eventually map live Amtrak GPS feeds to nearest physical tracks.

## Technology Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: TailwindCSS
- **Maps / Geospatial**: `mapbox-gl`, `react-map-gl/mapbox` v8 (ESM strict imports), and `@turf/turf` for spatial math.

## Current State (Scaffolding Complete)
1. **Map Integration**: 
   - A Mapbox GL container (`MapDisplay.tsx`) provides a full-screen, dark theme canvas.
   - Requires `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`.
2. **Context Caching**: 
   - `TrackContext.tsx` handles fetching and caching the heavy NARN GeoJSON dataset out of the React render loop to preserve token limits and rendering performance.
3. **Dispatch Mode UI**: 
   - Tracks are visualized using a Mapbox Vector Source in `TrackLayer.tsx`. Class I railroads (UP, BNSF, CSX) are painted with distinct neon glowing colors via Mapbox styling expressions.
4. **ATC Logic (Snap-to-Track)**:
   - `geoUtils.ts` exports a mathematical utility using `Turf.js` to snap raw GPS coordinates to the geometric NARN rail segments (`nearestPointOnLine`).
5. **Data Sources**:
   - We are currently using a mock dataset (`public/data/narn_dummy.geojson`) displaying generic lines near Chicago since the original NARN file is not on disk yet.

## Next Development Steps
- Obtain the full FRA NARN GeoJSON dataset or API source and place it in the application.
- Integrate the live Amtrak feed to map real-time trains to the network.
- Test `snapToTrack` accuracy using real payload coordinates.
