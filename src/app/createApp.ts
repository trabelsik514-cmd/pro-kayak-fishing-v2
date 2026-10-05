import maplibregl from 'maplibre-gl';
import { MarineService } from '../marine/MarineService';
import { createMap } from '../map/createMap';

const value = (v: number|null, unit = '') => v == null ? '—' : `${v.toFixed(1)}${unit}`;

function reportHtml(data: Awaited<ReturnType<MarineService['getPointConditions']>>) {
  return `
    <div class="report-head"><b>حالة البحر عند النقطة</b><button id="close-report" aria-label="إغلاق">×</button></div>
    <p>📍 ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}</p>
    <div class="report-grid">
      <span>🌊 الموج <b>${value(data.sea.waveHeight, ' m')}</b></span>
      <span>🧭 اتجاه الموج <b>${value(data.sea.waveDirection, '°')}</b></span>
      <span>〰️ Swell <b>${value(data.sea.swellHeight, ' m')}</b></span>
      <span>💨 الرياح <b>${value(data.weather.windSpeed, ' km/h')}</b></span>
      <span>💨 الهبات <b>${value(data.weather.windGusts, ' km/h')}</b></span>
      <span>🧭 اتجاه الرياح <b>${value(data.weather.windDirection, '°')}</b></span>
      <span>🌡️ الهواء <b>${value(data.weather.temperature, ' °C')}</b></span>
      <span>🌊 حرارة البحر <b>${value(data.sea.seaTemperature, ' °C')}</b></span>
      <span>📈 الضغط <b>${value(data.weather.pressure, ' hPa')}</b></span>
      <span>🌊 التيار <b>${value(data.sea.currentVelocity, ' km/h')}</b></span>
      <span>🧭 اتجاه التيار <b>${value(data.sea.currentDirection, '°')}</b></span>
    </div>
    <small>آخر جلب: ${new Date(data.fetchedAt).toLocaleTimeString('ar-TN')}</small>`;
}

export function createApp(root: HTMLElement) {
  root.innerHTML = `
    <main class="shell">
      <header class="topbar"><strong>🎣 PRO KAYAK FISHING</strong><span>تونس</span></header>
      <section id="map" class="map"></section>
      <aside class="report" id="report">
        <div class="report-head"><b>حالة البحر</b><button id="close-report" aria-label="إغلاق">×</button></div>
        <p>اضغط على أي نقطة للحصول على قراءة مستقلة للطقس والبحر.</p>
      </aside>
    </main>`;

  const { map, geolocate } = createMap('map');
  const marine = new MarineService();
  let marker: maplibregl.Marker | null = null;

  document.querySelector('#close-report')?.addEventListener('click', () => {
    (document.querySelector('#report') as HTMLElement).classList.add('hidden');
  });

  map.on('click', async (event) => {
    const { lat, lng } = event.lngLat;
    const report = document.querySelector<HTMLElement>('#report')!;
    report.classList.remove('hidden');
    marker?.remove();
    marker = new maplibregl.Marker({ color: '#e11d48' }).setLngLat([lng, lat]).addTo(map);

    report.innerHTML = `<div class="report-head"><b>جاري جلب آخر البيانات…</b><button id="close-report">×</button></div><p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>`;
    document.querySelector('#close-report')?.addEventListener('click', () => report.classList.add('hidden'));

    try {
      const data = await marine.getPointConditions(lat, lng);
      report.innerHTML = reportHtml(data);
      document.querySelector('#close-report')?.addEventListener('click', () => report.classList.add('hidden'));
    } catch (error) {
      report.innerHTML = `<div class="report-head"><b>تعذر جلب البيانات</b><button id="close-report">×</button></div><p>تم تحديد النقطة، لكن مصادر البيانات لم تستجب الآن.</p><button id="retry-report">إعادة المحاولة</button>`;
      document.querySelector('#close-report')?.addEventListener('click', () => report.classList.add('hidden'));
      document.querySelector('#retry-report')?.addEventListener('click', () => map.fire('click', event));
    }
  });

  map.on('load', () => {
    // Ask for GPS only after the map is ready; the user can deny the browser permission.
    geolocate.trigger();
  });
}