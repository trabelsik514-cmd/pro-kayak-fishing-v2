import maplibregl from 'maplibre-gl';
import { MarineService, type HourlyKayakPoint, type WeeklySeaSummary, type WeatherModelComparisonDay } from '../marine/MarineService';
import { GeocodingService, reverseCoastalName } from '../location/GeocodingService';
import { createMap } from '../map/createMap';
import { assessKayakConditions } from '../kayak/KayakAssessment';
import { loadTrips, saveTrip, deleteTrip, makeTrip, type KayakTrip, type TrackPoint } from '../trips/TripStore';
import { getBathymetryDepth } from '../bathymetry/BathymetryService';

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
  'اتجاه الموج':'Direction des vagues',
  'فترة الموج':'Période des vagues',
  'Swell':'Swell',
  'الرياح':'Vent',
  'الهبات':'Rafales',
  'اتجاه الرياح':'Direction du vent',
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

const t = (ar: string) => getLang() === 'fr' ? (FR[ar] ?? ar) : ar;
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
    <p>📍 ${escapeHtml(placeName ?? t('موقع بحري محدد'))}</p><p class="coords">${ltr(`${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`)}</p>
    <div class="report-grid">
      <span>🌊 ${t('الموج')} <b>${value(data.sea.waveHeight,' m')}</b></span><span>🧭 ${t('اتجاه الموج')} <b>${value(data.sea.waveDirection,'°')}</b></span>
      <span>〰️ ${t('Swell')} <b>${value(data.sea.swellHeight,' m')}</b></span><span>⏱️ ${t('فترة الموج')} <b>${value(data.sea.wavePeriod,' s')}</b></span>
      <span>💨 ${t('الرياح')} <b>${value(data.weather.windSpeed,' km/h')}</b></span><span>💨 ${t('الهبات')} <b>${value(data.weather.windGusts,' km/h')}</b></span>
      <span>🧭 ${t('اتجاه الرياح')} <b>${value(data.weather.windDirection,'°')}</b></span><span>🌡️ ${t('الهواء')} <b>${value(data.weather.temperature,' °C')}</b></span>
      <span>🌊 ${t('حرارة البحر')} <b>${value(data.sea.seaTemperature,' °C')}</b></span><span>📈 ${t('الضغط')} <b>${value(data.weather.pressure,' hPa')}</b></span>
      <span>🌊 ${t('التيار')} <b>${value(data.sea.currentVelocity,' km/h')}</b></span><span>🧭 ${t('اتجاه التيار')} <b>${directionValue(data.sea.currentDirection,data.sea.currentVelocity)}</b></span>
    </div><small class="report-updated">${t('آخر جلب:')} ${new Date(data.fetchedAt).toLocaleTimeString(locale())}</small>`;
}

export function createApp(root: HTMLElement) {
  setDocumentLanguage();
  root.innerHTML = `<main class="shell"><header class="topbar"><a class="brand" href="#" aria-label="PRO KAYAK FISHING V2"><img class="brand-logo" src="/brand/file_00000000540c820abaeb6846e360276e.png?v=20261005-2238" alt="PRO KAYAK FISHING V2"/></a>
    <button id="lang-toggle" class="lang-toggle" type="button">🌐 ${getLang() === 'ar' ? 'FR' : 'العربية'}</button>
    <form id="search-form" class="search"><input id="search-input" placeholder="${t('ابحث عن مدينة أو ساحل تونسي')}" autocomplete="off"/><button type="submit">${t('بحث')}</button></form></header>
    <section id="map" class="map"></section>
    <nav class="map-actions" aria-label="أدوات الخريطة">
      <div class="map-action-group">
        <span class="map-action-label">${t('البحر والرحلات')}</span>
        <div class="map-action-row">
          <button id="today-sea" class="map-action map-action-sea" type="button" aria-label="${t('حالة البحر اليوم')}">🌊 <span>${t('حالة البحر')}</span></button>
          <button id="weekly-sea" class="map-action map-action-weekly-sea" type="button" aria-label="${t('حالة البحر 7 أيام')}">📅 <span>7 ${getLang()==='fr'?'jours':'أيام'}</span></button>
          <button id="measure-toggle" class="map-action map-action-measure" type="button" aria-label="${t('قياس المسافة')}">📏 <span>${t('قياس')}</span></button>
          <button id="trip-toggle" class="map-action map-action-trip" type="button" aria-label="${t('رحلاتي')}">🛶 <span>${t('رحلاتي')}</span></button>
        </div>
      </div>
    </nav>
    <aside class="measure-panel hidden" id="measure-panel"></aside>
    <aside class="trip-panel hidden" id="trip-panel">
      <div class="trip-head"><b>🛶 ${t('سجل الرحلات')}</b><button id="close-trips" aria-label="${t('إغلاق')}">×</button></div>
      <div id="trip-status" class="trip-idle"><b>${t('لا توجد رحلة قيد التسجيل')}</b><span>${t('ابدأ التسجيل لتتبع مسار الكاياك عبر GPS.')}</span></div>
      <button id="trip-record" class="trip-primary">▶️ ${t('بدء تسجيل رحلة')}</button>
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
  let marker: maplibregl.Marker | null = null; const report = document.querySelector<HTMLElement>('#report')!;
  let selectedLocation: {lat:number; lng:number; label:string|null} | null = null;
  let pointRequestId = 0;

  const tripPanel = document.querySelector<HTMLElement>('#trip-panel')!;
  const tripList = document.querySelector<HTMLElement>('#trip-list')!;
  const tripStatus = document.querySelector<HTMLElement>('#trip-status')!;
  const routeView = document.querySelector<HTMLElement>('#route-view')!;
  const tripRecord = document.querySelector<HTMLButtonElement>('#trip-record')!;
  let recording = false;
  let watchId: number | null = null;
  let recordedPoints: TrackPoint[] = [];
  let lastRecordedAt = 0;
  let routeTripId: string | null = null;
  let measuring = false;
  let measurePoints: [number, number][] = [];
  let measureMarkers: maplibregl.Marker[] = [];

  const shell = root.querySelector<HTMLElement>('.shell')!;
  const setReportOpen = (open:boolean) => shell.classList.toggle('report-open', open);
  const closeReport = () => { report.classList.add('hidden'); setReportOpen(false); };
  document.querySelector('#close-report')?.addEventListener('click', closeReport);
  document.querySelector('#trip-toggle')?.addEventListener('click', () => {
    const opening = tripPanel.classList.contains('hidden');
    tripPanel.classList.toggle('hidden');
    if (opening) { closeReport(); measurePanel.classList.add('hidden'); measuring = false; renderTrips(); }
  });
  document.querySelector('#close-trips')?.addEventListener('click', () => tripPanel.classList.add('hidden'));
  const measurePanel = document.querySelector<HTMLElement>('#measure-panel')!;
  const measureToggle = document.querySelector<HTMLButtonElement>('#measure-toggle')!;

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
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
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
    if (!navigator.geolocation) {
      tripStatus.className = 'trip-error';
      tripStatus.textContent = getLang()==='fr' ? 'Cet appareil ne fournit pas de GPS.' : 'هذا الجهاز لا يوفر GPS.';
      return;
    }
    recording = true;
    recordedPoints = [];
    lastRecordedAt = 0;
    setRecordingStatus();
    watchId = navigator.geolocation.watchPosition(recordPosition, () => {
      tripStatus.className = 'trip-error';
      tripStatus.innerHTML = getLang()==='fr' ? '<b>Accès au GPS impossible</b><span>Activez la localisation dans les réglages du téléphone puis réessayez.</span>' : '<b>تعذر الوصول إلى GPS</b><span>فعّل الموقع من إعدادات الهاتف ثم حاول مرة أخرى.</span>';
    }, {enableHighAccuracy: true, maximumAge: 5000, timeout: 15000});
  };

  tripRecord.addEventListener('click', () => recording ? stopRecording() : startRecording());
  renderTrips();

  const selectPoint = async (lat:number,lng:number,label:string|null=null): Promise<void> => {
    const requestId = ++pointRequestId;
    if (routeTripId) removeRoute();
    selectedLocation = {lat, lng, label};
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
      const data = await marine.getPointConditions(lat,lng);
      if (!isCurrent()) return;

      const placeName = await placeNamePromise;
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

      const reportBase = reportHtml(data,placeName);
      const depthCard = `<div class="depth-card">🪸 ${t('العمق التقريبي')} <b>${t('جاري جلب آخر البيانات…')}</b><small>${t('المصدر:')} —</small></div>`;
      const initialHtml = reportBase.replace('</div><small>', `</div>${depthCard}<small>`) +
        `<hr><div class="kayak-assessment ${assessment.level}"><div class="kayak-assessment-head"><b>${t('ملاءمة ظروف الكياك')}</b><strong>${translateLevel(assessment.level)}</strong></div><div class="kayak-score"><span>${assessment.score}</span><small>/100</small></div><p>${escapeHtml(assessment.recommendation)}</p><ul>${assessment.reasons.map(reason=>`<li>${translateReason(reason)}</li>`).join('')}</ul><small>${t('تقييم تخطيطي مبني على بيانات الطقس والبحر المتاحة، وليس ضماناً لسلامة الرحلة.')}</small></div>`;
      report.innerHTML = initialHtml;
      bindClose();

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

  const showTodaySea = async (lat:number, lng:number) => {
    if (routeTripId) removeRoute();
    report.classList.remove('hidden');
    setReportOpen(true);
    tripPanel.classList.add('hidden');
    measurePanel.classList.add('hidden');
    measuring = false;
    report.innerHTML = `<div class="report-head"><b>${t('حالة البحر اليوم عند النقطة')}</b><button id="close-report">×</button></div><p>${t('جاري حساب ملخص اليوم…')}</p>`;
    document.querySelector('#close-report')?.addEventListener('click', closeReport);
    try {
      const d = await marine.getTodaySummary(lat, lng);
      report.innerHTML = `<div class="report-head"><b>${t('حالة البحر اليوم عند النقطة')}</b><button id="close-report">×</button></div>
        <p>📅 ${d.date}</p><div class="report-grid">
        <span>🌊 ${t('الموج اليوم')} <b>${value(d.waveMin,' m')} – ${value(d.waveMax,' m')}</b></span>
        <span>🧭 ${t('اتجاه الموج')} <b>${value(d.waveDirection,'°')}</b></span>
        <span>⏱️ ${t('فترة الموج')} <b>${value(d.wavePeriodMin,' s')} – ${value(d.wavePeriodMax,' s')}</b></span>
        <span>〰️ ${t('Swell اليوم')} <b>${value(d.swellMin,' m')} – ${value(d.swellMax,' m')}</b></span>
        <span>💨 ${t('الرياح اليوم')} <b>${value(d.windMin,' km/h')} – ${value(d.windMax,' km/h')}</b></span>
        <span>💨 ${t('الهبات اليوم')} <b>${value(d.gustMin,' km/h')} – ${value(d.gustMax,' km/h')}</b></span>
        </div><small>${t('الموقع:')} ${ltr(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)}</small>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    } catch {
      report.innerHTML = `<div class="report-head"><b>${t('تعذر جلب ملخص اليوم')}</b><button id="close-report">×</button></div><p>${t('حاول مرة أخرى بعد قليل.')}</p>`;
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
      const dayLabel=(date:string,index:number)=>{
        if(index===0) return t('اليوم');
        if(index===1) return t('غداً');
        if(index===2) return t('بعد غد');
        return new Date(date+'T12:00:00').toLocaleDateString(locale(),{weekday:'short',day:'numeric',month:'short'});
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

  document.querySelector('#today-sea')?.addEventListener('click', () => {
    const markerPoint = marker?.getLngLat();
    const target = selectedLocation
      ?? (markerPoint ? {lat: markerPoint.lat, lng: markerPoint.lng} : null)
      ?? (() => { const center = map.getCenter(); return {lat:center.lat, lng:center.lng}; })();
    showTodaySea(target.lat, target.lng);
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
  map.on('load',()=>geolocate.trigger());
}

// Production deployment refresh: 2026-10-05T20:39:12.734Z