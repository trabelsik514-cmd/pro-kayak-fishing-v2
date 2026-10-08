export type KayakAssessment = {
  score:number; level:'ممتاز'|'جيد'|'حذر'|'غير مناسب'; reasons:string[]; recommendation:string; dataComplete:boolean;
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const penalty=(v:number|null,bands:Array<[number,number]>):number=>{ if(v==null)return 0; for(const [limit,p] of bands)if(v>limit)return p; return 0; };
const weightedPenalty=(v:number|null,bands:Array<[number,number]>,weight=1)=>penalty(v,bands)*weight;
/** Conservative suitability model for fishing kayaks. Planning aid, not a safety certification. */
export function assessKayakConditions(data:{windSpeed:number|null;windGusts:number|null;windDirection?:number|null;waveHeight:number|null;waveDirection?:number|null;wavePeriod:number|null;swellHeight?:number|null;swellDirection?:number|null;swellPeriod?:number|null;currentVelocity?:number|null;precipitation?:number|null;}):KayakAssessment{
 const reasons:string[]=[]; const missing:string[]=[]; const risks:number[]=[];
 if(data.windSpeed==null)missing.push('الرياح'); else { const p=penalty(data.windSpeed,[[10,0],[15,8],[20,20],[25,38],[30,60],[Infinity,80]]); if(p)risks.push(p); if(data.windSpeed>25)reasons.push('الرياح قوية للكياك'); else if(data.windSpeed>20)reasons.push('الرياح مرتفعة وتحتاج حذراً'); else if(data.windSpeed>15)reasons.push('الرياح متوسطة إلى مرتفعة'); }
 if(data.windGusts==null)missing.push('الهبات'); else { const p=penalty(data.windGusts,[[20,0],[25,8],[30,20],[35,38],[40,60],[Infinity,82]]); if(p)risks.push(p); if(data.windGusts>35)reasons.push('الهبات قوية وقد تؤثر على التحكم بالكياك'); else if(data.windGusts>30)reasons.push('الهبات مرتفعة'); }
 if(data.waveHeight==null)missing.push('الموج'); else { const p=penalty(data.waveHeight,[[0.4,0],[0.6,8],[0.9,20],[1.2,38],[1.5,60],[Infinity,85]]); if(p)risks.push(p); if(data.waveHeight>1.2)reasons.push('ارتفاع الموج كبير للكياك'); else if(data.waveHeight>0.9)reasons.push('الموج مرتفع نسبياً'); }
 if(data.wavePeriod==null)missing.push('فترة الموج'); else if(data.waveHeight!=null){
  if(data.wavePeriod>=10&&data.waveHeight>0.7){risks.push(15);reasons.push('فترة الموج طويلة مع ارتفاع ملحوظ');}
  else if(data.wavePeriod>=8&&data.waveHeight>0.6){risks.push(8);reasons.push('فترة الموج طويلة نسبياً');}
}
if(data.swellPeriod!=null&&data.swellHeight!=null){
  if(data.swellPeriod>=12&&data.swellHeight>0.7){risks.push(10);reasons.push('فترة الـSwell طويلة مع ارتفاع ملحوظ');}
  else if(data.swellPeriod>=9&&data.swellHeight>0.6){risks.push(5);reasons.push('فترة الـSwell طويلة نسبياً');}
}
 if(data.swellHeight==null)missing.push('Swell'); else { const p=penalty(data.swellHeight,[[0.4,0],[0.7,7],[1.0,18],[1.4,35],[1.8,55],[Infinity,75]]); if(p)risks.push(p); if(data.swellHeight>1.0)reasons.push('الـSwell مرتفع'); }
 if(data.precipitation!=null){ const p=penalty(data.precipitation,[[0.2,0],[1,5],[3,12],[7,22],[Infinity,35]]); if(p)risks.push(p); if(data.precipitation>3)reasons.push('الأمطار قد تقلل الرؤية وراحة الرحلة'); }\n if(data.currentVelocity!=null){ const p=weightedPenalty(data.currentVelocity,[[0.5,0],[1.0,4],[1.5,10],[2.0,20],[Infinity,32]],0.65); if(p)risks.push(p); if(data.currentVelocity>1.5)reasons.push('التيار مرتفع نسبياً'); }
 const combined=Math.min(92,risks.reduce((sum,p)=>sum+p,0)*0.72);
 const strongest=risks.length?Math.max(...risks):0;
 // A suitability score is not a safety probability. Cap the score when any single
 // major hazard is present so a calm factor cannot mathematically hide it.
 const majorHazard=risks.some(p=>p>=38);
 let score=Math.round(clamp(100-Math.max(combined,strongest*0.88),0,92));
 if(majorHazard) score=Math.min(score,59);
 const dataComplete=missing.length===0; if(!dataComplete){score=Math.min(score,64);reasons.push('بيانات غير مكتملة: '+missing.join('، '));}
 const level=score>=82?'ممتاز':score>=65?'جيد':score>=45?'حذر':'غير مناسب';
 const recommendation=level==='ممتاز'?'الظروف تبدو ملائمة للتخطيط لرحلة كياك وفق البيانات المتاحة، لكن هذه درجة ملاءمة وليست نسبة أمان. تحقق من التغيرات قبل الانطلاق.':level==='جيد'?'الظروف قد تكون مناسبة، لكن راقب الرياح والهبات والموج وأعد التحقق قبل الانطلاق.':level==='حذر'?'الظروف تتطلب حذراً إضافياً. قلّل مدة الرحلة وابقَ قريباً من الشاطئ إذا قررت الخروج.':'الظروف الحالية غير ملائمة للتخطيط لرحلة كياك وفق البيانات المتاحة. يفضّل تأجيل الخروج وإعادة التحقق لاحقاً.';
 if(!reasons.length)reasons.push('العوامل البحرية والرياح ضمن نطاقات هادئة في البيانات المتاحة'); return {score,level,reasons,recommendation,dataComplete};
}