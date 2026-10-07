import maplibregl from 'maplibre-gl';
import { MarineService, type HourlyKayakPoint, type WeeklySeaSummary, type WeatherModelComparisonDay } from '../marine/MarineService';
import { GeocodingService, reverseCoastalName } from '../location/GeocodingService';
import { createMap } from '../map/createMap';
import { assessKayakConditions } from '../kayak/KayakAssessment';
import { loadTrips, saveTrip, deleteTrip, makeTrip, type KayakTrip, type TrackPoint } from '../trips/TripStore';
import { getBathymetryDepth } from '../bathymetry/BathymetryService';
import { initSeaNotifications, saveBackgroundLocation } from '../notifications/SeaNotificationService';
import { getDeviceLocation, watchDeviceLocation, clearDeviceLocationWatch } from '../location/DeviceLocationService';

const value = (v: number|null, unit = '') => v == null ? '—' : `${v.toFixed(1)}${unit}`;
const directionValue = (direction: number|null, speed: number|null) => direction == null || speed == null || speed < 0.1 ? '—' : `${direction.toFixed(1)}°`;
const escapeHtml = (v: string) => v.replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch] ?? ch));
const ltr = (v: string) => `<span dir="ltr">${v}</span>`;

type UiLang = 'ar' | 'fr';
const getLang = (): UiLang => localStorage.getItem('pkf-lang') === 'fr' ? 'fr' : 'ar';

const FR: Record<string,string> = {
  'ابحث عن مدينة أو ساحل تونسي':'Rechercher une ville ou une côte tunisienne',
  'إغلاق':'Fermer',
  'قياس المسافة':'Mesurer la distance',
  'إيقاف القياس':'Arrêter la mesure',
  'المسافة':'Distance',
  'عرض المسار':'Voir le parcours',
  'حذف':'Supprimer',
  'بدء تسجيل رحلة':'Démarrer une sortie',
  'موقع بحري محدد':'Position maritime sélectionnée',
  'كم':'km',
  'د':'min',
  'نقطة':'points',
  'بحث':'Rechercher',
  'العربية':'Français',
  'حالة البحر اليوم':"État de la mer aujourd'hui",
  'حالة الطقس اليوم':"Météo aujourd'hui",
  'جاري جلب طقس اليوم…':"Chargement de la météo du jour…",
  'تعذر جلب طقس اليوم':"Impossible de récupérer la météo du jour",
  'الحرارة':'Température',
  'احتمال الأمطار':'Probabilité de pluie',
  'الرطوبة':'Humidité',
  'الشروق':'Lever',
  'الغروب':'Coucher',
  'توقعات اليوم حسب الموقع المحدد':"Prévisions du jour selon la position sélectionnée",
  'صافي':'Dégagé',
  'غائم جزئياً':'Partiellement nuageux',
  'ضباب':'Brouillard',
  'رذاذ':'Bruine',
  'أمطار':'Pluie',
  'ثلوج':'Neige',
  'عواصف رعدية':'Orages',
  'متغير':'Variable',
  'حالة البحر 7 أيام':'État de la mer — 7 jours',
  'مقارنة النماذج':'Comparaison des modèles',
  'توافق النماذج':'Accord des modèles',
  'فرق الرياح':'Écart du vent',
  'متوسط التيار':'Courant moyen',
  'أقصى تيار':'Courant maximal',
  'اتجاه التيار':'Direction du courant',
  'بيانات غير متاحة':'Données indisponibles',

  'الأسبوع القادم':'7 prochains jours',
  'جاري حساب توقعات الأسبوع…':'Calcul des prévisions sur 7 jours…',
  'تعذر جلب توقعات الأسبوع':"Impossible de récupérer les prévisions sur 7 jours",
  'لا توجد بيانات أسبوعية متاحة':'Aucune donnée hebdomadaire disponible',
  'اليوم':'Aujourd’hui',
  'غداً':'Demain',
  'بعد غد':'Après-demain',
  'التقييم':'Évaluation',
  'أقصى موج':'Hauteur max.',
  'أقصى رياح':'Vent max.',
  'أقصى هبات':'Rafales max.',
  'اتجاه الموج السائد':'Direction dominante',

  'أفضل نافذة للرحلة':'Meilleure fenêtre pour la sortie',
  'ملاءمة ظروف الكياك':'Adéquation des conditions du kayak',
  'تقييم تخطيطي مبني على بيانات الطقس والبحر المتاحة، وليس ضماناً لسلامة الرحلة.':'Évaluation indicative basée sur les données météo et marines disponibles ; elle ne constitue pas une garantie de sécurité.',
  'الموج اليوم':"Vagues aujourd'hui",
  'Swell اليوم':"Swell aujourd'hui",
  'الرياح اليوم':"Vent aujourd'hui",
  'الهبات اليوم':"Rafales aujourd'hui",
  'متوسط ملاءمة النافذة':'Adéquation moyenne de la fenêtre',
  'بعض بيانات الساعات غير مكتملة':'Certaines données horaires sont incomplètes',

  '📏 قياس المسافة':'📏 Mesurer la distance',
  '✖️ إيقاف القياس':'✖️ Arrêter la mesure',
  '🛶 رحلاتي':'🛶 Mes voyages',
  '🛶 سجل الرحلات':'🛶 Journal des sorties',
  'سجل الرحلات':'Journal des sorties',
  'لا توجد رحلة قيد التسجيل':'Aucune sortie en cours',
  'ابدأ التسجيل لتتبع مسار الكاياك عبر GPS.':'Commencez l’enregistrement pour suivre le parcours du kayak via GPS.',
  '▶️ بدء تسجيل رحلة':'▶️ Démarrer une sortie',
  'حالة البحر':'État de la mer',
  'الطقس اليوم':'Météo aujourd’hui',
  'اضغط على أي نقطة للحصول على قراءة مستقلة للطقس والبحر.':'Touchez un point pour obtenir les conditions météo et marines de cette position.',
  'اضغط نقطة في البحر ثم نقطة ثانية على الشاطئ أو أي موقع آخر.':'Touchez un point en mer puis un second point sur la côte ou ailleurs.',
  'تم تحديد النقطة الأولى. اختر النقطة الثانية.':'Premier point sélectionné. Choisissez le second.',
  'إلغاء':'Annuler',
  '📏 المسافة':'📏 Distance',
  'تم القياس بين النقطتين المحددتين.':'Distance mesurée entre les deux points.',
  'قياس جديد':'Nouvelle mesure',
  'لا توجد رحلات محفوظة بعد.':'Aucune sortie enregistrée.',
  '🗺️ عرض المسار':'🗺️ Voir le parcours',
  'إخفاء المسار':'Masquer le parcours',
  'المسار المعروض':'Parcours affiché',
  '🗑️ حذف':'🗑️ Supprimer',
  'حالة البحر عند النقطة':'État de la mer au point',
  'جاري جلب آخر البيانات…':'Chargement des dernières données…',
  'جاري حساب ملخص اليوم…':'Calcul du résumé du jour…',
  'تعذر جلب البيانات':'Impossible de récupérer les données',
  'تم تحديد النقطة، لكن مصادر البيانات لم تستجب الآن.':'Point sélectionné, mais les sources de données ne répondent pas pour le moment.',
  'حالة البحر اليوم عند النقطة':"État de la mer aujourd'hui au point",
  'تعذر جلب ملخص اليوم':"Impossible de récupérer le résumé du jour",
  'حاول مرة أخرى بعد قليل.':'Réessayez dans quelques instants.',
  'لم يتم العثور على موقع تونسي مطابق.':'Aucun lieu tunisien correspondant trouvé.',
  'جاري البحث…':'Recherche…',
  'تعذر الاتصال بخدمة البحث. حاول مرة أخرى.':'Impossible de joindre le service de recherche. Réessayez.',
  'الموج':'Vagues',
  'ارتفاع الموج الآن':'Hauteur des vagues maintenant',
  'أقصى ارتفاع للموج اليوم':'Hauteur maximale des vagues aujourd’hui',
  'أقصى Swell اليوم':'Swell maximal aujourd’hui',
  'قد يرتفع الموج خلال اليوم':'La hauteur des vagues peut augmenter aujourd’hui',
  'اتجاه الموج':'Direction des vagues',
  'فترة الموج':'Période des vagues',
  'Swell':'Swell',
  'الرياح':'Vent',
  'الهبات':'Rafales',
  'اتجاه الرياح':'Direction du vent',
  'مرور الرياح':'Flux du vent',
  'إيقاف مرور الرياح':'Désactiver le flux du vent',
  'قادمة من':'Vient de',
  'متجهة إلى':'Se dirige vers',
  'سرعة الرياح':'Vitesse du vent',
  'تحديث الرياح':'Actualiser le vent',
  'الهواء':'Air',
  'حرارة البحر':'Température de la mer',
  'الضغط':'Pression',
  'التيار':'Courant',
  'العمق التقريبي':'Profondeur approximative',
  'غير متاح':'Indisponible',
  'لا توجد قراءة متاحة':'Aucune lecture disponible',
  'المصدر:':'Source :',
  'آخر جلب:':'Dernière mise à jour :',
  'الموقع:':'Position :',
  'أقصى فترة موج':'Période maximale des vagues',
  'أقصى Swell':'Swell maximal',
  'العمق':'Profondeur',
  'التقريبي':'approximative',
  'تقييم ظروف الكياك':'Évaluation des conditions du kayak',
  'ممتاز':'Excellent',
  'جيد':'Bon',
  'حذر':'Prudence',
  'غير مناسب':'Déconseillé',
  'الرياح قوية جداً للكياك':'Le vent est très fort pour le kayak',
  'الرياح قوية للكياك':'Le vent est fort pour le kayak',
  'الرياح مرتفعة للكياك':'Le vent est élevé pour le kayak',
  'الرياح متوسطة إلى مرتفعة':'Le vent est modéré à fort',
  'الرياح خفيفة إلى متوسطة':'Le vent est faible à modéré',
  'الهبات قوية جداً وقد تجعل التحكم بالكياك صعباً':'Les rafales sont très fortes et peuvent rendre le kayak difficile à contrôler',
  'الهبات قوية للكياك':'Les rafales sont fortes pour le kayak',
  'الهبات مرتفعة وتحتاج حذراً':'Les rafales sont élevées et demandent de la prudence',
  'الهبات مرتفعة نسبياً وتؤثر على التحكم':'Les rafales sont assez élevées et affectent le contrôle',
  'توجد هبات ملحوظة':'Des rafales notables sont présentes',
  'ارتفاع الموج غير مناسب للكياك':'La hauteur des vagues est inadaptée au kayak',
  'ارتفاع الموج كبير للكياك':'La hauteur des vagues est élevée pour le kayak',
  'الموج مرتفع نسبياً للكياك':'Les vagues sont relativement élevées pour le kayak',
  'الموج متوسط':'Les vagues sont modérées',
  'فترة الموج طويلة مع ارتفاع ملحوظ':'La période des vagues est longue avec une hauteur notable',
  'الرياح والهبات والموج ضمن الحدود الهادئة في البيانات المتاحة':'Le vent, les rafales et les vagues restent dans des niveaux calmes selon les données disponibles',
  'بيانات غير مكتملة':'Données incomplètes',
  'هذا تقييم آلي مبني على بيانات الطقس والبحر المتاحة، وليس ضماناً لسلامة الرحلة.':"Évaluation automatique basée sur les données météo et marines disponibles ; elle ne garantit pas la sécurité de la sortie.",
  'الظروف تبدو ملائمة للكياك وفق البيانات المتاحة. راقب تغير الرياح والموج قبل الانطلاق.':'Les conditions semblent adaptées au kayak selon les données disponibles. Surveillez l’évolution du vent et des vagues avant de partir.',
  'الظروف قد تكون مناسبة، لكن راقب الرياح والهبات والموج وأعد التحقق قبل الانطلاق.':'Les conditions peuvent être favorables, mais surveillez le vent, les rafales et les vagues avant le départ.',
  'ينصح بالحذر. افحص تغير الظروف واختَر مساراً قريباً من الشاطئ إذا قررت الخروج.':'La prudence est recommandée. Vérifiez l’évolution des conditions et restez près de la côte si vous sortez.',
  'الظروف الحالية غير ملائمة للكياك وفق البيانات المتاحة. يفضّل تأجيل الرحلة وإعادة التحقق لاحقاً.':'Les conditions actuelles sont défavorables au kayak selon les données disponibles. Il est préférable de reporter la sortie et de vérifier plus tard.'
};

