export type WaypointCategory = 'fish'|'anchor'|'rock'|'danger'|'nav'|'kayak'|'personal';

export type FishingWaypoint = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  category: WaypointCategory;
  species?: string;
  depth?: number;
  notes?: string;
  createdAt: number;
};

const KEY = 'pro-kayak-fishing.waypoints.v2';
const LEGACY_KEY = 'pro-kayak-fishing.waypoints.v1';
const VALID_CATEGORIES: WaypointCategory[] = ['fish','anchor','rock','danger','nav','kayak','personal'];

function validTunisiaCoordinate(lat:number,lng:number):boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 30 && lat <= 38.6 && lng >= 7 && lng <= 12.2;
}

export function loadWaypoints(): FishingWaypoint[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const points = value.filter((x:any) => {
      const lat=Number(x?.lat), lng=Number(x?.lng);
      return x && validTunisiaCoordinate(lat,lng) && typeof x.name === 'string' && x.name.trim().length > 0;
    }).map((x:any) => ({
      id: typeof x.id === 'string' && x.id ? x.id : 'wp-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
      lat: Number(x.lat),
      lng: Number(x.lng),
      name: String(x.name).trim().slice(0,80),
      category: VALID_CATEGORIES.includes(x.category) ? x.category : 'personal',
      depth: Number.isFinite(Number(x.depth)) ? Number(x.depth) : undefined,
      species: typeof x.species === 'string' ? x.species.slice(0,80) : undefined,
      notes: typeof x.notes === 'string' ? x.notes.slice(0,300) : undefined,
      createdAt: Number.isFinite(Number(x.createdAt)) ? Number(x.createdAt) : Date.now()
    })) as FishingWaypoint[];
    if (points.length && !localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(points));
    return points.slice(0,250);
  } catch { return []; }
}

export function saveWaypoint(point: Omit<FishingWaypoint,'id'|'createdAt'>): FishingWaypoint {
  const lat=Number(point.lat), lng=Number(point.lng);
  if (!validTunisiaCoordinate(lat,lng)) throw new Error('Invalid Tunisia waypoint coordinates');
  const waypoint: FishingWaypoint = {
    ...point,
    lat,
    lng,
    name: String(point.name).trim().slice(0,80),
    category: VALID_CATEGORIES.includes(point.category) ? point.category : 'personal',
    notes: point.notes?.slice(0,300),
    id: crypto.randomUUID ? crypto.randomUUID() : 'wp-' + Date.now(),
    createdAt: Date.now()
  };
  localStorage.setItem(KEY, JSON.stringify([waypoint, ...loadWaypoints()].slice(0,250)));
  return waypoint;
}

export function deleteWaypoint(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadWaypoints().filter(x => x.id !== id)));
}
