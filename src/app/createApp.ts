import maplibregl from 'maplibre-gl';
import { MarineService } from '../marine/MarineService';
import { GeocodingService, reverseCoastalName } from '../location/GeocodingService';
import { createMap } from '../map/createMap';
import { assessKayakConditions } from '../kayak/KayakAssessment';

const value = (v: number|null, unit = '') => v == null ? '—' : `${v.toFixed(1)}${unit}`;

function reportHtml(data: Awaited<ReturnType<MarineService['getPointConditions']>>, placeName: string|null) {
  return `<div class="report-head"><b>حالة البحر عند النقطة</b><button id="close-report" aria-label="إغلاق">×</button></div>
    <p>📍 ${placeName ?? 'موقع بحري محدد'}</p><p class="coords">${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}</p>
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
    <section id="map" class="map"></section><button id="today-sea" class="today-sea">🌊 حالة البحر اليوم</button><aside class="report" id="report"><div class="report-head"><b>حالة البحر</b><button id="close-report">×</button></div>
    <p>اضغط على أي نقطة للحصول على قراءة مستقلة للطقس والبحر.</p></aside><div class="search-results hidden" id="search-results"></div></main>`;

  const { map, geolocate } = createMap('map'); const marine = new MarineService(); const geocoder = new GeocodingService();
  let marker: maplibregl.Marker | null = null; const report = document.querySelector<HTMLElement>('#report')!;
  const closeReport = () => report.classList.add('hidden');
  document.querySelector('#close-report')?.addEventListener('click', closeReport);

  const selectPoint = async (lat:number,lng:number,label:string|null=null) => {
    report.classList.remove('hidden'); marker?.remove(); marker = new maplibregl.Marker({color:'#e11d48'}).setLngLat([lng,lat]).addTo(map);
    report.innerHTML=`<div class="report-head"><b>جاري جلب آخر البيانات…</b><button id="close-report">×</button></div><p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>`;
    document.querySelector('#close-report')?.addEventListener('click',closeReport);
    let placeName=label; if(!placeName){try{placeName=await reverseCoastalName(lat,lng)}catch{placeName=null}}
    try{
      const data=await marine.getPointConditions(lat,lng);
      const assessment=assessKayakConditions({windSpeed:data.weather.windSpeed,windGusts:data.weather.windGusts,waveHeight:data.sea.waveHeight,wavePeriod:data.sea.wavePeriod});
      report.innerHTML=reportHtml(data,placeName)+`<hr><div class="kayak-assessment"><b>تقييم ظروف الكياك: ${assessment.level}</b><strong>${assessment.score}/100</strong><ul>${assessment.reasons.map(r=>`<li>${r}</li>`).join('')}</ul><small>هذا تقييم آلي مبني على بيانات الطقس والبحر المتاحة، وليس ضماناً لسلامة الرحلة.</small></div>`;
      document.querySelector('#close-report')?.addEventListener('click',closeReport)
    }
    catch{report.innerHTML=`<div class="report-head"><b>تعذر جلب البيانات</b><button id="close-report">×</button></div><p>تم تحديد النقطة، لكن مصادر البيانات لم تستجب الآن.</p><button id="retry-report">إعادة المحاولة</button>`;document.querySelector('#close-report')?.addEventListener('click',closeReport);document.querySelector('#retry-report')?.addEventListener('click',()=>selectPoint(lat,lng,placeName))}
  };

  const showTodaySea = async (lat:number, lng:number) => {
    report.classList.remove('hidden');
    report.innerHTML = `<div class="report-head"><b>حالة البحر اليوم</b><button id="close-report">×</button></div><p>جاري حساب ملخص اليوم…</p>`;
    document.querySelector('#close-report')?.addEventListener('click', closeReport);
    try {
      const d = await marine.getTodaySummary(lat, lng);
      report.innerHTML = `<div class="report-head"><b>حالة البحر اليوم</b><button id="close-report">×</button></div>
        <p>📅 ${d.date}</p><div class="report-grid">
        <span>🌊 أقصى موج <b>${value(d.waveMax,' m')}</b></span>
        <span>🧭 اتجاه الموج السائد <b>${value(d.waveDirection,'°')}</b></span>
        <span>⏱️ أقصى فترة موج <b>${value(d.wavePeriod,' s')}</b></span>
        <span>〰️ أقصى Swell <b>${value(d.swellMax,' m')}</b></span>
        <span>💨 أقصى رياح <b>${value(d.windMax,' km/h')}</b></span>
        <span>💨 أقصى هبات <b>${value(d.gustMax,' km/h')}</b></span>
        </div><small>الموقع: ${lat.toFixed(4)}, ${lng.toFixed(4)}</small>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    } catch {
      report.innerHTML = `<div class="report-head"><b>تعذر جلب ملخص اليوم</b><button id="close-report">×</button></div><p>حاول مرة أخرى بعد قليل.</p>`;
      document.querySelector('#close-report')?.addEventListener('click', closeReport);
    }
  };

  document.querySelector('#today-sea')?.addEventListener('click', () => {
    const center = map.getCenter();
    showTodaySea(center.lat, center.lng);
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