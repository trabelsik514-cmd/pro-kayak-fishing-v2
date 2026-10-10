import { fetchApi } from '../services/ApiClient';
export type FishingIntelligence = {
  centerSst:number|null;
  minSst:number|null;
  maxSst:number|null;
  gradient:number|null;
  gradientLabel:'منخفض'|'متوسط'|'قوي'|'غير متاح';
  frontStrength:number|null;
  frontDirection:number|null;
  chlorophyll:number|null;
  chlorophyllLevel:'منخفض'|'متوسط'|'مرتفع'|'غير متاح';
  score:number|null;
  level:'ممتاز'|'جيد'|'متوسط'|'ضعيف'|'غير متاح';
  sampleCount:number;
  chlorophyllAvailable:boolean;
  note:string;
  source:'Open-Meteo Marine + NOAA CoastWatch';
};

type SstSample={latitude:number;longitude:number;sst:number|null};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

async function getJson(url:string,timeoutMs=12000):Promise<any>{
  const controller=new AbortController();
  const timer=globalThis.setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!response.ok) throw new Error('HTTP '+response.status);
    return await response.json();
  }finally{
    globalThis.clearTimeout(timer);
  }
}

async function getChlorophyll(latitude:number,longitude:number):Promise<number|null>{
  // Read chlorophyll through our API proxy so Android WebView does not depend
  // on cross-origin access to NOAA ERDDAP. The proxy also falls back across sensors.
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)) return null;
  try{
    const params=new URLSearchParams({lat:latitude.toFixed(5),lng:longitude.toFixed(5)});
    const response=await fetchApi('/api/chlorophyll?'+params.toString(),{cache:'no-store'},9000);
    if(!response.ok) return null;
    const payload=await response.json() as {chlorophyll?:unknown};
    const raw=payload?.chlorophyll;
    if(raw==null||raw==='') return null;
    const value=Number(raw);
    return Number.isFinite(value)&&value>=0.001&&value<=1000?value:null;
  }catch{
    return null;
  }
}

function chlorophyllLevel(value:number|null):FishingIntelligence['chlorophyllLevel']{
  if(value==null)return 'غير متاح';
  if(value<0.2)return 'منخفض';
  if(value<0.8)return 'متوسط';
  return 'مرتفع';
}

/**
 * Fishing Intelligence is an environmental indicator, not a catch probability.
 * SST gradient describes a possible thermal transition. Chlorophyll-a is a
 * productivity proxy. Neither signal proves that fish are present.
 */
