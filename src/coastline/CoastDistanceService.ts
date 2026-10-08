export type CoastDistance = { distanceMeters:number; shoreLat:number; shoreLng:number; bearing:number };
export async function getCoastDistance(lat:number,lng:number):Promise<CoastDistance|null>{
  if(!import.meta.env.PROD || !Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),11000);
  try{
    const r=await fetch(`/api/coast-distance?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`,{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
    if(!r.ok)return null;
    const d=await r.json();
    if(!Number.isFinite(Number(d.distanceMeters)))return null;
    return {distanceMeters:Number(d.distanceMeters),shoreLat:Number(d.shoreLat),shoreLng:Number(d.shoreLng),bearing:Number(d.bearing)};
  }catch{return null}finally{clearTimeout(timer)}
}