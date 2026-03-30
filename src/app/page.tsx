import { MapDisplay } from '@/components/Map/MapDisplay';

export default function Home() {
  return (
    <main className="w-full h-full min-h-screen bg-black overflow-hidden relative selection:bg-cyan-900 selection:text-white">
      <MapDisplay />
    </main>
  );
}
