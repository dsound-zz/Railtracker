import { useState, useEffect } from 'react';

export interface FreightContainer {
  containerId: string;
  eventType: 'container.transport.rail_departed' | 'container.transport.rail_arrived';
  origin: {
    name: string;
    coordinates: [number, number];
  };
  destination: {
    name: string;
    coordinates: [number, number];
  };
  startTime: string;
  eta: string;
  pathGeoJSON?: any;
}

export const useFreight = () => {
  const [containers, setContainers] = useState<FreightContainer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // In a real app, this would fetch from our database (populated by the T49 webhook)
    // For now, we seed with some 'Ghost' shipments for the simulation
    const mockFreight: FreightContainer[] = [
      {
        containerId: 'T49-CNTR-9921',
        eventType: 'container.transport.rail_departed',
        origin: { name: 'Port of Long Beach', coordinates: [-118.21, 33.77] },
        destination: { name: 'Chicago IHC', coordinates: [-87.65, 41.85] },
        startTime: new Date(Date.now() - 3600000 * 58).toISOString(), // 58h ago — ~97% done, near Chicago
        eta: new Date(Date.now() + 3600000 * 2).toISOString(), // 2h from now
        pathGeoJSON: {
          type: 'LineString',
          coordinates: [
            [-118.21, 33.77],
            [-115.17, 36.17], // Las Vegas
            [-104.99, 39.73], // Denver
            [-96.70, 40.81],  // Lincoln
            [-87.65, 41.85]   // Chicago
          ]
        }
      },
      {
        containerId: 'T49-CNTR-0045',
        eventType: 'container.transport.rail_departed',
        origin: { name: 'Seattle Terminal', coordinates: [-122.33, 47.60] },
        destination: { name: 'Kansas City Hub', coordinates: [-94.57, 39.09] },
        startTime: new Date(Date.now() - 3600000 * 24).toISOString(), // 24h ago
        eta: new Date(Date.now() + 3600000 * 24).toISOString(), // 24h from now
        pathGeoJSON: {
          type: 'LineString',
          coordinates: [
            [-122.33, 47.60],
            [-117.42, 47.65], // Spokane
            [-112.03, 46.58], // Helena
            [-106.66, 42.85], // Casper
            [-94.57, 39.09]   // KC
          ]
        }
      },
      {
        containerId: 'T49-CNTR-1147',
        eventType: 'container.transport.rail_departed',
        origin: { name: 'Gary Intermodal', coordinates: [-87.35, 41.59] },
        destination: { name: 'Chicago Union Station', coordinates: [-87.64, 41.88] },
        startTime: new Date(Date.now() - 3600000 * 1.5).toISOString(), // 1.5h ago — ~50% done
        eta: new Date(Date.now() + 3600000 * 1.5).toISOString(), // 1.5h from now
        pathGeoJSON: {
          type: 'LineString',
          coordinates: [
            [-87.35, 41.59], // Gary Intermodal
            [-87.50, 41.61], // Hammond
            [-87.62, 41.65], // South Chicago / Calumet (west of lake shore)
            [-87.64, 41.76], // Bridgeport
            [-87.64, 41.88]  // Chicago Union Station
          ]
        }
      }
    ];

    setContainers(mockFreight);
    setLoading(false);
  }, []);

  return { containers, loading };
};
