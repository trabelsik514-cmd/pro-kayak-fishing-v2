const EMODNET_URL = 'https://rest.emodnet-bathymetry.eu/depth_sample';
const GEBCO_URL = 'https://di-elevation.img.arcgis.com/arcgis/rest/services/gebco/ImageServer/identify';
const OSM_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SUBSTRATE_URL = 'https://gtkdata.gtk.fi/arcgis/rest/services/EMODnet/EMODnet_3_Geology/MapServer/2/query';

type DepthResult = {
  depthMeters: number;
  source: 'EMODnet Bathymetry DTM 2024' | 'GEBCO' | 'OpenStreetMap coastline';
  nearShore?: boolean;
  substrate?: { code:number; label:string; confidence:number|null } | null;
};

function finiteDepth(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) > 0 ? Math.abs(n) : null;
}

function parseEmodnet(data: any): { depth: number; hasSource: boolean } | null {
  if (!data || typeof data !== 'object') return null;
  // /depth_sample returns one DTM cell, not a point measurement. Prefer the
  // measured minimum, then average/smoothed values, exactly as exposed by
  // EMODnet. The DTM is ~115 m, so it must never be treated as centimetric data.
  const candidates = [data.min, data.avg, data.smoothed, data.max];
  for (const value of candidates) {
    const depth = finiteDepth(value);
    if (depth !== null) return { depth, hasSource: Boolean(data.reference) };
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
  try { return JSON.parse(text); } catch { return null; }
}

async function queryEmodnet(lat: number, lng: number, signal: AbortSignal): Promise<{depth:number; hasSource:boolean} | null> {
  const geom = `POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`;
  const url = `${EMODNET_URL}?geom=${encodeURIComponent(geom)}`;
  const data = await fetchJson(url, signal);
  return parseEmodnet(data);
}

async function queryGebco(lat: number, lng: number, signal: AbortSignal): Promise<number | null> {
  const geometry = JSON.stringify({x: lng, y: lat, spatialReference: { wkid: 4326 }});
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


async function querySubstrate(lat: number, lng: number, signal: AbortSignal): Promise<{code:number;label:string;confidence:number|null}|null> {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: JSON.stringify({x:lng,y:lat,spatialReference:{wkid:4326}}),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'Folk_5cl,Name,Conf_TOT',
    returnGeometry: 'false',
    outSR: '4326'
  });
  const data = await fetchJson(`${SUBSTRATE_URL}?${params.toString()}`, signal);
  const a = Array.isArray(data?.features) ? data.features[0] : null;
  const p = a?.attributes;
  if (!p) return null;
  const code = Number(p.Folk_5cl);
  if (!Number.isFinite(code)) return null;
  const labels: Record<number,string> = {
    1:'Mud to muddy Sand',2:'Sand',3:'Coarse substrate',4:'Mixed sediment',5:'Rock & boulders',
    6:'No data at this level of Folk',9:'Restricted data'
  };
  return {code,label:labels[code] || String(p.Name || 'Unknown substrate'),confidence:Number.isFinite(Number(p.Conf_TOT))?Number(p.Conf_TOT):null};
}

function metersPerDegreeLat() { return 111320; }
function metersPerDegreeLng(lat: number) { return 111320 * Math.cos(lat * Math.PI / 180); }

function pointSegmentDistanceMeters(
  lat: number, lng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const mx = metersPerDegreeLng(lat);
  const my = metersPerDegreeLat();
  const px = lng * mx, py = lat * my;
  const ax = aLng * mx, ay = aLat * my;
  const bx = bLng * mx, by = bLat * my;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / len2));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px-qx, py-qy);
}

async function isNearOsmCoastline(lat: number, lng: number, signal: AbortSignal): Promise<boolean> {
  // Only used for shallow EMODnet cells. OSM's coastline is a land/water
  // boundary, so it lets us distinguish a shoreline click from an offshore
  // point even though the EMODnet DTM cell itself is ~115 m wide.
  const radiusDeg = 0.0012; // ~130 m
  const south = lat - radiusDeg, north = lat + radiusDeg;
  const west = lng - radiusDeg, east = lng + radiusDeg;
  const query = `[out:json][timeout:5];way["natural"="coastline"](${south},${west},${north},${east});out geom;`;
  const url = `${OSM_OVERPASS_URL}?data=${encodeURIComponent(query)}`;
  const data = await fetchJson(url, signal);
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  let best = Infinity;
  for (const element of elements) {
    const geometry = Array.isArray(element.geometry) ? element.geometry : [];
    for (let i = 1; i < geometry.length; i++) {
      const a = geometry[i - 1], b = geometry[i];
      if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lon) || !Number.isFinite(b?.lat) || !Number.isFinite(b?.lon)) continue;
      best = Math.min(best, pointSegmentDistanceMeters(lat, lng, a.lat, a.lon, b.lat, b.lon));
      if (best <= 15) return true;
    }
  }
  return best <= 15;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 15 || lat > 90 || lng < -36 || lng > 43) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    let substrate: {code:number;label:string;confidence:number|null}|null = null;
    try { substrate = await querySubstrate(lat,lng,controller.signal); } catch { substrate = null; }

    try {
      const result = await queryEmodnet(lat, lng, controller.signal);
      if (result !== null) {
        // A shallow DTM cell can still be offshore even when its value is only
        // a few metres. Check the actual shoreline before applying a shoreline
        // interpretation; never invent a shallow value merely from the depth.
        if (result.depth <= 10) {
          try {
            if (await isNearOsmCoastline(lat, lng, controller.signal)) {
              res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
              return res.status(200).json({
                depthMeters: 0,
                source: 'OpenStreetMap coastline',
                nearShore: true,
                substrate
              });
            }
          } catch {
            // Coastline lookup is an enhancement only; keep the real DTM value.
          }
        }

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
        return res.status(200).json({
          depthMeters: Number(result.depth.toFixed(1)),
          source: 'EMODnet Bathymetry DTM 2024',
          nearShore: false,
          substrate
        });
      }
    } catch {
      // Continue to GEBCO.
    }

    try {
      const depth = await queryGebco(lat, lng, controller.signal);
      if (depth !== null) {
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
        return res.status(200).json({
          depthMeters: Number(depth.toFixed(1)),
          source: 'GEBCO',
          nearShore: false,
          substrate
        });
      }
    } catch {
      // Return a clean no-data response.
    }

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({ depthMeters: null, source: null, error: 'No bathymetry value for this coordinate' });
  } catch (error: any) {
    return res.status(504).json({ error: 'Bathymetry request timed out', detail: error?.name || 'unknown' });
  } finally {
    clearTimeout(timer);
  }
}
