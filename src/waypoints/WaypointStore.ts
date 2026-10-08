export type FishingWaypoint = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  createdAt: number;
};

const KEY = 'pro-kayak-fishing.waypoints.v1';

export function loadWaypoints(): FishingWaypoint[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((x) =>
      x && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng)) &&
      typeof x.name === 'string'
    ) : [];
  } catch { return []; }
}

export function saveWaypoint(point: Omit<FishingWaypoint,'id'|'createdAt'>): FishingWaypoint {
  const waypoint: FishingWaypoint = {
    ...point,
    id: crypto.randomUUID ? crypto.randomUUID() : 'wp-' + Date.now(),
    createdAt: Date.now()
  };
  localStorage.setItem(KEY, JSON.stringify([waypoint, ...loadWaypoints()].slice(0,100)));
  return waypoint;
}

export function deleteWaypoint(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadWaypoints().filter(x => x.id !== id)));
}
