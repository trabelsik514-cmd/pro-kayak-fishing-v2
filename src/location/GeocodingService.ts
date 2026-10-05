export type PlaceResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

const normalizeText = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/گ/g, 'ك')
  .replace(/ڨ/g, 'ق')
  .replace(/ڤ/g, 'ف')
  .replace(/چ/g, 'ج')
  .replace(/ژ/g, 'ز')
  .replace(/ـ/g, '')
  .replace(/[ًٌٍَُِّْ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase();

const stripCoastalPrefix = (value: string) => normalizeText(value)
  .replace(/^(شاطئ|شط|plage|beach|marina|port|ميناء|مرسى|راس|رأس|cap)\s+/i, '')
  .trim();

/*
 * These are SEARCH aliases, not guessed coordinates.
 * They expand common Tunisian ways of writing coastal places into a
 * canonical query, then the real coordinates are obtained from geocoders.
 */
type LocalPlace = { aliases: string[]; query: string; latitude?: number; longitude?: number; displayName?: string };

const LOCAL_TUNISIAN_QUERIES: LocalPlace[] = [
  {aliases:['مرسى الأمراء','مرسى الامراء','شاطئ مرسى الأمراء','شاطئ مرسى الامراء','Marsa El Omra','Marsa El Omraa'],query:'Marsa El Omra, Tunisia'},
  {aliases:['المنڨع','المنقع','المنقاع','El Mangaa','El Mngaa','El Menga'],query:'El Mangaa, Takelsa, Nabeul, Tunisia',latitude:36.8758,longitude:10.62527,displayName:'شاطئ المنڨع — تاكلسة، ولاية نابل، تونس'},
  {aliases:['مارينا بنزرت','مارينة بنزرت','مارينا بن زرت','مارينة بن زرت','Marina Bizerte','Marina de Bizerte'],query:'Marina Bizerte, Tunisia'},
  {aliases:['شط الشفع','شاطئ الشفع','Chatt Ech Chafaa','Chott Ech Chafaa','Chatt Chafaa'],query:'شط الشفع, Tunisia'},
  {aliases:['راس انجلة','رأس أنجلة','Ras Angela','Cap Angela'],query:'Ras Angela, Bizerte, Tunisia'},
  {aliases:['راس سيدي علي المكي','رأس سيدي علي المكي','Ras Sidi Ali Mekki'],query:'Ras Sidi Ali Mekki, Tunisia'},
  {aliases:['غار الملح','Ghar El Melh'],query:'Ghar El Melh, Tunisia'},
  {aliases:['رفراف','Raf Raf','Raf-Raf'],query:'Raf Raf, Tunisia'},
  {aliases:['العالية','Alia','Al Alya'],query:'Alia, Bizerte, Tunisia'},
  {aliases:['الماتلين','Metline','Mettline'],query:'Metline, Bizerte, Tunisia'},
  {aliases:['سيدي علي المكي','Sidi Ali Mekki'],query:'Sidi Ali Mekki, Tunisia'},
  {aliases:['طبرقة','Tabarka','Tabarka Tunisia'],query:'Tabarka, Tunisia'},
  {aliases:['عين دراهم','Ain Draham'],query:'Ain Draham, Tunisia'},
  {aliases:['بنزرت','بن زرت','Bizerte'],query:'Bizerte, Tunisia'},
  {aliases:['منزل جميل','Menzel Jemil'],query:'Menzel Jemil, Tunisia'},
  {aliases:['منزل عبد الرحمان','Menzel Abderrahmane'],query:'Menzel Abderrahmane, Tunisia'},
  {aliases:['نابل','Nabeul'],query:'Nabeul, Tunisia'},
  {aliases:['الحمامات','حمامات','Hammamet'],query:'Hammamet, Tunisia'},
  {aliases:['ياسمين الحمامات','Yasmine Hammamet'],query:'Yasmine Hammamet, Tunisia'},
  {aliases:['قليبية','Kelibia','Kélibia'],query:'Kelibia, Tunisia'},
  {aliases:['قربة','Korba'],query:'Korba, Tunisia'},
  {aliases:['منزل تميم','Menzel Temime'],query:'Menzel Temime, Tunisia'},
  {aliases:['الهوارية','هوارية','El Haouaria','Haouaria'],query:'El Haouaria, Tunisia'},
  {aliases:['المعمورة','Maamoura'],query:'Maamoura, Nabeul, Tunisia'},
  {aliases:['سيدي بوسعيد','Sidi Bou Said','Sidi Bou Saïd'],query:'Sidi Bou Said, Tunisia'},
  {aliases:['قرطاج','Carthage','Carthage Tunisia'],query:'Carthage, Tunisia'},
  {aliases:['المرسى','La Marsa','La Marsa Tunisia'],query:'La Marsa, Tunisia'},
  {aliases:['قمرت','Gammarth','Gammarth Tunisia'],query:'Gammarth, Tunisia'},
  {aliases:['رواد','Raoued'],query:'Raoued, Tunisia'},
  {aliases:['قلعة الأندلس','Kalaat El Andalous'],query:'Kalaat El Andalous, Tunisia'},
  {aliases:['رادس','Radès','Rades'],query:'Rades, Tunisia'},
  {aliases:['حمام الأنف','Hammam Lif'],query:'Hammam Lif, Tunisia'},
  {aliases:['حمام الشط','Hammam Chott'],query:'Hammam Chott, Tunisia'},
  {aliases:['سوسة','Sousse'],query:'Sousse, Tunisia'},
  {aliases:['حمام سوسة','Hammam Sousse'],query:'Hammam Sousse, Tunisia'},
  {aliases:['شط مريم','Chott Meriem','Chatt Mariem'],query:'Chott Meriem, Tunisia'},
  {aliases:['القنطاوي','ميناء القنطاوي','Port El Kantaoui'],query:'Port El Kantaoui, Tunisia'},
  {aliases:['هرقلة','Hergla'],query:'Hergla, Tunisia'},
  {aliases:['المنستير','Monastir'],query:'Monastir, Tunisia'},
  {aliases:['جمال','Jemmal'],query:'Jemmal, Monastir, Tunisia'},
  {aliases:['صيادة','Sayada'],query:'Sayada, Monastir, Tunisia'},
  {aliases:['لمطة','Lamta'],query:'Lamta, Monastir, Tunisia'},
  {aliases:['قصيبة المديوني','Ksibet El Mediouni'],query:'Ksibet El Mediouni, Tunisia'},
  {aliases:['المهدية','Mahdia'],query:'Mahdia, Tunisia'},
  {aliases:['رجيش','Rejiche','Rejish'],query:'Rejiche, Tunisia'},
  {aliases:['قصور الساف','Ksour Essef'],query:'Ksour Essef, Tunisia'},
  {aliases:['الشابة','Chebba','La Chebba'],query:'Chebba, Tunisia'},
  {aliases:['ملولش','Melloulèche','Melloulech'],query:'Mellouleche, Tunisia'},
  {aliases:['صفاقس','Sfax'],query:'Sfax, Tunisia'},
  {aliases:['قرقنة','Kerkennah','Kerkenes'],query:'Kerkennah, Tunisia'},
  {aliases:['المحرس','Mahres','Mahrès'],query:'Mahres, Tunisia'},
  {aliases:['الصخيرة','Skhira'],query:'Skhira, Tunisia'},
  {aliases:['قابس','Gabes','Gabès'],query:'Gabes, Tunisia'},
  {aliases:['مطماطة','Matmata'],query:'Matmata, Tunisia'},
  {aliases:['جرجيس','جربة جرجيس','Zarzis'],query:'Zarzis, Tunisia'},
  {aliases:['جربة','Djerba'],query:'Djerba, Tunisia'},
  {aliases:['حومة السوق','Houmt Souk'],query:'Houmt Souk, Djerba, Tunisia'},
  {aliases:['ميدون','Midoun'],query:'Midoun, Djerba, Tunisia'},
  {aliases:['أجيم','اجيم','Ajim'],query:'Ajim, Djerba, Tunisia'},
  {aliases:['أغير','اغير','Aghir'],query:'Aghir, Djerba, Tunisia'},
  {aliases:['بن قردان','بنقردان','Ben Guerdane'],query:'Ben Guerdane, Tunisia'}
];

const localQueryFor = (normalized: string) => {
  const stripped = stripCoastalPrefix(normalized);
  const hit = LOCAL_TUNISIAN_QUERIES.find(entry =>
    entry.aliases.some(alias => {
      const a = normalizeText(alias);
      return a === normalized || a === stripped || a.includes(normalized) || normalized.includes(a) ||
        a.includes(stripped) || stripped.includes(a);
    })
  );
  return hit?.query ?? null;
};

const localPlaceFor = (raw: string): LocalPlace | null => {
  const normalized = normalizeText(raw);
  const stripped = stripCoastalPrefix(raw);
  return LOCAL_TUNISIAN_QUERIES.find(entry =>
    entry.latitude != null && entry.longitude != null &&
    entry.aliases.some(alias => {
      const a = normalizeText(alias);
      return a === normalized || a === stripped || a.includes(normalized) || normalized.includes(a) ||
        a.includes(stripped) || stripped.includes(a);
    })
  ) ?? null;
};

const uniquePlaces = (places: PlaceResult[]) => {
  const seen = new Set<string>();
  return places.filter(p => {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return false;
    const key = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
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
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      country: item.country,
      admin1: item.admin1,
      timezone: item.timezone
    }))
    .filter((item: PlaceResult) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
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
    .filter((item: any) => item?.address?.country_code === 'tn' || /tunisia|tunisie|تونس/i.test(String(item?.display_name ?? '')))
    .map((item: any) => ({
      name: item.name || item.display_name?.split(',')[0] || query,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      country: item.address?.country || 'Tunisia',
      admin1: item.address?.state || item.address?.province || item.address?.governorate
    }))
    .filter((item: PlaceResult) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
};

const variantsFor = (raw: string) => {
  const normalized = normalizeText(raw);
  const stripped = stripCoastalPrefix(raw);
  const localQuery = localQueryFor(normalized);
  const candidates = [
    localQuery,
    raw,
    `${raw}, Tunisia`,
    `${stripped}, Tunisia`,
    `${stripped}, Tunisie`,
    `${normalized}, Tunisia`
  ];
  return Array.from(new Set(candidates.filter(Boolean).map(v => String(v).trim()))).slice(0, 6);
};

const scorePlace = (place: PlaceResult, normalizedQuery: string) => {
  const name = normalizeText(place.name);
  const stripped = stripCoastalPrefix(normalizedQuery);
  if (name === normalizedQuery || name === stripped) return 0;
  if (name.startsWith(normalizedQuery) || name.startsWith(stripped)) return 1;
  if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) return 2;
  return 3;
};

export class GeocodingService {
  async search(query: string): Promise<PlaceResult[]> {
    const raw = query.trim();
    if (!raw) return [];

    const normalized = normalizeText(raw);

    // Exact local Tunisian places with verified coordinates must not depend on
    // external geocoders. This keeps the public Tunisian beach name "المنڨع"
    // working even when a city-oriented geocoder does not contain it.
    const pinned = localPlaceFor(raw);
    if (pinned?.latitude != null && pinned?.longitude != null) {
      return [{
        name: pinned.displayName ?? pinned.aliases[0] ?? raw,
        latitude: pinned.latitude,
        longitude: pinned.longitude,
        country: 'Tunisia',
        admin1: 'Nabeul'
      }];
    }

    const variants = variantsFor(raw);

    const openQueries = variants.slice(0, 4);
    const primary = await Promise.all(
      openQueries.flatMap(q => [
        fromOpenMeteo(q, 'ar').catch(() => [] as PlaceResult[]),
        fromOpenMeteo(q, 'fr').catch(() => [] as PlaceResult[])
      ])
    );
    let places = uniquePlaces(primary.flat());

    const needsFallback = !places.length ||
      !places.some(p => scorePlace(p, normalized) <= 2);
    if (needsFallback) {
      const fallback = await Promise.all(
        variants.slice(0, 5).map(q => fromNominatim(q).catch(() => [] as PlaceResult[]))
      );
      places = uniquePlaces([...places, ...fallback.flat()]);
    }

    return places
      .filter(p => p.country === undefined || /tunisia|tunisie|تونس/i.test(p.country))
      .sort((a, b) => scorePlace(a, normalized) - scorePlace(b, normalized))
      .slice(0, 10);
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
