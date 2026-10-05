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
  swellHeight?:number|null;
}): KayakAssessment {
  let score = 100;
  const reasons:string[] = [];
  const missing:string[] = [];

  // تقييم مخصص للكياك: الرياح والهبات والموج هي العوامل الأساسية.
  // الحدود ليست توقعاً للسلامة؛ هي طريقة محافظة لتصنيف ملاءمة الظروف.
  if (data.windSpeed == null) {
    score -= 30; missing.push('الرياح');
  } else if (data.windSpeed > 30) {
    score -= 55; reasons.push('الرياح قوية جداً للكياك');
  } else if (data.windSpeed > 25) {
    score -= 45; reasons.push('الرياح قوية للكياك');
  } else if (data.windSpeed > 20) {
    score -= 30; reasons.push('الرياح مرتفعة للكياك');
  } else if (data.windSpeed > 15) {
    score -= 15; reasons.push('الرياح متوسطة إلى مرتفعة');
  } else if (data.windSpeed > 10) {
    score -= 5; reasons.push('الرياح خفيفة إلى متوسطة');
  }

  if (data.windGusts == null) {
    score -= 20; missing.push('الهبات');
  } else if (data.windGusts > 40) {
    score -= 45; reasons.push('الهبات قوية جداً وقد تجعل التحكم بالكياك صعباً');
  } else if (data.windGusts > 35) {
    score -= 35; reasons.push('الهبات قوية للكياك');
  } else if (data.windGusts > 30) {
    score -= 25; reasons.push('الهبات مرتفعة وتحتاج حذراً');
  } else if (data.windGusts > 25) {
    score -= 20; reasons.push('الهبات مرتفعة نسبياً وتؤثر على التحكم');
  } else if (data.windGusts > 20) {
    score -= 8; reasons.push('توجد هبات ملحوظة');
  }

  if (data.waveHeight == null) {
    score -= 30; missing.push('الموج');
  } else if (data.waveHeight > 1.8) {
    score -= 50; reasons.push('ارتفاع الموج غير مناسب للكياك');
  } else if (data.waveHeight > 1.5) {
    score -= 40; reasons.push('ارتفاع الموج كبير للكياك');
  } else if (data.waveHeight > 1.0) {
    score -= 25; reasons.push('الموج مرتفع نسبياً للكياك');
  } else if (data.waveHeight > 0.6) {
    score -= 10; reasons.push('الموج متوسط');
  }

  if (data.wavePeriod == null) {
    missing.push('فترة الموج');
  } else if (data.wavePeriod >= 8 && (data.waveHeight ?? 0) > 0.8) {
    score -= 10;
    reasons.push('فترة الموج طويلة مع ارتفاع ملحوظ');
  }
  if (data.swellHeight != null && data.swellHeight > 1.0) {
    score -= data.swellHeight > 1.5 ? 20 : 10;
    reasons.push('الـSwell مرتفع ويزيد اضطراب البحر');
  }

  const dataComplete = missing.length === 0;
  if (missing.length) reasons.push(`بيانات غير مكتملة: ${missing.join('، ')}`);

  score = clamp(Math.round(score),0,100);

  // سقوف محافظة تمنع ظهور "ممتاز" عندما تكون الرياح/الهبات/الموج
  // قد أصبحت عامل خطر واضحاً للكياك حتى لو كانت بقية المؤشرات جيدة.
  if (data.windSpeed != null) {
    if (data.windSpeed > 30) score = Math.min(score, 44);
    else if (data.windSpeed > 25) score = Math.min(score, 59);
    else if (data.windSpeed > 20) score = Math.min(score, 64);
  }

  if (data.windGusts != null) {
    if (data.windGusts > 40) score = Math.min(score, 39);
    else if (data.windGusts > 35) score = Math.min(score, 49);
    else if (data.windGusts > 30) score = Math.min(score, 64);
    else if (data.windGusts > 25) score = Math.min(score, 79);
  }

  if (data.waveHeight != null) {
    if (data.waveHeight > 1.8) score = Math.min(score, 29);
    else if (data.waveHeight > 1.5) score = Math.min(score, 44);
    else if (data.waveHeight > 1.0) score = Math.min(score, 64);
  }

  // لا نسمح بتقييم "ممتاز/جيد" عندما تكون بيانات السلامة الأساسية ناقصة.
  if (!dataComplete) score = Math.min(score, 59);

  const level = score >= 80 ? 'ممتاز' : score >= 65 ? 'جيد' : score >= 45 ? 'حذر' : 'غير مناسب';

  const recommendation =
    level === 'ممتاز' ? 'الظروف تبدو ملائمة للكياك وفق البيانات المتاحة. راقب تغير الرياح والموج قبل الانطلاق.' :
    level === 'جيد' ? 'الظروف قد تكون مناسبة، لكن راقب الرياح والهبات والموج وأعد التحقق قبل الانطلاق.' :
    level === 'حذر' ? 'ينصح بالحذر. افحص تغير الظروف واختَر مساراً قريباً من الشاطئ إذا قررت الخروج.' :
    'الظروف الحالية غير ملائمة للكياك وفق البيانات المتاحة. يفضّل تأجيل الرحلة وإعادة التحقق لاحقاً.';

  if (!reasons.length) reasons.push('الرياح والهبات والموج ضمن الحدود الهادئة في البيانات المتاحة');

  return {score, level, reasons, recommendation, dataComplete};
}