export async function getFishingIntelligence(
  latitude:number,
  longitude:number,
  context?:{windSpeed?:number|null;waveHeight?:number|null;seaTemperature?:number|null}
):Promise<FishingIntelligence>{
  const offsets:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[
    [0,0],[0.12,0],[0,-0.12],[0,0.12],[-0.12,0]
  ];
  const lats=offsets.map(([d])=>latitude+d);
  const lngs=offsets.map(([,d])=>longitude+d);

  const u=new URL('https://marine-api.open-meteo.com/v1/marine');
  u.searchParams.set('latitude',lats.join(','));
  u.searchParams.set('longitude',lngs.join(','));
  u.searchParams.set('current','sea_surface_temperature');
  u.searchParams.set('timezone','auto');
  u.searchParams.set('cell_selection','sea');

  // Fetch SST and chlorophyll independently. A slow NOAA endpoint must not block
  // SST results, and a failed SST request must not discard a valid chlorophyll reading.
  const [sstResult,chlorophyllResult]=await Promise.allSettled([
    getJson(u.toString(),12000),
    getChlorophyll(latitude,longitude)
  ]);
  const payload=sstResult.status==='fulfilled'?sstResult.value:null;
  const chlorophyll=chlorophyllResult.status==='fulfilled'?chlorophyllResult.value:null;

  const raw:Array<any>=payload==null?[]:(Array.isArray(payload)?payload:[payload]);
  const samples:SstSample[]=raw.map((p:any,i:number)=>({
    latitude:lats[i],
    longitude:lngs[i],
    sst:Number.isFinite(Number(p?.current?.sea_surface_temperature))
      ? Number(p.current.sea_surface_temperature)
      : null
  }));
  const values=samples.map(x=>x.sst).filter((x):x is number=>x!=null&&Number.isFinite(x));
  const centerSst=samples[0]?.sst ?? context?.seaTemperature ?? null;

  if(values.length<3){
    return {
      centerSst,minSst:values.length?Math.min(...values):null,maxSst:values.length?Math.max(...values):null,
      gradient:null,gradientLabel:'غير متاح',frontStrength:null,frontDirection:null,
      chlorophyll,chlorophyllLevel:chlorophyllLevel(chlorophyll),score:null,level:'غير متاح',
      sampleCount:values.length,chlorophyllAvailable:chlorophyll!=null,
      note:'لا توجد نقاط SST كافية لبناء تدرج حراري موثوق.',
      source:'Open-Meteo Marine + NOAA CoastWatch'
    };
  }

  const minSst=Math.min(...values);
  const maxSst=Math.max(...values);
  const gradient=Number((maxSst-minSst).toFixed(2));

  // Directional front strength: largest center-to-neighbour SST jump.
  const pairs=[
    {delta:Math.abs((samples[1]?.sst??centerSst??0)-(centerSst??0)),direction:90},
    {delta:Math.abs((samples[2]?.sst??centerSst??0)-(centerSst??0)),direction:180},
    {delta:Math.abs((samples[3]?.sst??centerSst??0)-(centerSst??0)),direction:0},
    {delta:Math.abs((samples[4]?.sst??centerSst??0)-(centerSst??0)),direction:270}
  ].filter(x=>Number.isFinite(x.delta));
  const front=pairs.sort((a,b)=>b.delta-a.delta)[0];
  const frontStrength=Number((front?.delta??gradient).toFixed(2));
  const frontDirection=front?.direction??null;

  let score=50;
  // Thermal transition: useful signal, but deliberately capped.
  if(frontStrength>=0.8)score+=20;
  else if(frontStrength>=0.45)score+=12;
  else if(frontStrength>=0.2)score+=5;

  // Chlorophyll is a productivity signal, not a fish-presence measurement.
  if(chlorophyll!=null){
    if(chlorophyll>=0.8)score+=15;
    else if(chlorophyll>=0.2)score+=8;
    else score-=3;
  }

  if(centerSst!=null){
    if(centerSst>=17&&centerSst<=27)score+=6;
    else if(centerSst>=14&&centerSst<=30)score+=3;
    else score-=4;
  }
  if(context?.waveHeight!=null){
    if(context.waveHeight<=0.6)score+=5;
    else if(context.waveHeight<=1.0)score+=2;
    else if(context.waveHeight>1.5)score-=8;
  }
  if(context?.windSpeed!=null){
    if(context.windSpeed<=15)score+=4;
    else if(context.windSpeed<=25)score+=1;
    else if(context.windSpeed>35)score-=8;
  }

  score=Math.round(clamp(score,20,95));
  const level=score>=82?'ممتاز':score>=68?'جيد':score>=52?'متوسط':'ضعيف';
  const gradientLabel=gradient>=0.8?'قوي':gradient>=0.45?'متوسط':gradient>=0.2?'منخفض':'منخفض';
  const note=chlorophyll==null
    ? (frontStrength>=0.45
      ? 'يوجد انتقال حراري ملحوظ، لكن بيانات الكلوروفيل غير متاحة حالياً.'
      : 'الإشارة الحرارية محدودة، وبيانات الكلوروفيل غير متاحة حالياً.')
    : frontStrength>=0.45 && chlorophyll>=0.2
      ? 'توجد إشارة حرارية وإنتاجية معاً؛ هذا يحدد منطقة تستحق الفحص، ولا يعني وجود السمك.'
      : chlorophyll>=0.8
        ? 'الكلوروفيل مرتفع نسبياً، وهو مؤشر إنتاجية بحرية وليس دليلاً على وجود السمك.'
        : 'لا توجد إشارة بيئية قوية كافية وحدها؛ افحص تغير الظروف ومواقع التغذية محلياً.';

  return {
    centerSst,minSst,maxSst,gradient,gradientLabel,frontStrength,frontDirection,
    chlorophyll,chlorophyllLevel:chlorophyllLevel(chlorophyll),
    score,level,sampleCount:values.length,chlorophyllAvailable:chlorophyll!=null,note,
    source:'Open-Meteo Marine + NOAA CoastWatch'
  };
}
