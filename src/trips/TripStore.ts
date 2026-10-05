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
const MAX_SHARED_POINTS = 5000;

const isValidPoint = (point: unknown): point is TrackPoint => {
  if (!point || typeof point !== 'object') return false;
  const p = point as Partial<TrackPoint>;
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Number.isFinite(p.timestamp) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
};

const isValidTrip = (trip: unknown): trip is KayakTrip => {
  if (!trip || typeof trip !== 'object') return false;
  const t = trip as Partial<KayakTrip>;
  return typeof t.id === 'string' && typeof t.name === 'string' &&
    Number.isFinite(t.startedAt) && Number.isFinite(t.endedAt) &&
    Array.isArray(t.points) && t.points.length > 0 && t.points.every(isValidPoint) &&
    Number.isFinite(t.distanceKm) && Number.isFinite(t.durationMin);
};

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
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isValidTrip) : [];
  } catch {
    return [];
  }
}

export function saveTrip(trip: KayakTrip): KayakTrip[] {
  const trips = [trip, ...loadTrips()].slice(0, 30);
  try {
    localStorage.setItem(KEY, JSON.stringify(trips));
  } catch {
    // Keep the in-memory result usable if storage is full or unavailable.
  }
  return trips;
}

export function deleteTrip(id: string): KayakTrip[] {
  const trips = loadTrips().filter(t => t.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(trips));
  } catch {}
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

export function encodeTripForShare(trip: KayakTrip): string {
  const json = JSON.stringify(trip);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export function decodeTripFromShare(encoded: string): KayakTrip | null {
  try {
    const base64 = encoded.replace(/-/g,'+').replace(/_/g,'/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const trip = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isValidTrip(trip)) return null;
    if (trip.points.length > MAX_SHARED_POINTS) trip.points = trip.points.slice(0, MAX_SHARED_POINTS);
    return trip;
  } catch { return null; }
}

export function encodeTripsForShare(trips: KayakTrip[]): string {
  const safeTrips = trips.filter(isValidTrip).slice(0, 6).map(trip => ({
    ...trip,
    points: trip.points.slice(0, MAX_SHARED_POINTS)
  }));
  const json = JSON.stringify(safeTrips);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export function decodeTripsFromShare(encoded: string): KayakTrip[] {
  try {
    const base64 = encoded.replace(/-/g,'+').replace(/_/g,'/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const trips = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!Array.isArray(trips)) return [];
    return trips.filter(isValidTrip).slice(0, 6).map(trip => ({
      ...trip,
      points: trip.points.slice(0, MAX_SHARED_POINTS)
    }));
  } catch { return []; }
}
