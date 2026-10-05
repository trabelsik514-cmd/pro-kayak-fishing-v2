import maplibregl from 'maplibre-gl';

export type BathymetryResult = {
  depthMeters: number;
  source: 'EMODnet Bathymetry DTM 2024';
  raw: string;
};

const CLIENT_API = '/api/bathymetry';

type EmodnetDepthResponse = {
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  stdev?: number | null;
  smoothed?: number | null;
  smoothedOffset?: number | null;
};

function normalizeDepth(data: EmodnetDepthResponse): number {
  // EMODnet normally returns positive water depth values. Accept negative
  // values as well because some service responses encode depth below sea
  // level as negative; the UI should always display depth as a positive
  // distance below the sea surface.
  const candidates = [data.smoothed, data.avg, data.min, data.max]
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && Math.abs(value) > 0);

  return candidates.length ? Math.abs(candidates[0]) : NaN;
}

export async function getBathymetryDepth(
  _map: maplibregl.Map,
  lng: number,
  lat: number
): Promise<BathymetryResult | null> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < 15 || lat > 90 || lng < -36 || lng > 43) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    // Use our same-origin Vercel function instead of calling EMODnet directly
    // from the browser. This avoids browser CORS/network restrictions while
    // keeping the official EMODnet REST service as the data source.
    const params = new URLSearchParams({
      lat: lat.toFixed(6),
      lng: lng.toFixed(6)
    });

    const res = await fetch(`${CLIENT_API}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) return null;

    const raw = await res.text();
    let data: EmodnetDepthResponse;

    try {
      data = JSON.parse(raw) as EmodnetDepthResponse;
    } catch {
      return null;
    }

    const depth = normalizeDepth(data);
    if (!Number.isFinite(depth)) return null;

    return {
      depthMeters: depth,
      source: 'EMODnet Bathymetry DTM 2024',
      raw
    };
  } finally {
    clearTimeout(timer);
  }
}
