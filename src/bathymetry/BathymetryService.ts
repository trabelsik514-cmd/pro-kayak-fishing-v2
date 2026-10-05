import maplibregl from 'maplibre-gl';

export type BathymetryResult = { depthMeters: number; source: 'GEBCO'; raw: string };

const WMS='https://wms.gebco.net/mapserv?';
const LAYER='GEBCO_LATEST';

export async function getBathymetryDepth(map: maplibregl.Map, lng:number, lat:number):Promise<BathymetryResult|null>{
  const point=map.project([lng,lat]);
  const size=101;
  const half=Math.max(1,Math.round(size/2));
  const sw=map.unproject([point.x-half,point.y+half]);
  const ne=map.unproject([point.x+half,point.y-half]);
  const bbox=[sw.lng,sw.lat,ne.lng,ne.lat].join(',');
  const params=new URLSearchParams({
    SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetFeatureInfo',
    LAYERS:LAYER,QUERY_LAYERS:LAYER,INFO_FORMAT:'text/plain',
    CRS:'EPSG:4326',BBOX:bbox,WIDTH:String(size),HEIGHT:String(size),
    I:String(half),J:String(half),FEATURE_COUNT:'1'
  });
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const res=await fetch(WMS+params.toString(),{signal:controller.signal,headers:{Accept:'text/plain'}});
    if(!res.ok)return null;
    const raw=await res.text();
    const match=raw.match(/(?:value|elevation|depth)[^\d-]*(-?\d+(?:\.\d+)?)/i);
    if(!match)return null;
    const elevation=Number(match[1]);
    if(!Number.isFinite(elevation))return null;
    const depth=elevation<0?-elevation:0;
    if(depth<=0)return null;
    return {depthMeters:depth,source:'GEBCO',raw};
  }finally{clearTimeout(timer);}
}
