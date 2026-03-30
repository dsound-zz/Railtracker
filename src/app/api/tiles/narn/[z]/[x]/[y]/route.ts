import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { PMTiles } from 'pmtiles';

const NARN_PATH = path.join(process.cwd(), 'public/data/narn.pmtiles');

/**
 * Node.js file-based Source for the pmtiles library.
 * Implements the same getBytes() interface as FetchSource but reads from disk,
 * avoiding a self-referential HTTP round-trip to the Next.js static server.
 */
class NodeFileSource {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  getKey() {
    return this.filePath;
  }

  async getBytes(offset: number, length: number) {
    const handle = await fs.open(this.filePath, 'r');
    try {
      const buffer = Buffer.allocUnsafe(length);
      await handle.read(buffer, 0, length, offset);
      // Slice to return a clean ArrayBuffer (Buffer shares memory with its pool)
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + length);
      return { data: ab };
    } finally {
      await handle.close();
    }
  }
}

// Module-level singleton — caches PMTiles header + root directory across requests
const pmtiles = new PMTiles(new NodeFileSource(NARN_PATH) as any);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await ctx.params;

  try {
    const tile = await pmtiles.getZxy(Number(z), Number(x), Number(y));

    if (!tile) {
      // Empty tile — valid, Mapbox GL skips it
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse(tile.data as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.mapbox-vector-tile',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(`[tiles] Error fetching tile ${z}/${x}/${y}:`, err);
    return new NextResponse('Tile error', { status: 500 });
  }
}
