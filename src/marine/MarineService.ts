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

async function getJson(url: URL, timeoutMs = 20000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const first = (value: unknown): number|null => {
  if (!Array.isArray(value)) return null;
  const n = Number(value[0]);
  return Number.isFinite(n) ? n : null;
};

export type DailySeaSummary = {
  date: string;
  waveMin: number|null;
  waveMax: number|null;
  waveDirection: number|null;
  wavePeriodMin: number|null;
  wavePeriodMax: number|null;
  swellMin: number|null;
  swellMax: number|null;
  windMin: number|null;
  windMax: number|null;
  gustMin: number|null;
  gustMax: number|null;
};



export type HourlyKayakPoint = {
  time:string;
  windSpeed:number|null;
  windGusts:number|null;
  windDirection:number|null;
  waveHeight:number|null;
  waveDirection:number|null;
  wavePeriod:number|null;
  swellHeight:number|null;
  swellDirection:number|null;
  swellPeriod:number|null;
  currentVelocity:number|null;
};

export class MarineService {
  async getTodaySummary(latitude: number, longitude: number): Promise<DailySeaSummary> {
    const url = new URL('https://marine-api.open-meteo.com/v1/marine');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('hourly', 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('cell_selection', 'sea');
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', String(latitude));
    weatherUrl.searchParams.set('longitude', String(longitude));
    weatherUrl.searchParams.set('hourly', 'wind_speed_10m,wind_gusts_10m');
    weatherUrl.searchParams.set('timezone', 'auto');
    weatherUrl.searchParams.set('forecast_days', '1');

    const [seaResult, weatherResult] = await Promise.allSettled([getJson(url), getJson(weatherUrl)]);
    if (seaResult.status === 'rejected' && weatherResult.status === 'rejected') {
      throw new Error('تعذر الوصول إلى توقعات اليوم');
    }

    const sea = seaResult.status === 'fulfilled' ? seaResult.value.hourly ?? {} : {};
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value.hourly ?? {} : {};
    const finite = (arr: unknown): number[] => Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    const range = (arr: unknown): [number|null,number|null] => {
      const v = finite(arr); return v.length ? [Math.min(...v), Math.max(...v)] : [null,null];
    };
    const [waveMin,waveMax] = range(sea.wave_height);
    const [wavePeriodMin,wavePeriodMax] = range(sea.wave_period);
    const [swellMin,swellMax] = range(sea.swell_wave_height);
    const [windMin,windMax] = range(weather.wind_speed_10m);
    const [gustMin,gustMax] = range(weather.wind_gusts_10m);
    const directions = finite(sea.wave_direction);
    const waveDirection = directions.length ? directions[0] : null;
    return {
      date: sea.time?.[0] ?? weather.time?.[0] ?? new Date().toISOString().slice(0, 10),
      waveMin,waveMax,waveDirection,wavePeriodMin,wavePeriodMax,swellMin,swellMax,
      windMin,windMax,gustMin,gustMax
    };
  }

  async getHourlyKayakForecast(latitude:number, longitude:number):Promise<HourlyKayakPoint[]> {
    const weatherUrl=new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude',String(latitude));
    weatherUrl.searchParams.set('longitude',String(longitude));
    weatherUrl.searchParams.set('hourly','wind_speed_10m,wind_gusts_10m,wind_direction_10m');
    weatherUrl.searchParams.set('timezone','auto');
    weatherUrl.searchParams.set('forecast_days','1');
    weatherUrl.searchParams.set('cell_selection','nearest');

    const seaUrl=new URL('https://marine-api.open-meteo.com/v1/marine');
    seaUrl.searchParams.set('latitude',String(latitude));
    seaUrl.searchParams.set('longitude',String(longitude));
    seaUrl.searchParams.set('hourly','wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity');
    seaUrl.searchParams.set('timezone','auto');
    seaUrl.searchParams.set('forecast_days','1');
    seaUrl.searchParams.set('cell_selection','sea');

    const [wr,sr]=await Promise.all([getJson(weatherUrl),getJson(seaUrl)]);
    const w=wr.hourly??{}; const m=sr.hourly??{};
    const n=Math.max(Array.isArray(w.time)?w.time.length:0,Array.isArray(m.time)?m.time.length:0);
    const num=(arr:unknown[],i:number):number|null=>{const v=Array.isArray(arr)?Number(arr[i]):NaN;return Number.isFinite(v)?v:null;};
    const out:HourlyKayakPoint[]=[];
    for(let i=0;i<n;i++){
      const time=(m.time?.[i]??w.time?.[i]);
      if(typeof time!=='string')continue;
      out.push({time,windSpeed:num(w.wind_speed_10m,i),windGusts:num(w.wind_gusts_10m,i),windDirection:num(w.wind_direction_10m,i),waveHeight:num(m.wave_height,i),waveDirection:num(m.wave_direction,i),wavePeriod:num(m.wave_period,i),swellHeight:num(m.swell_wave_height,i),swellDirection:num(m.swell_wave_direction,i),swellPeriod:num(m.swell_wave_period,i),currentVelocity:num(m.ocean_current_velocity,i)});
    }
    return out;
  }

  async getPointConditions(latitude: number, longitude: number): Promise<PointConditions> {
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', String(latitude));
    weatherUrl.searchParams.set('longitude', String(longitude));
    weatherUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    );
    weatherUrl.searchParams.set('timezone', 'auto');
    weatherUrl.searchParams.set('cell_selection', 'nearest');

    const marineUrl = new URL('https://marine-api.open-meteo.com/v1/marine');
    marineUrl.searchParams.set('latitude', String(latitude));
    marineUrl.searchParams.set('longitude', String(longitude));
    marineUrl.searchParams.set(
      'current',
      'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature'
    );
    marineUrl.searchParams.set('timezone', 'auto');
    marineUrl.searchParams.set('cell_selection', 'sea');

    // The first request uses the current endpoint. If a mobile connection,
    // coastal grid-cell selection, or a transient API issue causes it to fail,
    // retry with a small hourly response instead of failing the whole report.
    const weatherFallbackUrl = new URL(weatherUrl);
    weatherFallbackUrl.searchParams.delete('current');
    weatherFallbackUrl.searchParams.set(
      'hourly',
      'temperature_2m,relative_humidity_2m,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    );
    weatherFallbackUrl.searchParams.set('forecast_hours', '1');

    const marineFallbackUrl = new URL(marineUrl);
    marineFallbackUrl.searchParams.delete('current');
    marineFallbackUrl.searchParams.set(
      'hourly',
      'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature'
    );
    marineFallbackUrl.searchParams.set('forecast_hours', '1');

    const [weatherPrimary, marinePrimary] = await Promise.allSettled([
      getJson(weatherUrl),
      getJson(marineUrl)
    ]);

    let weatherResult = weatherPrimary;
    let marineResult = marinePrimary;

    if (weatherResult.status === 'rejected') {
      weatherResult = await Promise.resolve(getJson(weatherFallbackUrl))
        .then(value => ({ status: 'fulfilled' as const, value }))
        .catch(reason => ({ status: 'rejected' as const, reason }));
    }

    if (marineResult.status === 'rejected') {
      // A sea cell is preferred for a point on/near the coast. If that
      // selection is unavailable, retry using the nearest marine cell.
      const marineNearest = new URL(marineFallbackUrl);
      marineNearest.searchParams.set('cell_selection', 'nearest');
      marineResult = await Promise.resolve(getJson(marineFallbackUrl))
        .then(value => ({ status: 'fulfilled' as const, value }))
        .catch(async () =>
          Promise.resolve(getJson(marineNearest))
            .then(value => ({ status: 'fulfilled' as const, value }))
            .catch(reason => ({ status: 'rejected' as const, reason }))
        );
    }

    const weather = weatherResult.status === 'fulfilled'
      ? weatherResult.value.current ?? {}
      : {};
    const sea = marineResult.status === 'fulfilled'
      ? marineResult.value.current ?? {}
      : {};

    const weatherHourly = weatherResult.status === 'fulfilled'
      ? weatherResult.value.hourly ?? {}
      : {};
    const seaHourly = marineResult.status === 'fulfilled'
      ? marineResult.value.hourly ?? {}
      : {};

    const getWeather = (currentKey: string, hourlyKey: string): number|null =>
      Number.isFinite(Number(weather[currentKey]))
        ? Number(weather[currentKey])
        : first(weatherHourly[hourlyKey]);

    const getSea = (currentKey: string, hourlyKey: string): number|null =>
      Number.isFinite(Number(sea[currentKey]))
        ? Number(sea[currentKey])
        : first(seaHourly[hourlyKey]);

    const hasWeather = weatherResult.status === 'fulfilled';
    const hasSea = marineResult.status === 'fulfilled';
    if (!hasWeather && !hasSea) {
      throw new Error('تعذر الوصول إلى مصادر بيانات البحر والطقس');
    }

    return {
      latitude,
      longitude,
      weather: {
        temperature: getWeather('temperature_2m', 'temperature_2m'),
        windSpeed: getWeather('wind_speed_10m', 'wind_speed_10m'),
        windGusts: getWeather('wind_gusts_10m', 'wind_gusts_10m'),
        windDirection: getWeather('wind_direction_10m', 'wind_direction_10m'),
        pressure: getWeather('pressure_msl', 'pressure_msl'),
        humidity: getWeather('relative_humidity_2m', 'relative_humidity_2m'),
        precipitation: getWeather('precipitation', 'precipitation')
      },
      sea: {
        waveHeight: getSea('wave_height', 'wave_height'),
        waveDirection: getSea('wave_direction', 'wave_direction'),
        wavePeriod: getSea('wave_period', 'wave_period'),
        swellHeight: getSea('swell_wave_height', 'swell_wave_height'),
        swellDirection: getSea('swell_wave_direction', 'swell_wave_direction'),
        swellPeriod: getSea('swell_wave_period', 'swell_wave_period'),
        currentVelocity: getSea('ocean_current_velocity', 'ocean_current_velocity'),
        currentDirection: getSea('ocean_current_direction', 'ocean_current_direction'),
        seaTemperature: getSea('sea_surface_temperature', 'sea_surface_temperature')
      },
      fetchedAt: new Date().toISOString()
    };
  }
}
