import maplibregl from 'maplibre-gl';
import { MarineService } from '../marine/MarineService';
import { createMap } from '../map/createMap';

const value = (v: number|null, unit = '') => v == null ? '—' : `${v.toFixed(1)}${unit}`;

export function createApp(root: HTMLElement) {
  root.innerHTML = `
    <main class="shell">
      <header class="topbar"><strong>🎣 PRO KAYAK FISHING</strong><span>تونس</span></header>
      <section id="map" class="map"></section>
      <aside class="report" id="report">
        <b>حالة البحر</b>
        <p>اضغط على أي نقطة للحصول على قراءة مستقلة للطقس والبحر.</p>
      </aside>
    </main>`;

  const map = createMap('map');
  const marine = new MarineService();
  let marker: maplibregl.Marker | null = null;

  map.on('click', async (event) => {
    const { lat, lng } = event.lngLat;
    const report = document.querySelector<HTMLElement>('#report')!;

    marker?.remove();
    marker = new maplibregl.Marker({ color: '#e11d48' })
      .setLngLat([lng, lat])
      .addTo(map);

    report.innerHTML = `
      <b>جاري جلب آخر البيانات…</b>
      <p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
    `;

    try {
      const data = await marine.getPointConditions(lat, lng);
      report.innerHTML = `
        <b>حالة البحر عند النقطة</b>
        <p>🌊 الموج: ${value(data.sea.waveHeight, ' m')} — اتجاه ${value(data.sea.waveDirection, '°')}</p>
        <p>〰️ Swell: ${value(data.sea.swellHeight, ' m')} — اتجاه ${value(data.sea.swellDirection, '°')}</p>
        <p>💨 الرياح: ${value(data.weather.windSpeed, ' km/h')} — هبات ${value(data.weather.windGusts, ' km/h')}</p>
        <p>🧭 اتجاه الرياح: ${value(data.weather.windDirection, '°')}</p>
        <p>🌡️ الحرارة: ${value(data.weather.temperature, ' °C')} — البحر: ${value(data.sea.seaTemperature, ' °C')}</p>
        <p>📈 الضغط: ${value(data.weather.pressure, ' hPa')}</p>
        <p>🌊 التيار: ${value(data.sea.currentVelocity, ' km/h')} — اتجاه ${value(data.sea.currentDirection, '°')}</p>
        <small>آخر جلب: ${new Date(data.fetchedAt).toLocaleTimeString('ar-TN')}</small>
      `;
    } catch (error) {
      report.innerHTML = `
        <b>تعذر جلب البيانات</b>
        <p>تم تحديد النقطة بنجاح، لكن مصادر البيانات لم تستجب الآن.</p>
        <p>${error instanceof Error ? error.message : 'خطأ غير معروف'}</p>
      `;
    }
  });
}