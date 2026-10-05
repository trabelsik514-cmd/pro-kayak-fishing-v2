import { MarineService } from '../marine/MarineService';
import { createMap } from '../map/createMap';

export function createApp(root: HTMLElement) {
  root.innerHTML = `
    <main class="shell">
      <header class="topbar"><strong>🎣 PRO KAYAK FISHING</strong><span>تونس</span></header>
      <section id="map" class="map"></section>
      <aside class="report" id="report"><b>اختر نقطة في البحر</b><p>اضغط على الخريطة للحصول على حالة البحر والطقس والتحليل.</p></aside>
    </main>`;

  const map = createMap('map');
  const marine = new MarineService();
  map.on('click', async (event) => {
    const { lat, lng } = event.lngLat;
    const report = document.querySelector('#report')!;
    report.innerHTML = `<b>جاري تحليل الموقع…</b><p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>`;
    const data = await marine.getPointConditions(lat, lng);
    report.innerHTML = `<b>حالة البحر</b><p>الموج: ${data.waveHeight ?? '—'} m</p><p>الرياح: ${data.windSpeed ?? '—'} km/h</p>`;
  });
}