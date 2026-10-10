import maplibregl from 'maplibre-gl';
import { fetchApi } from '../services/ApiClient';

export type BathymetryResult = {
  depthMeters: number;
  source: 'EMODnet Bathymetry DTM 2024' | 'GEBCO' | 'OpenStreetMap coastline';
  nearShore?: boolean;
  substrate?: { code:number; label:string; confidence:number|null } | null;
};

// Vite/StackBlitz preview does not provide Vercel serverless functions.
// Calling /api/bathymetry there makes Vite treat api/bathymetry.ts as a client
// module and can produce an esbuild loader error. Production on Vercel keeps
// using the real serverless endpoint.
const CLIENT_API = '/api/bathymetry';

type BathymetryApiResponse = {
  depthMeters?: number | null;
  source?: 'EMODnet Bathymetry DTM 2024' | 'GEBCO' | 'OpenStreetMap coastline' | null;
  nearShore?: boolean;
  substrate?: { code:number; label:string; confidence:number|null } | null;
};

export async function getBathymetryDepth(
  _map: maplibregl.Map,
  lng: number,
  lat: number
): Promise<BathymetryResult | null> {
  if (!CLIENT_API) return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < 15 || lat > 90 || lng < -36 || lng > 43) return null;

  try {
    const params = new URLSearchParams({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    const res = await fetchApi(`${CLIENT_API}?${params.toString()}`, { cache: 'no-store' }, 9000);
    if (!res.ok) return null;
    const data = await res.json() as BathymetryApiResponse;
    const rawDepth = data.depthMeters;
    if (rawDepth == null || rawDepth === '') return null;
    const depth = Number(rawDepth);
    if (!Number.isFinite(depth) || depth < 0) return null;
    if (
      data.source !== 'EMODnet Bathymetry DTM 2024' &&
      data.source !== 'GEBCO' &&
      data.source !== 'OpenStreetMap coastline'
    ) return null;

    return {
      depthMeters: depth,
      source: data.source,
      nearShore: Boolean(data.nearShore),
      substrate: data.substrate ?? null
    };
  } catch {
    // Optional bathymetry must fail cleanly without breaking the sea-state report.
    return null;
  }
}
