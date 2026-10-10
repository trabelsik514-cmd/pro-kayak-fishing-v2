export type KayakAssessment = {
  score:number;
  level:'ممتاز'|'جيد'|'حذر'|'غير مناسب';
  reasons:string[];
  recommendation:string;
  dataComplete:boolean;
  hardStop:boolean;
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
// Bands are ascending thresholds. Select the highest threshold crossed, not the first.
const penalty=(v:number|null,bands:Array<[number,number]>):number=>{
  if(v==null)return 0;
  for(let i=bands.length-1;i>=0;i--){
    const [limit,p]=bands[i];
    if(v>limit)return p;
  }
  return 0;
};
const weightedPenalty=(v:number|null,bands:Array<[number,number]>,weight=1)=>penalty(v,bands)*weight;
/**
 * Conservative kayak trip-planning score, not a probability of safety.
 * Thresholds are intentionally conservative for small fishing kayaks on the sea.
 */
export function assessKayakConditions(data:{
  windSpeed:number|null;
  windGusts:number|null;
  windDirection?:number|null;
  waveHeight:number|null;
  waveDirection?:number|null;
  wavePeriod:number|null;
  swellHeight?:number|null;
  swellDirection?:number|null;
  swellPeriod?:number|null;
  currentVelocity?:number|null;
}):KayakAssessment{
  const reasons:string[]=[];
  const missing:string[]=[];
  const risks:number[]=[];

  if(data.windSpeed==null) missing.push('الرياح');
  else {
    const p=penalty(data.windSpeed,[[10,5],[15,15],[18,30],[20,45],[25,65],[30,80],[Infinity,90]]);
    if(p)risks.push(p);
    if(data.windSpeed>=20)reasons.push('الرياح تبلغ حد الإيقاف المحافظ للكياك');
    else if(data.windSpeed>18)reasons.push('الرياح مرتفعة جدًا؛ أجّل الخروج');
    else if(data.windSpeed>10)reasons.push('رياح متوسطة؛ تحقّق من اتجاهها ومسار العودة');
  }

  if(data.windGusts==null) missing.push('الهبات');
  else {
    const p=penalty(data.windGusts,[[15,5],[20,12],[25,25],[30,45],[35,65],[40,82],[Infinity,90]]);
    if(p)risks.push(p);
    if(data.windGusts>=30)reasons.push('هبات الرياح تبلغ حد الإيقاف المحافظ للكياك');
    else if(data.windGusts>25)reasons.push('هبات قوية قد تفقدك السيطرة على الكياك');
  }

  if(data.waveHeight==null) missing.push('الموج');
  else {
    const p=penalty(data.waveHeight,[[0.3,5],[0.5,15],[0.6,25],[0.8,45],[1.0,65],[1.2,80],[Infinity,90]]);
    if(p)risks.push(p);
    if(data.waveHeight>=0.8)reasons.push('ارتفاع الموج يبلغ حد الإيقاف المحافظ للكياك');
    else if(data.waveHeight>0.5)reasons.push('الموج يتجاوز النطاق المثالي للصيد بالكياك');
  }

  if(data.wavePeriod==null) missing.push('فترة الموج');
  else if(data.waveHeight!=null){
    if(data.wavePeriod<5&&data.waveHeight>0.5){
      risks.push(18);
      reasons.push('موج قصير وحاد نسبيًا؛ قد يجعل حركة الكياك صعبة');
    } else if(data.wavePeriod<7&&data.waveHeight>0.5){
      risks.push(10);
      reasons.push('فترة الموج قصيرة نسبيًا');
    } else if(data.wavePeriod>=10&&data.waveHeight>0.7){
      risks.push(10);
      reasons.push('فترة الموج طويلة مع ارتفاع ملحوظ');
    }
  }

  if(data.swellHeight==null) missing.push('Swell');
  else {
    const p=penalty(data.swellHeight,[[0.3,5],[0.4,12],[0.6,25],[0.8,45],[1.0,65],[1.4,80],[Infinity,90]]);
    if(p)risks.push(p);
    if(data.swellHeight>=1.0)reasons.push('ارتفاع الـSwell يبلغ حد الإيقاف المحافظ للكياك');
    else if(data.swellHeight>0.6)reasons.push('الـSwell مرتفع نسبيًا');
  }

  if(data.swellPeriod!=null&&data.swellHeight!=null){
    if(data.swellPeriod>=12&&data.swellHeight>0.7){
      risks.push(12);
      reasons.push('فترة الـSwell طويلة مع ارتفاع ملحوظ');
    } else if(data.swellPeriod>=9&&data.swellHeight>0.6){
      risks.push(6);
      reasons.push('فترة الـSwell طويلة نسبيًا');
    }
  }

  if(data.currentVelocity==null) missing.push('التيار');
  else {
    const p=weightedPenalty(data.currentVelocity,[[0.5,0],[1.0,8],[1.5,18],[2.0,32],[Infinity,45]],0.75);
    if(p)risks.push(p);
    if(data.currentVelocity>=2.0)reasons.push('التيار قوي؛ لا تعتمد على التجديف وحده للعودة');
    else if(data.currentVelocity>1.5)reasons.push('التيار مرتفع نسبيًا');
  }

  // Without knowing the wind direction relative to the coast, do not assume it is onshore.
  // A hard-stop factor must never be averaged away by warm air or otherwise calm factors.
  const hardStop =
    (data.windSpeed!=null&&data.windSpeed>=20) ||
    (data.windGusts!=null&&data.windGusts>=30) ||
    (data.waveHeight!=null&&data.waveHeight>=0.8) ||
    (data.swellHeight!=null&&data.swellHeight>=1.0) ||
    (data.currentVelocity!=null&&data.currentVelocity>=2.0);

  const combined=Math.min(92,risks.reduce((sum,p)=>sum+p,0)*0.72);
  const strongest=risks.length?Math.max(...risks):0;
  let score=Math.round(clamp(100-Math.max(combined,strongest*0.88),0,100));
  if(hardStop) score=Math.min(score,44);
  const dataComplete=missing.length===0;
  if(!dataComplete){
    score=Math.min(score,64);
    reasons.push('بيانات السلامة غير مكتملة: '+missing.join('، '));
  }

  const level=score>=82?'ممتاز':score>=65?'جيد':score>=45?'حذر':'غير مناسب';
  const recommendation=hardStop
    ? 'لا تخرج بالكياك في هذه الظروف وفق حدود التحذير المحافظة. أجّل الرحلة وأعد فحص التوقعات البحرية الرسمية.'
    : !dataComplete
      ? 'بيانات السلامة غير مكتملة؛ لا تصنّف الرحلة آمنة. تحقّق من الرياح والهبات والموج والـSwell والتيار قبل القرار.'
      : level==='ممتاز'
        ? 'الظروف تبدو ملائمة للتخطيط فقط وفق البيانات المتاحة. تحقق من النشرة البحرية واتجاه الرياح ومسار العودة قبل الانطلاق.'
        : level==='جيد'
          ? 'قد تكون الظروف ملائمة لمجدّف متمرس وفي مياه محمية؛ راقب تغير الرياح والموج وأعد التحقق قبل الانطلاق.'
          : level==='حذر'
            ? 'الظروف تتطلب حذرًا إضافيًا. الخيار الأكثر أمانًا هو التأجيل أو البقاء في مياه محمية قريبة من الشاطئ.'
            : 'الظروف الحالية غير ملائمة للتخطيط لرحلة كياك؛ يوصى بتأجيل الخروج.';
  if(!reasons.length)reasons.push('العوامل البحرية ضمن النطاقات الهادئة في البيانات المتاحة');
  return {score,level,reasons,recommendation,dataComplete,hardStop};
}
