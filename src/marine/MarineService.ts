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
    maxWaveHeightToday: number|null;
    maxWaveTimeToday: string|null;
    maxSwellHeightToday: number|null;
  };
  fetchedAt: string;
  dataTime: string|null;
  timezone: string|null;
  source: 'Open-Meteo';
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
  dataFrom: string|null;
  dataTo: string|null;
  timezone: string|null;
  generatedAt: string;
  source: 'Open-Meteo';
};



export type WeeklySeaSummary = {
  date: string;
  waveMin: number|null;
  waveMax: number|null;
  waveDirection: number|null;
  wavePeriodMax: number|null;
  swellMax: number|null;
  windMin: number|null;
  windMax: number|null;
  gustMax: number|null;
  currentAvg: number|null;
  currentMax: number|null;
  currentDirection: number|null;
};

export type WeatherModelComparisonDay = {
  date: string;
  ecmwf: { windMax:number|null; gustMax:number|null };
  gfs: { windMax:number|null; gustMax:number|null };
  icon: { windMax:number|null; gustMax:number|null };
  windSpread:number|null;
  gustSpread:number|null;
  agreement:number|null;
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

  async getWeatherModelComparison(latitude:number, longitude:number):Promise<WeatherModelComparisonDay[]> {
    const models = [
      {key:'ecmwf' as const, model:'ecmwf_ifs'},
      {key:'gfs' as const, model:'ncep_gfs_global'},
      {key:'icon' as const, model:'icon_global'}
    ];
    const makeUrl = (model:string) => {
      const u = new URL('https://api.open-meteo.com/v1/forecast');
      u.searchParams.set('latitude',String(latitude));
      u.searchParams.set('longitude',String(longitude));
      u.searchParams.set('hourly','wind_speed_10m,wind_gusts_10m');
      u.searchParams.set('forecast_days','7');
      u.searchParams.set('timezone','auto');
      u.searchParams.set('models',model);
      u.searchParams.set('cell_selection','nearest');
      return u;
    };
    const results = await Promise.all(models.map(async ({key,model}) => {
      try { return {key, payload:await getJson(makeUrl(model))}; }
      catch { return {key, payload:null}; }
    }));
    const byModel = new Map(results.map(x=>[x.key,x.payload]));
    const dateSet = new Set<string>();
    for (const payload of byModel.values()) {
      const times = payload?.hourly?.time;
      if (Array.isArray(times)) for (const time of times) if(typeof time==='string') dateSet.add(time.slice(0,10));
    }
    const dates=[...dateSet].sort().slice(0,7);
    const rangeFor=(payload:any,date:string,key:string):number|null=>{
      const times=Array.isArray(payload?.hourly?.time)?payload.hourly.time:[];
      const arr=payload?.hourly?.[key];
      const values=times.map((time:string,i:number)=>time.slice(0,10)===date&&Array.isArray(arr)?Number(arr[i]):NaN).filter(Number.isFinite);
      return values.length?Math.max(...values):null;
    };
    const spread=(values:(number|null)[])=>{
      const v=values.filter((x):x is number=>x!=null&&Number.isFinite(x));
      return v.length>=2?Math.max(...v)-Math.min(...v):null;
    };
    return dates.map(date=>{
      const e={windMax:rangeFor(byModel.get('ecmwf'),date,'wind_speed_10m'),gustMax:rangeFor(byModel.get('ecmwf'),date,'wind_gusts_10m')};
      const g={windMax:rangeFor(byModel.get('gfs'),date,'wind_speed_10m'),gustMax:rangeFor(byModel.get('gfs'),date,'wind_gusts_10m')};
      const i={windMax:rangeFor(byModel.get('icon'),date,'wind_speed_10m'),gustMax:rangeFor(byModel.get('icon'),date,'wind_gusts_10m')};
      const windSpread=spread([e.windMax,g.windMax,i.windMax]);
      const gustSpread=spread([e.gustMax,g.gustMax,i.gustMax]);
      const windAgreement=windSpread==null?null:Math.max(0,Math.min(100,Math.round(100-(windSpread/15)*100)));
      const gustAgreement=gustSpread==null?null:Math.max(0,Math.min(100,Math.round(100-(gustSpread/20)*100)));
      return {date,ecmwf:e,gfs:g,icon:i,windSpread,gustSpread,agreement:
        windAgreement==null?gustAgreement:gustAgreement==null?windAgreement:Math.round((windAgreement+gustAgreement)/2)};
    });
  }

  async getWeeklySeaSummary(latitude:number, longitude:number):Promise<WeeklySeaSummary[]> {
    const url = new URL('https://marine-api.open-meteo.com/v1/marine');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('hourly', 'wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,ocean_current_direction');
    url.searchParams.set('daily', 'wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');
    url.searchParams.set('cell_selection', 'sea');

    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', String(latitude));
    weatherUrl.searchParams.set('longitude', String(longitude));
    weatherUrl.searchParams.set('hourly', 'wind_speed_10m,wind_gusts_10m');
    weatherUrl.searchParams.set('timezone', 'auto');
    weatherUrl.searchParams.set('forecast_days', '7');
    weatherUrl.searchParams.set('cell_selection', 'nearest');

    const [seaResult, weatherResult] = await Promise.allSettled([getJson(url), getJson(weatherUrl)]);
    if (seaResult.status === 'rejected' && weatherResult.status === 'rejected') {
      throw new Error('تعذر الوصول إلى توقعات الأسبوع');
    }

    const seaPayload = seaResult.status === 'fulfilled' ? seaResult.value : {};
    const weatherPayload = weatherResult.status === 'fulfilled' ? weatherResult.value : {};
    const daily = seaPayload.daily ?? {};
    const dailyDates = Array.isArray(daily.time) ? daily.time.filter((v:unknown):v is string=>typeof v==='string') : [];
    const seaHourly = seaPayload.hourly ?? {};
    const weatherHourly = weatherPayload.hourly ?? {};
    const seaTimes = Array.isArray(seaHourly.time) ? seaHourly.time.filter((v:unknown):v is string=>typeof v==='string') : [];
    const weatherTimes = Array.isArray(weatherHourly.time) ? weatherHourly.time.filter((v:unknown):v is string=>typeof v==='string') : [];

    const dayIndexes = (times:string[], date:string) => times.map((time,i)=>({time,i})).filter(x=>x.time.slice(0,10)===date);
    const nums = (arr:unknown,indexes:{i:number}[]) => indexes.map(x=>Array.isArray(arr)?Number(arr[x.i]):NaN).filter(Number.isFinite);
    const range = (arr:unknown,indexes:{i:number}[]) => {
      const values=nums(arr,indexes);
      return values.length ? [Math.min(...values),Math.max(...values)] as [number,number] : [null,null] as [number|null,number|null];
    };
    const numberAt = (arr:unknown,i:number) => Array.isArray(arr) && Number.isFinite(Number(arr[i])) ? Number(arr[i]) : null;

    return dailyDates.slice(0,7).map((date:string,i:number)=>{
      const sd=dayIndexes(seaTimes,date);
      const wd=dayIndexes(weatherTimes,date);
      const [waveMin,hourlyWaveMax]=range(seaHourly.wave_height,sd);
      const [windMin,windMax]=range(weatherHourly.wind_speed_10m,wd);
      const [,gustMax]=range(weatherHourly.wind_gusts_10m,wd);
      const currentPairs = sd.map(({i}) => ({
        speed: numberAt(seaHourly.ocean_current_velocity, i),
        direction: numberAt(seaHourly.ocean_current_direction, i)
      })).filter((x): x is {speed:number; direction:number} =>
        x.speed != null && x.direction != null && Number.isFinite(x.speed) && Number.isFinite(x.direction)
      );
      const currentValues=currentPairs.map(x=>x.speed);
      const currentAvg=currentValues.length ? currentValues.reduce((a,b)=>a+b,0)/currentValues.length : null;
      const currentMax=currentValues.length ? Math.max(...currentValues) : null;
      // Current direction is a flow direction. Use a speed-weighted circular mean
      // so calm hours cannot pull the weekly direction toward an arbitrary angle.
      const directionVector=currentPairs.reduce((acc,{speed,direction})=>{
        const rad=direction*Math.PI/180;
        acc.x+=Math.sin(rad)*speed;
        acc.y+=Math.cos(rad)*speed;
        return acc;
      },{x:0,y:0});
      const vectorMagnitude=Math.hypot(directionVector.x,directionVector.y);
      const currentDirection=vectorMagnitude > 0.01
        ? (Math.atan2(directionVector.x,directionVector.y)*180/Math.PI+360)%360
        : null;
      const dailyWaveMax=numberAt(daily.wave_height_max,i);
      const dailyDirection=numberAt(daily.wave_direction_dominant,i);
      const dailyPeriod=numberAt(daily.wave_period_max,i);
      const dailySwell=numberAt(daily.swell_wave_height_max,i);
      const directions=nums(seaHourly.wave_direction,sd);
      return {
        date,
        waveMin,
        waveMax: dailyWaveMax ?? hourlyWaveMax,
        waveDirection: dailyDirection ?? (directions.length ? directions[0] : null),
        wavePeriodMax: dailyPeriod ?? (()=>{const [,max]=range(seaHourly.wave_period,sd);return max;})(),
        swellMax: dailySwell ?? (()=>{const [,max]=range(seaHourly.swell_wave_height,sd);return max;})(),
        windMin,
        windMax,
        gustMax,
        currentAvg,
        currentMax,
        currentDirection
      };
    });
  }

  async getTodaySummary(latitude: number, longitude: number): Promise<DailySeaSummary> {
    const url = new URL('https://marine-api.open-meteo.com/v1/marine');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('hourly', 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period');
    url.searchParams.set('current', 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period');
    url.searchParams.set('daily', 'wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max,swell_wave_direction_dominant,swell_wave_period_max');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('cell_selection', 'sea');

    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', String(latitude));
    weatherUrl.searchParams.set('longitude', String(longitude));
    weatherUrl.searchParams.set('hourly', 'wind_speed_10m,wind_gusts_10m');
    weatherUrl.searchParams.set('current', 'wind_speed_10m,wind_gusts_10m');
    weatherUrl.searchParams.set('timezone', 'auto');
    weatherUrl.searchParams.set('forecast_days', '1');
    weatherUrl.searchParams.set('cell_selection', 'nearest');

    const [seaResult, weatherResult] = await Promise.allSettled([getJson(url), getJson(weatherUrl)]);
    if (seaResult.status === 'rejected' && weatherResult.status === 'rejected') {
      throw new Error('تعذر الوصول إلى توقعات اليوم');
    }

    const seaPayload = seaResult.status === 'fulfilled' ? seaResult.value : {};
    const weatherPayload = weatherResult.status === 'fulfilled' ? weatherResult.value : {};
    const sea = seaPayload.hourly ?? {};
    const seaDaily = seaPayload.daily ?? {};
    const weather = weatherPayload.hourly ?? {};
    const seaTimes = Array.isArray(sea.time) ? sea.time.filter((v: unknown): v is string => typeof v === 'string') : [];
    const weatherTimes = Array.isArray(weather.time) ? weather.time.filter((v: unknown): v is string => typeof v === 'string') : [];
    const date = (seaTimes[0] ?? weatherTimes[0] ?? new Date().toISOString()).slice(0, 10);

    const sameDay = (times: string[]) => times
      .map((time, i) => ({time, i}))
      .filter(({time}) => time.slice(0, 10) === date);

    const seaDay = sameDay(seaTimes);
    const weatherDay = sameDay(weatherTimes);
    const valuesFor = (arr: unknown, indexes: {i:number}[]): number[] =>
      indexes.map(({i}) => Array.isArray(arr) ? Number(arr[i]) : NaN).filter(Number.isFinite);
    const range = (arr: unknown, indexes: {i:number}[]): [number|null,number|null] => {
      const v = valuesFor(arr, indexes);
      return v.length ? [Math.min(...v), Math.max(...v)] : [null, null];
    };

    const [waveMin,waveMax] = range(sea.wave_height, seaDay);
    const dailyWaveMax = Array.isArray(seaDaily.wave_height_max) ? Number(seaDaily.wave_height_max[0]) : NaN;
    const dailyPeriodMax = Array.isArray(seaDaily.wave_period_max) ? Number(seaDaily.wave_period_max[0]) : NaN;
    const dailySwellMax = Array.isArray(seaDaily.swell_wave_height_max) ? Number(seaDaily.swell_wave_height_max[0]) : NaN;
    const [wavePeriodMin,wavePeriodMax] = range(sea.wave_period, seaDay);
    const [swellMin,swellMax] = range(sea.swell_wave_height, seaDay);
    const [windMin,windMax] = range(weather.wind_speed_10m, weatherDay);
    const [gustMin,gustMax] = range(weather.wind_gusts_10m, weatherDay);
    const directions = valuesFor(sea.wave_direction, seaDay);
    const dailyDominant = Array.isArray(seaDaily.wave_direction_dominant) ? Number(seaDaily.wave_direction_dominant[0]) : NaN;
    const waveDirection = Number.isFinite(dailyDominant) ? dailyDominant : (directions.length ? directions[0] : null);
    const allTimes = [...seaDay.map(x => x.time), ...weatherDay.map(x => x.time)].sort();
    const dataFrom = allTimes[0] ?? null;
    const dataTo = allTimes.at(-1) ?? null;
    const timezone = seaPayload.timezone ?? weatherPayload.timezone ?? null;

    return {
      date,
      waveMin, waveMax: Number.isFinite(dailyWaveMax) ? dailyWaveMax : waveMax,
      waveDirection,
      wavePeriodMin, wavePeriodMax: Number.isFinite(dailyPeriodMax) ? dailyPeriodMax : wavePeriodMax,
      swellMin, swellMax: Number.isFinite(dailySwellMax) ? dailySwellMax : swellMax,
      windMin,windMax,gustMin,gustMax,
      dataFrom,dataTo,timezone,
      generatedAt:new Date().toISOString(),
      source:'Open-Meteo'
    };
  }

  async getHourlyKayakForecast(latitude:number, longitude:number):Promise<HourlyKayakPoint[]> {
    const weatherUrl=new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude',String(latitude));
    weatherUrl.searchParams.set('longitude',String(longitude));
    weatherUrl.searchParams.set('hourly','wind_speed_10m,wind_gusts_10m,wind_direction_10m');
    weatherUrl.searchParams.set('timezone','auto');
    weatherUrl.searchParams.set('forecast_days','7');
    weatherUrl.searchParams.set('cell_selection','nearest');

    const seaUrl=new URL('https://marine-api.open-meteo.com/v1/marine');
    seaUrl.searchParams.set('latitude',String(latitude));
    seaUrl.searchParams.set('longitude',String(longitude));
    seaUrl.searchParams.set('hourly','wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity');
    seaUrl.searchParams.set('timezone','auto');
    seaUrl.searchParams.set('forecast_days','7');
    seaUrl.searchParams.set('cell_selection','sea');

    const [wr,sr]=await Promise.all([getJson(weatherUrl),getJson(seaUrl)]);
    const w = ((wr as {hourly?: Record<string, unknown>}).hourly ?? {}) as Record<string, unknown>;
    const m = ((sr as {hourly?: Record<string, unknown>}).hourly ?? {}) as Record<string, unknown>;
    const weatherTimes=Array.isArray(w.time)?w.time.filter((v:unknown):v is string=>typeof v==='string'):[];
    const marineTimes=Array.isArray(m.time)?m.time.filter((v:unknown):v is string=>typeof v==='string'):[];
    const weatherIndex=new Map(weatherTimes.map((time:string,i:number)=>[time,i]));
    const marineIndex=new Map(marineTimes.map((time:string,i:number)=>[time,i]));
    const now=Date.now();
    const num=(arr:unknown,i:number):number|null=>{const v=Array.isArray(arr)?Number(arr[i]):NaN;return Number.isFinite(v)?v:null;};
    const out:HourlyKayakPoint[]=[];
    for(const time of [...new Set([...weatherTimes,...marineTimes])].sort()){
      const ts=Date.parse(time);
      if(!Number.isFinite(ts) || ts < now - 30*60*1000) continue;
      const wi=weatherIndex.get(time);
      const mi=marineIndex.get(time);
      if(wi==null && mi==null) continue;
      out.push({
        time,
        windSpeed:wi==null?null:num(w.wind_speed_10m,wi),
        windGusts:wi==null?null:num(w.wind_gusts_10m,wi),
        windDirection:wi==null?null:num(w.wind_direction_10m,wi),
        waveHeight:mi==null?null:num(m.wave_height,mi),
        waveDirection:mi==null?null:num(m.wave_direction,mi),
        wavePeriod:mi==null?null:num(m.wave_period,mi),
        swellHeight:mi==null?null:num(m.swell_wave_height,mi),
        swellDirection:mi==null?null:num(m.swell_wave_direction,mi),
        swellPeriod:mi==null?null:num(m.swell_wave_period,mi),
        currentVelocity:mi==null?null:num(m.ocean_current_velocity,mi)
      });
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
    marineUrl.searchParams.set('daily', 'wave_height_max,swell_wave_height_max');
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

    const weatherPayload = weatherResult.status === 'fulfilled' ? weatherResult.value : {};
    const marinePayload = marineResult.status === 'fulfilled' ? marineResult.value : {};
    const weather = weatherPayload.current ?? {};
    const sea = marinePayload.current ?? {};
    const seaDaily = marinePayload.daily ?? {};
    const maxWaveHeightToday = Array.isArray(seaDaily.wave_height_max) && Number.isFinite(Number(seaDaily.wave_height_max[0]))
      ? Number(seaDaily.wave_height_max[0]) : null;
    const maxSwellHeightToday = Array.isArray(seaDaily.swell_wave_height_max) && Number.isFinite(Number(seaDaily.swell_wave_height_max[0]))
      ? Number(seaDaily.swell_wave_height_max[0]) : null;

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
        seaTemperature: getSea('sea_surface_temperature', 'sea_surface_temperature'),
        maxWaveHeightToday,
        maxWaveTimeToday: null,
        maxSwellHeightToday
      },
      fetchedAt: new Date().toISOString(),
      dataTime: weather.time ?? sea.time ?? null,
      timezone: weatherPayload.timezone ?? marinePayload.timezone ?? null,
      source: 'Open-Meteo'
    };
  }
}
