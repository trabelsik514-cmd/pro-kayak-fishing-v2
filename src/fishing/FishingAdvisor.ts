export type SpeciesProfile = {key:'Daurade'|'Loup'|'Sar'|'Balistes';ar:string;fr:string;minTemp:number;maxTemp:number;preferredDepthMin:number;preferredDepthMax:number;habitat:'roche'|'sable'|'mixte';seasons:number[]};
export type SpeciesSignal = {key:SpeciesProfile['key'];ar:string;fr:string;score:number;reasons:string[]};
export type FishingWindow={start:string;end:string;score:number;level:'ممتاز'|'جيد'|'متوسط'|'ضعيف';reasons:string[]};
const PROFILES:SpeciesProfile[]=[
{key:'Daurade',ar:'الدنيس',fr:'Daurade',minTemp:14,maxTemp:25,preferredDepthMin:2,preferredDepthMax:35,habitat:'mixte',seasons:[1,2,3,4,5,9,10,11,12]},
{key:'Loup',ar:'القاروص',fr:'Bar / Loup',minTemp:12,maxTemp:24,preferredDepthMin:1,preferredDepthMax:25,habitat:'mixte',seasons:[1,2,3,4,5,6,9,10,11,12]},
{key:'Sar',ar:'السار',fr:'Sar',minTemp:16,maxTemp:27,preferredDepthMin:3,preferredDepthMax:45,habitat:'roche',seasons:[3,4,5,6,7,8,9,10,11]},
{key:'Balistes',ar:'الحلوفة',fr:'Baliste',minTemp:18,maxTemp:29,preferredDepthMin:5,preferredDepthMax:80,habitat:'mixte',seasons:[5,6,7,8,9,10]}];
const clamp=(n:number,a=0,b=100)=>Math.max(a,Math.min(b,n));
const tempFit=(v:number,min:number,max:number)=>v>=min&&v<=max?100:(v<min-5||v>max+5?0:Math.round(100-Math.abs(v-(v<min?min:max))*20));
const depthFit=(v:number,min:number,max:number)=>v>=min&&v<=max?100:Math.max(0,100-Math.round((v<min?min-v:v-max)*8));
export function rankSpecies(input:{seaTemperature:number|null;depth:number|null;month:number;gradient:number|null;chlorophyll:number|null;waveHeight:number|null}):SpeciesSignal[]{
return PROFILES.map(p=>{const reasons:string[]=[];let score=35;
if(input.seaTemperature!=null){const f=tempFit(input.seaTemperature,p.minTemp,p.maxTemp);score+=Math.round((f-50)*.35);if(f>=80)reasons.push('حرارة مناسبة');else if(f<45)reasons.push('الحرارة خارج النطاق المفضل');}
if(input.depth!=null){const f=depthFit(input.depth,p.preferredDepthMin,p.preferredDepthMax);score+=Math.round((f-50)*.22);if(f>=80)reasons.push('العمق ضمن النطاق المفضل');else if(f<45)reasons.push('العمق بعيد عن النطاق المفضل');}
if(p.seasons.includes(input.month)){score+=10;reasons.push('الموسم ملائم');}else{score-=4;reasons.push('خارج أفضل فترة موسمية عامة');}
if(input.gradient!=null&&input.gradient>=.45){score+=7;reasons.push('يوجد انتقال حراري');}
if(input.chlorophyll!=null&&input.chlorophyll>=.2){score+=5;reasons.push('إشارة إنتاجية بحرية موجودة');}
if(input.waveHeight!=null&&input.waveHeight<=.8){score+=4;reasons.push('حالة البحر تساعد على الوصول');}
return {...p,score:Math.round(clamp(score)),reasons};}).sort((a,b)=>b.score-a.score).map(({key,ar,fr,score,reasons})=>({key,ar,fr,score,reasons}));}
export function rankFishingWindows(points:Array<{time:string;windSpeed:number|null;windGusts:number|null;waveHeight:number|null;wavePeriod:number|null;currentVelocity:number|null}>):FishingWindow[]{
const scored=points.map(p=>{let s=55;const reasons:string[]=[];
if(p.windSpeed!=null){if(p.windSpeed<=12){s+=18;reasons.push('رياح هادئة')}else if(p.windSpeed<=18){s+=10;reasons.push('رياح مقبولة')}else if(p.windSpeed>28){s-=25;reasons.push('رياح قوية')}}
if(p.windGusts!=null){if(p.windGusts<=20)s+=10;else if(p.windGusts>35){s-=22;reasons.push('هبات قوية')}}
if(p.waveHeight!=null){if(p.waveHeight<=.5)s+=12;else if(p.waveHeight<=.8)s+=7;else if(p.waveHeight>1.2){s-=25;reasons.push('موج مرتفع')}}
if(p.wavePeriod!=null&&p.wavePeriod>=9&&p.waveHeight!=null&&p.waveHeight>.7){s-=8;reasons.push('فترة موج طويلة')}
if(p.currentVelocity!=null&&p.currentVelocity>1.5){s-=8;reasons.push('تيار مرتفع')}
s=Math.round(clamp(s));const level=s>=82?'ممتاز':s>=65?'جيد':s>=45?'متوسط':'ضعيف';return {...p,score:s,level,reasons};});
const out:FishingWindow[]=[];for(let i=0;i<scored.length;i+=2){const a=scored[i],b=scored[i+1];if(!a)continue;out.push({start:a.time,end:b?.time??new Date(new Date(a.time).getTime()+3600000).toISOString(),score:a.score,level:a.level,reasons:a.reasons});}return out.sort((a,b)=>b.score-a.score).slice(0,4);}
export function calculateConfidence(input:{sst:boolean;chlorophyll:boolean;depth:boolean;current:boolean;hourly:boolean;weatherModels:boolean}):{score:number;reasons:string[]}{const weights:Array<[keyof typeof input,number,string]>=[['sst',20,'SST متوفر'],['chlorophyll',15,'Chlorophyll متوفر'],['depth',15,'العمق متوفر'],['current',15,'التيار متوفر'],['hourly',20,'التوقعات الساعية متوفرة'],['weatherModels',15,'مقارنة النماذج متوفرة']];let score=0;const reasons:string[]=[];for(const [k,w,l] of weights){if(input[k]){score+=w;reasons.push(l)}else reasons.push('غير متوفر: '+l)}return{score,reasons};}
export function tunisianProfile(lat:number,lng:number):string{if(lat>=37)return'الشمال التونسي — سواحل بنزرت/طبرقة';if(lat>=36.2)return'الساحل الشمالي الشرقي — تونس/الوطن القبلي';if(lat>=35.3)return'الساحل الشرقي — سوسة/المنستير/المهدية';if(lat>=34.4)return'الوسط والجنوب الشرقي — صفاقس/قابس';return'الجنوب التونسي — جرجيس/جربة';}
