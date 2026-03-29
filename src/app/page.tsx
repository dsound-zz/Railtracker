import { TrackProvider } from '@/context/TrackContext';
import { MapDisplay } from '@/components/Map/MapDisplay';

export default function Home() {
  return (
    <main className="w-full h-full min-h-screen bg-black overflow-hidden relative selection:bg-cyan-900 selection:text-white">
      {/* Wrapper to Cache Geospatial Lines in Browser */}
      <TrackProvider>
        {/* Render Map Layer with Track Vector Features */}
        <MapDisplay />
      </TrackProvider>
    </main>
  );
}
