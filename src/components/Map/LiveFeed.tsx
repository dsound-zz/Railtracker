import React, { useState } from 'react';
import { AmtrakTrain } from '@/hooks/useAmtrak';
import { FreightContainer } from '@/hooks/useFreight';

interface LiveFeedProps {
  trains: AmtrakTrain[];
  containers: FreightContainer[];
  trainsLoading: boolean;
  freightLoading: boolean;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ 
  trains, 
  containers, 
  trainsLoading, 
  freightLoading 
}) => {
  const [activeTab, setActiveTab] = useState<'amtrak' | 'logistics'>('amtrak');

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
          Network Assets
        </button>
        <button
          onClick={() => setActiveTab('logistics')}
          className={`flex-1 py-2 text-xs font-mono font-bold tracking-tighter uppercase transition-colors ${
            activeTab === 'logistics' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-900/10' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Freight Ghosts
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {activeTab === 'amtrak' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-cyan-400 font-mono text-[10px] uppercase">Active passenger network</h3>
              {trainsLoading && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>}
            </div>
            {trains.map(train => (
              <div key={train.trainID} className="bg-zinc-800/80 border border-zinc-700 p-2 rounded text-xs flex flex-col gap-1 transition hover:bg-zinc-700 hover:border-cyan-500/50">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-200">{train.routeName} #{train.trainNum}</span>
                  <span className="text-emerald-400">{Math.round(train.velocity)} mph</span>
                </div>
                <div className="text-zinc-400 flex justify-between items-center text-[10px] uppercase">
                  <span>Provider: {train.provider}</span>
                  <span className="text-cyan-600 font-mono">{train.heading}</span>
                </div>
              </div>
            ))}
            {trains.length === 0 && !trainsLoading && (
              <div className="text-zinc-500 text-xs italic py-2">No active assets found.</div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
             <div className="flex items-center justify-between mb-1">
              <h3 className="text-amber-500 font-mono text-[10px] uppercase">Tracked T49 Logistics</h3>
              {freightLoading && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
            </div>
            {containers.map(container => (
              <div key={container.containerId} className="bg-zinc-800/80 border border-zinc-700 p-2 rounded text-xs flex flex-col gap-1 transition hover:bg-zinc-700 hover:border-amber-500/50">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-200">{container.containerId}</span>
                  <span className="text-amber-500 font-mono text-[10px]">{container.eventType.split('.').pop()}</span>
                </div>
                <div className="text-zinc-300 font-semibold">{container.origin.name} → {container.destination.name}</div>
                
                {/* Progress Bar for Logistics */}
                <div className="w-full bg-zinc-900 h-1 rounded-full mt-2 relative overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-amber-500 transition-all duration-1000"
                    style={{ width: `${(container as any).progress || 0}%` }}
                  />
                </div>

                <div className="text-zinc-500 flex justify-between items-center text-[10px] font-mono mt-1">
                  <span>Progress: {Math.round((container as any).progress || 0)}%</span>
                  <span>ETA: {new Date(container.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}

            {containers.length === 0 && !freightLoading && (
              <div className="text-zinc-500 text-xs italic py-2 font-mono">No logistics ghosts currently tracked.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
