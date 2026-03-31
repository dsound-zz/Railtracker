'use client';

import React, { useEffect } from 'react';
import { Hotspot } from '@/data/hotspots';

export type DrawerTrigger =
  | { type: 'amtrak'; trainId: string; routeName: string; velocity: number; heading: string; trainState: string; hotspot: Hotspot }
  | { type: 'metra'; trainId: string; routeId: string; tripId: string; velocity?: number; heading?: string; hotspot: Hotspot }
  | { type: 'ghost'; containerId: string; origin: string; destination: string; progress: number; hotspot: Hotspot }
  | { type: 'hotspot'; hotspot: Hotspot };

interface MediaDrawerProps {
  trigger: DrawerTrigger | null;
  onClose: () => void;
}

/** Operator-specific links for manual railfan resources */
const OPERATOR_RESOURCES: Record<string, { label: string; url: string }[]> = {
  BNSF: [{ label: 'BNSF Track Shipment', url: 'https://www.bnsf.com/ship-with-bnsf/track-shipment/' }],
  UP: [{ label: 'UP Train Locator', url: 'https://www.up.com/customers/track_ship/trace/index.htm' }],
  NS: [{ label: 'NS Train Tracking', url: 'https://www.nscorp.com/content/nscorp/en/ship/tracking.html' }],
  CSX: [{ label: 'CSX ShipCSX', url: 'https://www.csx.com/index.cfm/customers/tools-resources/track-trace/' }],
  Metra: [{ label: 'Metra Tracker', url: 'https://metrarail.com/maps-schedules/train-tracker' }],
  CPKC: [{ label: 'CPKC Tracking', url: 'https://www.cpkcr.com/' }],
  Mixed: [],
};

const HEADING_LABELS: Record<string, string> = {
  N: '↑ North', NE: '↗ NE', E: '→ East', SE: '↘ SE',
  S: '↓ South', SW: '↙ SW', W: '← West', NW: '↖ NW',
};

