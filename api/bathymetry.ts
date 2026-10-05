const EMODNET_URL = 'https://rest.emodnet-bathymetry.eu/depth_sample';
const GEBCO_URL = 'https://di-elevation.img.arcgis.com/arcgis/rest/services/gebco/ImageServer/identify';

type DepthResult = {
  depthMeters: number;
  source: 'EMODnet Bathymetry DTM 2024' | 'GEBCO';
};

function finiteDepth(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) > 0 ? Math.abs(n) : null;
}

function parseEmodnet(data: any): number | null {
  if (!data || typeof data !== 'object') return null;
  // For a point close to the shoreline, the cell's minimum water depth is
  // much safer than the smoothed/average value: the EMODnet DTM cell is
  // about 115 m wide, so a shoreline click can otherwise inherit a deeper
  // value from the same grid cell. Prefer the shallowest measured/interpolated
  // value available in that cell, then fall back to smoothed/average values.
  const candidates = [data.min, data.smoothed, data.avg, data.max];
  for (const value of candidates) {
    const depth = finiteDepth(value);
    if (depth !== null) return depth;
  }
  return null;
}

function parseGebco(data: any): number | null {
  if (!data || typeof data !== 'object') return null;

  const candidates: unknown[] = [
    data.value,
    data.pixelValue,
    data.properties?.['Pixel Value'],
    data.properties?.pixelValue,
    data.properties?.value,
    data.pixelData?.pixelBlock?.pixels?.[0]?.[0],
    data.pixelData?.pixelBlock?.pixels?.[0]?.[0]?.[0]
  ];

  for (const value of candidates) {
    const n = Number(value);
    // GEBCO is an elevation grid: negative values are underwater.
    if (Number.isFinite(n) && n < 0) return Math.abs(n);
  }

  return null;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<any | null> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PRO-KAYAK-FISHING/1.0'
    },
    signal
  });

  if (!response.ok) return null;

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function queryEmodnet(lat: number, lng: number, signal: AbortSignal): Promise<number | null> {
  const geom = `POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`;
  const url = `${EMODNET_URL}?geom=${encodeURIComponent(geom)}`;
  const data = await fetchJson(url, signal);
  return parseEmodnet(data);
}

async function queryGebco(lat: number, lng: number, signal: AbortSignal): Promise<number | null> {
  const geometry = JSON.stringify({
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 }
  });

  const params = new URLSearchParams({
    geometry,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    returnGeometry: 'false',
    returnPixelValues: 'true',
    f: 'json'
  });

  const data = await fetchJson(`${GEBCO_URL}?${params.toString()}`, signal);
  return parseGebco(data);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 15 || lat > 90 ||
    lng < -36 || lng > 43
  ) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    // Primary: EMODnet's official point-sampling REST service.
    try {
      const depth = await queryEmodnet(lat, lng, controller.signal);
      if (depth !== null) {
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
        return res.status(200).json({
          depthMeters: Number(depth.toFixed(1)),
          source: 'EMODnet Bathymetry DTM 2024' satisfies DepthResult['source']
        });
      }
    } catch {
      // Continue to the global fallback below.
    }

    // Fallback: ArcGIS-hosted GEBCO elevation service.
    // Only negative elevations are accepted as water depth; positive values
    // indicate land and are deliberately not converted to a fake depth.
    try {
      const depth = await queryGebco(lat, lng, controller.signal);
      if (depth !== null) {
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
        return res.status(200).json({
          depthMeters: Number(depth.toFixed(1)),
          source: 'GEBCO' satisfies DepthResult['source']
        });
      }
    } catch {
      // Return a clean no-data response rather than exposing upstream details.
    }

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({
      depthMeters: null,
      source: null,
      error: 'No bathymetry value for this coordinate'
    });
  } catch (error: any) {
    return res.status(504).json({
      error: 'Bathymetry request timed out',
      detail: error?.name || 'unknown'
    });
  } finally {
    clearTimeout(timer);
  }
}
