export type PointConditions = { waveHeight: number|null; windSpeed: number|null };

export class MarineService {
  async getPointConditions(latitude: number, longitude: number): Promise<PointConditions> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'wind_speed_10m');
    url.searchParams.set('timezone', 'auto');

    const marine = new URL('https://marine-api.open-meteo.com/v1/marine');
    marine.searchParams.set('latitude', String(latitude));
    marine.searchParams.set('longitude', String(longitude));
    marine.searchParams.set('current', 'wave_height');
    marine.searchParams.set('timezone', 'auto');

    const [weatherResponse, marineResponse] = await Promise.all([fetch(url), fetch(marine)]);
    if (!weatherResponse.ok || !marineResponse.ok) throw new Error('Marine data unavailable');
    const weather = await weatherResponse.json();
    const sea = await marineResponse.json();
    return { waveHeight: sea.current?.wave_height ?? null, windSpeed: weather.current?.wind_speed_10m ?? null };
  }
}