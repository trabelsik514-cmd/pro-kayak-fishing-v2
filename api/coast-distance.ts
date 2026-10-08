const OSM_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function finite(n: unknown): number | null {
  const x=Number(n);
  return Number.isFinite(x) ? x : null;
}
function metersPerLat(){ return 111320; }
function metersPerLng(lat:number){ return 111320*Math.cos(lat*Math.PI/180); }
function segDistance(lat:number,lng:number,aLat:number,aLng:number,bLat:number,bLng:number){
  const mx=metersPerLng(lat), my=metersPerLat();
  const px=lng*mx, py=lat*my, ax=aLng*mx, ay=aLat*my, bx=bLng*mx, by=bLat*my;
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}
async function fetchJson(url:string,signal:AbortSignal){
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'PRO-KAYAK-FISHING/1.0'},signal});
  if(!r.ok) return null;
  try{return await r.json()}catch{return null}
}
export default async function handler(req:any,res:any){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const lat=finite(req.query?.lat),lng=finite(req.query?.lng);
  if(lat===null||lng===null||lat<15||lat>90||lng<-36||lng>43)return res.status(400).json({error:'Invalid coordinates'});
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const d=0.025;
    const q=`[out:json][timeout:8];way["natural"="coastline"](${lat-d},${lng-d},${lat+d},${lng+d});out geom;`;
    const data=await fetchJson(`${OSM_OVERPASS_URL}?data=${encodeURIComponent(q)}`,controller.signal);
    let best=Infinity,bLat=0,bLng=0;
    for(const e of Array.isArray(data?.elements)?data.elements:[]){
      const g=Array.isArray(e.geometry)?e.geometry:[];
      for(let i=1;i<g.length;i++){
        const a=g[i-1],b=g[i];
        if(!Number.isFinite(a?.lat)||!Number.isFinite(a?.lon)||!Number.isFinite(b?.lat)||!Number.isFinite(b?.lon))continue;
        const mx=metersPerLng(lat),my=metersPerLat();
        const px=lng*mx,py=lat*my,ax=a.lon*mx,ay=a.lat*my,bx=b.lon*mx,by=b.lat*my;
        const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;
        const x=ax+t*dx,y=ay+t*dy,dist=Math.hypot(px-x,py-y);
        if(dist<best){best=dist;bLng=x/mx;bLat=y/my;}
      }
    }
    if(!Number.isFinite(best))return res.status(200).json({distanceMeters:null});
    const rad=Math.PI/180;
    const y=Math.sin((bLng-lng)*rad)*Math.cos(bLat*rad);
    const x=Math.cos(lat*rad)*Math.sin(bLat*rad)-Math.sin(lat*rad)*Math.cos(bLat*rad)*Math.cos((bLng-lng)*rad);
    const bearing=(Math.atan2(y,x)*180/Math.PI+360)%360;
    res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=7200');
    return res.status(200).json({distanceMeters:Math.round(best),shoreLat:Number(bLat.toFixed(6)),shoreLng:Number(bLng.toFixed(6)),bearing:Math.round(bearing)});
  }catch{return res.status(200).json({distanceMeters:null});}
  finally{clearTimeout(timer);}
}