const FR_KI: Record<string,string> = {
  'ارتفاع الـSwell':'Hauteur du swell',
  'فترة الـSwell':'Période du swell',
  'التفسير':'Analyse',
  'القرار':'Décision',
};
const t = (ar: string) => getLang() === 'fr' ? (FR_KI[ar] ?? FR[ar] ?? ar) : ar;
const translateReason = (reason: string) => {
  if (getLang() !== 'fr') return reason;
  if (reason.startsWith('بيانات غير مكتملة:')) {
    return `${t('بيانات غير مكتملة')}: ${reason.replace('بيانات غير مكتملة:', '').trim().split('، ').map(t).join(', ')}`;
  }
  return t(reason);
};
const translateLevel = (level: string) => t(level);
const locale = () => getLang() === 'fr' ? 'fr-TN' : 'ar-TN';

function bestKayakWindow(points:HourlyKayakPoint[], hours=3){ const rows=points.map(p=>({p,a:assessKayakConditions({windSpeed:p.windSpeed,windGusts:p.windGusts,waveHeight:p.waveHeight,wavePeriod:p.wavePeriod,swellHeight:p.swellHeight,currentVelocity:p.currentVelocity})})); let best:any=null; for(let i=0;i<=rows.length-hours;i++){const w=rows.slice(i,i+hours); const score=Math.round(w.reduce((n,x)=>n+x.a.score,0)/w.length); const blocked=w.some(x=>x.a.level==='غير مناسب'); const effective=blocked?Math.max(0,score-20):score; if(!best||effective>best.score){const start=w[0].p.time; const end=new Date(new Date(w[w.length-1].p.time).getTime()+60*60*1000).toISOString(); best={score:effective,start,end,complete:w.every(x=>x.a.dataComplete)};}} return best;}

function setDocumentLanguage() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}