export const MediaDrawer: React.FC<MediaDrawerProps> = ({ trigger, onClose }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isOpen = trigger !== null;
  const hotspot = trigger?.hotspot ?? null;

  const accentColor = (() => {
    if (!trigger) return { text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/20', dot: 'bg-emerald-400' };
    switch (trigger.type) {
      case 'amtrak':  return { text: 'text-cyan-400',    border: 'border-cyan-500/40',    bg: 'bg-cyan-950/20',    dot: 'bg-cyan-400'    };
      case 'metra':   return { text: 'text-blue-400',    border: 'border-blue-500/40',    bg: 'bg-blue-950/20',    dot: 'bg-blue-400'    };
      case 'ghost':   return { text: 'text-amber-400',   border: 'border-amber-500/40',   bg: 'bg-amber-950/20',   dot: 'bg-amber-400'   };
      case 'hotspot': return { text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/20', dot: 'bg-emerald-400' };
    }
  })();

  const operatorLinks = hotspot ? (OPERATOR_RESOURCES[hotspot.operator] ?? []) : [];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      )}

      {/* Slide-over panel */}
      <div
        className={[
          'absolute top-0 right-0 h-full z-50 w-[420px] max-w-[90vw]',
          'bg-zinc-950 border-l border-zinc-800 shadow-2xl',
          'flex flex-col overflow-hidden',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                Dispatch Intelligence Hub
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold ${accentColor.text} truncate`}>
                  {trigger?.type === 'amtrak' && `${trigger.routeName} #${trigger.trainId}`}
                  {trigger?.type === 'metra' && `Metra ${trigger.routeId} #${trigger.trainId}`}
                  {trigger?.type === 'ghost' && trigger.containerId}
                  {trigger?.type === 'hotspot' && trigger.hotspot.name}
                </span>
                {hotspot && (
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono border border-zinc-700">
                        {hotspot.operator}
                    </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* ── Telemetry Card ────────────────────────────────── */}
          {(trigger?.type === 'amtrak' || trigger?.type === 'metra') && (
            <div className={`rounded-xl border ${accentColor.border} ${accentColor.bg} p-4`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full ${accentColor.dot} animate-pulse`} />
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-300 font-bold">Live Telemetry</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Velocity</span>
                  <span className="text-2xl font-bold text-white font-mono">
                    {Math.round(trigger?.velocity || 0)}
                    <span className="text-xs text-zinc-500 ml-1">mph</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Heading</span>
                  <span className="text-xl font-bold text-white font-mono">
                    {trigger?.type === 'amtrak' ? (HEADING_LABELS[trigger.heading] ?? trigger.heading) : (trigger?.heading || '—')}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Identifier</span>
                  <span className="text-sm font-bold text-zinc-300 font-mono">
                    {trigger?.type === 'amtrak' ? `#${trigger.trainId}` : trigger?.tripId}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Provider</span>
                  <span className="text-sm font-bold text-zinc-300 font-mono">
                    {trigger?.type === 'amtrak' ? 'Amtrak' : 'Metra GTFS-R'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Action Cards ──────────────────────────────────── */}
          {hotspot && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">Regional Dispatch Access</span>
              
              <button
                onClick={() => window.open(hotspot.broadcastifyPlayerUrl, '_blank')}
                className="group relative flex items-center gap-4 w-full p-4 rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-300 hover:bg-blue-600/20 hover:border-blue-400 transition-all shadow-lg shadow-blue-900/10"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5c2.76 0 5 2.24 5 5v4c0 2.76-2.24 5-5 5" />
                    <path d="M7 19c-2.76 0-5-2.24-5-5v-4c0-2.76 2.24-5 5-5" />
                    <path d="M12 7c-1.66 0-3 1.34-3 3v4c0 1.66 1.34 3 3 3" />
                  </svg>
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold uppercase tracking-tight">Open Live Dispatcher</span>
                  <span className="text-[10px] text-blue-400/80 font-mono">Broadcastify Web Player 📻</span>
                </div>
                <svg className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {hotspot.youtubeVideoId && (
                <button
                  onClick={() => window.open(`https://www.youtube.com/watch?v=${hotspot.youtubeVideoId}`, '_blank')}
                  className="group relative flex items-center gap-4 w-full p-4 rounded-xl border border-red-500/30 bg-red-600/10 text-red-300 hover:bg-red-600/20 hover:border-red-400 transition-all shadow-lg shadow-red-900/10"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-500/20 text-red-400 group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold uppercase tracking-tight">Open Live Camera</span>
                    <span className="text-[10px] text-red-400/80 font-mono">Virtual Railfan Streams 🎥</span>
                  </div>
                  <svg className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* ── Node Metadata ─────────────────────────────────── */}
          {hotspot && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-4">Node Profile</span>
              <div className="flex flex-col gap-3 text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-600">Primary Op</span>
                  <span className="text-white font-bold">{hotspot.operator}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-600">Geocode</span>
                  <span className="text-zinc-400">{hotspot.coordinates[0].toFixed(4)}°N, {Math.abs(hotspot.coordinates[1]).toFixed(4)}°W</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-600">Location</span>
                  <span className="text-zinc-300">Chicago Sub</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Manual Assets ─────────────────────────────────── */}
          {operatorLinks.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-1">Auxiliary Resources</span>
              <div className="flex flex-col gap-2">
                {operatorLinks.map(({ label, url }) => (
                  <button
                    key={url}
                    onClick={() => window.open(url, '_blank')}
                    className="flex justify-between items-center px-4 py-3 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all text-xs font-mono group"
                  >
                    <span>{label}</span>
                    <svg className="group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-950 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="text-[10px] font-mono text-zinc-600">CONNECTED</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-tighter">
                Press ESC to exit dispatch hub
            </span>
        </div>
      </div>
    </>
  );
};
