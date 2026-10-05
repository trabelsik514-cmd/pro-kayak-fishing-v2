export type PlaceResult = { name: string; latitude: number; longitude: number; country?: string; admin1?: string; timezone?: string };

export class GeocodingService {
  async search(query: string): Promise<PlaceResult[]> {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', query.trim());
    url.searchParams.set('count', '8');
    url.searchParams.set('language', 'ar');
    url.searchParams.set('format', 'json');

    const response = await fetch(url);
    if (!response.ok) throw new Error('تعذر البحث عن الموقع');
    const data = await response.json();
    return (data.results ?? [])
      .filter((item: any) => item.country_code === 'TN')
      .map((item: any) => ({
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        country: item.country,
        admin1: item.admin1,
        timezone: item.timezone
      }));
  }
}

export async function reverseCoastalName(latitude: number, longitude: number): Promise<string|null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '14');
  url.searchParams.set('accept-language', 'ar,fr');

  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.display_name ?? null;
}