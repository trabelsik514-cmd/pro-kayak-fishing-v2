export type TrackPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

export type KayakTrip = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  points: TrackPoint[];
  distanceKm: number;
  durationMin: number;
};

const KEY = 'pro-kayak-fishing.trips.v1';

export function distanceMeters(a: TrackPoint, b: TrackPoint): number {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function totalDistanceKm(points: TrackPoint[]): number {
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += distanceMeters(points[i - 1], points[i]);
  return meters / 1000;
}

export function loadTrips(): KayakTrip[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KayakTrip[];
    return Array.isArray(parsed) ? parsed.filter(t => Array.isArray(t.points)) : [];
  } catch {
    return [];
  }
}

export function saveTrip(trip: KayakTrip): KayakTrip[] {
  const trips = [trip, ...loadTrips()].slice(0, 30);
  localStorage.setItem(KEY, JSON.stringify(trips));
  return trips;
}

export function deleteTrip(id: string): KayakTrip[] {
  const trips = loadTrips().filter(t => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(trips));
  return trips;
}

export function makeTrip(points: TrackPoint[]): KayakTrip {
  const startedAt = points[0]?.timestamp ?? Date.now();
  const endedAt = points[points.length - 1]?.timestamp ?? startedAt;
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `trip-${Date.now()}`,
    name: `رحلة ${new Date(startedAt).toLocaleDateString('ar-TN')}`,
    startedAt,
    endedAt,
    points,
    distanceKm: totalDistanceKm(points),
    durationMin: Math.max(0, (endedAt - startedAt) / 60000)
  };
}
