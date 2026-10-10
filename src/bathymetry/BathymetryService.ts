import maplibregl from 'maplibre-gl';
import { fetchApi } from '../services/ApiClient';

export type BathymetryResult = {
  depthMeters: number;
  source: 'EMODnet Bathymetry DTM 2024' | 'GEBCO' | 'OpenStreetMap coastline';
  nearShore?: boolean;
  substrate?: { code:number; label:string; confidence:number|null } | null;
};

// Public-source-first retrieval keeps the Android app working even if a
// deployment's /api routes require web authentication. Proxy remains fallback.
const EMODNET_URL='https://rest.emodnet-bathymetry.eu/depth_sample';
const GEBCO_URL='https://di-elevation.img.arcgis.com/arcgis/rest/services/gebco/ImageServer/identify';
const depthCache=new Map<string,{expiresAt:number;promise:Promise<BathymetryResult|null>}>();

async function fetchExternalJson(url:string,timeoutMs=3500):Promise<any|null>{
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const request=(async()=>{
    try{
      const response=await fetch(url,{
        headers:{Accept:'application/json'},
        cache:'no-store',
        signal:controller.signal
      });
      if(!response.ok) return null;
      const text=await response.text();
      try{return JSON.parse(text)}catch{return null}
    }catch{
      return null;
    }
  })();
  const timeout=new Promise<null>(resolve=>{
    timer=setTimeout(()=>{controller.abort();resolve(null)},timeoutMs);
  });
  try{
    return await Promise.race([request,timeout]);
  }finally{
    if(timer!==undefined) clearTimeout(timer);
  }
}

async function queryEmodnet(lng:number,lat:number):Promise<BathymetryResult|null>{
  const geom='POINT('+lng.toFixed(6)+' '+lat.toFixed(6)+')';
  const params=new URLSearchParams({geom});
  const data=await fetchExternalJson(EMODNET_URL+'?'+params.toString(),3500);
  if(!data||typeof data!=='object') return null;
  for(const raw of [data.min,data.avg,data.smoothed,data.max]){
    if(raw==null||raw==='') continue;
    const numeric=Number(raw);
    if(Number.isFinite(numeric)&&Math.abs(numeric)<=12000){
      return {
        depthMeters:Number(Math.abs(numeric).toFixed(1)),
        source:'EMODnet Bathymetry DTM 2024',
        nearShore:false,
        substrate:null
      };
    }
  }
  return null;
}

async function queryGebco(lng:number,lat:number):Promise<BathymetryResult|null>{
  const geometry=JSON.stringify({x:lng,y:lat,spatialReference:{wkid:4326}});
  const params=new URLSearchParams({
    geometry,
    geometryType:'esriGeometryPoint',
    sr:'4326',
    returnGeometry:'false',
    returnPixelValues:'true',
    f:'json'
  });
  const data=await fetchExternalJson(GEBCO_URL+'?'+params.toString(),3500);
  if(!data||typeof data!=='object') return null;
  const candidates:unknown[]=[
    data.value,
    data.pixelValue,
    data.properties?.['Pixel Value'],
    data.properties?.pixelValue,
    data.properties?.value,
    data.pixelData?.pixelBlock?.pixels?.[0]?.[0],
    data.pixelData?.pixelBlock?.pixels?.[0]?.[0]?.[0]
  ];
  for(const raw of candidates){
    if(raw==null||raw==='') continue;
    const numeric=Number(raw);
    if(Number.isFinite(numeric)&&numeric<0&&Math.abs(numeric)<=12000){
      return {
        depthMeters:Number(Math.abs(numeric).toFixed(1)),
        source:'GEBCO',
        nearShore:false,
        substrate:null
      };
    }
  }
  return null;
}

async function queryProxy(lng:number,lat:number):Promise<BathymetryResult|null>{
  try{
    const params=new URLSearchParams({lat:lat.toFixed(6),lng:lng.toFixed(6)});
    const response=await fetchApi('/api/bathymetry?'+params.toString(),{cache:'no-store'},8000);
    if(!response.ok) return null;
    const data=await response.json() as {
      depthMeters?:number|null;
      source?:BathymetryResult['source']|null;
      nearShore?:boolean;
      substrate?:BathymetryResult['substrate'];
    };
    const depth=data.depthMeters;
    if(depth==null||!Number.isFinite(Number(depth))||Number(depth)<0) return null;
    if(data.source!=='EMODnet Bathymetry DTM 2024'&&data.source!=='GEBCO'&&data.source!=='OpenStreetMap coastline') return null;
    return {
      depthMeters:Number(depth),
      source:data.source,
      nearShore:Boolean(data.nearShore),
      substrate:data.substrate??null
    };
  }catch{
    return null;
  }
}

async function loadDepth(lng:number,lat:number):Promise<BathymetryResult|null>{
  // Ask both public data providers concurrently; prefer EMODnet when both return data.
  const [emodnet,gebco]=await Promise.all([
    queryEmodnet(lng,lat),
    queryGebco(lng,lat)
  ]);
  if(emodnet) return emodnet;
  if(gebco) return gebco;
  return queryProxy(lng,lat);
}

export function getBathymetryDepth(
  _map: maplibregl.Map,
  lng: number,
  lat: number
): Promise<BathymetryResult|null> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return Promise.resolve(null);
  if (lat < 15 || lat > 90 || lng < -36 || lng > 43) return Promise.resolve(null);

  const key=lat.toFixed(5)+','+lng.toFixed(5);
  const cached=depthCache.get(key);
  if(cached&&cached.expiresAt>Date.now()) return cached.promise;

  const promise=loadDepth(lng,lat).catch(()=>null);
  const entry={expiresAt:Date.now()+10*60*1000,promise};
  depthCache.set(key,entry);
  void promise.then(value=>{
    if(value===null) entry.expiresAt=Date.now()+30_000;
  }).catch(()=>{entry.expiresAt=Date.now()+30_000});
  if(depthCache.size>100){
    const firstKey=depthCache.keys().next().value;
    if(firstKey!==undefined) depthCache.delete(firstKey);
  }
  return promise;
}