function reportHtml(data: Awaited<ReturnType<MarineService['getPointConditions']>>, placeName: string|null) {
  return `<div class="report-head"><b>${t('حالة البحر عند النقطة')}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div>
    <p class="report-place">📍 ${escapeHtml(placeName ?? t('موقع بحري محدد'))}</p><p class="coords">${ltr(`${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`)}</p>
    <div class="report-grid">
      <span>🌊 ${t('ارتفاع الموج الآن')} <b>${value(data.sea.waveHeight,' m')}</b></span><span>🧭 ${t('اتجاه الموج')} <b>${value(data.sea.waveDirection,'°')}</b></span>
      <span>📈 ${t('أقصى ارتفاع للموج اليوم')} <b>${value(data.sea.maxWaveHeightToday,' m')}</b></span>
      <span>〰️ ${t('Swell')} <b>${value(data.sea.swellHeight,' m')}</b></span><span>📈 ${t('أقصى Swell اليوم')} <b>${value(data.sea.maxSwellHeightToday,' m')}</b></span><span>⏱️ ${t('فترة الموج')} <b>${value(data.sea.wavePeriod,' s')}</b></span>
      <span>💨 ${t('الرياح')} <b>${value(data.weather.windSpeed,' km/h')}</b></span><span>💨 ${t('الهبات')} <b>${value(data.weather.windGusts,' km/h')}</b></span>
      <span>🧭 ${t('اتجاه الرياح')} <b>${value(data.weather.windDirection,'°')}</b></span><span>🌡️ ${t('الهواء')} <b>${value(data.weather.temperature,' °C')}</b></span>
      <span>🌊 ${t('حرارة البحر')} <b>${value(data.sea.seaTemperature,' °C')}</b></span><span>📈 ${t('الضغط')} <b>${value(data.weather.pressure,' hPa')}</b></span>
      <span>🌊 ${t('التيار')} <b>${value(data.sea.currentVelocity,' km/h')}</b></span><span>🧭 ${t('اتجاه التيار')} <b>${directionValue(data.sea.currentDirection,data.sea.currentVelocity)}</b></span>
    </div><small class="report-updated">${t('آخر جلب:')} ${new Date(data.fetchedAt).toLocaleTimeString(locale())}</small>`;
}

export function createApp(root: HTMLElement) {
  setDocumentLanguage();
  void initSeaNotifications();
  root.innerHTML = `<main class="shell"><header class="topbar"><a class="brand" href="#" aria-label="PRO KAYAK FISHING V2"><img class="brand-logo" src="/brand/file_00000000540c820abaeb6846e360276e.png?v=20261005-2238" alt="PRO KAYAK FISHING V2"/></a>
    <button id="lang-toggle" class="lang-toggle" type="button">🌐 ${getLang() === 'ar' ? 'FR' : 'العربية'}</button>
    <form id="search-form" class="search"><input id="search-input" placeholder="${t('ابحث عن مدينة أو ساحل تونسي')}" autocomplete="off"/><button type="submit">${t('بحث')}</button></form></header>
    <section id="map" class="map"></section>
    <nav class="map-actions" aria-label="أدوات الخريطة">
      <div class="map-action-group">
        <span class="map-action-label">${t('البحر والرحلات')}</span>
        <div class="map-action-row">
          <button id="today-sea" class="map-action map-action-sea" type="button" aria-label="${t('حالة الطقس اليوم')}">🌤️ <span>${t('الطقس اليوم')}</span></button>
          <button id="weekly-sea" class="map-action map-action-weekly-sea" type="button" aria-label="${t('حالة البحر 7 أيام')}">📅 <span>7 ${getLang()==='fr'?'jours':'أيام'}</span></button>
          <button id="measure-toggle" class="map-action map-action-measure" type="button" aria-label="${t('قياس المسافة')}">📏 <span>${t('قياس')}</span></button>
          <button id="trip-toggle" class="map-action map-action-trip" type="button" aria-label="${t('رحلاتي')}">🛶 <span>${t('رحلاتي')}</span></button>
          <button id="kayak-intelligence-toggle" class="map-action map-action-intelligence" type="button" aria-label="${getLang()==='fr'?'Kayak Intelligence':'ذكاء الكياك'}">🧠 <span>${getLang()==='fr'?'Intelligence':'ذكاء الكياك'}</span></button>
        </div>
      </div>
    </nav>
    <div class="pkf-map-toolbar" aria-label="${getLang()==='fr'?'Outils de navigation':'أدوات الملاحة'}">
      <button id="pkf-gps" class="pkf-tool pkf-tool-gps" type="button" title="${getLang()==='fr'?'Ma position':'موقعي'}" aria-label="${getLang()==='fr'?'Ma position':'موقعي'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path></svg>
        <span class="pkf-tool-label">${getLang()==='fr'?'Position':'موقعي'}</span>
      </button>
      <button id="pkf-layers" class="pkf-tool" type="button" title="${getLang()==='fr'?'Couches':'الطبقات'}" aria-label="${getLang()==='fr'?'Couches':'الطبقات'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"></path><path d="m4 12 8 4 8-4"></path><path d="m4 16 8 4 8-4"></path></svg>
        <span class="pkf-tool-label">${getLang()==='fr'?'Couches':'الطبقات'}</span>
      </button>
      <button id="pkf-wind" class="pkf-tool pkf-tool-wind" type="button" title="${getLang()==='fr'?'Vent':'الرياح'}" aria-label="${getLang()==='fr'?'Vent':'الرياح'}">
        <span aria-hidden="true">🌬️</span>
        <span class="pkf-tool-label">${getLang()==='fr'?'Vent':'الرياح'}</span>
      </button>
      <button id="pkf-measure" class="pkf-tool" type="button" title="${t('قياس المسافة')}" aria-label="${t('قياس المسافة')}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16 16 4l4 4L8 20H4v-4Z"></path><path d="m8 16 2 2M11 13l2 2M14 10l2 2"></path></svg>
        <span class="pkf-tool-label">${getLang()==='fr'?'Mesurer':'قياس'}</span>
      </button>
      <button id="pkf-trip" class="pkf-tool pkf-tool-route" type="button" title="${t('رحلاتي')}" aria-label="${t('رحلاتي')}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19c5-1 7-8 12-8h4"></path><path d="m16 7 4 4-4 4"></path><circle cx="5" cy="19" r="1.5"></circle></svg>
        <span class="pkf-tool-label">${getLang()==='fr'?'Sorties':'رحلاتي'}</span>
      </button>
    </div>
    <aside id="pkf-layer-panel" class="pkf-layer-panel hidden">
      <div class="pkf-layer-head"><b>◈ ${getLang()==='fr'?'Couches':'الطبقات'}</b><button id="pkf-layer-close" type="button" aria-label="${t('إغلاق')}">×</button></div>
      <label class="pkf-layer-row"><span>🛰️ ${getLang()==='fr'?'Satellite':'الأقمار الصناعية'}</span><input id="pkf-satellite-toggle" type="checkbox" checked></label>
      <label class="pkf-layer-row"><span>🌬️ ${t('مرور الرياح')}</span><input id="pkf-wind-toggle" type="checkbox"></label>
      <label class="pkf-layer-row"><span>🧭 ${getLang()==='fr'?'Carte marine':'الخريطة البحرية'}</span><input id="pkf-nautical-toggle" type="checkbox"></label>
      <div class="pkf-layer-note">${getLang()==='fr'?'Mode nautique: bathymétrie EMODnet et courbes de profondeur. Les cartes Navionics officielles nécessitent une licence/API Garmin.':'وضع الملاحة البحرية: أعماق EMODnet وخطوط الأعماق. خرائط Navionics الرسمية تحتاج ترخيصاً ومفتاح API من Garmin.'}</div>
    </aside>
    <nav class="pkf-bottom-nav" aria-label="${getLang()==='fr'?'Navigation principale':'التنقل الرئيسي'}">
      <button id="pkf-nav-map" type="button" class="active">
        <span class="pkf-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z"></path><path d="M9 4v13.5M15 6.5V20"></path></svg></span>
        <b>${getLang()==='fr'?'Carte':'الخريطة'}</b>
      </button>
      <button id="pkf-nav-sea" type="button">
        <span class="pkf-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path><circle cx="12" cy="12" r="4"></circle></svg></span>
        <b>${getLang()==='fr'?'Météo':'الطقس'}</b>
      </button>
      <button id="pkf-nav-fish" type="button">
        <span class="pkf-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12c3.2-4.5 7.3-6.2 12.2-5 2.2.6 4.1 2 5.8 5-1.7 3-3.6 4.4-5.8 5C10.3 18.2 6.2 16.5 3 12Z"></path><path d="M21 12 24 9v6l-3-3Z"></path><circle cx="15" cy="10.2" r="1.05"></circle><path d="M8 16.2 5.8 19"></path></svg></span>
        <b>${getLang()==='fr'?'Pêche':'الصيد'}</b>
      </button>
      <button id="pkf-nav-report" type="button">
        <span class="pkf-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Z"></path><path d="M9 11h6M9 15h6M9 7h3"></path></svg></span>
        <b>${getLang()==='fr'?'Rapport':'التقرير'}</b>
      </button>
    </nav>
    <aside class="measure-panel hidden" id="measure-panel"></aside>
    <aside class="trip-panel hidden" id="trip-panel">
      <div class="trip-head"><b><span class="trip-head-icon">↗</span> ${t('سجل الرحلات')}</b><button id="close-trips" aria-label="${t('إغلاق')}">×</button></div>
      <div id="trip-status" class="trip-idle"><b>${t('لا توجد رحلة قيد التسجيل')}</b><span>${t('ابدأ التسجيل لتتبع مسار الكاياك عبر GPS.')}</span></div>
      <button id="trip-record" class="trip-primary"><span aria-hidden="true">●</span> ${t('بدء تسجيل رحلة')}</button>
      <div id="trip-list" class="trip-list"></div>
    </aside>
    <aside class="route-view hidden" id="route-view" aria-live="polite"></aside>
    <aside class="report" id="report"><div class="report-head"><b>${t('حالة البحر')}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div>
    <p>${t('اضغط على أي نقطة للحصول على قراءة مستقلة للطقس والبحر.')}</p></aside><div class="search-results hidden" id="search-results"></div></main>`;

  if (!sessionStorage.getItem('pkf-v2-splash-seen')) {
    const splash = document.createElement('div');
    splash.className = 'brand-splash';
    splash.innerHTML = '<div class="brand-splash-card"><img src="/brand/file_00000000540c820abaeb6846e360276e.png?v=20261005-2238" alt="PRO KAYAK FISHING V2"/></div>';
    root.appendChild(splash);
    sessionStorage.setItem('pkf-v2-splash-seen', '1');
    window.setTimeout(() => splash.classList.add('brand-splash-hide'), 1600);
    window.setTimeout(() => splash.remove(), 2200);
  }

  root.querySelector<HTMLButtonElement>('#lang-toggle')?.addEventListener('click', () => {
    localStorage.setItem('pkf-lang', getLang() === 'ar' ? 'fr' : 'ar');
    createApp(root);
  });


  const { map, geolocate } = createMap('map'); const marine = new MarineService(); const geocoder = new GeocodingService();

  // Professional map controls are presentation shortcuts over existing features.
  const layerPanel = document.querySelector<HTMLElement>('#pkf-layer-panel')!;
  // Wind-flow layer: shows the latest wind speed, the direction the wind comes FROM,
  // and the direction it is MOVING TO. Open-Meteo wind direction follows the
  // meteorological convention (direction of origin), so the flow arrow is +180°.
  const windMarkers: maplibregl.Marker[] = [];
  let windFlowEnabled = false;
  let windFlowRequestId = 0;
  let windFlowTimer: number | null = null;
  let windFlowLegend: HTMLElement | null = null;

  const cardinal = (degrees:number|null) => {
    if (degrees == null || !Number.isFinite(degrees)) return '—';
    const dirs = getLang() === 'fr'
      ? ['N','NE','E','SE','S','SO','O','NO']
      : ['شمال','شمال شرق','شرق','جنوب شرق','جنوب','جنوب غرب','غرب','شمال غرب'];
    return dirs[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
  };

  const clearWindFlow = () => {
    windFlowRequestId += 1;
    windMarkers.splice(0).forEach(m => m.remove());
    windFlowLegend?.remove();
    windFlowLegend = null;
  };

  const ensureWindLegend = () => {
    if (windFlowLegend) return windFlowLegend;
    const el = document.createElement('div');
    el.className = 'pkf-wind-legend';
    shell.appendChild(el);
    windFlowLegend = el;
    return el;
  };

  const updateWindLegend = (speed:number|null, from:number|null) => {
    const el = ensureWindLegend();
    const to = from == null ? null : (from + 180) % 360;
    const speedText = speed == null ? '—' : speed.toFixed(1) + ' km/h';
    el.innerHTML = '<div class="pkf-wind-legend-head"><span>🌬️ '+t('مرور الرياح')+'</span><button type="button" id="pkf-wind-refresh" title="'+t('تحديث الرياح')+'">↻</button></div>' +
      '<div class="pkf-wind-legend-flow"><b>'+t('قادمة من')+'</b><strong>'+cardinal(from)+'</strong><span>→</span><b>'+t('متجهة إلى')+'</b><strong>'+cardinal(to)+'</strong></div>' +
      '<small>💨 '+t('سرعة الرياح')+': '+speedText+' · '+new Date().toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit',hour12:false})+'</small>';
    el.querySelector<HTMLButtonElement>('#pkf-wind-refresh')?.addEventListener('click', () => { void refreshWindFlow(); });
  };

  const refreshWindFlow = async () => {
    if (!windFlowEnabled) return;
    const requestId = ++windFlowRequestId;
    try {
      const bounds = map.getBounds();
      const west = Math.max(7.0, bounds.getWest());
      const east = Math.min(12.5, bounds.getEast());
      const south = Math.max(30.0, bounds.getSouth());
      const north = Math.min(38.5, bounds.getNorth());
      if (east <= west || north <= south) return;

      const cols = 4;
      const rows = 4;
      const points:{lat:number;lng:number}[] = [];
      for (let r=0;r<rows;r++) {
        const lat = south + (north-south)*(r/(rows-1));
        for (let col=0;col<cols;col++) {
          const lng = west + (east-west)*(col/(cols-1));
          points.push({lat,lng});
        }
      }

      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', points.map(p=>p.lat.toFixed(3)).join(','));
      url.searchParams.set('longitude', points.map(p=>p.lng.toFixed(3)).join(','));
      url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m');
      url.searchParams.set('wind_speed_unit', 'kmh');
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('cell_selection', 'nearest');
      const response = await fetch(url,{cache:'no-store'});
      if (!response.ok) throw new Error('wind_http_'+response.status);
      const payload = await response.json();
      if (requestId !== windFlowRequestId || !windFlowEnabled) return;

      clearWindFlow();
      windFlowEnabled = true;
      const locations = Array.isArray(payload) ? payload : [payload];
      let legendSpeed:number|null = null;
      let legendFrom:number|null = null;

      locations.forEach((location:any,index:number)=>{
        const current=location?.current;
        const speed=Number(current?.wind_speed_10m), from=Number(current?.wind_direction_10m);
        if(!Number.isFinite(speed)||!Number.isFinite(from)||!points[index]) return;
        if(legendSpeed == null || speed > legendSpeed) { legendSpeed = speed; legendFrom = from; }
        const to=(from+180)%360;
        const el=document.createElement('div');
        el.className='pkf-wind-arrow';
        el.setAttribute('aria-hidden','true');
        el.style.setProperty('--wind-opacity',(0.48+Math.max(0,Math.min(1,speed/45))*0.42).toFixed(2));
        el.innerHTML='<svg viewBox="0 0 44 44" focusable="false"><path class="pkf-wind-tail" d="M22 37V13"></path><path class="pkf-wind-head" d="M11 24 22 9l11 15"></path></svg>';
        const marker=new maplibregl.Marker({element:el,anchor:'center',rotation:to,rotationAlignment:'map',pitchAlignment:'map',subpixelPositioning:true})
          .setLngLat([points[index].lng,points[index].lat])
          .addTo(map);
        windMarkers.push(marker);
      });
      updateWindLegend(legendSpeed,legendFrom);
    } catch (error) {
      console.warn('PKF wind flow refresh failed',error);
      if (requestId === windFlowRequestId && windFlowEnabled) {
        updateWindLegend(null,null);
      }
    }
  };

  const setWindFlow = (enabled:boolean) => {
    windFlowEnabled = enabled;
    const toggle = document.querySelector<HTMLInputElement>('#pkf-wind-toggle');
    if (toggle) toggle.checked = enabled;
    const button = document.querySelector<HTMLButtonElement>('#pkf-wind');
    button?.classList.toggle('active', enabled);
    button?.setAttribute('aria-pressed', String(enabled));
    if (windFlowTimer != null) { window.clearInterval(windFlowTimer); windFlowTimer = null; }
    if (!enabled) { clearWindFlow(); return; }
    void refreshWindFlow();
    windFlowTimer = window.setInterval(() => { void refreshWindFlow(); }, 15 * 60 * 1000);
  };

  document.querySelector<HTMLButtonElement>('#pkf-gps')?.addEventListener('click', async () => {
    const button = document.querySelector<HTMLButtonElement>('#pkf-gps');
    if (button) button.disabled = true;
    try {
      const position = await getDeviceLocation();
      map.flyTo({ center: [position.lng, position.lat], zoom: Math.max(map.getZoom(), 12), essential: true });
      await selectPoint(position.lat, position.lng, null);
    } catch (error) {
      console.error('PKF GPS error', error);
      const message = getLang() === 'fr'
        ? 'Accès à la position impossible. Activez la localisation précise et autorisez PRO KAYAK FISHING à utiliser votre position.'
        : 'تعذر الوصول إلى موقعك. فعّل الموقع الدقيق واسمح لتطبيق PRO KAYAK FISHING باستخدام موقعك.';
      window.alert(message);
    } finally {
      if (button) button.disabled = false;
    }
  });
  document.querySelector<HTMLButtonElement>('#pkf-layers')?.addEventListener('click', () => layerPanel.classList.toggle('hidden'));
  document.querySelector<HTMLButtonElement>('#pkf-layer-close')?.addEventListener('click', () => layerPanel.classList.add('hidden'));
  document.querySelector<HTMLInputElement>('#pkf-satellite-toggle')?.addEventListener('change', e => {
    const visible = (e.currentTarget as HTMLInputElement).checked;
    if (map.getLayer('satellite')) map.setLayoutProperty('satellite','visibility',visible?'visible':'none');
  });
  document.querySelector<HTMLInputElement>('#pkf-wind-toggle')?.addEventListener('change', e => {
    setWindFlow((e.currentTarget as HTMLInputElement).checked);
  });
  document.querySelector<HTMLInputElement>('#pkf-nautical-toggle')?.addEventListener('change', e => {
    const enabled = (e.currentTarget as HTMLInputElement).checked;
    if (map.getLayer('satellite')) map.setLayoutProperty('satellite', 'visibility', enabled ? 'none' : 'visible');
    if (map.getLayer('nautical-bathymetry')) map.setLayoutProperty('nautical-bathymetry', 'visibility', enabled ? 'visible' : 'none');
    if (map.getLayer('nautical-contours')) map.setLayoutProperty('nautical-contours', 'visibility', enabled ? 'visible' : 'none');
  });
  document.querySelector<HTMLButtonElement>('#pkf-wind')?.addEventListener('click', () => {
    const next = !windFlowEnabled;
    setWindFlow(next);
    const button = document.querySelector<HTMLButtonElement>('#pkf-wind');
    button?.classList.toggle('active', next);
    button?.setAttribute('aria-pressed', String(next));
  });
  document.querySelector<HTMLButtonElement>('#pkf-measure')?.addEventListener('click', () => document.querySelector<HTMLButtonElement>('#measure-toggle')?.click());
  document.querySelector<HTMLButtonElement>('#pkf-trip')?.addEventListener('click', () => document.querySelector<HTMLButtonElement>('#trip-toggle')?.click());


  let marker: maplibregl.Marker | null = null; const report = document.querySelector<HTMLElement>('#report')!;
  let selectedLocation: {lat:number; lng:number; label:string|null} | null = null;
  let pointRequestId = 0;

  const tripPanel = document.querySelector<HTMLElement>('#trip-panel')!;
  const tripList = document.querySelector<HTMLElement>('#trip-list')!;
  const tripStatus = document.querySelector<HTMLElement>('#trip-status')!;
  const routeView = document.querySelector<HTMLElement>('#route-view')!;
  const tripRecord = document.querySelector<HTMLButtonElement>('#trip-record')!;
  let recording = false;
  let watchId: string | number | null = null;
  let recordedPoints: TrackPoint[] = [];
  let lastRecordedAt = 0;
  let routeTripId: string | null = null;
  let measuring = false;
  let measurePoints: [number, number][] = [];
  let measureMarkers: maplibregl.Marker[] = [];

  const shell = root.querySelector<HTMLElement>('.shell')!;
  const setReportOpen = (open:boolean) => shell.classList.toggle('report-open', open);
  const closeReport = () => { report.classList.add('hidden'); setReportOpen(false); };
  const setBottomNav = (active:string) => {
    document.querySelectorAll<HTMLButtonElement>('.pkf-bottom-nav button').forEach(b=>b.classList.remove('active'));
    document.querySelector<HTMLButtonElement>('#pkf-nav-'+active)?.classList.add('active');
  };
  document.querySelector<HTMLButtonElement>('#pkf-nav-map')?.addEventListener('click', () => {
    closeReport(); tripPanel.classList.add('hidden'); setBottomNav('map');
  });
  document.querySelector<HTMLButtonElement>('#pkf-nav-sea')?.addEventListener('click', () => {
    document.querySelector<HTMLButtonElement>('#today-sea')?.click(); setBottomNav('sea');
  });
  document.querySelector<HTMLButtonElement>('#pkf-nav-fish')?.addEventListener('click', () => {
    document.querySelector<HTMLButtonElement>('#kayak-intelligence-toggle')?.click(); setBottomNav('fish');
  });
  document.querySelector<HTMLButtonElement>('#pkf-nav-report')?.addEventListener('click', () => {
    if (selectedLocation) { report.classList.remove('hidden'); setReportOpen(true); setBottomNav('report'); }
    else { document.querySelector<HTMLButtonElement>('#today-sea')?.click(); setBottomNav('sea'); }
  });
  document.querySelector('#close-report')?.addEventListener('click', closeReport);


  document.querySelector('#trip-toggle')?.addEventListener('click', () => {
    const opening = tripPanel.classList.contains('hidden');
    tripPanel.classList.toggle('hidden');
    if (opening) { closeReport(); measurePanel.classList.add('hidden'); measuring = false; renderTrips(); }
  });
  document.querySelector('#close-trips')?.addEventListener('click', () => tripPanel.classList.add('hidden'));
  const measurePanel = document.querySelector<HTMLElement>('#measure-panel')!;
  const measureToggle = document.querySelector<HTMLButtonElement>('#measure-toggle')!;

  const openKayakIntelligence = async (initialLabel:string|null = null, initialLat:number|null = null, initialLng:number|null = null) => {
    closeReport();
    tripPanel.classList.add('hidden');
    measurePanel.classList.add('hidden');
    measuring = false;

    let panel = document.querySelector<HTMLElement>('#kayak-intelligence');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'kayak-intelligence';
      panel.className = 'kayak-intelligence';
      shell.appendChild(panel);
    }
    panel.classList.add('ki-open');
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');

    const isFr = getLang() === 'fr';
    const tx = (ar:string, fr:string) => isFr ? fr : ar;
    const scoreLabel = (level:string) => translateLevel(level);
    const formatTime = (iso:string) => new Date(iso).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit',hour12:false});
    const seaState = (h:number|null) => h==null ? tx('غير متوفر','Indisponible') : h<=0.4 ? tx('هادئ','Calme') : h<=0.8 ? tx('خفيف','Léger') : h<=1.2 ? tx('متوسط','Modéré') : tx('مرتفع','Élevé');
    const windState = (v:number|null) => v==null ? tx('غير متوفر','Indisponible') : v<=15 ? tx('مناسب','Favorable') : v<=20 ? tx('متوسط','Modéré') : tx('مرتفع','Élevé');

    panel.innerHTML = `
      <div class="ki-page">
        <header class="ki-topbar">
          <button id="ki-close" class="ki-icon-btn" aria-label="${tx('إغلاق','Fermer')}">×</button>
          <div class="ki-title">
            <span class="ki-eyebrow">🧠 ${tx('ذكاء الكياك','KAYAK INTELLIGENCE')}</span>
            <strong>${tx('قرار الرحلة','Décision de sortie')}</strong>
          </div>
          <span class="ki-live-dot" title="${tx('بيانات حديثة','Données récentes')}"></span>
        </header>

        <div class="ki-body">
          <div class="ki-searchbar">
            <span>📍</span>
            <input id="ki-place" value="${escapeHtml(initialLabel ?? '')}" placeholder="${tx('ابحث عن موقع الصيد…','Rechercher un spot…')}" autocomplete="off"/>
            <button id="ki-search" type="button">${tx('اختيار','Choisir')}</button>
          </div>
          <div class="ki-planner">
            <div class="ki-planner-title">🧭 <b>${tx('حضّر خروجتك','Préparez votre sortie')}</b><small>${tx('نحلل الفترة من الانطلاق إلى العودة','Nous analysons toute la période')}</small></div>
            <label><span>🗓️ ${tx('التاريخ','Date')}</span><input id="ki-date" type="date"/></label>
            <label><span>⏰ ${tx('وقت الانطلاق','Heure de départ')}</span><input id="ki-time" type="time" value="07:00"/></label>
            <label><span>⏱️ ${tx('مدة الرحلة','Durée')}</span><select id="ki-duration"><option value="2">2 h</option><option value="3">3 h</option><option value="4" selected>4 h</option><option value="5">5 h</option><option value="6">6 h</option><option value="8">8 h</option></select></label>
            <button id="ki-analyze-trip" class="ki-plan-btn" type="button">🧠 ${tx('تحليل الرحلة','Analyser la sortie')}</button>
          </div>

          <div class="ki-status">
            <div class="ki-loading">
              <span class="ki-spinner"></span>
              <b>${tx('جاري تحليل ظروف البحر…','Analyse des conditions marines…')}</b>
              <small>${tx('يتم جلب أحدث بيانات النقطة المحددة','Récupération des dernières données du point')}</small>
            </div>
          </div>
        </div>
      </div>`;

    const close = () => {
      if (!panel) return;
      panel.classList.remove('ki-open');
      panel.setAttribute('aria-hidden','true');
      panel.removeAttribute('aria-modal');
      panel.style.display = 'none';
      panel.remove();
    };
    panel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('#ki-close')) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }, {capture:true});

    const run = async (lat:number,lng:number,label:string|null) => {
      const status = panel?.querySelector<HTMLElement>('.ki-status');
      if (!status) return;

      const dateInput = panel.querySelector<HTMLInputElement>('#ki-date')!;
      const timeInput = panel.querySelector<HTMLInputElement>('#ki-time')!;
      const durationInput = panel.querySelector<HTMLSelectElement>('#ki-duration')!;
      const selectedDate = dateInput.value;
      const startTime = timeInput.value || '07:00';
      const durationHours = Number(durationInput.value) || 4;
      const startLocal = `${selectedDate}T${startTime}`;
      const startTs = Date.parse(startLocal);
      const endTs = startTs + durationHours*3600000;

      status.innerHTML = `
        <div class="ki-loading">
          <span class="ki-spinner"></span>
          <b>${tx('جاري تحليل الرحلة كاملة…','Analyse de toute la sortie…')}</b>
          <small>${tx('نحلل البحر والرياح من وقت الانطلاق حتى وقت العودة','Analyse de la mer et du vent du départ au retour')}</small>
        </div>`;

      try {
        const hourly = await marine.getHourlyKayakForecast(lat,lng);
        const selected = hourly.filter(p => {
          const ts = Date.parse(p.time);
          return Number.isFinite(ts) && ts >= startTs && ts < endTs;
        });
        if (selected.length < Math.max(2, Math.min(durationHours,3))) {
          throw new Error('insufficient_forecast');
        }

        const assessments = selected.map(p => ({
          point:p,
          assessment:assessKayakConditions({
            windSpeed:p.windSpeed, windGusts:p.windGusts, windDirection:p.windDirection,
            waveHeight:p.waveHeight, waveDirection:p.waveDirection, wavePeriod:p.wavePeriod,
            swellHeight:p.swellHeight, swellDirection:p.swellDirection, swellPeriod:p.swellPeriod,
            currentVelocity:p.currentVelocity
          })
        }));
        const scores = assessments.map(x=>x.assessment.score);
        const avgScore = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
        const minScore = Math.min(...scores);
        const score = Math.round(avgScore*0.6 + minScore*0.4);
        const worst = assessments.reduce((a,b)=>a.assessment.score<=b.assessment.score?a:b);
        const reasons = [...new Set(assessments.flatMap(x=>x.assessment.reasons).map(translateReason))].slice(0,4);
        const decisionLevel = score >= 85 ? 'ممتاز' : score >= 70 ? 'جيد' : score >= 50 ? 'حذر' : 'غير مناسب';
        const decisionClass = decisionLevel === 'ممتاز' ? 'good' : decisionLevel === 'جيد' ? 'ok' : decisionLevel === 'حذر' ? 'warn' : 'bad';
        const endDate = new Date(new Date(startLocal).getTime()+durationHours*3600000);
        const formatLocal = (d:Date) => d.toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit',hour12:false});
        const best = bestKayakWindow(hourly.filter(p=>p.time.slice(0,10)===selectedDate),durationHours);
        const worstTime = formatTime(worst.point.time);
        const tripAdvice = score >= 85
          ? tx('الظروف تبدو مناسبة طوال فترة الرحلة المحددة.','Les conditions semblent favorables pendant toute la durée choisie.')
          : score >= 70
          ? tx('الرحلة ممكنة، لكن راقب تطور البحر والرياح خصوصاً في أسوأ ساعة.','Sortie possible, mais surveillez surtout l’évolution de la mer et du vent pendant l’heure la moins favorable.')
          : score >= 50
          ? tx('الحذر مطلوب؛ توجد فترة أضعف داخل الرحلة. قلّل مدة التعرض وفكّر في العودة المبكرة.','Prudence requise : une période moins favorable est présente. Réduisez l’exposition et envisagez un retour anticipé.')
          : tx('لا أوصي بهذه الفترة للكياك وفق البيانات المتاحة.','Cette période n’est pas recommandée pour le kayak selon les données disponibles.');

        status.innerHTML = `
          <section class="ki-hero ${decisionClass}">
            <div class="ki-location-main">
              <span class="ki-pin">📍</span>
              <div><b>${escapeHtml(label ?? tx('موقع الصيد المحدد','Spot sélectionné'))}</b><small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small></div>
            </div>
            <div class="ki-verdict">
              <div class="ki-verdict-copy">
                <small>${tx('قرار الرحلة المخطط لها','Décision pour la sortie planifiée')}</small>
                <strong>${scoreLabel(decisionLevel)}</strong>
                <span>${escapeHtml(tripAdvice)}</span>
              </div>
              <div class="ki-score-ring" style="--ki-score:${score}">
                <div><strong>${score}</strong><small>/100</small></div>
              </div>
            </div>
          </section>

          <section class="ki-window-card">
            <div class="ki-section-head"><div><span>🗓️</span><b>${tx('خطة الرحلة','Plan de sortie')}</b></div><small>${tx('تحليل الفترة كاملة','Analyse de toute la période')}</small></div>
            <div class="ki-trip-summary">
              <div><span>${tx('التاريخ','Date')}</span><b>${new Intl.DateTimeFormat(locale(),{weekday:'short',day:'numeric',month:'short'}).format(new Date(selectedDate+'T12:00:00'))}</b></div>
              <div><span>${tx('الانطلاق','Départ')}</span><b>${startTime}</b></div>
              <div><span>${tx('العودة المتوقعة','Retour prévu')}</span><b>${formatLocal(endDate)}</b></div>
              <div><span>${tx('المدة','Durée')}</span><b>${durationHours}h</b></div>
            </div>
            ${best ? `<div class="ki-best-window"><span>⭐ ${tx('أفضل نافذة في هذا اليوم','Meilleure fenêtre du jour')}</span><strong>${formatTime(best.start)} → ${formatTime(best.end)}</strong><b>${best.score}/100</b></div>` : ''}
          </section>

          <section class="ki-section">
            <div class="ki-section-head"><div><span>🌊</span><b>${tx('البحر أثناء الرحلة','Mer pendant la sortie')}</b></div><small>${tx('أضعف نقطة: '+worstTime,'Point le plus défavorable : '+worstTime)}</small></div>
            <div class="ki-metrics">
              <div class="ki-metric primary"><small>${tx('أعلى موج','Vague max')}</small><b>${value(Math.max(...assessments.map(x=>x.point.waveHeight??0)),' m')}</b><span>${tx('خلال الرحلة','pendant la sortie')}</span></div>
              <div class="ki-metric"><small>${tx('أقصر فترة موج','Période min')}</small><b>${value(Math.min(...assessments.map(x=>x.point.wavePeriod??999)),' s')}</b><span>${tx('أثناء الرحلة','pendant la sortie')}</span></div>
              <div class="ki-metric"><small>${tx('أعلى Swell','Swell max')}</small><b>${value(Math.max(...assessments.map(x=>x.point.swellHeight??0)),' m')}</b><span>${tx('متوقع','prévu')}</span></div>
              <div class="ki-metric"><small>${tx('أعلى فترة Swell','Période swell')}</small><b>${value(Math.max(...assessments.map(x=>x.point.swellPeriod??0)),' s')}</b><span>${tx('متوقع','prévu')}</span></div>
            </div>
          </section>

          <section class="ki-section">
            <div class="ki-section-head"><div><span>💨</span><b>${tx('الرياح أثناء الرحلة','Vent pendant la sortie')}</b></div></div>
            <div class="ki-metrics">
              <div class="ki-metric primary"><small>${tx('أعلى رياح','Vent max')}</small><b>${value(Math.max(...assessments.map(x=>x.point.windSpeed??0)),' km/h')}</b><span>${tx('خلال الرحلة','pendant la sortie')}</span></div>
              <div class="ki-metric"><small>${tx('أعلى هبات','Rafales max')}</small><b>${value(Math.max(...assessments.map(x=>x.point.windGusts??0)),' km/h')}</b><span>${tx('خلال الرحلة','pendant la sortie')}</span></div>
              <div class="ki-metric"><small>${tx('أسوأ تقييم','Score minimum')}</small><b>${minScore}/100</b><span>${escapeHtml(worstTime)}</span></div>
              <div class="ki-metric"><small>${tx('المتوسط','Moyenne')}</small><b>${avgScore}/100</b><span>${tx('للفترة','de la période')}</span></div>
            </div>
          </section>

          <section class="ki-section ki-analysis">
            <div class="ki-section-head"><div><span>🔎</span><b>${tx('لماذا هذا القرار؟','Pourquoi cette décision ?')}</b></div></div>
            <ul>${reasons.length ? reasons.map(r=>`<li>${escapeHtml(r)}</li>`).join('') : `<li>${tx('لا توجد عوامل خطر رئيسية في الفترة المختارة.','Aucun facteur de risque majeur sur la période choisie.')}</li>`}</ul>
          </section>

          <section class="ki-data-status">
            <div><span>●</span><b>${tx('التقييم مبني على توقعات الرحلة','Évaluation basée sur les prévisions de sortie')}</b></div>
            <small>${selected.length} ${tx('ساعات محللة','heures analysées')}</small>
          </section>

          <div class="ki-disclaimer">${tx('هذا تخطيط للرحلة وليس ضماناً للسلامة. افحص التنبيهات البحرية والظروف المحلية قبل الانطلاق، وأعد التقييم إذا تغير وقت الرحلة.','Ceci est une aide à la planification et non une garantie de sécurité. Vérifiez les alertes marines et les conditions locales avant le départ, et réévaluez si l’horaire change.')}</div>
        `;
      } catch (error) {
        status.innerHTML = `<div class="ki-loading"><b>${tx('لا توجد بيانات توقعات كافية لهذه الفترة.','Prévisions insuffisantes pour cette période.')}</b><small>${tx('اختر تاريخاً أقرب أو وقتاً مختلفاً.','Choisissez une date plus proche ou une autre heure.')}</small></div>`;
      }
    };

    const dateEl = panel.querySelector<HTMLInputElement>('#ki-date')!;
    const localDateKey = (d:Date) => {
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    };
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    const lastDay = new Date(now.getFullYear(),now.getMonth(),now.getDate()+6);
    dateEl.value = localDateKey(tomorrow);
    dateEl.min = localDateKey(now);
    dateEl.max = localDateKey(lastDay);
    let currentLat = initialLat ?? map.getCenter().lat;
    let currentLng = initialLng ?? map.getCenter().lng;
    let currentLabel = initialLabel;
    const input=panel.querySelector<HTMLInputElement>('#ki-place')!;
    const doSearch = async () => {
      const q=input.value.trim();
      if(!q) return;
      input.classList.remove('ki-invalid');
      try {
        const results=await geocoder.search(q);
        const hit=results[0];
        if(hit) {
          currentLat = hit.latitude;
          currentLng = hit.longitude;
          currentLabel = hit.name;
          await run(currentLat,currentLng,currentLabel);
        }
        else {
          input.classList.add('ki-invalid');
          input.setAttribute('aria-invalid','true');
        }
      } catch {
        input.classList.add('ki-invalid');
        input.setAttribute('aria-invalid','true');
      }
    };
    input.addEventListener('change',doSearch);
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void doSearch();}});
    panel.querySelector('#ki-search')?.addEventListener('click',()=>void doSearch());
    panel.querySelector('#ki-analyze-trip')?.addEventListener('click',()=>void run(
      currentLat, currentLng, input.value.trim() || currentLabel
    ));
    [dateEl, panel.querySelector('#ki-time'), panel.querySelector('#ki-duration')].forEach(el => el?.addEventListener('change',()=>void run(
      currentLat, currentLng, input.value.trim() || currentLabel
    )));

    void run(currentLat,currentLng,currentLabel);
  };

  document.querySelector('#kayak-intelligence-toggle')?.addEventListener('click', () => {
    const center = map.getCenter();
    const target = selectedLocation ?? {lat:center.lat, lng:center.lng, label:null};
    void openKayakIntelligence(target.label ?? null, target.lat, target.lng);
  });
  const measureDistanceKm = (a:[number,number], b:[number,number]) => {
    const R=6371, p1=a[1]*Math.PI/180, p2=b[1]*Math.PI/180;
    const dp=(b[1]-a[1])*Math.PI/180, dl=(b[0]-a[0])*Math.PI/180;
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  };

  const clearMeasurement = () => {
    if (map.getLayer('measure-line')) map.removeLayer('measure-line');
    if (map.getSource('measure-source')) map.removeSource('measure-source');
    measureMarkers.forEach(m=>m.remove());
    measureMarkers=[];
    measurePoints=[];
  };

  const renderMeasurement = () => {
    if (!measurePoints.length) {
      measurePanel.innerHTML='<b>📏 '+t('قياس المسافة')+'</b><p>'+t('اضغط نقطة في البحر ثم نقطة ثانية على الشاطئ أو أي موقع آخر.')+'</p>';
      return;
    }
    if (measurePoints.length===1) {
      measurePanel.innerHTML='<b>📏 '+t('قياس المسافة')+'</b><p>'+t('تم تحديد النقطة الأولى. اختر النقطة الثانية.')+'</p><button id="measure-cancel">'+t('إلغاء')+'</button>';
      measurePanel.querySelector('#measure-cancel')?.addEventListener('click',()=>{clearMeasurement();renderMeasurement();});
      return;
    }
    const km=measureDistanceKm(measurePoints[0],measurePoints[1]);
    measurePanel.innerHTML='<b>📏 '+t('المسافة')+'</b><strong>'+ (km<1 ? Math.round(km*1000)+' '+(getLang()==='fr'?'m':'متر') : km.toFixed(2)+' '+(getLang()==='fr'?'km':'كم')) +'</strong><p>'+t('تم القياس بين النقطتين المحددتين.')+'</p><button id="measure-new">'+t('قياس جديد')+'</button>';
    measurePanel.querySelector('#measure-new')?.addEventListener('click',()=>{clearMeasurement();renderMeasurement();});
  };

  const startMeasurement = () => {
    closeReport();
    tripPanel.classList.add('hidden');
    measuring=true;
    clearMeasurement();
    measurePanel.classList.remove('hidden');
    measureToggle.textContent='✖️ '+t('إيقاف القياس');
    renderMeasurement();
  };

  const stopMeasurement = () => {
    measuring=false;
    clearMeasurement();
    measurePanel.classList.add('hidden');
    measureToggle.textContent='📏 '+t('قياس المسافة');
  };

  measureToggle.addEventListener('click',()=>measuring ? stopMeasurement() : startMeasurement());
  renderMeasurement();


  const removeRoute = () => {
    if (map.getLayer('trip-route-line')) map.removeLayer('trip-route-line');
    if (map.getSource('trip-route-source')) map.removeSource('trip-route-source');
    routeTripId = null;
    routeView.classList.add('hidden');
    routeView.innerHTML = '';
  };

  const drawTrip = (trip: KayakTrip) => {
    if (!trip.points.length) return;
    const draw = () => {
      removeRoute();
      report.classList.add('hidden');
      setReportOpen(false);
      measurePanel.classList.add('hidden');
      measuring = false;
      tripPanel.classList.add('hidden');
      const coordinates = trip.points.map(p => [p.lng, p.lat] as [number, number]);
      map.addSource('trip-route-source', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }
      });
      map.addLayer({
        id: 'trip-route-line',
        type: 'line',
        source: 'trip-route-source',
        paint: { 'line-color': '#e11d48', 'line-width': 4, 'line-opacity': 0.9 }
      });
      const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
      coordinates.slice(1).forEach(c => bounds.extend(c));
      if (coordinates.length === 1) map.easeTo({center: coordinates[0], zoom: 15});
      else map.fitBounds(bounds, {padding: 70, maxZoom: 15});
      routeTripId = trip.id;
      const distance = Number.isFinite(trip.distanceKm) ? trip.distanceKm.toFixed(2) : '0.00';
      const duration = Math.round(trip.durationMin);
      const routeName = getLang() === 'fr' && trip.name.startsWith('رحلة ') ? 'Sortie ' + new Date(trip.startedAt).toLocaleDateString('fr-TN') : trip.name;
      routeView.innerHTML = `<div class="route-view-head"><div><b>🗺️ ${t('المسار المعروض')}</b><small>${escapeHtml(routeName)}</small></div><button id="close-route-view" aria-label="${t('إغلاق')}">×</button></div><div class="route-view-stats"><span>📍 <b>${distance}</b> ${getLang()==='fr'?'km':'كم'}</span><span>⏱️ <b>${duration}</b> ${getLang()==='fr'?'min':'د'}</span><span>🧭 <b>${trip.points.length}</b> ${getLang()==='fr'?'points':'نقطة'}</span></div><button id="hide-route" class="route-hide">${t('إخفاء المسار')}</button>`;
      routeView.classList.remove('hidden');
      routeView.querySelector('#close-route-view')?.addEventListener('click', removeRoute);
      routeView.querySelector('#hide-route')?.addEventListener('click', removeRoute);
    };
    if (map.isStyleLoaded()) draw(); else map.once('load', draw);
  };


  const renderTrips = () => {
    const trips = loadTrips();
    const tripName = (trip: KayakTrip) => {
      if (getLang() === 'fr' && trip.name.startsWith('رحلة ')) {
        const date = new Date(trip.startedAt).toLocaleDateString('fr-TN');
        return 'Sortie ' + date;
      }
      return trip.name;
    };
    if (!trips.length) {
      tripList.innerHTML = '<div class="trip-empty">'+t('لا توجد رحلات محفوظة بعد.')+'</div>';
      return;
    }
    tripList.innerHTML = trips.map(trip => {
      const distance = Number.isFinite(trip.distanceKm) ? trip.distanceKm.toFixed(2) : '0.00';
      const duration = Math.round(trip.durationMin);
      return `<article class="trip-card">
        <b>${escapeHtml(tripName(trip))}</b>
        <small>${new Date(trip.startedAt).toLocaleString(locale())}</small>
        <div class="trip-stats"><span>📍 ${distance} ${getLang()==="fr" ? "km" : "كم"}</span><span>⏱️ ${duration} ${getLang()==="fr" ? "min" : "د"}</span><span>🧭 ${trip.points.length} ${getLang()==="fr" ? "points" : "نقطة"}</span></div>
        <div class="trip-actions">
          <button data-view-trip="${trip.id}">🗺️ ${t('عرض المسار')}</button>
          <button data-delete-trip="${trip.id}" class="danger-action">🗑️ ${t('حذف')}</button>
        </div>
      </article>`;
    }).join('');
    tripList.querySelectorAll<HTMLButtonElement>('[data-view-trip]').forEach(btn => btn.addEventListener('click', () => {
      const trip = loadTrips().find(t => t.id === btn.dataset.viewTrip);
      if (trip) drawTrip(trip);
    }));
    tripList.querySelectorAll<HTMLButtonElement>('[data-delete-trip]').forEach(btn => btn.addEventListener('click', () => {
      if (!btn.dataset.deleteTrip) return;
      deleteTrip(btn.dataset.deleteTrip);
      if (routeTripId === btn.dataset.deleteTrip) removeRoute();
      renderTrips();
    }));
  };

  const setRecordingStatus = () => {
    if (!recording) {
      tripStatus.className = 'trip-idle';
      tripStatus.innerHTML = '<b>'+t('لا توجد رحلة قيد التسجيل')+'</b><span>'+t('ابدأ التسجيل لتتبع مسار الكاياك عبر GPS.')+'</span>';
      tripRecord.textContent = '▶️ '+t('بدء تسجيل رحلة');
      return;
    }
    const distance = recordedPoints.length > 1
      ? recordedPoints.slice(1).reduce((sum, p, i) => sum + distanceMetersSafe(recordedPoints[i], p), 0)
      : 0;
    tripStatus.className = 'trip-recording';
    tripStatus.innerHTML = `<b>🔴 ${getLang()==='fr' ? 'Enregistrement en cours' : 'التسجيل جارٍ'}</b><span>${recordedPoints.length} ${getLang()==='fr' ? 'points' : 'نقطة'} • ${(distance / 1000).toFixed(2)} ${getLang()==='fr' ? 'km' : 'كم'}</span>`;
    tripRecord.textContent = getLang()==='fr' ? '⏹️ Arrêter et enregistrer' : '⏹️ إيقاف وحفظ الرحلة';
  };

  const distanceMetersSafe = (a: TrackPoint, b: TrackPoint) => {
    const R = 6371000;
    const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    const dp = (b.lat - a.lat) * Math.PI / 180, dl = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const recordPosition = (position: GeolocationPosition) => {
    if (!recording) return;
    const point: TrackPoint = {lat: position.coords.latitude, lng: position.coords.longitude, timestamp: position.timestamp || Date.now()};
    const previous = recordedPoints[recordedPoints.length - 1];
    const enoughTime = point.timestamp - lastRecordedAt >= 5000;
    const enoughDistance = !previous || distanceMetersSafe(previous, point) >= 5;
    if (previous && !enoughTime && !enoughDistance) return;
    recordedPoints.push(point);
    lastRecordedAt = point.timestamp;
    selectedLocation = {lat: point.lat, lng: point.lng, label: null};
    setRecordingStatus();
  };

  const stopRecording = () => {
    if (watchId !== null) void clearDeviceLocationWatch(watchId);
    watchId = null;
    recording = false;
    if (recordedPoints.length < 2) {
      recordedPoints = [];
      setRecordingStatus();
      tripStatus.innerHTML = getLang()==='fr' ? '<b>Sortie non enregistrée</b><span>Au moins deux points GPS sont nécessaires pour créer un parcours.</span>' : '<b>لم يتم حفظ الرحلة</b><span>نحتاج إلى نقطتين GPS على الأقل لتكوين مسار.</span>';
      return;
    }
    const trip = makeTrip(recordedPoints);
    saveTrip(trip);
    const savedPoints = [...recordedPoints];
    recordedPoints = [];
    setRecordingStatus();
    renderTrips();
    drawTrip({...trip, points: savedPoints});
  };

  const startRecording = () => {
    recording = true;
    recordedPoints = [];
    lastRecordedAt = 0;
    setRecordingStatus();
    void watchDeviceLocation(
      position => recordPosition({
        coords: {
          latitude: position.lat,
          longitude: position.lng,
          accuracy: position.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      } as GeolocationPosition),
      error => {
        recording = false;
        setRecordingStatus();
        tripStatus.className = 'trip-error';
        tripStatus.innerHTML = getLang()==='fr'
          ? '<b>Accès au GPS impossible</b><span>Activez la localisation précise et autorisez l’accès à votre position.</span>'
          : '<b>تعذر الوصول إلى GPS</b><span>فعّل الموقع الدقيق واسمح للتطبيق بالوصول إلى موقعك.</span>';
        console.error('PKF trip GPS error', error);
      }
    ).then(id => { watchId = id; });
  };

  tripRecord.addEventListener('click', () => recording ? stopRecording() : startRecording());
  renderTrips();

  const selectPoint = async (lat:number,lng:number,label:string|null=null): Promise<void> => {