import React, { useState, useEffect } from 'react';
import { AmtrakTrain } from '@/hooks/useAmtrak';
import { MetraTrain } from '@/hooks/useMetra';
import { FreightContainer } from '@/hooks/useFreight';
import { HOTSPOTS, Hotspot } from '@/data/hotspots';

interface LiveFeedProps {
  trains: AmtrakTrain[];
  metraTrains: MetraTrain[];
  containers: (FreightContainer & { progress?: number; region?: string; currentPosition?: [number, number] })[];
  trainsLoading: boolean;
  metraLoading: boolean;
  freightLoading: boolean;
  selectedId: string | null;
  onSelectTrain: (id: string) => void;
  onSelectMetraTrain: (id: string) => void;
  onSelectContainer: (id: string) => void;
  /** Optional: called when user explicitly clicks a hotspot in the feed */
  onSelectHotspot?: (hotspot: Hotspot) => void;
}

type Tab = 'amtrak' | 'logistics' | 'hotspots';

export const LiveFeed: React.FC<LiveFeedProps> = ({
  trains,
  metraTrains,
  containers,
  trainsLoading,
  metraLoading,
  freightLoading,
  selectedId,
  onSelectTrain,
  onSelectMetraTrain,
  onSelectContainer,
  onSelectHotspot,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('amtrak');
  const [networkSubTab, setNetworkSubTab] = useState<'amtrak' | 'metra'>('amtrak');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-zinc-900/80 p-4 rounded border border-zinc-700 backdrop-blur pointer-events-auto h-full flex flex-col min-h-[400px]">
        <h2 className="text-emerald-400 font-mono text-lg font-bold tracking-widest uppercase mb-4 shrink-0">
          RailTracker Dispatch
        </h2>
      </div>
    );
  }

  const hotspotList = Array.from(HOTSPOTS.entries());

  const operatorColor: Record<string, string> = {
    BNSF: 'text-orange-400',
    UP:   'text-yellow-400',
    NS:   'text-purple-400',
    CSX:  'text-blue-400',
    Metra: 'text-pink-400',
    CPKC: 'text-red-500',
    Mixed: 'text-emerald-400',
  };

  return (
    <div className="bg-zinc-900/80 p-4 rounded border border-zinc-700 backdrop-blur pointer-events-auto h-full flex flex-col">
      <h2 className="text-emerald-400 font-mono text-lg font-bold tracking-widest uppercase mb-4 shrink-0">
        RailTracker Dispatch
      </h2>

      {/* TABS */}
      <div className="flex border-b border-zinc-700 mb-4 shrink-0">
        <button
          onClick={() => setActiveTab('amtrak')}
          className={`flex-1 py-2 text-xs font-mono font-bold tracking-tighter uppercase transition-colors ${
            activeTab === 'amtrak' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-900/10' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Network
        </button>
        <button
          onClick={() => setActiveTab('logistics')}
          className={`flex-1 py-2 text-xs font-mono font-bold tracking-tighter uppercase transition-colors ${
            activeTab === 'logistics' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-900/10' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Ghosts
        </button>
        <button
          onClick={() => setActiveTab('hotspots')}
          className={`flex-1 py-2 text-xs font-mono font-bold tracking-tighter uppercase transition-colors ${
            activeTab === 'hotspots' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-900/10' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Hotspots
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">

        {/* ── Network Tab ──────────────────────────────────────── */}
        {activeTab === 'amtrak' && (
          <div className="flex flex-col gap-4">
            {/* Sub Menu */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setNetworkSubTab('amtrak')}
                className={`flex-1 py-1.5 text-[10px] font-mono font-bold tracking-tighter uppercase rounded transition-colors ${
                  networkSubTab === 'amtrak' 
                    ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.3)]' 
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700 hover:text-cyan-300 hover:border-cyan-500/30'
                }`}
              >
                Amtrak
              </button>
              <button
                onClick={() => setNetworkSubTab('metra')}
                className={`flex-1 py-1.5 text-[10px] font-mono font-bold tracking-tighter uppercase rounded transition-colors ${
                  networkSubTab === 'metra' 
                    ? 'bg-pink-900/40 text-pink-400 border border-pink-500/50 shadow-[0_0_8px_rgba(244,114,182,0.3)]' 
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700 hover:text-pink-300 hover:border-pink-500/30'
                }`}
              >
                Metra
              </button>
            </div>

            {/* Amtrak Section */}
            {networkSubTab === 'amtrak' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-cyan-400 font-mono text-[10px] uppercase font-bold">Amtrak National</h3>
                  {(trainsLoading) && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                </div>
                {trains.map(train => (
                  <div
                    key={train.trainID}
                    onClick={() => onSelectTrain(train.trainID)}
                    className={`border p-2 rounded text-xs flex flex-col gap-1 transition cursor-pointer ${
                      selectedId === train.trainID
                        ? 'bg-zinc-700/80 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                        : 'bg-zinc-800/80 border-zinc-700 hover:bg-zinc-700 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-200">{train.routeName} #{train.trainNum}</span>
                      <span className="text-emerald-400 font-mono">{Math.round(train.velocity)} mph</span>
                    </div>
                    <div className="text-zinc-500 flex justify-between items-center text-[9px] uppercase font-mono">
                      <span>{train.provider}</span>
                      <span className="text-cyan-600 font-mono">{train.heading}</span>
                    </div>
                  </div>
                ))}
                {trains.length === 0 && !trainsLoading && (
                  <div className="text-zinc-600 text-[10px] italic py-1 font-mono">No active Amtrak assets.</div>
                )}
              </div>
            )}

            {/* Metra Section */}
            {networkSubTab === 'metra' && (
              <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-pink-400 font-mono text-[10px] uppercase font-bold">Metra Regional</h3>
                    {metraLoading && <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />}
                  </div>
                  {metraTrains.map(train => (
                    <div
                      key={train.id}
                      onClick={() => onSelectMetraTrain(train.id)}
                      className={`border p-2 rounded text-xs flex flex-col gap-1 transition cursor-pointer ${
                        selectedId === train.id
                          ? 'bg-zinc-700/80 border-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.5)]'
                          : 'bg-zinc-800/80 border-zinc-700 hover:bg-zinc-700 hover:border-pink-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-200">{train.routeId} #{train.id}</span>
                        <span className="text-pink-400 font-mono">{Math.round((train.speed || 0) * 2.237)} mph</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] uppercase font-mono">
                        <span className="text-zinc-500">Trip: {train.tripId}</span>
                        <div className="flex gap-2">
                          <span className={`${(train.delay || 0) <= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {(train.delay || 0) <= 0 ? 'ON TIME' : `${Math.round((train.delay || 0) / 60)}m DELAY`}
                          </span>
                          <span className="text-pink-600">{train.bearing}°</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {metraTrains.length === 0 && !metraLoading && (
                    <div className="text-zinc-600 text-[10px] italic py-1 font-mono">No active Metra assets.</div>
                  )}
              </div>
            )}
          </div>
        )}

        {/* ── Freight Ghosts Tab ──────────────────────────────── */}
        {activeTab === 'logistics' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-amber-500 font-mono text-[10px] uppercase">Tracked T49 Logistics</h3>
              {freightLoading && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </div>
            {containers.map(container => (
              <div
                key={container.containerId}
                onClick={() => onSelectContainer(container.containerId)}
                className={`border p-2 rounded text-xs flex flex-col gap-1 transition cursor-pointer ${
                  selectedId === container.containerId
                    ? 'bg-zinc-700/80 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                    : 'bg-zinc-800/80 border-zinc-700 hover:bg-zinc-700 hover:border-amber-500/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-200">{container.containerId}</span>
                  <span className="text-amber-500 font-mono text-[10px]">{container.eventType.split('.').pop()}</span>
                </div>
                <div className="text-zinc-300 font-semibold">{container.origin.name} → {container.destination.name}</div>

                <div className="w-full bg-zinc-900 h-1 rounded-full mt-2 relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-amber-500 transition-all duration-1000"
                    style={{ width: `${container.progress ?? 0}%` }}
                  />
                </div>

                <div className="text-zinc-500 flex justify-between items-center text-[10px] font-mono mt-1">
                  <span>Progress: {Math.round(container.progress ?? 0)}%</span>
                  <span>ETA: {new Date(container.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}

            {containers.length === 0 && !freightLoading && (
              <div className="text-zinc-500 text-xs italic py-2 font-mono">No logistics ghosts currently tracked.</div>
            )}
          </div>
        )}

        {/* ── Hotspots Tab ────────────────────────────────────── */}
        {activeTab === 'hotspots' && (
          <div className="flex flex-col gap-2">
            <div className="mb-1">
              <h3 className="text-emerald-400 font-mono text-[10px] uppercase">Chicago Rail Nodes</h3>
              <p className="text-[10px] font-mono text-zinc-600 mt-0.5">
                Click to open regional scanner + live stream.
              </p>
            </div>
            {hotspotList.map(([key, hotspot]) => (
              <div
                key={key}
                onClick={() => onSelectHotspot?.(hotspot)}
                className={`border p-2 rounded text-xs flex flex-col gap-1 transition cursor-pointer ${
                  selectedId === key
                    ? 'bg-zinc-700/80 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                    : 'bg-zinc-800/80 border-zinc-700 hover:bg-zinc-700 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-200 text-[11px]">{hotspot.name}</span>
                  <span className={`font-mono text-[10px] font-bold ${operatorColor[hotspot.operator] ?? 'text-zinc-400'}`}>
                    {hotspot.operator}
                  </span>
                </div>
                <div className="text-zinc-500 text-[10px] font-mono flex justify-between">
                  <span>Feed Active</span>
                  <span>{hotspot.youtubeVideoId ? '📹 Camera Available' : '— Scanner Only'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
