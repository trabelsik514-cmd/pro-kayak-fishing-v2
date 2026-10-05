export type KayakAssessment = {
  score: number;
  level: 'ممتاز'|'جيد'|'حذر'|'غير مناسب';
  reasons: string[];
};

const clamp = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));

export function assessKayakConditions(data: {
  windSpeed:number|null; windGusts:number|null; waveHeight:number|null; wavePeriod:number|null;
}): KayakAssessment {
  let score = 100;
  const reasons:string[] = [];
  const wind = data.windSpeed ?? 999;
  const gust = data.windGusts ?? 999;
  const wave = data.waveHeight ?? 999;
  const period = data.wavePeriod ?? 0;

  if (data.windSpeed == null) { score -= 25; reasons.push('بيانات الرياح غير متوفرة بالكامل'); }
  else if (wind > 25) { score -= 45; reasons.push('الرياح قوية للكياك'); }
  else if (wind > 18) { score -= 25; reasons.push('الرياح مرتفعة'); }
  else if (wind > 12) { score -= 10; reasons.push('رياح متوسطة'); }

  if (data.windGusts == null) { score -= 15; reasons.push('بيانات الهبات غير متوفرة'); }
  else if (gust > 35) { score -= 30; reasons.push('الهبات قوية'); }
  else if (gust > 25) { score -= 15; reasons.push('الهبات قد تؤثر على التحكم'); }

  if (data.waveHeight == null) { score -= 25; reasons.push('بيانات الموج غير متوفرة بالكامل'); }
  else if (wave > 1.5) { score -= 40; reasons.push('ارتفاع الموج كبير للكياك'); }
  else if (wave > 1.0) { score -= 25; reasons.push('الموج مرتفع نسبياً'); }
  else if (wave > 0.6) { score -= 10; reasons.push('الموج متوسط'); }

  if (data.wavePeriod != null && period >= 8 && wave > 0.8) {
    score -= 10;
    reasons.push('فترة الموج طويلة مع ارتفاع ملحوظ');
  }

  score = clamp(Math.round(score),0,100);
  const level = score >= 80 ? 'ممتاز' : score >= 65 ? 'جيد' : score >= 45 ? 'حذر' : 'غير مناسب';
  if (!reasons.length) reasons.push('الرياح والموج ضمن الحدود الهادئة في البيانات المتاحة');
  return {score,level,reasons};
}