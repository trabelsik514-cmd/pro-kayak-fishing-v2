export type KayakAssessment = {
  score: number;
  level: 'ممتاز'|'جيد'|'حذر'|'غير مناسب';
  reasons: string[];
  recommendation: string;
  dataComplete: boolean;
};

const clamp = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));

export function assessKayakConditions(data: {
  windSpeed:number|null;
  windGusts:number|null;
  waveHeight:number|null;
  wavePeriod:number|null;
}): KayakAssessment {
  let score = 100;
  const reasons:string[] = [];
  const missing:string[] = [];

  if (data.windSpeed == null) {
    score -= 30; missing.push('الرياح');
  } else if (data.windSpeed > 30) {
    score -= 55; reasons.push('الرياح قوية جداً للكياك');
  } else if (data.windSpeed > 25) {
    score -= 45; reasons.push('الرياح قوية للكياك');
  } else if (data.windSpeed > 18) {
    score -= 25; reasons.push('الرياح مرتفعة');
  } else if (data.windSpeed > 12) {
    score -= 10; reasons.push('رياح متوسطة');
  }

  if (data.windGusts == null) {
    score -= 20; missing.push('الهبات');
  } else if (data.windGusts > 40) {
    score -= 35; reasons.push('الهبات قوية جداً');
  } else if (data.windGusts > 35) {
    score -= 30; reasons.push('الهبات قوية');
  } else if (data.windGusts > 25) {
    score -= 15; reasons.push('الهبات قد تؤثر على التحكم');
  }

  if (data.waveHeight == null) {
    score -= 30; missing.push('الموج');
  } else if (data.waveHeight > 1.8) {
    score -= 50; reasons.push('ارتفاع الموج غير مناسب للكياك');
  } else if (data.waveHeight > 1.5) {
    score -= 40; reasons.push('ارتفاع الموج كبير للكياك');
  } else if (data.waveHeight > 1.0) {
    score -= 25; reasons.push('الموج مرتفع نسبياً');
  } else if (data.waveHeight > 0.6) {
    score -= 10; reasons.push('الموج متوسط');
  }

  if (data.wavePeriod == null) {
    missing.push('فترة الموج');
  } else if (data.wavePeriod >= 8 && (data.waveHeight ?? 0) > 0.8) {
    score -= 10;
    reasons.push('فترة الموج طويلة مع ارتفاع ملحوظ');
  }

  const dataComplete = missing.length === 0;
  if (missing.length) reasons.push(`بيانات غير مكتملة: ${missing.join('، ')}`);

  score = clamp(Math.round(score),0,100);

  // لا نسمح بتقييم "ممتاز/جيد" عندما تكون بيانات السلامة الأساسية ناقصة.
  if (!dataComplete) score = Math.min(score, 59);

  const level = score >= 80 ? 'ممتاز' : score >= 65 ? 'جيد' : score >= 45 ? 'حذر' : 'غير مناسب';

  const recommendation =
    level === 'ممتاز' ? 'الظروف تبدو ملائمة للكياك وفق البيانات المتاحة. راقب تغير الرياح والموج قبل الانطلاق.' :
    level === 'جيد' ? 'يمكن أن تكون الظروف مناسبة، مع متابعة الهبات والموج وإعادة التحقق قبل الانطلاق.' :
    level === 'حذر' ? 'ينصح بالحذر. افحص تغير الظروف واختَر مساراً قريباً من الشاطئ إذا قررت الخروج.' :
    'الظروف الحالية غير ملائمة للكياك وفق البيانات المتاحة. يفضّل تأجيل الرحلة وإعادة التحقق لاحقاً.';

  if (!reasons.length) reasons.push('الرياح والموج ضمن الحدود الهادئة في البيانات المتاحة');

  return {score, level, reasons, recommendation, dataComplete};
}