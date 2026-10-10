const DATASETS = [
  { id: 'nesdisVHNchlaDaily', variable: 'chlor_a', dimensions: 4, source: 'NOAA VIIRS S-NPP' },
  { id: 'erdMH1chla1day_R2022NRT', variable: 'chlorophyll', dimensions: 3, source: 'NASA Aqua MODIS / NOAA CoastWatch ERDDAP' },
  { id: 'nesdisVHNnoaa20chlaDaily', variable: 'chlor_a', dimensions: 4, source: 'NOAA VIIRS NOAA-20' }
] as const;

type ChlorophyllSource = typeof DATASETS[number];

async function sampleSource(
  source:ChlorophyllSource,
  lat:number,
  lng:number
):Promise<number|null>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const latCoord='('+lat.toFixed(4)+')';
    const lngCoord='('+lng.toFixed(4)+')';
    const selectors=source.dimensions===4
      ? '[(last)][(0)]['+latCoord+']['+lngCoord+']'
      : '[(last)]['+latCoord+']['+lngCoord+']';
    const url='https://coastwatch.pfeg.noaa.gov/erddap/griddap/'+source.id+'.json?'+source.variable+selectors;
    const response=await fetch(url,{
      headers:{Accept:'application/json'},
      signal:controller.signal
    });
    if(!response.ok) return null;
    const payload=await response.json() as {table?:{rows?:unknown[][]}};
    const rows=payload?.table?.rows;
    if(!Array.isArray(rows)||!rows.length) return null;
    const raw=rows[0]?.[rows[0].length-1];
    // A missing satellite pixel is null/NaN, not a measured zero.
    if(raw==null||raw==='') return null;
    const value=Number(raw);
    return Number.isFinite(value)&&value>=0.001&&value<=1000?value:null;
  }catch{
    return null;
  }finally{
    clearTimeout(timer);
  }
}

export default async function handler(req:any,res:any){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Accept, Content-Type');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }

  const lat=Number(req.query?.lat);
  const lng=Number(req.query?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<15||lat>90||lng< -36||lng>43){
    return res.status(400).json({error:'Invalid coordinates'});
  }

  try{
    // Ask independent satellites together: cloudy/missing pixels from one sensor
    // can fall back to another without holding the report for multiple timeouts.
    const results=await Promise.all(DATASETS.map(async source=>({
      source,
      value:await sampleSource(source,lat,lng)
    })));
    const found=results.find(result=>result.value!==null);
    res.setHeader('Cache-Control',found?'s-maxage=600, stale-while-revalidate=3600':'s-maxage=120, stale-while-revalidate=600');
    if(!found){
      return res.status(200).json({chlorophyll:null,source:null,error:'No valid satellite pixel for this coordinate'});
    }
    return res.status(200).json({
      chlorophyll:found.value,
      source:found.source.source,
      units:'mg/m³'
    });
  }catch(error:any){
    return res.status(504).json({chlorophyll:null,source:null,error:error?.name||'Chlorophyll request failed'});
  }
}
