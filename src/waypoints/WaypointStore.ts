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

export function loadWaypoints(): FishingWaypoint[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((x) =>
      x && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng)) &&
      typeof x.name === 'string' && typeof x.category === 'string'
    ).map((x) => ({
      ...x,
      lat: Number(x.lat), lng: Number(x.lng),
      category: ['fish','anchor','rock','danger','nav','kayak','personal'].includes(x.category) ? x.category : 'fish',
      depth: Number.isFinite(Number(x.depth)) ? Number(x.depth) : undefined,
      species: typeof x.species === 'string' ? x.species : undefined,
      notes: typeof x.notes === 'string' ? x.notes : undefined
    })) : [];
  } catch { return []; }
}

export function saveWaypoint(point: Omit<FishingWaypoint,'id'|'createdAt'>): FishingWaypoint {
  const waypoint: FishingWaypoint = {
    ...point,
    id: crypto.randomUUID ? crypto.randomUUID() : 'wp-' + Date.now(),
    createdAt: Date.now()
  };
  localStorage.setItem(KEY, JSON.stringify([waypoint, ...loadWaypoints()].slice(0,250)));
  return waypoint;
}

export function deleteWaypoint(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadWaypoints().filter(x => x.id !== id)));
}
