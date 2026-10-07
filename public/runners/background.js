// PRO KAYAK FISHING background sea update runner.
// Runs periodically while Android allows background work.
// It refreshes data every 15 minutes, but sends a user notification at most every 6 hours.

const NOTIFY_EVERY_MS = 6 * 60 * 60 * 1000;
const DEFAULT_LAT = 35.8;
const DEFAULT_LNG = 10.7;

async function readLocation() {
  try {
    const raw = await CapacitorKV.get('pkf_selected_location');
    if (!raw || !raw.value) return null;
    const parsed = JSON.parse(raw.value);
    if (Number.isFinite(Number(parsed.lat)) && Number.isFinite(Number(parsed.lng))) {
      return { lat: Number(parsed.lat), lng: Number(parsed.lng), label: parsed.label || null };
    }
  } catch (error) {
    console.warn('PKF location read failed', error);
  }
  return null;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchSeaSnapshot(lat, lng) {
  const weather = new URL('https://api.open-meteo.com/v1/forecast');
  weather.searchParams.set('latitude', String(lat));
  weather.searchParams.set('longitude', String(lng));
  weather.searchParams.set('current', 'wind_speed_10m,wind_gusts_10m,wind_direction_10m');
  weather.searchParams.set('timezone', 'auto');

  const marine = new URL('https://marine-api.open-meteo.com/v1/marine');
  marine.searchParams.set('latitude', String(lat));
  marine.searchParams.set('longitude', String(lng));
  marine.searchParams.set('current', 'wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity');
  marine.searchParams.set('daily', 'wave_height_max,swell_wave_height_max');
  marine.searchParams.set('forecast_days', '1');
  marine.searchParams.set('timezone', 'auto');
  marine.searchParams.set('cell_selection', 'sea');

  const [wr, mr] = await Promise.all([fetch(weather), fetch(marine)]);
  if (!wr.ok || !mr.ok) throw new Error('Open-Meteo request failed');

  const w = await wr.json();
  const m = await mr.json();
  const wc = w.current || {};
  const mc = m.current || {};
  const md = m.daily || {};

  return {
    wind: num(wc.wind_speed_10m),
    gust: num(wc.wind_gusts_10m),
    windDir: num(wc.wind_direction_10m),
    wave: num(mc.wave_height),
    waveDir: num(mc.wave_direction),
    wavePeriod: num(mc.wave_period),
    swell: num(mc.swell_wave_height),
    current: num(mc.ocean_current_velocity),
    maxWave: num(Array.isArray(md.wave_height_max) ? md.wave_height_max[0] : null),
    maxSwell: num(Array.isArray(md.swell_wave_height_max) ? md.swell_wave_height_max[0] : null),
  };
}

function conditionLabel(s) {
  const wind = s.wind ?? 999;
  const gust = s.gust ?? 999;
  const wave = s.wave ?? 999;
  if (wind > 28 || gust > 40 || wave > 1.2) return 'حذر';
  if (wind > 20 || gust > 30 || wave > 0.8) return 'جيد';
  return 'ممتاز';
}

function format(value, unit) {
  return value == null ? '—' : value.toFixed(1) + unit;
}

async function notify(snapshot, location) {
  const label = location.label || 'النقطة المختارة';
  const level = conditionLabel(snapshot);
  const body =
    '🌊 ' + label + '\n' +
    'الموج ' + format(snapshot.wave, ' م') +
    ' · الرياح ' + format(snapshot.wind, ' كم/س') +
    ' · الهبات ' + format(snapshot.gust, ' كم/س') + '\n' +
    'أقصى موج اليوم ' + format(snapshot.maxWave, ' م') +
    ' · Swell ' + format(snapshot.swell, ' م') +
    '\nالحالة: ' + level;

  await CapacitorNotifications.schedule([
    {
      id: 610000 + Math.floor(Date.now() / 3600000) % 100000,
      title: 'PRO KAYAK FISHING — تحديث البحر',
      body,
      largeBody: body,
      group: 'pkf-sea-updates',
      autoCancel: true
    }
  ]);
}

async function run(resolve, reject) {
  try {
    const location = await readLocation();
    if (!location) {
      resolve();
      return;
    }

    const snapshot = await fetchSeaSnapshot(location.lat, location.lng);
    const now = Date.now();
    const last = await CapacitorKV.get('pkf_last_sea_notification');
    const lastAt = Number(last?.value || 0);

    // The background job itself runs every 15 minutes. Notification cadence is 6 hours.
    if (!Number.isFinite(lastAt) || now - lastAt >= NOTIFY_EVERY_MS) {
      await notify(snapshot, location);
      await CapacitorKV.set('pkf_last_sea_notification', String(now));
    }

    await CapacitorKV.set('pkf_last_background_refresh', new Date(now).toISOString());
    resolve();
  } catch (error) {
    console.warn('PKF background refresh failed', error);
    reject(error);
  }
}

addEventListener('pkfBackgroundRefresh', run);
addEventListener('pkfSaveLocation', async (resolve, reject, args) => {
  try {
    if (args && Number.isFinite(Number(args.lat)) && Number.isFinite(Number(args.lng))) {
      await CapacitorKV.set('pkf_selected_location', JSON.stringify({
        lat: Number(args.lat),
        lng: Number(args.lng),
        label: args.label || null
      }));
    }
    resolve();
  } catch (error) {
    reject(error);
  }
});
