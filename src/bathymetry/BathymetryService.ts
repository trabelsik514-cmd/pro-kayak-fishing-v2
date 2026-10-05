import maplibregl from 'maplibre-gl';

export type BathymetryResult = {
  depthMeters: number;
  source: 'EMODnet Bathymetry DTM 2024';
  raw: string;
};

const API = 'https://rest.emodnet-bathymetry.eu/depth_sample';

type EmodnetDepthResponse = {
  min?: number;
  max?: number;
  avg?: number;
  stdev?: number;
  smoothed?: number;
  smoothedOffset?: number;
};

export async function getBathymetryDepth(
  _map: maplibregl.Map,
  lng: number,
  lat: number
): Promise<BathymetryResult | null> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const geom = `POINT(${lng} ${lat})`;
  const url = `${API}?geom=${encodeURIComponent(geom)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) return null;

    const raw = await res.text();
    let data: EmodnetDepthResponse;

    try {
      data = JSON.parse(raw) as EmodnetDepthResponse;
    } catch {
      return null;
    }

    // EMODnet returns water depth as a positive value in metres.
    // Prefer the smoothed cell value; fall back to the cell average.
    const depth = Number.isFinite(data.smoothed)
      ? data.smoothed!
      : Number.isFinite(data.avg)
        ? data.avg!
        : NaN;

    if (!Number.isFinite(depth) || depth <= 0) return null;

    return {
      depthMeters: depth,
      source: 'EMODnet Bathymetry DTM 2024',
      raw
    };
  } finally {
    clearTimeout(timer);
  }
}
