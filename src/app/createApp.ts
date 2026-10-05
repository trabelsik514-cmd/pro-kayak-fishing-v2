import maplibregl from 'maplibre-gl';
import { MarineService } from '../marine/MarineService';
import { GeocodingService, reverseCoastalName } from '../location/GeocodingService';
import { createMap } from '../map/createMap';
import { assessKayakConditions } from '../kayak/KayakAssessment';
import { deleteTrip, loadTrips, makeTrip, type KayakTrip, type TrackPoint, totalDistanceKm, saveTrip, encodeTripForShare, decodeTripFromShare, encodeTripsForShare, decodeTripsFromShare } from '../trips/TripStore';

const value = (v: number|null, unit = '') => v == null ? '—' : `${v.toFixed(1)}${unit}`;
const escapeHtml = (v: unknown) => {
  const entities: Record<string, string> = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(v ?? '').replace(/[&<>"']/g, ch => entities[ch] ?? ch);
};

function reportHtml(
  data: Awaited<ReturnType<MarineService['getPointConditions']>>,
  placeName: string|null,
  assessment: ReturnType<typeof assessKayakConditions>
) {
  const levelClass = assessment.level === 'ممتاز' ? 'safe' :
    assessment.level === 'جيد' ? 'good' :
    assessment.level === 'حذر' ? 'caution' : 'danger';

  return `<div class="report-head"><b>تقرير الكاياك التفصيلي</b><button id="close-report" aria-label="إغلاق">×</button></div>
    <div class="place-title">📍 ${escapeHtml(placeName ?? 'موقع بحري محدد')}</div>
    <p class="coords">${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}</p>

    <section class="kayak-summary ${levelClass}">
      <div><span>ملاءمة الكياك</span><strong>${assessment.score}/100</strong></div>
      <b>${assessment.level}</b>
      <p>${assessment.recommendation}</p>
    </section>

    <h4>🌊 حالة البحر</h4>
    <div class="report-grid">
      <span>🌊 الموج <b>${value(data.sea.waveHeight,' m')}</b></span>
      <span>🧭 اتجاه الموج <b>${value(data.sea.waveDirection,'°')}</b></span>
      <span>〰️ Swell <b>${value(data.sea.swellHeight,' m')}</b></span>
      <span>⏱️ فترة الموج <b>${value(data.sea.wavePeriod,' s')}</b></span>
      <span>🌡️ حرارة البحر <b>${value(data.sea.seaTemperature,' °C')}</b></span>
      <span>🌊 التيار <b>${value(data.sea.currentVelocity,' km/h')}</b></span>
      <span>🧭 اتجاه التيار <b>${value(data.sea.currentDirection,'°')}</b></span>
    </div>

    <h4>💨 الطقس والرياح</h4>
    <div class="report-grid">
      <span>💨 الرياح <b>${value(data.weather.windSpeed,' km/h')}</b></span>
      <span>💨 الهبات <b>${value(data.weather.windGusts,' km/h')}</b></span>
      <span>🧭 اتجاه الرياح <b>${value(data.weather.windDirection,'°')}</b></span>
      <span>🌡️ الحرارة <b>${value(data.weather.temperature,' °C')}</b></span>
      <span>💧 الرطوبة <b>${value(data.weather.humidity,' %')}</b></span>
      <span>📈 الضغط <b>${value(data.weather.pressure,' hPa')}</b></span>
    </div>

    <section class="assessment-details">
      <h4>⚠️ لماذا هذا التقييم؟</h4>
      <ul>${assessment.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
      <small>${assessment.dataComplete ? 'تم استلام بيانات السلامة الأساسية.' : 'التقييم محدود لأن بعض بيانات السلامة الأساسية غير متوفرة حالياً.'}</small>
    </section>

    <small class="updated">آخر جلب: ${new Date(data.fetchedAt).toLocaleTimeString('ar-TN')}</small>
    <p class="safety-note">هذا تقرير آلي مبني على مصادر الطقس والبحر المتاحة، ولا يضمن سلامة الرحلة. افحص الظروف محلياً قبل الانطلاق.</p>`;
}

export function createApp(root: HTMLElement) {
  root.innerHTML = `<main class="shell"><header class="topbar"><strong>🎣 PRO KAYAK FISHING</strong>
    <form id="search-form" class="search"><input id="search-input" placeholder="ابحث عن مدينة أو ساحل تونسي" autocomplete="off"/><button type="submit">بحث</button></form></header>
    <section id="map" class="map"></section>
    <button id="today-sea" class="today-sea">🌊 حالة البحر اليوم</button>
    <button id="trip-toggle" class="trip-toggle">🛶 رحلات الكاياك</button>
    <button id="group-toggle" class="group-toggle">👥 المجموعة</button>
    <aside class="report hidden" id="report"></aside>
    <aside class="trip-panel hidden" id="trip-panel"></aside>
    <aside class="group-panel hidden" id="group-panel"></aside>
    <div class="search-results hidden" id="search-results"></div></main>`;

  const { map, geolocate } = createMap('map');
  const marine = new MarineService();
  const geocoder = new GeocodingService();
  let marker: maplibregl.Marker | null = null;
  const report = document.querySelector<HTMLElement>('#report')!;

  const bindClose = () => document.querySelector('#close-report')?.addEventListener('click', () => report.classList.add('hidden'));

  const tripPanel = document.querySelector<HTMLElement>('#trip-panel')!;
  const tripToggle = document.querySelector<HTMLButtonElement>('#trip-toggle')!;
  const groupPanel = document.querySelector<HTMLElement>('#group-panel')!;
  const groupToggle = document.querySelector<HTMLButtonElement>('#group-toggle')!;
  let trips = loadTrips();
  let groupTrips: KayakTrip[] = [];
  let recording = false;
  let watchId: number | null = null;
  let trackPoints: TrackPoint[] = [];
  let routeSourceReady = false;

  const routeGeoJson = () => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: trackPoints.map(p => [p.lng, p.lat])
    }
  });

  const ensureRouteLayer = () => {
    if (routeSourceReady || !map.isStyleLoaded()) return;
    map.addSource('kayak-route', { type: 'geojson', data: routeGeoJson() });
    map.addLayer({
      id: 'kayak-route-line',
      type: 'line',
      source: 'kayak-route',
      paint: { 'line-color': '#e11d48', 'line-width': 5, 'line-opacity': 0.9 }
    });
    routeSourceReady = true;
  };

  const updateRoute = () => {
    ensureRouteLayer();
    const source = map.getSource('kayak-route');
    if (source && 'setData' in source && typeof source.setData === 'function') {
      source.setData(routeGeoJson());
    }
  };

  const fitRoute = (trip: KayakTrip) => {
    if (!trip.points.length) return;
    const bounds = new maplibregl.LngLatBounds();
    trip.points.forEach(p => bounds.extend([p.lng, p.lat]));
    if (trip.points.length === 1) {
      map.flyTo({ center: [trip.points[0].lng, trip.points[0].lat], zoom: 14 });
    } else {
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 700 });
    }
  };

  const showTripRoute = (trip: KayakTrip) => {
    trackPoints = trip.points;
    ensureRouteLayer();
    updateRoute();
    fitRoute(trip);
    tripPanel.classList.remove('hidden');
    renderTrips();
  };

  const groupColors = ['#e11d48','#06b6d4','#f59e0b','#22c55e','#8b5cf6','#f97316'];

  const ensureGroupLayer = () => {
    if (!map.isStyleLoaded() || map.getSource('kayak-group-routes')) return;
    map.addSource('kayak-group-routes', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: 'kayak-group-route-lines',
      type: 'line',
      source: 'kayak-group-routes',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 4,
        'line-opacity': 0.9
      }
    });
  };

  const updateGroupRoutes = () => {
    ensureGroupLayer();
    const source = map.getSource('kayak-group-routes');
    if (!source || !('setData' in source) || typeof source.setData !== 'function') return;
    source.setData({
      type: 'FeatureCollection',
      features: groupTrips.map((trip, index) => ({
        type: 'Feature',
        properties: { id: trip.id, name: trip.name, color: groupColors[index % groupColors.length] },
        geometry: { type: 'LineString', coordinates: trip.points.map(p => [p.lng, p.lat]) }
      }))
    });
  };

  const showGroupRoutes = (selected: KayakTrip[]) => {
    groupTrips = selected.filter(t => t.points.length);
    updateGroupRoutes();
    if (groupTrips.length) {
      const bounds = new maplibregl.LngLatBounds();
      groupTrips.forEach(trip => trip.points.forEach(p => bounds.extend([p.lng, p.lat])));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 90, maxZoom: 15, duration: 700 });
    }
    groupPanel.classList.remove('hidden');
    renderGroup();
  };

  const sharedParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
  const sharedTrip = sharedParams.get('trip');
  const sharedGroup = sharedParams.get('group');

  if (sharedTrip) {
    const imported = decodeTripFromShare(sharedTrip);
    if (imported) setTimeout(() => showTripRoute(imported), 0);
  }

  if (sharedGroup) {
    const importedGroup = decodeTripsFromShare(sharedGroup);
    if (importedGroup.length) setTimeout(() => showGroupRoutes(importedGroup), 0);
  }

  const googleRouteUrl = (trip: KayakTrip) => {
    if (!trip.points.length) return '#';
    const start = trip.points[0];
    const end = trip.points[trip.points.length - 1];
    return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}`;
  };

  const renderGroup = () => {
    const selectedIds = new Set(groupTrips.map(t => t.id));
    const list = trips.length
      ? trips.map((trip, index) => `
        <label class="group-trip-row">
          <input type="checkbox" data-group-trip="${trip.id}" ${selectedIds.has(trip.id) ? 'checked' : ''}>
          <span class="group-color" style="background:${groupColors[index % groupColors.length]}"></span>
          <span><b>${trip.name}</b><small>${trip.distanceKm.toFixed(2)} كم · ${Math.round(trip.durationMin)} د</small></span>
        </label>`).join('')
      : '<p class="trip-empty">احفظ رحلة واحدة على الأقل لإضافتها إلى المجموعة.</p>';

    groupPanel.innerHTML = `
      <div class="trip-head"><b>👥 مجموعة الكاياك</b><button id="close-group" aria-label="إغلاق">×</button></div>
      <p class="group-help">اختر عدة رحلات لإظهار مسارات الكاياك معاً على الخريطة. تعمل هذه الصفحة أيضاً دون خادم خارجي.</p>
      <div class="group-list">${list}</div>
      <div class="group-actions">
        <button id="show-group" class="trip-primary">🗺️ عرض المجموعة</button>
        <button id="share-group" class="trip-secondary">📤 مشاركة المجموعة</button>
      </div>`;

    groupPanel.querySelector('#close-group')?.addEventListener('click', () => groupPanel.classList.add('hidden'));
    groupPanel.querySelector('#show-group')?.addEventListener('click', () => {
      const selected = Array.from(groupPanel.querySelectorAll<HTMLInputElement>('[data-group-trip]:checked'))
        .map(input => trips.find(t => t.id === input.dataset.groupTrip))
        .filter((t): t is KayakTrip => Boolean(t))
        .slice(0, 6);
      showGroupRoutes(selected);
    });
    groupPanel.querySelector('#share-group')?.addEventListener('click', async () => {
      const selected = Array.from(groupPanel.querySelectorAll<HTMLInputElement>('[data-group-trip]:checked'))
        .map(input => trips.find(t => t.id === input.dataset.groupTrip))
        .filter((t): t is KayakTrip => Boolean(t))
        .slice(0, 6);
      if (!selected.length) return;
      const url = new URL(location.href);
      url.hash = 'group=' + encodeTripsForShare(selected);
      try {
        if (navigator.share) await navigator.share({
          title: 'مجموعة كاياك',
          text: `مجموعة من ${selected.length} رحلات كاياك`,
          url: url.toString()
        });
        else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url.toString());
          const button = groupPanel.querySelector<HTMLButtonElement>('#share-group');
          if (button) { button.textContent = '✅ تم نسخ رابط المجموعة'; setTimeout(() => { button.textContent = '📤 مشاركة المجموعة'; }, 1800); }
        } else window.prompt('انسخ رابط المجموعة:', url.toString());
      } catch {}
    });
  };

  const renderTrips = () => {
    const activeDistance = totalDistanceKm(trackPoints);
    const status = recording
      ? `<div class="trip-recording"><b>🔴 تسجيل الرحلة جارٍ</b><span>${activeDistance.toFixed(2)} كم · ${trackPoints.length} نقطة</span></div>`
      : `<div class="trip-idle"><b>سجل رحلات الكاياك</b><span>يُحفظ المسار على هذا الجهاز.</span></div>`;

    const controls = recording
      ? `<button id="stop-trip" class="trip-primary">⏹ إيقاف وحفظ الرحلة</button>`
      : `<button id="start-trip" class="trip-primary">▶ بدء تسجيل رحلة</button>`;

    const list = trips.length ? trips.map(trip => `
      <article class="trip-card">
        <div><b>${trip.name}</b><small>${new Date(trip.startedAt).toLocaleString('ar-TN')}</small></div>
        <div class="trip-stats"><span>📏 ${trip.distanceKm.toFixed(2)} كم</span><span>⏱️ ${Math.round(trip.durationMin)} د</span></div>
        <div class="trip-actions">
          <button data-view-trip="${trip.id}">🗺️ مشاهدة المسار</button>
          <button data-share-trip="${trip.id}">📤 مشاركة</button>
          <a href="${googleRouteUrl(trip)}" target="_blank" rel="noopener">Google Maps</a>
          <button data-delete-trip="${trip.id}" class="danger-action">حذف</button>
        </div>
      </article>`).join('') : '<p class="trip-empty">لا توجد رحلات محفوظة بعد.</p>';

    tripPanel.innerHTML = `
      <div class="trip-head"><b>🛶 رحلات الكاياك</b><button id="close-trips" aria-label="إغلاق">×</button></div>
      ${status}
      ${controls}
      <div class="trip-list">${list}</div>`;
    
    document.querySelector('#close-trips')?.addEventListener('click', () => tripPanel.classList.add('hidden'));
    document.querySelector('#start-trip')?.addEventListener('click', startTrip);
    document.querySelector('#stop-trip')?.addEventListener('click', stopTrip);
    tripPanel.querySelectorAll<HTMLButtonElement>('[data-view-trip]').forEach(btn => btn.addEventListener('click', () => {
      const trip = trips.find(t => t.id === btn.dataset.viewTrip);
      if (trip) showTripRoute(trip);
    }));
    tripPanel.querySelectorAll<HTMLButtonElement>('[data-share-trip]').forEach(btn => btn.addEventListener('click', async () => {
      const trip = trips.find(t => t.id === btn.dataset.shareTrip);
      if (!trip) return;
      const url = new URL(location.href);
      url.hash = 'trip=' + encodeTripForShare(trip);
      try {
        if (navigator.share) await navigator.share({ title: 'رحلة كاياك', text: 'رحلة ' + trip.distanceKm.toFixed(2) + ' كم', url: url.toString() });
        else if (navigator.clipboard) { await navigator.clipboard.writeText(url.toString()); btn.textContent = '✅ تم نسخ الرابط'; setTimeout(() => { btn.textContent = '📤 مشاركة'; }, 1800); }
        else window.prompt('انسخ رابط الرحلة:', url.toString());
      } catch {}
    }));
    tripPanel.querySelectorAll<HTMLButtonElement>('[data-delete-trip]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.deleteTrip;
      if (!id) return;
      trips = deleteTrip(id);
      groupTrips = groupTrips.filter(trip => trip.id !== id);
      updateGroupRoutes();
      renderTrips();
    }));
  };

  const addTrackPosition = (position: GeolocationPosition) => {
    const point: TrackPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: position.timestamp || Date.now()
    };
    const previous = trackPoints[trackPoints.length - 1];
    if (previous && Math.abs(point.lat - previous.lat) < 0.00005 && Math.abs(point.lng - previous.lng) < 0.00005) return;
    trackPoints.push(point);
    updateRoute();
    renderTrips();
  };

  const startTrip = () => {
    if (!navigator.geolocation) {
      tripPanel.insertAdjacentHTML('beforeend', '<p class="trip-error">GPS غير متوفر في هذا المتصفح.</p>');
      return;
    }
    if (recording) return;
    recording = true;
    trackPoints = [];
    renderTrips();
    navigator.geolocation.getCurrentPosition(
      addTrackPosition,
      () => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        recording = false;
        renderTrips();
        tripPanel.insertAdjacentHTML('beforeend', '<p class="trip-error">تعذر الوصول إلى GPS. اسمح للموقع بالوصول ثم أعد المحاولة.</p>');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    watchId = navigator.geolocation.watchPosition(
      addTrackPosition,
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  };

  const stopTrip = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    recording = false;
    if (trackPoints.length) {
      const trip = makeTrip(trackPoints);
      trips = saveTrip(trip);
      showTripRoute(trip);
    }
    renderTrips();
  };

  tripToggle.addEventListener('click', () => {
    groupPanel.classList.add('hidden');
    tripPanel.classList.toggle('hidden');
    if (!tripPanel.classList.contains('hidden')) renderTrips();
  });

  groupToggle.addEventListener('click', () => {
    tripPanel.classList.add('hidden');
    groupPanel.classList.toggle('hidden');
    if (!groupPanel.classList.contains('hidden')) renderGroup();
  });



  const selectPoint = async (lat:number,lng:number,label:string|null=null) => {
    report.classList.remove('hidden');
    marker?.remove();
    marker = new maplibregl.Marker({color:'#e11d48'}).setLngLat([lng,lat]).addTo(map);
    report.innerHTML=`<div class="report-head"><b>جاري جلب تقرير الكاياك…</b><button id="close-report" aria-label="إغلاق">×</button></div><p class="coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</p><div class="loading-report">يتم جلب أحدث بيانات البحر والطقس للنقطة المحددة.</div>`;
    bindClose();

    let placeName=label;
    if(!placeName){
      try{ placeName=await reverseCoastalName(lat,lng); }catch{ placeName=null; }
    }

    try{
      const data=await marine.getPointConditions(lat,lng);
      const assessment=assessKayakConditions({
        windSpeed:data.weather.windSpeed,
        windGusts:data.weather.windGusts,
        waveHeight:data.sea.waveHeight,
        wavePeriod:data.sea.wavePeriod
      });
      report.innerHTML=reportHtml(data,placeName,assessment);
      bindClose();
    } catch {
      report.innerHTML=`<div class="report-head"><b>تعذر جلب البيانات</b><button id="close-report" aria-label="إغلاق">×</button></div><p>تم تحديد النقطة، لكن مصادر البيانات لم تستجب الآن.</p><button id="retry-report">إعادة المحاولة</button>`;
      bindClose();
      document.querySelector('#retry-report')?.addEventListener('click',()=>selectPoint(lat,lng,placeName));
    }
  };

  const showTodaySea = async (lat:number, lng:number) => {
    report.classList.remove('hidden');
    report.innerHTML = `<div class="report-head"><b>حالة البحر اليوم</b><button id="close-report" aria-label="إغلاق">×</button></div><p>جاري حساب ملخص اليوم…</p>`;
    bindClose();
    try {
      const d = await marine.getTodaySummary(lat, lng);
      report.innerHTML = `<div class="report-head"><b>حالة البحر اليوم</b><button id="close-report" aria-label="إغلاق">×</button></div>
        <p>📅 ${d.date}</p><div class="report-grid">
        <span>🌊 أقصى موج <b>${value(d.waveMax,' m')}</b></span>
        <span>🧭 اتجاه الموج السائد <b>${value(d.waveDirection,'°')}</b></span>
        <span>⏱️ أقصى فترة موج <b>${value(d.wavePeriod,' s')}</b></span>
        <span>〰️ أقصى Swell <b>${value(d.swellMax,' m')}</b></span>
        <span>💨 أقصى رياح <b>${value(d.windMax,' km/h')}</b></span>
        <span>💨 أقصى هبات <b>${value(d.gustMax,' km/h')}</b></span>
        </div><small>الموقع: ${lat.toFixed(4)}, ${lng.toFixed(4)}</small>`;
      bindClose();
    } catch {
      report.innerHTML = `<div class="report-head"><b>تعذر جلب ملخص اليوم</b><button id="close-report" aria-label="إغلاق">×</button></div><p>حاول مرة أخرى بعد قليل.</p>`;
      bindClose();
    }
  };

  document.querySelector('#today-sea')?.addEventListener('click', () => {
    const center = map.getCenter();
    showTodaySea(center.lat, center.lng);
  });

  map.on('click',event=>selectPoint(event.lngLat.lat,event.lngLat.lng));

  document.querySelector('#search-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const input=document.querySelector<HTMLInputElement>('#search-input')!;
    const results=document.querySelector<HTMLElement>('#search-results')!;
    const query=input.value.trim();
    if(!query)return;
    results.classList.remove('hidden');
    results.innerHTML='<div>جاري البحث…</div>';
    try{
      const places=await geocoder.search(query);
      if(!places.length){results.innerHTML='<div>لم يتم العثور على موقع تونسي مطابق.</div>';return}
      results.innerHTML=places.map((p,i)=>`<button data-index="${i}"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.admin1??'')} ${escapeHtml(p.country??'')}</small></button>`).join('');
      results.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.addEventListener('click',()=>{
        const p=places[Number(button.dataset.index)];
        results.classList.add('hidden');
        const label=[p.name,p.admin1].filter(Boolean).join(' — ');
        map.stop();
        map.jumpTo({center:[p.longitude,p.latitude],zoom:13.5});
        selectPoint(p.latitude,p.longitude,label);
      }));
    }catch{
      results.innerHTML='<div>تعذر الاتصال بخدمة البحث. حاول مرة أخرى.</div>';
    }
  });

  map.on('load',()=>{ ensureRouteLayer(); ensureGroupLayer(); updateGroupRoutes(); geolocate.trigger(); });
}