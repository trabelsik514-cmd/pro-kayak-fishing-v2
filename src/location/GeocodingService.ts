export type PlaceResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

const normalizeArabic = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/ـ/g, '')
  .replace(/[ًٌٍَُِّْ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase();

const uniquePlaces = (places: PlaceResult[]) => {
  const seen = new Set<string>();
  return places.filter(p => {
    const key = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
};

const fromOpenMeteo = async (query: string, language: 'ar'|'fr') => {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.trim());
  url.searchParams.set('count', '20');
  url.searchParams.set('language', language);
  url.searchParams.set('countryCode', 'TN');
  url.searchParams.set('format', 'json');
  const response = await fetch(url);
  if (!response.ok) return [] as PlaceResult[];
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
};

const fromNominatim = async (query: string) => {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '10');
  url.searchParams.set('countrycodes', 'tn');
  url.searchParams.set('accept-language', 'ar,fr,en');
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) return [] as PlaceResult[];
  const data = await response.json();
  return (data ?? [])
    .filter((item: any) => String(item?.display_name ?? '').toLowerCase().includes('tun') || item?.address?.country_code === 'tn')
    .map((item: any) => ({
      name: item.name || item.display_name?.split(',')[0] || query,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      country: item.address?.country || 'Tunisia',
      admin1: item.address?.state || item.address?.province || item.address?.governorate
    }))
    .filter((item: PlaceResult) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
};

export class GeocodingService {
  async search(query: string): Promise<PlaceResult[]> {
    const raw = query.trim();
    if (!raw) return [];

    const normalized = normalizeArabic(raw);
    const variants = Array.from(new Set([raw, normalized, `${raw}, Tunisia`].filter(Boolean)));

    const primary = await Promise.all(
      variants.slice(0, 2).flatMap(q => [
        fromOpenMeteo(q, 'ar').catch(() => []),
        fromOpenMeteo(q, 'fr').catch(() => [])
      ])
    );
    let places = uniquePlaces(primary.flat());

    // Open-Meteo uses normalized prefix matching; for small coastal/local names,
    // use Nominatim as a second source when the first source has no good match.
    if (!places.length || !places.some(p => normalizeArabic(p.name).includes(normalized))) {
      const fallback = await Promise.all(variants.slice(0, 2).map(q => fromNominatim(q).catch(() => [])));
      places = uniquePlaces([...places, ...fallback.flat()]);
    }

    // Keep Tunisia only and rank exact/normalized name matches first.
    return places
      .filter(p => p.country === undefined || /tunisia|تونس|tunisie/i.test(p.country))
      .sort((a, b) => {
        const an = normalizeArabic(a.name);
        const bn = normalizeArabic(b.name);
        const aExact = an === normalized ? 0 : an.startsWith(normalized) ? 1 : 2;
        const bExact = bn === normalized ? 0 : bn.startsWith(normalized) ? 1 : 2;
        return aExact - bExact;
      })
      .slice(0, 8);
  }
}

export async function reverseCoastalName(latitude: number, longitude: number): Promise<string|null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '14');
  url.searchParams.set('accept-language', 'ar,fr');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const data = await response.json();
  return data.display_name ?? null;
}
