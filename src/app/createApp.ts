import maplibregl from 'maplibre-gl';
import { MarineService } from '../marine/MarineService';
import { GeocodingService, reverseCoastalName } from '../location/GeocodingService';
import { createMap } from '../map/createMap';

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
    <section id="map" class="map"></section><aside class="report" id="report"><div class="report-head"><b>حالة البحر</b><button id="close-report">×</button></div>
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
    try{const data=await marine.getPointConditions(lat,lng); report.innerHTML=reportHtml(data,placeName); document.querySelector('#close-report')?.addEventListener('click',closeReport)}
    catch{report.innerHTML=`<div class="report-head"><b>تعذر جلب البيانات</b><button id="close-report">×</button></div><p>تم تحديد النقطة، لكن مصادر البيانات لم تستجب الآن.</p><button id="retry-report">إعادة المحاولة</button>`;document.querySelector('#close-report')?.addEventListener('click',closeReport);document.querySelector('#retry-report')?.addEventListener('click',()=>selectPoint(lat,lng,placeName))}
  };

  map.on('click',event=>selectPoint(event.lngLat.lat,event.lngLat.lng));
  document.querySelector('#search-form')?.addEventListener('submit',async event=>{
    event.preventDefault(); const input=document.querySelector<HTMLInputElement>('#search-input')!; const results=document.querySelector<HTMLElement>('#search-results')!; const query=input.value.trim(); if(!query)return;
    results.classList.remove('hidden'); results.innerHTML='<div>جاري البحث…</div>';
    try{const places=await geocoder.search(query); if(!places.length){results.innerHTML='<div>لم يتم العثور على موقع تونسي مطابق.</div>';return}
      results.innerHTML=places.map((p,i)=>`<button data-index="${i}"><b>${p.name}</b><small>${p.admin1??''} ${p.country??''}</small></button>`).join('');
      results.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.addEventListener('click',()=>{const p=places[Number(button.dataset.index)];results.classList.add('hidden');map.flyTo({center:[p.longitude,p.latitude],zoom:12,essential:true});selectPoint(p.latitude,p.longitude,[p.name,p.admin1].filter(Boolean).join(' — '))}))
    }catch{results.innerHTML='<div>تعذر الاتصال بخدمة البحث. حاول مرة أخرى.</div>'}
  });
  map.on('load',()=>geolocate.trigger());
}