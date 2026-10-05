import maplibregl from 'maplibre-gl';
import { MarineService } from '../marine/MarineService';
import { GeocodingService, reverseCoastalName } from '../location/GeocodingService';
import { createMap } from '../map/createMap';
import { assessKayakConditions } from '../kayak/KayakAssessment';
import { loadTrips, saveTrip, deleteTrip, makeTrip, type KayakTrip, type TrackPoint } from '../trips/TripStore';

const value = (v: number|null, unit = '') => v == null ? '—' : `${v.toFixed(1)}${unit}`;
const escapeHtml = (v: string) => v.replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch] ?? ch));
const ltr = (v: string) => `<span dir="ltr">${v}</span>`;

function reportHtml(data: Awaited<ReturnType<MarineService['getPointConditions']>>, placeName: string|null) {
  return `<div class="report-head"><b>حالة البحر عند النقطة</b><button id="close-report" aria-label="إغلاق">×</button></div>
    <p>📍 ${escapeHtml(placeName ?? 'موقع بحري محدد')}</p><p class="coords">${ltr(`${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`)}</p>
    <div class="report-grid">
      <span>🌊 الموج <b>${value(data.sea.waveHeight,' m')}</b></span><span>🧭 اتجاه الموج <b>${value(data.sea.waveDirection,'°')}</b></span>
      <span>〰️ Swell <b>${value(data.sea.swellHeight,' m')}</b></span><span>⏱️ فترة الموج <b>${value(data.sea.wavePeriod,' s')}</b></span>
      <span>💨 الرياح <b>${value(data.weather.windSpeed,' km/h')}</b></span><span>💨 الهبات <b>${value(data.weather.windGusts,' km/h')}</b></span>
      <span>🧭 اتجاه الرياح <b>${value(data.weather.windDirection,'°')}</b></span><span>🌡️ الهواء <b>${value(data.weather.temperature,' °C')}</b></span>
      <span>🌊 حرارة البحر <b>${value(data.sea.seaTemperature,' °C')}</b></span><span>📈 الضغط <b>${value(data.weather.pressure,' hPa')}</b></span>
      <span>🌊 التيار <b>${value(data.sea.currentVelocity,' km/h')}</b></span><span>🧭 اتجاه التيار <b>${value(data.sea.currentDirection,'°')}</b></span>
    </div><small>آخر جلب: ${new Date(data.fetchedAt).toLocaleTimeString('ar-TN')}</small>`;
}

export function createApp(root: HTMLElement) {
  root.innerHTML = `<main class="shell"><header class="topbar"><strong>🎣 PRO KAYAK FISHING</strong>
    <form id="search-form" class="search"><input id="search-input" placeholder="ابحث عن مدينة أو ساحل تونسي" autocomplete="off"/><button type="submit">بحث</button></form></header>
    <section id="map" class="map"></section>
    <button id="today-sea" class="today-sea">🌊 حالة البحر اليوم</button>
    <button id="trip-toggle" class="trip-toggle">🛶 رحلاتي</button>
    <aside class="trip-panel hidden" id="trip-panel">
      <div class="trip-head"><b>🛶 سجل الرحلات</b><button id="close-trips" aria-label="إغلاق">×</button></div>
      <div id="trip-status" class="trip-idle"><b>لا توجد رحلة قيد التسجيل</b><span>ابدأ التسجيل لتتبع مسار الكاياك عبر GPS.</span></div>
      <button id="trip-record" class="trip-primary">▶️ بدء تسجيل رحلة</button>
      <div id="trip-list" class="trip-list"></div>
    </aside>
    <aside class="report" id="report"><div class="report-head"><b>حالة البحر</b><button id="close-report">×</button></div>
    <p>اضغط على أي نقطة للحصول على قراءة مستقلة للطقس والبحر.</p></aside><div class="search-results hidden" id="search-results"></div></main>`;

  const { map, geolocate } = createMap('map'); const marine = new MarineService(); const geocoder = new GeocodingService();
  let marker: maplibregl.Marker | null = null; const report = document.querySelector<HTMLElement>('#report')!;
  let selectedLocation: {lat:number; lng:number; label:string|null} | null = null;
  let pointRequestId = 0;

  const tripPanel = document.querySelector<HTMLElement>('#trip-panel')!;
  const tripList = document.querySelector<HTMLElement>('#trip-list')!;
  const tripStatus = document.querySelector<HTMLElement>('#trip-status')!;
  const tripRecord = document.querySelector<HTMLButtonElement>('#trip-record')!;
  let recording = false;
  let watchId: number | null = null;
  let recordedPoints: TrackPoint[] = [];
  let lastRecordedAt = 0;
  let routeTripId: string | null = null;

  const closeReport = () => report.classList.add('hidden');
  document.querySelector('#close-report')?.addEventListener('click', closeReport);
  document.querySelector('#trip-toggle')?.addEventListener('click', () => {
    tripPanel.classList.toggle('hidden');
    if (!tripPanel.classList.contains('hidden')) renderTrips();
  });
  document.querySelector('#close-trips')?.addEventListener('click', () => tripPanel.classList.add('hidden'));

  const removeRoute = () => {
    if (map.getLayer('trip-route-line')) map.removeLayer('trip-route-line');
    if (map.getSource('trip-route-source')) map.removeSource('trip-route-source');
    routeTripId = null;
  };

  const drawTrip = (trip: KayakTrip) => {
    if (!trip.points.length) return;
    const draw = () => {
      removeRoute();
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
    };
    if (map.isStyleLoaded()) draw(); else map.once('load', draw);
  };

  const renderTrips = () => {
    const trips = loadTrips();
    if (!trips.length) {
      tripList.innerHTML = '<div class="trip-empty">لا توجد رحلات محفوظة بعد.</div>';
      return;
    }
    tripList.innerHTML = trips.map(trip => {
      const distance = Number.isFinite(trip.distanceKm) ? trip.distanceKm.toFixed(2) : '0.00';
      const duration = Math.round(trip.durationMin);
      return `<article class="trip-card">
        <b>${escapeHtml(trip.name)}</b>
        <small>${new Date(trip.startedAt).toLocaleString('ar-TN')}</small>
        <div class="trip-stats"><span>📍 ${distance} كم</span><span>⏱️ ${duration} د</span><span>🧭 ${trip.points.length} نقطة</span></div>
        <div class="trip-actions">
          <button data-view-trip="${trip.id}">🗺️ عرض المسار</button>
          <button data-delete-trip="${trip.id}" class="danger-action">🗑️ حذف</button>
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
      tripStatus.innerHTML = '<b>لا توجد رحلة قيد التسجيل</b><span>ابدأ التسجيل لتتبع مسار الكاياك عبر GPS.</span>';
      tripRecord.textContent = '▶️ بدء تسجيل رحلة';
      return;
    }
    const distance = recordedPoints.length > 1
      ? recordedPoints.slice(1).reduce((sum, p, i) => sum + distanceMetersSafe(recordedPoints[i], p), 0)
      : 0;
    tripStatus.className = 'trip-recording';
    tripStatus.innerHTML = `<b>🔴 التسجيل جارٍ</b><span>${recordedPoints.length} نقطة • ${(distance / 1000).toFixed(2)} كم</span>`;
    tripRecord.textContent = '⏹️ إيقاف وحفظ الرحلة';
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
      tripStatus.innerHTML = '<b>لم يتم حفظ الرحلة</b><span>نحتاج إلى نقطتين GPS على الأقل لتكوين مسار.</span>';
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
      tripStatus.textContent = 'هذا الجهاز لا يوفر GPS.';
      return;
    }
    recording = true;
    recordedPoints = [];
    lastRecordedAt = 0;
    setRecordingStatus();
    watchId = navigator.geolocation.watchPosition(recordPosition, () => {
      tripStatus.className = 'trip-error';
      tripStatus.innerHTML = '<b>تعذر الوصول إلى GPS</b><span>فعّل الموقع من إعدادات الهاتف ثم حاول مرة أخرى.</span>';
    }, {enableHighAccuracy: true, maximumAge: 5000, timeout: 15000});
  };

  tripRecord.addEventListener('click', () => recording ? stopRecording() : startRecording());
  renderTrips();

  const selectPoint = async (lat:number,lng:number,label:string|null=null) => {
    const requestId = ++pointRequestId;
    selectedLocation = {lat, lng, label};
    report.classList.remove('hidden'); marker?.remove(); marker = new maplibregl.Marker({color:'#e11d48'}).setLngLat([lng,lat]).addTo(map);
    report.innerHTML=`<div class="report-head"><b>جاري جلب آخر البيانات…</b><button id="close-report">×</button></div><p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>`;
    document.querySelector('#close-report')?.addEventListener('click',closeReport);
    let placeName=label; if(!placeName){try{placeName=await reverseCoastalName(lat,lng)}catch{placeName=null}}
    try{
      const data=await marine.getPointConditions(lat,lng);
      if (requestId !== pointRequestId) return;
      const assessment=assessKayakConditions({windSpeed:data.weather.windSpeed,windGusts:data.weather.windGusts,waveHeight:data.sea.waveHeight,wavePeriod:data.sea.wavePeriod});
      report.innerHTML=reportHtml(data,placeName)+`<hr><div class="kayak-assessment"><b>تقييم ظروف الكياك: ${assessment.level}</b><strong>${assessment.score}/100</strong><ul>${assessment.reasons.map(r=>`<li>${r}</li>`).join('')}</ul><small>هذا تقييم آلي مبني على بيانات الطقس والبحر المتاحة، وليس ضماناً لسلامة الرحلة.</small></div>`;
      document.querySelector('#close-report')?.addEventListener('click',closeReport)
    }
    catch{report.innerHTML=`<div class="report-head"><b>تعذر جلب البيانات</b><button id="close-report">×</button></div><p>تم تحديد النقطة، لكن مصادر البيانات لم تستجب الآن.</p><button id="retry-report">إعادة المحاولة</button>`;document.querySelector('#close-report')?.addEventListener('click',closeReport);document.querySelector('#retry-report')?.addEventListener('click',()=>selectPoint(lat,lng,placeName))}
  };

  const showTodaySea = async (lat:number, lng:number) => {
    report.classList.remove('hidden');
    report.innerHTML = `<div class="report-head"><b>حالة البحر اليوم عند النقطة</b><button id="close-report">×</button></div><p>جاري حساب ملخص اليوم…</p>`;
    document.querySelector('#close-report')?.addEventListener('click', closeReport);
    try {
      const d = await marine.getTodaySummary(lat, lng);
      report.innerHTML = `<div class="report-head"><b>حالة البحر اليوم عند النقطة</b><button id="close-report">×</button></div>
        <p>📅 ${d.date}</p><div class="report-grid">
        <span>🌊 أقصى موج <b>${value(d.waveMax,' m')}</b></span>
        <span>🧭 اتجاه الموج السائد <b>${value(d.waveDirection,'°')}</b></span>
        <span>⏱️ أقصى فترة موج <b>${value(d.wavePeriod,' s')}</b></span>
        <span>〰️ أقصى Swell <b>${value(d.swellMax,' m')}</b></span>
        <span>💨 أقصى رياح <b>${value(d.windMax,' km/h')}</b></span>
        <span>💨 أقصى هبات <b>${value(d.gustMax,' km/h')}</b></span>
        </div><small>الموقع: ${ltr(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)}</small>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    } catch {
      report.innerHTML = `<div class="report-head"><b>تعذر جلب ملخص اليوم</b><button id="close-report">×</button></div><p>حاول مرة أخرى بعد قليل.</p>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    }
  };

  document.querySelector('#today-sea')?.addEventListener('click', () => {
    const markerPoint = marker?.getLngLat();
    const target = selectedLocation
      ?? (markerPoint ? {lat: markerPoint.lat, lng: markerPoint.lng} : null)
      ?? (() => { const center = map.getCenter(); return {lat:center.lat, lng:center.lng}; })();
    showTodaySea(target.lat, target.lng);
  });

  map.on('click',event=>selectPoint(event.lngLat.lat,event.lngLat.lng));
  document.querySelector('#search-form')?.addEventListener('submit',async event=>{
    event.preventDefault(); const input=document.querySelector<HTMLInputElement>('#search-input')!; const results=document.querySelector<HTMLElement>('#search-results')!; const query=input.value.trim(); if(!query)return;
    results.classList.remove('hidden'); results.innerHTML='<div>جاري البحث…</div>';
    try{const places=await geocoder.search(query); if(!places.length){results.innerHTML='<div>لم يتم العثور على موقع تونسي مطابق.</div>';return}
      results.innerHTML=places.map((p,i)=>`<button data-index="${i}"><b>${p.name}</b><small>${p.admin1??''} ${p.country??''}</small></button>`).join('');
      results.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.addEventListener('click',()=>{const p=places[Number(button.dataset.index)];results.classList.add('hidden');const label=[p.name,p.admin1].filter(Boolean).join(' — ');map.stop();map.jumpTo({center:[p.longitude,p.latitude],zoom:13.5});selectPoint(p.latitude,p.longitude,label)}))
    }catch{results.innerHTML='<div>تعذر الاتصال بخدمة البحث. حاول مرة أخرى.</div>'}
  });
  map.on('load',()=>geolocate.trigger());
}
