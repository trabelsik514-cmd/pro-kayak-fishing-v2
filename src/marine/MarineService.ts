export type PointConditions = {
  latitude: number;
  longitude: number;
  weather: {
    temperature: number|null;
    windSpeed: number|null;
    windGusts: number|null;
    windDirection: number|null;
    pressure: number|null;
    humidity: number|null;
    precipitation: number|null;
  };
  sea: {
    waveHeight: number|null;
    waveDirection: number|null;
    wavePeriod: number|null;
    swellHeight: number|null;
    swellDirection: number|null;
    swellPeriod: number|null;
    currentVelocity: number|null;
    currentDirection: number|null;
    seaTemperature: number|null;
  };
  fetchedAt: string;
};

async function getJson(url: URL, timeoutMs = 12000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export class MarineService {
  async getPointConditions(latitude: number, longitude: number): Promise<PointConditions> {
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', String(latitude));
    weatherUrl.searchParams.set('longitude', String(longitude));
    weatherUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    );
    weatherUrl.searchParams.set('timezone', 'auto');

    const marineUrl = new URL('https://marine-api.open-meteo.com/v1/marine');
    marineUrl.searchParams.set('latitude', String(latitude));
    marineUrl.searchParams.set('longitude', String(longitude));
    marineUrl.searchParams.set(
      'current',
      'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature'
    );
    marineUrl.searchParams.set('timezone', 'auto');

    const [weatherResult, marineResult] = await Promise.allSettled([
      getJson(weatherUrl),
      getJson(marineUrl)
    ]);

    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value.current ?? {} : {};
    const sea = marineResult.status === 'fulfilled' ? marineResult.value.current ?? {} : {};

    const hasData = weatherResult.status === 'fulfilled' || marineResult.status === 'fulfilled';
    if (!hasData) throw new Error('تعذر الوصول إلى مصادر بيانات البحر والطقس');

    return {
      latitude,
      longitude,
      weather: {
        temperature: weather.temperature_2m ?? null,
        windSpeed: weather.wind_speed_10m ?? null,
        windGusts: weather.wind_gusts_10m ?? null,
        windDirection: weather.wind_direction_10m ?? null,
        pressure: weather.pressure_msl ?? null,
        humidity: weather.relative_humidity_2m ?? null,
        precipitation: weather.precipitation ?? null
      },
      sea: {
        waveHeight: sea.wave_height ?? null,
        waveDirection: sea.wave_direction ?? null,
        wavePeriod: sea.wave_period ?? null,
        swellHeight: sea.swell_wave_height ?? null,
        swellDirection: sea.swell_wave_direction ?? null,
        swellPeriod: sea.swell_wave_period ?? null,
        currentVelocity: sea.ocean_current_velocity ?? null,
        currentDirection: sea.ocean_current_direction ?? null,
        seaTemperature: sea.sea_surface_temperature ?? null
      },
      fetchedAt: new Date().toISOString()
    };
  }
}