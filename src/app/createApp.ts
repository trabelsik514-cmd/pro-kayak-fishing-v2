import maplibregl from 'maplibre-gl';
import { MarineService, type HourlyKayakPoint, type WeeklySeaSummary, type WeatherModelComparisonDay } from '../marine/MarineService';
import { GeocodingService, reverseCoastalName } from '../location/GeocodingService';
import { createMap } from '../map/createMap';
import { assessKayakConditions } from '../kayak/KayakAssessment';
import { loadTrips, saveTrip, deleteTrip, makeTrip, type KayakTrip, type TrackPoint } from '../trips/TripStore';
import { getBathymetryDepth } from '../bathymetry/BathymetryService';
import { initSeaNotifications, saveBackgroundLocation } from '../notifications/SeaNotificationService';
import { getDeviceLocation, watchDeviceLocation, clearDeviceLocationWatch } from '../location/DeviceLocationService';
import { loadWaypoints, saveWaypoint, deleteWaypoint, type FishingWaypoint, type WaypointCategory } from '../waypoints/WaypointStore';
import { getCoastDistance } from '../coastline/CoastDistanceService';

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
  '📍 نقاطي':'📍 Mes points',
  'حفظ كنقطة صيد':'Enregistrer comme spot',
  'اسم نقطة الصيد':'Nom du spot',
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
      <button id="pkf-waypoint" class="pkf-tool" type="button" title="${getLang()==='fr'?'Points de pêche':'نقاطي'}" aria-label="${getLang()==='fr'?'Points de pêche':'نقاطي'}">
        <span aria-hidden="true">📍</span>
        <span class="pkf-tool-label">${getLang()==='fr'?'Points':'نقاطي'}</span>
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
      <div class="pkf-layer-note">${getLang()==='fr'?'Les données marines apparaissent dans le rapport du point sélectionné.':'البيانات البحرية تظهر داخل تقرير النقطة المختارة، بدلاً من عرض طبقات غير موجودة فعلياً.'}</div>
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
      <button id="pkf-nav-waypoints" type="button">
        <span class="pkf-nav-icon">📍</span>
        <b>${getLang()==='fr'?'Mes points':'نقاطي'}</b>
      </button>
    </nav>
    <aside class="measure-panel hidden" id="measure-panel"></aside>
    <aside class="saved-waypoints-panel hidden" id="saved-waypoints-panel">
      <div class="saved-waypoints-head">
        <div class="saved-waypoints-title"><b>${getLang()==='fr'?'Mes points enregistrés':'نقاطي المحفوظة'}</b></div>
        <div class="saved-waypoints-actions">
          <button id="add-coordinate-waypoint" class="saved-waypoints-add" type="button">＋ ${getLang()==='fr'?'Coordonnées':'إحداثيات'}</button>
          <button id="close-saved-waypoints" type="button" aria-label="${getLang()==='fr'?'Fermer':'إغلاق'}">×</button>
        </div>
      </div>
      <div id="saved-waypoints-list"></div>
    </aside>
    <div id="coordinate-waypoint-modal" class="coordinate-waypoint-modal hidden" role="dialog" aria-modal="true" aria-labelledby="coordinate-waypoint-title">
      <form class="coordinate-waypoint-card" id="coordinate-waypoint-form">
        <div class="coordinate-waypoint-head">
          <b id="coordinate-waypoint-title">${getLang()==='fr'?'Ajouter un point par coordonnées':'إضافة نقطة بالإحداثيات'}</b>
          <button id="close-coordinate-waypoint" type="button" aria-label="${getLang()==='fr'?'Fermer':'إغلاق'}">×</button>
        </div>
        <label>${getLang()==='fr'?'Nom du point':'اسم النقطة'}
          <input id="coordinate-point-name" required maxlength="80" autocomplete="off" placeholder="${getLang()==='fr'?'Ex. Spot Sidi Bou Saïd':'مثال: نقطة صيد سيدي بوسعيد'}">
        </label>
        <div class="coordinate-grid">
          <label>${getLang()==='fr'?'Latitude':'خط العرض'}
            <input id="coordinate-point-lat" required inputmode="decimal" type="text" autocomplete="off" placeholder="N 36°55.510 أو 36.9251667">
          </label>
          <label>${getLang()==='fr'?'Longitude':'خط الطول'}
            <input id="coordinate-point-lng" required inputmode="decimal" type="text" autocomplete="off" placeholder="E 010°42.65 أو 10.7108333">
          </label>
        </div>
        <label>${getLang()==='fr'?'Type':'النوع'}
          <select id="coordinate-point-category">
            <option value="fish">${getLang()==='fr'?'Pêche':'صيد'}</option>
            <option value="anchor">${getLang()==='fr'?'Mouillage':'مرسى'}</option>
            <option value="rock">${getLang()==='fr'?'Rocher':'صخور'}</option>
            <option value="danger">${getLang()==='fr'?'Danger':'خطر'}</option>
            <option value="nav">${getLang()==='fr'?'Navigation':'ملاحة'}</option>
            <option value="kayak">Kayak</option>
            <option value="personal">${getLang()==='fr'?'Personnel':'شخصية'}</option>
          </select>
        </label>
        <label>${getLang()==='fr'?'Notes':'ملاحظات'}
          <textarea id="coordinate-point-notes" rows="2" maxlength="300" placeholder="${getLang()==='fr'?'Notes facultatives':'ملاحظات اختيارية'}"></textarea>
        </label>
        <div id="coordinate-point-error" class="coordinate-point-error" role="alert"></div>
        <button id="save-coordinate-waypoint" class="trip-primary" type="submit">${getLang()==='fr'?'Enregistrer le point':'حفظ النقطة'}</button>
      </form>
    </div>
    <aside class="trip-panel hidden" id="trip-panel">
      <div class="trip-head"><b><span class="trip-head-icon">↗</span> ${t('سجل الرحلات')}</b><button id="close-trips" aria-label="${t('إغلاق')}">×</button></div>
      <div id="trip-status" class="trip-idle"><b>${t('لا توجد رحلة قيد التسجيل')}</b><span>${t('ابدأ التسجيل لتتبع مسار الكاياك عبر GPS.')}</span></div>
      <button id="trip-record" class="trip-primary"><span aria-hidden="true">●</span> ${t('بدء تسجيل رحلة')}</button>
      <button id="route-planner-open" class="trip-secondary">🛶 ${getLang()==='fr'?'Créer une route depuis mes points':'إنشاء مسار من نقاطي'}</button>
      <div id="route-planner" class="route-planner hidden"></div>
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

      const zoom = map.getZoom();
      const cols = zoom >= 11 ? 5 : 4;
      const rows = zoom >= 11 ? 5 : 4;
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
  const waypointMarkers = new Map<string, maplibregl.Marker>();
  const waypointIcon = (category: WaypointCategory) => ({
    fish:'🐟', anchor:'⚓', rock:'🪨', danger:'⚠️', nav:'🧭', kayak:'🛶', personal:'📌'
  }[category]);

  const waypointLabel = (category: WaypointCategory) => {
    const ar:Record<WaypointCategory,string> = {fish:'صيد',anchor:'مرسى',rock:'صخور',danger:'خطر',nav:'ملاحة',kayak:'كاياك',personal:'شخصية'};
    const fr:Record<WaypointCategory,string> = {fish:'Pêche',anchor:'Mouillage',rock:'Roches',danger:'Danger',nav:'Navigation',kayak:'Kayak',personal:'Personnel'};
    return (getLang()==='fr'?fr:ar)[category];
  };

  const showWaypointPopup = async (wp:FishingWaypoint) => {
    const popup = new maplibregl.Popup({offset:18,maxWidth:'320px'})
      .setLngLat([wp.lng,wp.lat])
      .setHTML(`<div class="pkf-wp-popup" dir="${getLang()==='fr'?'ltr':'rtl'}"><div class="pkf-wp-title">${waypointIcon(wp.category)} ${escapeHtml(wp.name)}</div><div class="pkf-wp-type">${escapeHtml(waypointLabel(wp.category))}</div><div class="pkf-wp-grid"><span>📍 ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</span>${wp.depth!=null ? `<span>〽️ ${wp.depth} m</span>` : ''}${wp.species ? `<span>🐟 ${escapeHtml(wp.species)}</span>` : ''}<span class="pkf-coast-loading">🏖️ ${getLang()==='fr'?'Distance au rivage: calcul...':'المسافة إلى الشاطئ: جارٍ الحساب...'}</span></div>${wp.notes ? `<div class="pkf-wp-notes">${escapeHtml(wp.notes)}</div>` : ''}<button class="pkf-wp-delete" data-wp-delete="${wp.id}" type="button">${getLang()==='fr'?'Supprimer':'حذف النقطة'}</button></div>`)
      .addTo(map);
    const coast=await getCoastDistance(wp.lat,wp.lng);
    if(coast){
      const root=popup.getElement()?.querySelector<HTMLElement>('.pkf-wp-popup');
      if(root){
        const loading=root.querySelector('.pkf-coast-loading');
        if(loading) loading.textContent=getLang()==='fr'
          ? `🏖️ Rivage: ${coast.distanceMeters>=1000?(coast.distanceMeters/1000).toFixed(2)+' km':coast.distanceMeters+' m'} • ${Math.round(coast.bearing)}°`
          : `🏖️ الشاطئ: ${coast.distanceMeters>=1000?(coast.distanceMeters/1000).toFixed(2)+' كم':coast.distanceMeters+' م'} • اتجاه ${Math.round(coast.bearing)}°`;
      }
    }
    setTimeout(() => document.querySelector<HTMLButtonElement>(`[data-wp-delete="${wp.id}"]`)?.addEventListener('click', () => {
      deleteWaypoint(wp.id); waypointMarkers.get(wp.id)?.remove(); waypointMarkers.delete(wp.id); popup.remove();
    }),0);
  };

  const showWaypointPopup_OLD = (wp:FishingWaypoint) => {
    const popup = new maplibregl.Popup({offset:18,maxWidth:'300px'})
      .setLngLat([wp.lng,wp.lat])
      .setHTML(`
        <div class="pkf-wp-popup" dir="${getLang()==='fr'?'ltr':'rtl'}">
          <div class="pkf-wp-title">${waypointIcon(wp.category)} ${wp.name}</div>
          <div class="pkf-wp-type">${waypointLabel(wp.category)}</div>
          <div class="pkf-wp-grid">
            <span>📍 ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</span>
            ${wp.depth!=null ? `<span>〽️ ${wp.depth} m</span>` : ''}
            ${wp.species ? `<span>🐟 ${wp.species}</span>` : ''}
          </div>
          ${wp.notes ? `<div class="pkf-wp-notes">${wp.notes}</div>` : ''}
          <button class="pkf-wp-delete" data-wp-delete="${wp.id}" type="button">${getLang()==='fr'?'Supprimer':'حذف النقطة'}</button>
        </div>`)
      .addTo(map);
    setTimeout(() => {
      document.querySelector<HTMLButtonElement>(`[data-wp-delete="${wp.id}"]`)?.addEventListener('click', () => {
        deleteWaypoint(wp.id);
        waypointMarkers.get(wp.id)?.remove();
        waypointMarkers.delete(wp.id);
        popup.remove();
      });
    },0);
  };

  const renderWaypointMarker = (wp:FishingWaypoint) => {
    if (waypointMarkers.has(wp.id)) return;
    const el=document.createElement('button');
    el.className='pkf-waypoint-marker'; el.type='button'; el.textContent=waypointIcon(wp.category);
    el.title=`${wp.name} — ${waypointLabel(wp.category)}`;
    el.setAttribute('aria-label',wp.name);
    el.addEventListener('click', ev => { ev.stopPropagation(); void selectPoint(wp.lat,wp.lng,wp.name); showWaypointPopup(wp); });
    const marker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([wp.lng,wp.lat]).addTo(map);
    waypointMarkers.set(wp.id,marker);
  };
  loadWaypoints().forEach(renderWaypointMarker);

  document.querySelector<HTMLButtonElement>('#pkf-waypoint')?.addEventListener('click', () => {
    if (!selectedLocation) {
      window.alert(getLang()==='fr' ? 'Sélectionnez d’abord un point sur la carte.' : 'حدد نقطة على الخريطة أولاً.');
      return;
    }
    const fr=getLang()==='fr';
    const name=window.prompt(fr ? 'Nom du point' : 'اسم النقطة', fr ? 'Spot de pêche' : 'نقطة صيد')?.trim();
    if (!name) return;
    const categoryInput=window.prompt(
      fr ? 'Type: fish / anchor / rock / danger / nav / kayak / personal' : 'النوع: fish / anchor / rock / danger / nav / kayak / personal',
      'fish'
    )?.trim().toLowerCase() as WaypointCategory | undefined;
    const category:WaypointCategory = categoryInput && ['fish','anchor','rock','danger','nav','kayak','personal'].includes(categoryInput) ? categoryInput : 'fish';
    const depthRaw=window.prompt(fr ? 'Profondeur (m), optionnel' : 'العمق بالمتر، اختياري', '')?.trim();
    const depth=depthRaw && Number.isFinite(Number(depthRaw)) ? Number(depthRaw) : undefined;
    const species=window.prompt(fr ? 'Espèce ciblée, optionnel' : 'نوع السمك المستهدف، اختياري', '')?.trim() || undefined;
    const notes=window.prompt(fr ? 'Notes, optionnel' : 'ملاحظات، اختيارية', '')?.trim() || undefined;
    const wp=saveWaypoint({lat:selectedLocation.lat,lng:selectedLocation.lng,name,category,depth,species,notes});
    renderWaypointMarker(wp);
    const notice=document.createElement('div'); notice.className='pkf-waypoint-notice';
    notice.textContent=`${waypointIcon(category)} ${fr ? 'Point enregistré: ' : 'تم حفظ النقطة: '}${name}`;
    report.prepend(notice); window.setTimeout(()=>notice.remove(),3000);
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
    closeReport(); tripPanel.classList.add('hidden'); savedWaypointsPanel?.classList.add('hidden'); setBottomNav('map');
  });
  document.querySelector<HTMLButtonElement>('#pkf-nav-sea')?.addEventListener('click', () => {
    savedWaypointsPanel?.classList.add('hidden'); document.querySelector<HTMLButtonElement>('#today-sea')?.click(); setBottomNav('sea');
  });
  document.querySelector<HTMLButtonElement>('#pkf-nav-fish')?.addEventListener('click', () => {
    savedWaypointsPanel?.classList.add('hidden'); document.querySelector<HTMLButtonElement>('#kayak-intelligence-toggle')?.click(); setBottomNav('fish');
  });
  // Coordinate parser: accepts decimal, DDM (N 36°55.510), DMS, and pasted lat/lng pairs.
  const parseCoordinate = (raw:string, axis:'lat'|'lng'): number | null => {
    let s = raw.trim().replace(/[，,;]/g, ' ').replace(/[−–—]/g, '-');
    if (!s) return null;
    const hemi = (s.match(/[NSEW]/i)?.[0] || '').toUpperCase();
    const nums = (s.match(/-?\\d+(?:[.,]\\d+)?/g) || []).map(v => Number(v.replace(',', '.')));
    if (!nums.length) return null;
    const sign = hemi === 'S' || hemi === 'W' ? -1 : 1;
    let value:number;
    if (nums.length >= 3) {
      value = Math.abs(nums[0]) + nums[1] / 60 + nums[2] / 3600;
    } else if (nums.length >= 2 && /[°'′]/.test(s)) {
      value = Math.abs(nums[0]) + nums[1] / 60;
    } else {
      value = nums[0];
    }
    if (nums[0] < 0 && !hemi) value = -Math.abs(value);
    else value *= sign;
    const max = axis === 'lat' ? 90 : 180;
    return Number.isFinite(value) && Math.abs(value) <= max ? value : null;
  };
  const parseCoordinatePair = (raw:string): {lat:number;lng:number} | null => {
    const s = raw.trim().replace(/[−–—]/g, '-');
    const latMatch = s.match(/([NS])\\s*[-+]?\\d+(?:[°º]\\s*\\d+(?:[.,]\\d+)?(?:[′']\\s*\\d+(?:[.,]\\d+)?)?|[.,]\\d+)?)/i);
    const lngMatch = s.match(/([EW])\\s*[-+]?\\d+(?:[°º]\\s*\\d+(?:[.,]\\d+)?(?:[′']\\s*\\d+(?:[.,]\\d+)?)?|[.,]\\d+)?)/i);
    if (latMatch && lngMatch) {
      const lat = parseCoordinate(latMatch[0], 'lat');
      const lng = parseCoordinate(lngMatch[0], 'lng');
      if (lat != null && lng != null) return {lat,lng};
    }
    const nums = s.match(/-?\\d+(?:[.,]\\d+)?/g)?.map(v=>Number(v.replace(',','.'))) || [];
    if (nums.length === 2 && nums[0] >= 30 && nums[0] <= 38.6 && nums[1] >= 7 && nums[1] <= 12.2) {
      return {lat:nums[0],lng:nums[1]};
    }
    return null;
  };
  const coordinateLatInput = document.querySelector<HTMLInputElement>('#coordinate-point-lat')!;
  const coordinateLngInput = document.querySelector<HTMLInputElement>('#coordinate-point-lng')!;
  coordinateLatInput.addEventListener('paste', ev => {
    const pasted = ev.clipboardData?.getData('text') || '';
    const pair = parseCoordinatePair(pasted);
    if (pair) {
      ev.preventDefault();
      coordinateLatInput.value = pair.lat.toFixed(7);
      coordinateLngInput.value = pair.lng.toFixed(7);
    }
  });
  const coordinateWaypointModal = document.querySelector<HTMLElement>('#coordinate-waypoint-modal')!;
  const coordinateError = document.querySelector<HTMLElement>('#coordinate-point-error')!;
  const openCoordinateWaypoint = () => {
    coordinateError.textContent = '';
    coordinateWaypointModal.classList.remove('hidden');
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('#coordinate-point-name')?.focus());
  };
  const closeCoordinateWaypoint = () => coordinateWaypointModal.classList.add('hidden');
  document.querySelector<HTMLButtonElement>('#add-coordinate-waypoint')?.addEventListener('click', openCoordinateWaypoint);
  document.querySelector<HTMLButtonElement>('#close-coordinate-waypoint')?.addEventListener('click', closeCoordinateWaypoint);
  coordinateWaypointModal.addEventListener('pointerdown', ev => { if (ev.target === coordinateWaypointModal) closeCoordinateWaypoint(); });
  document.querySelector<HTMLFormElement>('#coordinate-waypoint-form')?.addEventListener('submit', ev => {
    ev.preventDefault();
    const name = document.querySelector<HTMLInputElement>('#coordinate-point-name')?.value.trim() || '';
    const latRaw = document.querySelector<HTMLInputElement>('#coordinate-point-lat')?.value || '';
    const lngRaw = document.querySelector<HTMLInputElement>('#coordinate-point-lng')?.value || '';
    const pair = parseCoordinatePair(latRaw);
    const lat = pair?.lat ?? parseCoordinate(latRaw, 'lat');
    const lng = pair?.lng ?? parseCoordinate(lngRaw, 'lng');
    const category = document.querySelector<HTMLSelectElement>('#coordinate-point-category')?.value as WaypointCategory;
    const notes = document.querySelector<HTMLTextAreaElement>('#coordinate-point-notes')?.value.trim() || '';
    if (!name) { coordinateError.textContent = getLang()==='fr' ? 'Entrez un nom.' : 'أدخل اسم النقطة.'; return; }
    if (!Number.isFinite(lat) || lat < 30 || lat > 38.6 || !Number.isFinite(lng) || lng < 7 || lng > 12.2) {
      coordinateError.textContent = getLang()==='fr' ? 'Coordonnées hors de la zone tunisienne. Vérifiez latitude et longitude.' : 'الإحداثيات خارج نطاق تونس. تحقق من خط العرض والطول.';
      return;
    }
    const safeCategory:WaypointCategory = ['fish','anchor','rock','danger','nav','kayak','personal'].includes(category) ? category : 'personal';
    const wp = saveWaypoint({lat, lng, name, category:safeCategory, notes});
    renderWaypointMarker(wp);
    renderSavedWaypoints();
    closeCoordinateWaypoint();
    savedWaypointsPanel.classList.add('hidden');
    setBottomNav('map');
    map.flyTo({center:[lng,lat],zoom:Math.max(map.getZoom(),13),essential:true});
    void selectPoint(lat, lng, name);
    showWaypointPopup(wp);
  });

  const savedWaypointsPanel = document.querySelector<HTMLElement>('#saved-waypoints-panel')!;
  const savedWaypointsList = document.querySelector<HTMLElement>('#saved-waypoints-list')!;
  const renderSavedWaypoints = () => {
    const points = loadWaypoints();
    if (!points.length) {
      savedWaypointsList.innerHTML = `<div class="saved-waypoint-empty">${getLang()==='fr'?'Aucun point enregistré.':'لا توجد نقاط محفوظة بعد.'}</div>`;
      return;
    }
    savedWaypointsList.innerHTML = points.map(wp => `
      <article class="saved-waypoint-card" data-saved-wp="${wp.id}">
        <div class="saved-waypoint-icon">${waypointIcon(wp.category)}</div>
        <div class="saved-waypoint-main">
          <b>${escapeHtml(wp.name)}</b>
          <small>${waypointLabel(wp.category)} • ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}</small>
          ${wp.depth!=null ? `<small>〽️ ${wp.depth} m${wp.species ? ' • 🐟 '+escapeHtml(wp.species) : ''}</small>` : (wp.species ? `<small>🐟 ${escapeHtml(wp.species)}</small>` : '')}
        </div>
        <button class="saved-waypoint-delete" type="button" data-delete-saved-wp="${wp.id}" aria-label="${getLang()==='fr'?'Supprimer':'حذف'}">🗑️</button>
      </article>`).join('');
    savedWaypointsList.querySelectorAll<HTMLElement>('[data-saved-wp]').forEach(card => card.addEventListener('click', ev => {
      if ((ev.target as HTMLElement).closest('[data-delete-saved-wp]')) return;
      const wp=points.find(x=>x.id===card.dataset.savedWp);
      if (!wp) return;
      map.flyTo({center:[wp.lng,wp.lat],zoom:Math.max(map.getZoom(),12),essential:true});
      void selectPoint(wp.lat,wp.lng,wp.name);
      showWaypointPopup(wp);
      savedWaypointsPanel.classList.add('hidden');
    }));
    savedWaypointsList.querySelectorAll<HTMLButtonElement>('[data-delete-saved-wp]').forEach(btn => btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const id=btn.dataset.deleteSavedWp; if (!id) return;
      deleteWaypoint(id); waypointMarkers.get(id)?.remove(); waypointMarkers.delete(id); renderSavedWaypoints();
    }));
  };
  document.querySelector<HTMLButtonElement>('#pkf-nav-waypoints')?.addEventListener('click', () => {
    closeReport(); tripPanel.classList.add('hidden'); renderSavedWaypoints();
    savedWaypointsPanel.classList.remove('hidden'); setBottomNav('waypoints');
  });
  const closeSavedWaypoints = (ev?: Event) => {
    ev?.preventDefault(); ev?.stopPropagation();
    savedWaypointsPanel.classList.add('hidden');
    savedWaypointsPanel.style.display = 'none';
    setBottomNav('map');
    requestAnimationFrame(() => { savedWaypointsPanel.style.removeProperty('display'); });
  };
  const closeSavedButton = document.querySelector<HTMLButtonElement>('#close-saved-waypoints');
  closeSavedButton?.addEventListener('click', closeSavedWaypoints, {capture:true});
  closeSavedButton?.addEventListener('pointerdown', closeSavedWaypoints, {capture:true});
  savedWaypointsPanel.addEventListener('click', ev => {
    if ((ev.target as HTMLElement).closest('#close-saved-waypoints')) closeSavedWaypoints(ev);
  }, {capture:true});
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

  const routePlanner = document.querySelector<HTMLElement>('#route-planner')!;
  const routePlannerOpen = document.querySelector<HTMLButtonElement>('#route-planner-open')!;
  const haversineKm = (a:{lat:number,lng:number}, b:{lat:number,lng:number}) => {
    const R=6371, rad=Math.PI/180, dLat=(b.lat-a.lat)*rad, dLng=(b.lng-a.lng)*rad;
    const q=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(q));
  };
  const bearingDeg = (a:{lat:number,lng:number}, b:{lat:number,lng:number}) => {
    const rad=Math.PI/180, y=Math.sin((b.lng-a.lng)*rad)*Math.cos(b.lat*rad);
    const x=Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lng-a.lng)*rad);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  };
  const bearingLabel = (deg:number) => ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];
  const clearSavedRoute = () => {
    if(map.getLayer('saved-route-line')) map.removeLayer('saved-route-line');
    if(map.getSource('saved-route-source')) map.removeSource('saved-route-source');
    routeView.classList.add('hidden');
  };
  const drawWaypointRoute = (points:FishingWaypoint[]) => {
    clearSavedRoute();
    if(points.length<2) return;
    const coordinates=points.map(p=>[p.lng,p.lat] as [number,number]);
    map.addSource('saved-route-source',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates},properties:{}}});
    map.addLayer({id:'saved-route-line',type:'line',source:'saved-route-source',paint:{'line-color':'#32c5ff','line-width':4,'line-opacity':.9,'line-dasharray':[1,1]}});
    const bounds=coordinates.slice(1).reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(coordinates[0],coordinates[0]));
    map.fitBounds(bounds,{padding:80,maxZoom:14,duration:800});
    const distance=points.slice(1).reduce((sum,p,i)=>sum+haversineKm(points[i],p),0);
    const legs=points.slice(1).map((p,i)=>({km:haversineKm(points[i],p),bearing:bearingDeg(points[i],p),dir:bearingLabel(bearingDeg(points[i],p))}));
    routeView.classList.remove('hidden');
    routeView.innerHTML=`<div class="route-view-head"><div><b>🛶 ${getLang()==='fr'?'Route kayak':'مسار الكاياك'}</b><small>${points.length} ${getLang()==='fr'?'points':'نقاط'}</small></div><button id="close-route-view" aria-label="${t('إغلاق')}">×</button></div><div class="route-view-stats"><span>📏 <b>${distance.toFixed(2)}</b> km</span><span>🧭 <b>${legs[0]?.dir||'—'}</b></span><span>📍 <b>${points.length}</b></span></div><div class="route-legs">${legs.map((l,i)=>`<div><span>${i+1}. ${escapeHtml(points[i].name)} → ${escapeHtml(points[i+1].name)}</span><small>${l.km.toFixed(2)} km • ${Math.round(l.bearing)}° ${l.dir}</small></div>`).join('')}</div><button id="hide-route" class="route-hide">${t('إخفاء المسار')}</button>`;
    routeView.querySelector('#close-route-view')?.addEventListener('click',clearSavedRoute);
    routeView.querySelector('#hide-route')?.addEventListener('click',clearSavedRoute);
  };
  const openRoutePlanner = () => {
    const points=loadWaypoints();
    if(points.length<2){ window.alert(getLang()==='fr'?'Enregistrez au moins deux points.':'احفظ نقطتين على الأقل أولاً.'); return; }
    routePlanner.innerHTML=`<div class="route-planner-head"><b>${getLang()==='fr'?'Choisir les points':'اختر نقاط المسار'}</b><small>${getLang()==='fr'?'Sélectionnez les points dans l’ordre.':'حدد النقاط حسب ترتيب الملاحة.'}</small></div><div class="route-planner-list">${points.map(p=>`<label><input type="checkbox" value="${p.id}" data-route-point><span>${waypointIcon(p.category)} ${escapeHtml(p.name)}</span></label>`).join('')}</div><button id="route-build" class="trip-primary">${getLang()==='fr'?'Tracer la route':'رسم المسار'}</button>`;
    routePlanner.classList.remove('hidden');
    let routeOrder=0;
    routePlanner.querySelectorAll<HTMLInputElement>('[data-route-point]').forEach(input=>input.addEventListener('change',()=>{
      if(input.checked){routeOrder+=1;input.dataset.order=String(routeOrder);} else {delete input.dataset.order;}
    }));
    routePlanner.querySelector('#route-build')?.addEventListener('click',()=>{const selected=Array.from(routePlanner.querySelectorAll<HTMLInputElement>('[data-route-point]:checked')).sort((a,b)=>Number(a.dataset.order||9999)-Number(b.dataset.order||9999)).map(x=>points.find(p=>p.id===x.value)).filter(Boolean) as FishingWaypoint[];if(selected.length<2){window.alert(getLang()==='fr'?'Choisissez au moins deux points.':'اختر نقطتين على الأقل.');return;}drawWaypointRoute(selected);routePlanner.classList.add('hidden');tripPanel.classList.add('hidden');});
  };
  routePlannerOpen.addEventListener('click',openRoutePlanner);
  tripRecord.addEventListener('click', () => recording ? stopRecording() : startRecording());
  renderTrips();

  const selectPoint = async (lat:number,lng:number,label:string|null=null): Promise<void> => {
    const requestId = ++pointRequestId;
    if (routeTripId) removeRoute();
    selectedLocation = {lat, lng, label};
    void saveBackgroundLocation(lat, lng, label);
    report.classList.remove('hidden');
    setReportOpen(true);
    tripPanel.classList.add('hidden');
    measurePanel.classList.add('hidden');
    measuring = false;

    marker?.remove();
    marker = new maplibregl.Marker({color:'#e11d48'}).setLngLat([lng,lat]).addTo(map);

    const isCurrent = () => requestId === pointRequestId;
    const bindClose = () => document.querySelector('#close-report')?.addEventListener('click',closeReport);
    const renderLoading = (title:string, body:string) => {
      report.innerHTML = `<div class="report-head"><b>${title}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div><p>${body}</p>`;
      bindClose();
    };
    const renderDepth = (depthLabel:string, depthSource:string) => {
      const card = report.querySelector('.depth-card');
      if (card) {
        card.innerHTML = `🪸 ${t('العمق التقريبي')} <b>${depthLabel}</b><small>${t('المصدر:')} ${escapeHtml(depthSource)}</small>`;
      }
    };

    renderLoading(t('جاري جلب آخر البيانات…'), `${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    const placeNamePromise: Promise<string|null> = label
      ? Promise.resolve(label)
      : Promise.race([
          reverseCoastalName(lat,lng,getLang()).catch(() => null),
          new Promise<string|null>(resolve => window.setTimeout(() => resolve(null), 3500))
        ]);

    try {
      // The core sea/weather reading is the only blocking operation.
      // Optional enrichments are started independently and may update the report later.
      const [data, hourlyForecast] = await Promise.all([
        marine.getPointConditions(lat,lng),
        marine.getHourlyKayakForecast(lat,lng)
      ]);
      if (!isCurrent()) return;

      // Reverse geocoding is optional: never hold the current sea report for a place-name lookup.
      const placeName = label;
      if (!isCurrent()) return;

      const assessment = assessKayakConditions({
        windSpeed:data.weather.windSpeed,
        windGusts:data.weather.windGusts,
        windDirection:data.weather.windDirection,
        waveHeight:data.sea.waveHeight,
        waveDirection:data.sea.waveDirection,
        wavePeriod:data.sea.wavePeriod,
        swellHeight:data.sea.swellHeight,
        swellDirection:data.sea.swellDirection,
        swellPeriod:data.sea.swellPeriod,
        currentVelocity:data.sea.currentVelocity
      });

      const forecastDate = hourlyForecast[0]?.time.slice(0,10) ?? '';
      const todayForecast = hourlyForecast.filter(p => p.time.slice(0,10) === forecastDate);
      const futureHours = todayForecast.slice(0,12);
      const forecastRows = futureHours.map(p => ({
        p,
        a: assessKayakConditions({
          windSpeed:p.windSpeed,
          windGusts:p.windGusts,
          windDirection:p.windDirection,
          waveHeight:p.waveHeight,
          waveDirection:p.waveDirection,
          wavePeriod:p.wavePeriod,
          swellHeight:p.swellHeight,
          swellDirection:p.swellDirection,
          swellPeriod:p.swellPeriod,
          currentVelocity:p.currentVelocity
        })
      }));
      const planningScore = futureHours.length
        ? Math.round(forecastRows.reduce((sum,row)=>sum+row.a.score,0)/forecastRows.length)
        : assessment.score;
      const planningLevel = planningScore>=82?'ممتاز':planningScore>=65?'جيد':planningScore>=45?'حذر':'غير مناسب';
      const bestPlanningWindow = bestKayakWindow(todayForecast,3);
      const planningTime = (iso:string) => iso.slice(11,16);
      const levelClass = (level:string) => level==='ممتاز'?'excellent':level==='جيد'?'good':level==='حذر'?'caution':'danger';
      const planningReasons = forecastRows
        .flatMap(row=>row.a.reasons)
        .filter((reason,index,array)=>array.indexOf(reason)===index)
        .slice(0,3);
      const planningHoursHtml = forecastRows.slice(0,8).map(({p,a}) =>
        `<article class="departure-hour ${levelClass(a.level)}">
          <b>${planningTime(p.time)}</b>
          <strong>${a.score}<small>/100</small></strong>
          <span>${translateLevel(a.level)}</span>
          <small>🌊 ${value(p.waveHeight,' m')} · 💨 ${value(p.windSpeed,' km/h')}</small>
        </article>`
      ).join('');
      const planningWindowHtml = bestPlanningWindow
        ? `<div class="departure-best">
            <span>🎣 ${t('أفضل نافذة متوقعة')}</span>
            <strong>${planningTime(bestPlanningWindow.start)} → ${planningTime(bestPlanningWindow.end)}</strong>
            <small>${t('نافذة تخطيطية لمدة 3 ساعات، وليست ضماناً لسلامة الرحلة.')}</small>
          </div>`
        : '';
      const planningReasonsHtml = planningReasons.length
        ? `<ul class="departure-reasons">${planningReasons.map(reason=>`<li>• ${translateReason(reason)}</li>`).join('')}</ul>`
        : '';
      const departurePlanning = `<section class="departure-planning">
        <div class="departure-planning-head">
          <div><b>🎣 ${t('تخطيط الخروج')}</b><small>${t('مبني على الساعات القادمة عند هذه النقطة')}</small></div>
          <strong class="${levelClass(planningLevel)}">${planningScore}/100</strong>
        </div>
        <div class="departure-status ${levelClass(planningLevel)}">${translateLevel(planningLevel)}</div>
        ${planningWindowHtml}
        <div class="departure-hours">${planningHoursHtml || `<small>${t('لا توجد بيانات ساعية كافية للتخطيط.')}</small>`}</div>
        ${planningReasonsHtml}
        <small class="departure-note">${t('هذا تقييم تخطيطي للظروف البحرية والرياح، وليس شهادة سلامة. أعد التحقق من التوقعات قبل الانطلاق.')}</small>
      </section>`;
      const reportBase = reportHtml(data,placeName)
        .replace('<div class="report-grid">', departurePlanning + '<div class="report-grid">')
        + (
          data.sea.maxWaveHeightToday != null && data.sea.waveHeight != null && data.sea.maxWaveHeightToday > data.sea.waveHeight + 0.3
            ? `<div class="sea-wave-warning">⚠️ <b>${t('قد يرتفع الموج خلال اليوم')}</b><span>${value(data.sea.waveHeight,' m')} → ${value(data.sea.maxWaveHeightToday,' m')}</span></div>`
            : ''
        );
      const depthCard = `<div class="depth-card">🪸 ${t('العمق التقريبي')} <b>${t('جاري جلب آخر البيانات…')}</b><small>${t('المصدر:')} —</small></div>`;
      const initialHtml = reportBase.replace('</div><small>', `</div>${depthCard}<small>`) +
        `<hr><div class="kayak-assessment ${assessment.level}"><div class="kayak-assessment-head"><b>${t('ملاءمة ظروف الكياك')}</b><strong>${translateLevel(assessment.level)}</strong></div><div class="kayak-score"><span>${assessment.score}</span><small>/100</small></div><p>${escapeHtml(assessment.recommendation)}</p><ul>${assessment.reasons.map(reason=>`<li>${translateReason(reason)}</li>`).join('')}</ul><small>${t('تقييم تخطيطي مبني على بيانات الطقس والبحر المتاحة، وليس ضماناً لسلامة الرحلة.')}</small></div>`;
      report.innerHTML = initialHtml;
      bindClose();

      // Add the coastal name whenever reverse geocoding finishes, without rebuilding the report.
      void placeNamePromise.then(resolvedName => {
        if (!isCurrent() || !resolvedName) return;
        const placeEl = report.querySelector<HTMLElement>('.report-place');
        if (placeEl) placeEl.innerHTML = '📍 ' + escapeHtml(resolvedName);
      });

      // Species compatibility enrichment: uses the selected point's bathymetry and current sea temperature.
      void (async () => {
        try {
          const bathy = await getBathymetryDepth(map,lng,lat);
          if (!isCurrent()) return;
          renderDepth(
            bathy ? `${bathy.depthMeters.toFixed(1)} m` : t('غير متاح'),
            bathy?.source ?? t('لا توجد قراءة متاحة')
          );
          const depth = bathy?.depthMeters;
          const seaTemp = data.sea.seaTemperature;
          const substrateCode = bathy?.substrate?.code ?? null;
          const substrateLabel = bathy?.substrate?.label ?? null;
          const substrateName = substrateCode===1?'mud':substrateCode===2?'sandy':substrateCode===3?'coarse':substrateCode===4?'mixed':substrateCode===5?'rocky':null;
          const month = new Date().getMonth()+1;
          const species = [
            {ar:'الدنيس / Daurade',fr:'Daurade',min:2,max:50,tmin:14,tmax:28,bottom:['sandy','rocky','seagrass'],season:[3,4,5,6,7,8,9,10,11]},
            {ar:'السار / Sar',fr:'Sar',min:3,max:55,tmin:15,tmax:27,bottom:['rocky','reef','seagrass'],season:[4,5,6,7,8,9,10,11]},
            {ar:'الشرغو / Diplodus',fr:'Diplodus',min:2,max:45,tmin:14,tmax:27,bottom:['rocky','reef','seagrass'],season:[3,4,5,6,7,8,9,10]},
            {ar:'القاروص / Loup',fr:'Loup de mer',min:1,max:30,tmin:10,tmax:25,bottom:['sandy','rocky','estuary'],season:[9,10,11,12,1,2,3,4]},
            {ar:'المرمار / Pageot',fr:'Pageot',min:15,max:120,tmin:13,tmax:24,bottom:['sandy','rocky'],season:[4,5,6,7,8,9,10]},
            {ar:'الحلوفة / Balistes capriscus',fr:'Baliste gris / Balistes capriscus',min:10,max:100,tmin:18,tmax:24,bottom:['rocky','reef','seagrass','sandy'],season:[5,6,7,8,9,10]}
          ];
          const compatibility = (s:{min:number;max:number;tmin:number;tmax:number,bottom?:string[],season?:number[]}) => {
            if (depth == null) return {score:0, reasons:[] as string[]};
            const reasons:string[]=[];
            const depthFit = depth >= s.min && depth <= s.max;
            const depthScore = depthFit ? 35 : Math.max(0, 35 - Math.min(Math.abs(depth-s.min),Math.abs(depth-s.max))*1.2);
            reasons.push(depthFit ? (getLang()==='fr'?'Profondeur adaptée':'العمق مناسب') : (getLang()==='fr'?'Profondeur moins adaptée':'العمق أقل ملاءمة'));
            const tempScore = seaTemp == null ? 15 : (seaTemp >= s.tmin && seaTemp <= s.tmax ? 25 : Math.max(0,25-Math.min(Math.abs(seaTemp-s.tmin),Math.abs(seaTemp-s.tmax))*4));
            if (seaTemp != null) reasons.push(seaTemp >= s.tmin && seaTemp <= s.tmax ? (getLang()==='fr'?'Température adaptée':'الحرارة مناسبة') : (getLang()==='fr'?'Température moins adaptée':'الحرارة أقل ملاءمة'));
            const seasonFit = s.season?.includes(month);
            const seasonScore = seasonFit ? 20 : 8;
            reasons.push(seasonFit ? (getLang()==='fr'?'Saison favorable':'الموسم مناسب') : (getLang()==='fr'?'Saison moins favorable':'الموسم أقل ملاءمة'));
            const current = Number(data.sea.currentVelocity);
            const currentScore = Number.isFinite(current) ? (current>=0.2&&current<=1.2 ? 10 : current<0.2 ? 5 : 3) : 5;
            if (Number.isFinite(current)) reasons.push(current>=0.2&&current<=1.2 ? (getLang()==='fr'?'Courant favorable':'التيار مناسب') : (getLang()==='fr'?'Courant moins favorable':'التيار أقل ملاءمة'));
            const bottomFit = !!(substrateName && s.bottom?.includes(substrateName));
            const substrateScore = bottomFit ? 20 : (substrateName ? 6 : 10);
            if (substrateName) reasons.push(bottomFit ? (getLang()==='fr'?'Fond marin adapté':'نوع القاع مناسب') : (getLang()==='fr'?'Fond marin moins adapté':'نوع القاع أقل ملاءمة'));
            return {score:Math.round(Math.min(100,depthScore+tempScore+seasonScore+currentScore+substrateScore)),reasons};
          };
          const ranked = species.map(s=>({...s,...compatibility(s)})).sort((a,b)=>b.score-a.score).slice(0,4);
          const card = document.createElement('div');
          card.className='species-compat';
          card.innerHTML = `<div class="species-compat-head"><b>🐟 ${getLang()==='fr'?'Espèces potentielles':'الأنواع المحتملة'}</b><small>${getLang()==='fr'?'Compatibilité environnementale':'ملاءمة بيئية'}</small></div><div class="species-compat-list">${ranked.map((s,i)=>`<details ${i===0?'open':''}><summary><span>🐟 ${escapeHtml(getLang()==='fr'?s.fr:s.ar)}</span><strong>${s.score}/100</strong></summary><div class="species-reasons">${s.reasons.map(r=>`<span>• ${escapeHtml(r)}</span>`).join('')}</div></details>`).join('')}</div><small>${getLang()==='fr'?'La note explique la compatibilité environnementale; elle ne garantit pas la présence du poisson.':'الدرجة تشرح الملاءمة البيئية ولا تضمن وجود السمك في النقطة.'}</small>`;
          if (!isCurrent()) return;
          const depthCardEl = report.querySelector('.depth-card');
          if (depthCardEl) {
            if (substrateLabel) {
              const sub = document.createElement('div');
              sub.className='substrate-card';
              sub.innerHTML=`🪨 <b>${getLang()==='fr'?'Fond marin':'نوع القاع'}</b><span>${escapeHtml(getLang()==='fr' ? ({'Mud to muddy Sand':'Vase / sable vaseux','Sand':'Sable','Coarse substrate':'Sédiment grossier','Mixed sediment':'Sédiment mixte','Rock & boulders':'Roche et blocs'} as Record<string,string>)[substrateLabel] || substrateLabel : ({'Mud to muddy Sand':'طين / رمل طيني','Sand':'رمل','Coarse substrate':'رواسب خشنة','Mixed sediment':'رواسب مختلطة','Rock & boulders':'صخور وكتل'} as Record<string,string>)[substrateLabel] || substrateLabel)}</span>`;
              depthCardEl.insertAdjacentElement('afterend',sub);
            }
            depthCardEl.insertAdjacentElement('afterend',card);
          }
        } catch {
          // Species enrichment is optional and never blocks the sea report.
        }
      })();

      // Verified marine reference points.
      // These are scientific sampling locations, NOT fabricated fishing spots.
      // Coordinates/substrate are taken from a published Tunisia marine survey.
      try {
        const marinePoints = [
          {id:'ras-blat',ar:'رأس بلاط · رفراف',fr:'Ras Blat · Rafraf',icon:'🪨',color:'#f59e0b',lat:37.1969,lng:10.2089,descAr:'نقطة بحرية موثقة — قاع رملي/صخري',descFr:'Point marin documenté — fond sableux/rocheux'},
          {id:'ras-ettarf',ar:'رأس الطرف · رفراف',fr:'Ras Ettarf · Rafraf',icon:'🔵',color:'#38bdf8',lat:37.1822,lng:10.2653,descAr:'نقطة بحرية موثقة — قاع رملي',descFr:'Point marin documenté — fond sableux'},
          {id:'ghar-el-melh',ar:'غار الملح',fr:'Ghar El Melh',icon:'🟠',color:'#fb923c',lat:37.1625,lng:10.2147,descAr:'نقطة بحرية موثقة — قاع رملي/طيني',descFr:'Point marin documenté — fond sableux/vaseux'},
          {id:'la-marsa',ar:'المرسى',fr:'La Marsa',icon:'🌿',color:'#22c55e',lat:36.8956,lng:10.3219,descAr:'نقطة بحرية موثقة — قاع رملي/صخري',descFr:'Point marin documenté — fond sableux/rocheux'},
          {id:'sidi-bou-said',ar:'سيدي بوسعيد',fr:'Sidi Bou Saïd',icon:'🪨',color:'#ef4444',lat:36.8661,lng:10.3519,descAr:'نقطة بحرية موثقة — قاع صخري',descFr:'Point marin documenté — fond rocheux'},
          {id:'salammbo',ar:'قرطاج / سلامبو',fr:'Carthage / Salammbo',icon:'🪨',color:'#a78bfa',lat:36.8447,lng:10.3272,descAr:'نقطة بحرية موثقة — قاع صخري',descFr:'Point marin documenté — fond rocheux'}
        ];
        const features = marinePoints.map((p:any) => ({
          type:'Feature' as const,
          properties:{
            id:p.id,
            label:getLang()==='fr'?p.fr:p.ar,
            icon:p.icon,
            description:getLang()==='fr'?p.descFr:p.descAr,
            color:p.color
          },
          geometry:{type:'Point' as const,coordinates:[p.lng,p.lat]}
        }));
        const sourceId='pkf-marine-points';
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId,{type:'geojson',data:{type:'FeatureCollection',features}});
          map.addLayer({
            id:'pkf-marine-points-layer',
            type:'circle',
            source:sourceId,
            paint:{
              'circle-radius':7,
              'circle-color':['get','color'],
              'circle-stroke-color':'#fff',
              'circle-stroke-width':2,
              'circle-opacity':0.90
            }
          });
        } else {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features} as any);
        }
        (window as any).__rlxMarinePointsTypes=marinePoints;
      } catch {}
      
      // Optional services must never delay the core sea-state report.
      void (async () => {
        try {
          const bathy = await getBathymetryDepth(map,lng,lat);
          if (!isCurrent()) return;
          renderDepth(
            bathy ? `${bathy.depthMeters.toFixed(1)} m` : t('غير متاح'),
            bathy?.source ?? t('لا توجد قراءة متاحة')
          );
        } catch {
          if (!isCurrent()) return;
          renderDepth(t('غير متاح'),t('لا توجد قراءة متاحة'));
        }
      })();

      void (async () => {
        try {
          const hourly = await marine.getHourlyKayakForecast(lat,lng);
          if (!isCurrent()) return;
          const best = bestKayakWindow(hourly,3);
          if (!best) return;
          const fmt=(x:string)=>new Date(x).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});
          const level=best.score>=82?'ممتاز':best.score>=65?'جيد':best.score>=45?'حذر':'غير مناسب';
          const card = document.createElement('div');
          card.className='kayak-window';
          card.innerHTML=`<b>⏰ ${t('أفضل نافذة للرحلة')}</b><strong>${fmt(best.start)} – ${fmt(best.end)}</strong><span>${t('متوسط ملاءمة النافذة')}: ${best.score}/100 · ${translateLevel(level)}</span>`;
          if (!isCurrent()) return;
          const assessmentEl = report.querySelector('.kayak-assessment');
          if (assessmentEl) assessmentEl.insertAdjacentElement('beforebegin',card);
          else report.appendChild(card);
        } catch {
          // Forecast enrichment is optional; the already rendered current report remains valid.
        }
      })();
    } catch {
      if (!isCurrent()) return;
      report.innerHTML=`<div class="report-head"><b>${t('تعذر جلب البيانات')}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div><p>${t('تم تحديد النقطة، لكن مصادر البيانات لم تستجب الآن.')}</p><button id="retry-report">${getLang()==='fr' ? 'Réessayer' : 'إعادة المحاولة'}</button>`;
      bindClose();
      document.querySelector('#retry-report')?.addEventListener('click',()=>selectPoint(lat,lng,label));
    }
  };

  const showTodayWeather = async (lat:number, lng:number) => {
    if (routeTripId) removeRoute();
    report.classList.remove('hidden');
    setReportOpen(true);
    tripPanel.classList.add('hidden');
    measurePanel.classList.add('hidden');
    measuring = false;
    report.innerHTML = `<div class="report-head"><b>🌤️ ${t('حالة الطقس اليوم')}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div><div class="sea-loading">${t('جاري جلب طقس اليوم…')}</div>`;
    document.querySelector('#close-report')?.addEventListener('click', closeReport);
    try {
      const d = await marine.getTodayWeatherSummary(lat,lng);
      const weatherText = (code:number|null) => {
        if (code==null) return t('بيانات غير متاحة');
        if (code===0) return t('صافي');
        if ([1,2,3].includes(code)) return t('غائم جزئياً');
        if ([45,48].includes(code)) return t('ضباب');
        if ([51,53,55,56,57].includes(code)) return t('رذاذ');
        if ([61,63,65,66,67,80,81,82].includes(code)) return t('أمطار');
        if ([71,73,75,77,85,86].includes(code)) return t('ثلوج');
        if ([95,96,99].includes(code)) return t('عواصف رعدية');
        return t('متغير');
      };
      const dir = (deg:number|null) => {
        if(deg==null) return '—';
        const dirs=['N','NE','E','SE','S','SW','W','NW'];
        return dirs[Math.round(deg/45)%8];
      };
      const time = (v:string|null) => v ? v.slice(11,16) : '—';
      const placeName = await reverseCoastalName(lat,lng,getLang()).catch(() => null);
      report.innerHTML = `
        <div class="report-head"><b>🌤️ ${t('حالة الطقس اليوم')}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div>
        <section class="weather-location-banner">
          <b>📍 ${placeName || (getLang()==='fr' ? 'Point sélectionné' : 'النقطة المحددة')}</b>
          <small dir="ltr">${lat.toFixed(5)}, ${lng.toFixed(5)}</small>
        </section>
        <section class="sea-overview weather-overview">
          <div><span>🌡️ ${t('الحرارة')}</span><b>${value(d.temperatureMin,' °C')} – ${value(d.temperatureMax,' °C')}</b></div>
          <div><span>🌧️ ${t('احتمال الأمطار')}</span><b>${value(d.precipitationProbabilityMax,' %')}</b></div>
          <div><span>💨 ${t('الرياح')}</span><b>${value(d.windMin,' km/h')} – ${value(d.windMax,' km/h')}</b></div>
          <div><span>💨 ${t('أقصى هبات')}</span><b>${value(d.gustMax,' km/h')}</b></div>
          <div><span>🧭 ${t('اتجاه الرياح')}</span><b dir="ltr">${dir(d.windDirectionDominant)}</b></div>
          <div><span>💧 ${t('الرطوبة')}</span><b>${value(d.humidityMean,' %')}</b></div>
        </section>
        <section class="sea-best-window weather-highlight">
          <div><b>☀️ ${weatherText(d.weatherCode)}</b></div>
          <p>🌅 ${t('الشروق')} ${time(d.sunrise)} &nbsp; · &nbsp; 🌇 ${t('الغروب')} ${time(d.sunset)}</p>
          <small>${t('توقعات اليوم حسب الموقع المحدد')}</small>
        </section>
        <div class="sea-source"><span>${t('المصدر:')} Open-Meteo</span><span>${t('آخر تحديث:')} ${new Date().toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit',hour12:false})}</span></div>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    } catch {
      report.innerHTML=`<div class="report-head"><b>${t('تعذر جلب طقس اليوم')}</b><button id="close-report">×</button></div><p>${t('حاول مرة أخرى بعد قليل.')}</p>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    }
  };

  const showTodaySea = async (lat:number, lng:number) => {
    if (routeTripId) removeRoute();
    report.classList.remove('hidden');
    setReportOpen(true);
    tripPanel.classList.add('hidden');
    measurePanel.classList.add('hidden');
    measuring = false;
    report.innerHTML = `<div class="report-head"><b>🌊 ${t('حالة البحر اليوم')}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div><div class="sea-loading">${t('جاري جلب توقعات اليوم…')}</div>`;
    document.querySelector('#close-report')?.addEventListener('click', closeReport);
    try {
      const [d, hourly] = await Promise.all([
        marine.getTodaySummary(lat, lng),
        marine.getHourlyKayakForecast(lat, lng)
      ]);
      const todayPoints = hourly.filter(p => p.time.slice(0,10) === d.date);
      const nextPoints = todayPoints.slice(0,12);
      const assess = (p:HourlyKayakPoint) => assessKayakConditions({
        windSpeed:p.windSpeed, windGusts:p.windGusts, windDirection:p.windDirection,
        waveHeight:p.waveHeight, waveDirection:p.waveDirection, wavePeriod:p.wavePeriod,
        swellHeight:p.swellHeight, swellPeriod:p.swellPeriod, currentVelocity:p.currentVelocity
      });
      const rows = nextPoints.map(p => ({p,a:assess(p)}));
      const best = bestKayakWindow(todayPoints,3);
      const levelClass = (level:string) => level==='ممتاز'?'excellent':level==='جيد'?'good':level==='حذر'?'caution':'danger';
      const levelLabel = (level:string) => translateLevel(level);
      const timeLabel = (iso:string) => iso.slice(11,16);
      const hourCards = rows.map(({p,a}) => `<article class="sea-hour-card ${levelClass(a.level)}">
        <div class="sea-hour-time">${timeLabel(p.time)}</div>
        <strong>${a.score}<small>/100</small></strong>
        <b>${levelLabel(a.level)}</b>
        <span>🌊 ${value(p.waveHeight,' m')}</span>
        <span>💨 ${value(p.windSpeed,' km/h')}</span>
        <span>💨 ${value(p.windGusts,' km/h')}</span>
      </article>`).join('');
      const bestHtml = best
        ? `<section class="sea-best-window">
            <div><b>🎣 ${t('أفضل نافذة متوقعة')}</b><strong>${best.score}/100</strong></div>
            <p>${timeLabel(best.start)} → ${timeLabel(best.end)}</p>
            <small>${t('نافذة تخطيطية لمدة 3 ساعات، وليست ضماناً لسلامة الرحلة.')}</small>
          </section>`
        : '';
      const overall = todayPoints.length ? Math.round(todayPoints.slice(0,12).map(assess).reduce((n,a)=>n+a.score,0)/Math.min(12,todayPoints.length)) : null;
      const overallLevel = overall==null ? '—' : overall>=82?'ممتاز':overall>=65?'جيد':overall>=45?'حذر':'غير مناسب';
      const reasons = rows.flatMap(x => x.a.reasons).filter((v,i,a)=>a.indexOf(v)===i).slice(0,3);
      const reasonHtml = reasons.length ? `<ul class="sea-reasons">${reasons.map(r=>`<li>• ${translateReason(r)}</li>`).join('')}</ul>` : '';
      report.innerHTML = `
        <div class="report-head"><b>🌊 ${t('حالة البحر اليوم')}</b><button id="close-report" aria-label="${t('إغلاق')}">×</button></div>
        <div class="sea-location">📍 ${ltr(lat.toFixed(4)+', '+lng.toFixed(4))}</div>
        <section class="sea-overview">
          <div><span>${t('تقييم اليوم')}</span><strong>${overall ?? '—'}<small>/100</small></strong><b>${overallLevel==='—'?'—':levelLabel(overallLevel)}</b></div>
          <div><span>🌊 ${t('نطاق الموج')}</span><b>${value(d.waveMin,' m')} – ${value(d.waveMax,' m')}</b></div>
          <div><span>💨 ${t('نطاق الرياح')}</span><b>${value(d.windMin,' km/h')} – ${value(d.windMax,' km/h')}</b></div>
          <div><span>💨 ${t('أقصى هبات')}</span><b>${value(d.gustMin,' km/h')} – ${value(d.gustMax,' km/h')}</b></div>
        </section>
        ${bestHtml}
        <button type="button" class="sea-section-toggle" id="sea-hours-toggle" aria-expanded="true">
          <span>🕐 ${t('الساعات القادمة')}</span><span class="sea-section-chevron" aria-hidden="true">⌃</span>
        </button>
        <div class="sea-hour-strip" id="sea-hour-strip">${hourCards || `<p>${t('لا توجد بيانات ساعية متاحة')}</p>`}</div>
        ${reasonHtml ? `<section class="sea-reasons-box"><b>${t('أهم عوامل التقييم')}</b>${reasonHtml}</section>` : ''}
        <div class="sea-source">
          <span>${t('المصدر:')} Open-Meteo</span>
          <span>${t('بيانات اليوم حسب الموقع المحدد')}</span>
        </div>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);

      const hoursToggle = document.querySelector<HTMLButtonElement>('#sea-hours-toggle');
      const hoursStrip = document.querySelector<HTMLElement>('#sea-hour-strip');
      hoursToggle?.addEventListener('click', () => {
        if (!hoursStrip) return;
        const open = hoursToggle.getAttribute('aria-expanded') !== 'false';
        hoursToggle.setAttribute('aria-expanded', String(!open));
        hoursStrip.classList.toggle('collapsed', open);
        const chevron = hoursToggle.querySelector<HTMLElement>('.sea-section-chevron');
        if (chevron) chevron.textContent = open ? '⌄' : '⌃';
      });
    } catch {
      report.innerHTML = `<div class="report-head"><b>${t('تعذر جلب حالة البحر')}</b><button id="close-report">×</button></div><p>${t('حاول مرة أخرى بعد قليل.')}</p>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    }
  };

  const showWeeklySea = async (lat:number, lng:number) => {
    if (routeTripId) removeRoute();
    report.classList.remove('hidden');
    setReportOpen(true);
    tripPanel.classList.add('hidden');
    measurePanel.classList.add('hidden');
    measuring = false;
    report.innerHTML = `<div class="report-head"><b>${t('حالة البحر 7 أيام')}</b><button id="close-report">×</button></div><p>${t('جاري حساب توقعات الأسبوع…')}</p>`;
    document.querySelector('#close-report')?.addEventListener('click', closeReport);
    try {
      const [days, modelDays] = await Promise.all([marine.getWeeklySeaSummary(lat,lng), marine.getWeatherModelComparison(lat,lng)]);
      const formatForecastDate=(date:string)=> {
        const d = new Date(date + 'T12:00:00');
        return new Intl.DateTimeFormat(locale(), {
          weekday:'long', day:'numeric', month:'long'
        }).format(d);
      };
      const dayLabel=(date:string,index:number)=>{
        if(index===0) return t('اليوم');
        if(index===1) return t('غداً');
        if(index===2) return t('بعد غد');
        return formatForecastDate(date);
      };
      const score=(d:WeeklySeaSummary)=>{
        let s=100;
        if(d.waveMax!=null) s-=d.waveMax<=0.5?0:d.waveMax<=0.8?10:d.waveMax<=1.2?25:45;
        if(d.windMax!=null) s-=d.windMax<=15?0:d.windMax<=25?10:d.windMax<=35?25:40;
        if(d.gustMax!=null) s-=d.gustMax<=25?0:d.gustMax<=40?10:25;
        return Math.max(0,Math.min(100,Math.round(s)));
      };
      const level=(s:number)=>s>=82?'ممتاز':s>=65?'جيد':s>=45?'حذر':'غير مناسب';
      const cards=days.map((d,i)=>{
        const s=score(d);
        return `<article class="weekly-sea-card">
          <div class="weekly-sea-day"><b>${dayLabel(d.date,i)}</b><strong>${translateLevel(level(s))}</strong></div>
          <div class="weekly-sea-values">
            <span>🌊 ${t('أقصى موج')} <b>${value(d.waveMax,' m')}</b></span>
            <span>🧭 ${t('اتجاه الموج السائد')} <b>${value(d.waveDirection,'°')}</b></span>
            <span>💨 ${t('أقصى رياح')} <b>${value(d.windMax,' km/h')}</b></span>
            <span>💨 ${t('أقصى هبات')} <b>${value(d.gustMax,' km/h')}</b></span>
          </div>
        </article>`;
      }).join('');
      const currentByDate = new Map(days.map(d=>[d.date,d]));
      const modelCards = modelDays.map((m:WeatherModelComparisonDay,i:number)=>{
        const label=dayLabel(m.date,i);
        const fmt=(v:number|null,unit:string)=>v==null?'--':v.toFixed(0)+unit;
        const current=currentByDate.get(m.date);
        return '<article class="model-compare-card">' +
          '<div class="model-compare-head"><b>'+label+'</b><strong>'+(m.agreement==null?'--':m.agreement+'%')+'</strong></div>' +
          '<div class="model-compare-grid">' +
          '<span>ECMWF <b>'+fmt(m.ecmwf.windMax,' km/h')+'</b></span>' +
          '<span>GFS <b>'+fmt(m.gfs.windMax,' km/h')+'</b></span>' +
          '<span>ICON <b>'+fmt(m.icon.windMax,' km/h')+'</b></span>' +
          '<span>'+t('فرق الرياح')+' <b>'+fmt(m.windSpread,' km/h')+'</b></span>' +
          '<span>'+t('متوسط التيار')+' <b>'+fmt(current?.currentAvg ?? null,' km/h')+'</b></span>' +
          '<span>'+t('أقصى تيار')+' <b>'+fmt(current?.currentMax ?? null,' km/h')+'</b></span>' +
          '<span>'+t('اتجاه التيار')+' <b>'+directionValue(current?.currentDirection ?? null,current?.currentAvg ?? null)+'</b></span>' +
          '</div></article>';
      }).join('');
      report.innerHTML = '<div class="report-head"><b>'+t('حالة البحر 7 أيام')+'</b><button id="close-report">×</button></div>' +
        '<p>📍 '+ltr(lat.toFixed(4)+', '+lng.toFixed(4))+'</p>' +
        '<div class="weekly-sea-list">'+(cards || '<p>'+t('لا توجد بيانات أسبوعية متاحة')+'</p>')+'</div>' +
        '<section class="model-comparison">' +
          '<div class="model-comparison-title"><b>📊 '+t('مقارنة النماذج')+'</b><small>'+t('توافق النماذج')+'</small></div>' +
          '<div class="model-comparison-list">'+(modelCards || '<p>'+t('بيانات غير متاحة')+'</p>')+'</div>' +
          '<small>'+t('الثقة هنا تقيس تقارب نماذج الرياح الثلاثة، وليست دقة مضمونة.')+'</small>' +
        '</section>' +
        '<small>'+t('المصدر:')+' Open-Meteo · ECMWF · GFS · ICON</small>';
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    } catch {
      report.innerHTML=`<div class="report-head"><b>${t('تعذر جلب توقعات الأسبوع')}</b><button id="close-report">×</button></div><p>${t('حاول مرة أخرى بعد قليل.')}</p>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    }
  };

  document.querySelector('#weekly-sea')?.addEventListener('click', () => {
    const markerPoint = marker?.getLngLat();
    const target = selectedLocation ?? (markerPoint ? {lat: markerPoint.lat, lng: markerPoint.lng} : null) ?? (() => { const center=map.getCenter(); return {lat:center.lat,lng:center.lng}; })();
    showWeeklySea(target.lat,target.lng);
  });

  document.querySelector('#today-sea')?.addEventListener('click', async () => {
    // Weather must always follow the explicitly selected point. If there is no
    // selected point, use GPS rather than silently falling back to map center.
    const markerPoint = marker?.getLngLat();
    const target = selectedLocation
      ?? (markerPoint ? {lat: markerPoint.lat, lng: markerPoint.lng} : null);
    if (target) {
      showTodayWeather(target.lat, target.lng);
      return;
    }
    try {
      const position = await getDeviceLocation();
      const gps = {lat: position.lat, lng: position.lng};
      selectedLocation = {lat:gps.lat, lng:gps.lng, label:null};
      showTodayWeather(gps.lat, gps.lng);
    } catch {
      report.innerHTML = `<div class="report-head"><b>📍 ${getLang()==='fr'?'Position requise':'يلزم تحديد موقع'}</b><button id="close-report">×</button></div><p>${getLang()==='fr'?'Sélectionnez un point sur la carte ou activez le GPS.':'حدد نقطة على الخريطة أو فعّل GPS لعرض الطقس بدقة.'}</p>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    }
  });

  map.on('click',event=>{
    if (measuring) {
      if (measurePoints.length>=2) return;
      const point:[number,number]=[event.lngLat.lng,event.lngLat.lat];
      measurePoints.push(point);
      const marker=new maplibregl.Marker({color: measurePoints.length===1 ? '#f59e0b' : '#22c55e'}).setLngLat(point).addTo(map);
      measureMarkers.push(marker);
      if (measurePoints.length===2) {
        map.addSource('measure-source',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:measurePoints}}});
        map.addLayer({id:'measure-line',type:'line',source:'measure-source',paint:{'line-color':'#f59e0b','line-width':4,'line-dasharray':[1,1]}});
      }
      renderMeasurement();
      return;
    }
    selectPoint(event.lngLat.lat,event.lngLat.lng);
  });
  document.querySelector('#search-form')?.addEventListener('submit',async event=>{
    event.preventDefault(); const input=document.querySelector<HTMLInputElement>('#search-input')!; const results=document.querySelector<HTMLElement>('#search-results')!; const query=input.value.trim(); if(!query)return;
    results.classList.remove('hidden'); results.innerHTML='<div>'+t('جاري البحث…')+'</div>';
    try{const places=await geocoder.search(query,getLang()); if(!places.length){results.innerHTML='<div>'+t('لم يتم العثور على موقع تونسي مطابق.')+'</div>';return}
      results.innerHTML=places.map((p,i)=>`<button data-index="${i}"><b>${p.name}</b><small>${p.admin1??''} ${p.country??''}</small></button>`).join('');
      results.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.addEventListener('click',()=>{const p=places[Number(button.dataset.index)];results.classList.add('hidden');const label=[p.name,p.admin1].filter(Boolean).join(' — ');map.stop();map.jumpTo({center:[p.longitude,p.latitude],zoom:13.5});selectPoint(p.latitude,p.longitude,label)}))
    }catch{results.innerHTML='<div>'+t('تعذر الاتصال بخدمة البحث. حاول مرة أخرى.')+'</div>'}
  });
  // Keep the wind layer synchronized with map navigation without fetching on every pixel.
  let windMoveTimer:number|null = null;
  map.on('moveend', () => {
    if (!windFlowEnabled) return;
    if (windMoveTimer != null) window.clearTimeout(windMoveTimer);
    windMoveTimer = window.setTimeout(() => { void refreshWindFlow(); }, 350);
  });

  // Live sea data refresh: while the app is open, refresh the selected point every 15 minutes.
  // A single timer is shared across language/UI re-renders so it cannot multiply.
  const refreshKey = '__pkfSeaRefreshTimer';
  const previousRefresh = (window as unknown as Record<string, unknown>)[refreshKey];
  if (typeof previousRefresh === 'number') window.clearInterval(previousRefresh);
  const refreshTimer = window.setInterval(() => {
    if (!selectedLocation || report.classList.contains('hidden')) return;
    const target = {...selectedLocation};
    void selectPoint(target.lat, target.lng, target.label);
  }, 15 * 60 * 1000);
  (window as unknown as Record<string, unknown>)[refreshKey] = refreshTimer;

  map.on('load',()=>geolocate.trigger());
}

// Production deployment refresh: 2026-10-05T20:39:12.734Z