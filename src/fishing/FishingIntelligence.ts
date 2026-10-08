export type FishingIntelligence = {
  centerSst: number|null;
  minSst: number|null;
  maxSst: number|null;
  gradient: number|null;
  gradientLabel: 'منخفض'|'متوسط'|'قوي'|'غير متاح';
  score: number|null;
  level: 'ممتاز'|'جيد'|'متوسط'|'ضعيف'|'غير متاح';
  sampleCount: number;
  note: string;
  source: 'Open-Meteo Marine';
};

type Sample = { latitude:number; longitude:number; sst:number|null };

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

async function getJson(url:URL):Promise<any>{
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok) throw new Error('HTTP '+response.status);
  return response.json();
}

/**
 * Fishing Intelligence is an indicator of marine conditions around the
 * selected point. It is NOT a probability of catching fish and never
 * overrides the kayak-safety assessment.
 *
 * Five SST samples are used: center + four nearby points. The gradient is
 * the max-min SST spread. Open-Meteo documents SST as a marine model field;
 * coastal accuracy is limited, so this is deliberately presented as an
 * indicator rather than a precise thermal-front detector.
 */
export async function getFishingIntelligence(
  latitude:number,
  longitude:number,
  context?: { windSpeed?:number|null; waveHeight?:number|null; seaTemperature?:number|null }
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

  const payload=await getJson(u);
  const raw:Array<any>=Array.isArray(payload)?payload:[payload];
  const samples:Sample[]=raw.map((p:any,i:number)=>({
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
      gradient:null,gradientLabel:'غير متاح',score:null,level:'غير متاح',sampleCount:values.length,
      note:'لا توجد نقاط SST كافية لبناء تدرج حراري موثوق.',
      source:'Open-Meteo Marine'
    };
  }

  const minSst=Math.min(...values);
  const maxSst=Math.max(...values);
  const gradient=Number((maxSst-minSst).toFixed(2));

  // This is an activity indicator, not a catch probability.
  // SST gradient contributes only 35 points; sea-state context contributes 65.
  let score=55;
  if(gradient>=0.8) score+=20;
  else if(gradient>=0.45) score+=12;
  else if(gradient>=0.2) score+=6;

  const sst=centerSst;
  if(sst!=null){
    if(sst>=17&&sst<=27) score+=10;
    else if(sst>=14&&sst<=30) score+=5;
    else score-=6;
  }
  if(context?.waveHeight!=null){
    if(context.waveHeight<=0.6) score+=8;
    else if(context.waveHeight<=1.0) score+=3;
    else if(context.waveHeight>1.5) score-=8;
  }
  if(context?.windSpeed!=null){
    if(context.windSpeed<=15) score+=7;
    else if(context.windSpeed<=25) score+=2;
    else if(context.windSpeed>35) score-=8;
  }

  score=Math.round(clamp(score,20,95));
  const level=score>=82?'ممتاز':score>=68?'جيد':score>=52?'متوسط':'ضعيف';
  const gradientLabel=gradient>=0.8?'قوي':gradient>=0.45?'متوسط':gradient>=0.2?'منخفض':'منخفض';
  const note=gradient>=0.45
    ? 'يوجد فرق حراري ملحوظ حول النقطة؛ قد يكون مفيداً كإشارة للصيد، لكنه ليس دليلاً على وجود السمك.'
    : 'التدرج الحراري حول النقطة محدود؛ لا توجد إشارة حرارية قوية من هذه البيانات وحدها.';

  return {centerSst,minSst,maxSst,gradient,gradientLabel,score,level,sampleCount:values.length,note,source:'Open-Meteo Marine'};
}
