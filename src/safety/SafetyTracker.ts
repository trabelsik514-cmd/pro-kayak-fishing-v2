export type SafetyPoint = { lat: number; lng: number; timestamp: number };
const rad = (v: number) => v * Math.PI / 180;
const deg = (v: number) => v * 180 / Math.PI;
export function distanceKm(a: SafetyPoint, b: SafetyPoint): number {
  const R = 6371, p1 = rad(a.lat), p2 = rad(b.lat), dp = rad(b.lat-a.lat), dl = rad(b.lng-a.lng);
  const h = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
export function bearingTo(a: SafetyPoint, b: SafetyPoint): number {
  const lat1=rad(a.lat), lat2=rad(b.lat), dl=rad(b.lng-a.lng);
  const y=Math.sin(dl)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dl);
  return (deg(Math.atan2(y,x))+360)%360;
}