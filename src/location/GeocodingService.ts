export type PlaceResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
  source?: 'local' | 'open-meteo' | 'nominatim' | 'arcgis';
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
  .replace(/\b(?:el|al)\b/gi, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const stripCoastalPrefix = (value: string) => normalizeText(value)
  .replace(/^(?:شاطئ|شاطي|شط|plage|beach|marina|port|ميناء|مرسى|راس|رأس|cap|cape)\s+/i, '')
  .trim();

type LocalPlace = { aliases: string[]; query: string };

const LOCAL_TUNISIAN_QUERIES: LocalPlace[] = [
  // Bizerte / Cap Blanc / north coast
  {aliases:['بنزرت','بن زرت','Bizerte','Bizerte ville','Bizerte Marina','Marina Bizerte','Marina de Bizerte','مارينا بنزرت','مارينة بنزرت','مارينا بن زرت'],query:'Bizerte, Tunisia'},
  {aliases:['راس انجلة','رأس أنجلة','Ras Angela','Cap Angela','Cape Angela'],query:'Cap Angela, Bizerte, Tunisia'},
  {aliases:['راس الجبل','رأس الجبل','Ras Jebel','Ras el Jebel'],query:'Ras Jebel, Bizerte, Tunisia'},
  {aliases:['رفراف','رَف راف','Raf Raf','Raf-Raf','Rafraf'],query:'Raf Raf, Bizerte, Tunisia'},
  {aliases:['غار الملح','غارالملاح','Ghar El Melh','Ghar al Milh','Ghar El Meleh'],query:'Ghar El Melh, Tunisia'},
  {aliases:['الهوارية','هوارية','الحوارية','El Haouaria','El Hawaria','Haouaria'],query:'El Haouaria, Nabeul, Tunisia'},
  {aliases:['راس طبرقة','رأس طبرقة','Tabarka','طبرقة'],query:'Tabarka, Tunisia'},
  {aliases:['عين دراهم','Ain Draham'],query:'Ain Draham, Tunisia'},
  {aliases:['الماتلين','الماتلين','Metline','Mettline'],query:'Metline, Bizerte, Tunisia'},
  {aliases:['العالية','العالية بنزرت','Alia','El Alia'],query:'Alia, Bizerte, Tunisia'},
  {aliases:['منزل جميل','Menzel Jemil'],query:'Menzel Jemil, Bizerte, Tunisia'},
  {aliases:['منزل عبد الرحمان','Menzel Abderrahmane','Menzel Abd er Rahmane'],query:'Menzel Abderrahmane, Bizerte, Tunisia'},
  {aliases:['منزل بورقيبة','Menzel Bourguiba'],query:'Menzel Bourguiba, Bizerte, Tunisia'},
  {aliases:['رفراف شاطئ','شاطئ رفراف','Plage Raf Raf','Raf Raf Beach'],query:'Plage Raf Raf, Tunisia'},
  {aliases:['سيدي علي المكي','شاطئ سيدي علي المكي','Sidi Ali Mekki','Plage Sidi Ali Mekki'],query:'Sidi Ali Mekki, Tunisia'},
  {aliases:['راس فرتاس','رأس فرتاس','راس فرطاس','رأس فرطاس','Ras Fartas','Ras Fartass','Rass el Fortass','Ras el Fortas','Rass Fortass','Ras Fartas Beach'],query:'Ras Fartas, Takelsa, Nabeul, Tunisia'},
  {aliases:['راس سيدي علي المكي','رأس سيدي علي المكي','Ras Sidi Ali Mekki'],query:'Ras Sidi Ali Mekki, Tunisia'},

  // Tunis / Gulf of Tunis
  {aliases:['تونس','Tunis','Tunis ville'],query:'Tunis, Tunisia'},
  {aliases:['المرسى','المرسي','La Marsa','La Marsa Tunisia'],query:'La Marsa, Tunisia'},
  {aliases:['قمرت','قرمرت','Gammarth','Gammarth Tunisia'],query:'Gammarth, Tunisia'},
  {aliases:['سيدي بوسعيد','سيدي بوسعيد','Sidi Bou Said','Sidi Bou Saïd'],query:'Sidi Bou Said, Tunisia'},
  {aliases:['قرطاج','Carthage','Carthage Tunisia'],query:'Carthage, Tunisia'},
  {aliases:['قمرت الشاطئ','شاطئ قمرت','Gammarth Beach'],query:'Gammarth Beach, Tunisia'},
  {aliases:['رواد','Raoued','Raoued Plage','Plage Raoued'],query:'Raoued, Tunisia'},
  {aliases:['قلعة الاندلس','قلعة الأندلس','Kalaat El Andalous','Kalâat El Andalous'],query:'Kalaat El Andalous, Tunisia'},
  {aliases:['رادس','Rades','Radès','Port Rades'],query:'Rades, Tunisia'},
  {aliases:['حمام الانف','حمام الأنف','Hammam Lif','Hammam-Lif'],query:'Hammam Lif, Tunisia'},
  {aliases:['حمام الشط','Hammam Chott','Hammam Chatt'],query:'Hammam Chott, Tunisia'},
  {aliases:['الزهراء','Ezzahra','Ez Zahra'],query:'Ezzahra, Tunisia'},
  {aliases:['المروج','El Mourouj'],query:'El Mourouj, Tunisia'},

  // Nabeul / Cap Bon
  {aliases:['نابل','Nabeul'],query:'Nabeul, Tunisia'},
  {aliases:['الحمامات','حمامات','Hammamet'],query:'Hammamet, Tunisia'},
  {aliases:['ياسمين الحمامات','Yasmine Hammamet'],query:'Yasmine Hammamet, Tunisia'},
  {aliases:['حمامات الجنوبية','Hammamet Sud'],query:'Hammamet Sud, Tunisia'},
  {aliases:['مرسى الأمراء','مرسى الامراء','شاطئ مرسى الأمراء','شاطئ مرسى الامراء','Marsa El Omra','Marsa El Omraa'],query:'Marsa El Omra, Takelsa, Nabeul, Tunisia'},
  {aliases:['المنڨع','المنقع','المنقاع','El Mangaa','El Mngaa','El Menga'],query:'El Mangaa, Takelsa, Nabeul, Tunisia'},
  {aliases:['موزرڨية','موزرقية','Mouzerquia','Mouzerka'],query:'Mouzerquia, Takelsa, Nabeul, Tunisia'},
  {aliases:['تازركة','تازركا','Tazarka','Tazarka Beach','Plage Tazarka'],query:'Tazarka, Tunisia'},
  {aliases:['قليبية','قليبيا','Kélibia','Kelibia','Kelibia Beach'],query:'Kelibia, Tunisia'},
  {aliases:['شاطئ قليبية','Plage Kelibia','Kelibia plage'],query:'Kelibia Beach, Tunisia'},
  {aliases:['منزل تميم','Menzel Temime','Menzel-Temime'],query:'Menzel Temime, Tunisia'},
  {aliases:['قربة','Korba'],query:'Korba, Tunisia'},
  {aliases:['شاطئ قربة','Korba Beach','Plage Korba'],query:'Korba Beach, Tunisia'},
  {aliases:['المعمورة','Maamoura','Maâmoura','Maamoura Beach'],query:'Maamoura, Nabeul, Tunisia'},
  {aliases:['الهوارية','El Haouaria','Haouaria'],query:'El Haouaria, Nabeul, Tunisia'},
  {aliases:['سيدي داود','Sidi Daoud'],query:'Sidi Daoud, Tunisia'},
  {aliases:['شط الحمامات','Chott Hammamet'],query:'Hammamet, Tunisia'},

  // Sousse / Monastir
  {aliases:['سوسة','Sousse'],query:'Sousse, Tunisia'},
  {aliases:['حمام سوسة','Hammam Sousse'],query:'Hammam Sousse, Tunisia'},
  {aliases:['شط مريم','Chott Meriem','Chott Mariem','Chatt Mariem','Plage Chott Meriem'],query:'Chott Meriem, Tunisia'},
  {aliases:['القنطاوي','ميناء القنطاوي','Port El Kantaoui','Port Kantaoui'],query:'Port El Kantaoui, Tunisia'},
  {aliases:['هرقلة','Hergla'],query:'Hergla, Tunisia'},
  {aliases:['المنستير','Monastir','Monastir Tunisia'],query:'Monastir, Tunisia'},
  {aliases:['الميناء الترفيهي المنستير','Marina Monastir','Marina de Monastir'],query:'Marina Monastir, Tunisia'},
  {aliases:['الميناء القديم المنستير','Vieux Port Monastir'],query:'Monastir, Tunisia'},
  {aliases:['صيادة','Sayada'],query:'Sayada, Monastir, Tunisia'},
  {aliases:['لمطة','Lamta'],query:'Lamta, Monastir, Tunisia'},
  {aliases:['قصيبة المديوني','Ksibet El Mediouni','Ksibet Mediouni'],query:'Ksibet El Mediouni, Tunisia'},
  {aliases:['طبلبة','Teboulba'],query:'Teboulba, Monastir, Tunisia'},
  {aliases:['المكنين','Moknine'],query:'Moknine, Tunisia'},
  {aliases:['جمال','Jemmal'],query:'Jemmal, Tunisia'},

  // Mahdia / Sahel
  {aliases:['المهدية','Mahdia'],query:'Mahdia, Tunisia'},
  {aliases:['رجيش','رجيش الشاطئ','Rejiche','Rejish','Plage Rejiche'],query:'Rejiche, Tunisia'},
  {aliases:['قصور الساف','Ksour Essef','Ksour Essaf'],query:'Ksour Essef, Tunisia'},
  {aliases:['الشابة','الشابة المهدية','Chebba','La Chebba','Plage Chebba'],query:'Chebba, Tunisia'},
  {aliases:['ملولش','Melloulèche','Melloulech','Mellouleche'],query:'Mellouleche, Tunisia'},
  {aliases:['سيدي علوان','Sidi Alouane'],query:'Sidi Alouane, Tunisia'},
  {aliases:['البقالطة','Bekalta'],query:'Bekalta, Tunisia'},

  // Sfax / Kerkennah
  {aliases:['صفاقس','Sfax'],query:'Sfax, Tunisia'},
  {aliases:['ميناء صفاقس','Port de Sfax','Sfax Port'],query:'Port de Sfax, Tunisia'},
  {aliases:['قرقنة','قرقنة','Kerkennah','Kerkenes','Kerkennah Islands'],query:'Kerkennah Islands, Tunisia'},
  {aliases:['الشرقي','جزيرة الشرقي','Chergui Kerkennah'],query:'Chergui, Kerkennah, Tunisia'},
  {aliases:['الشرقي قرقنة','Chergui'],query:'Chergui, Kerkennah, Tunisia'},
  {aliases:['الغربي قرقنة','Gharbi','Gharbi Kerkennah'],query:'Gharbi, Kerkennah, Tunisia'},
  {aliases:['المحرس','Mahrès','Mahres','Mahrès Tunisia'],query:'Mahres, Tunisia'},
  {aliases:['الصخيرة','Skhira','La Skhira'],query:'Skhira, Tunisia'},

  // Gabes / Djerba / Zarzis
  {aliases:['قابس','Gabès','Gabes'],query:'Gabes, Tunisia'},
  {aliases:['قابس البحرية','Gabes Port','Port de Gabes'],query:'Gabes Port, Tunisia'},
  {aliases:['شنني قابس','Chenini Gabes'],query:'Chenini, Gabes, Tunisia'},
  {aliases:['مطماطة','Matmata'],query:'Matmata, Tunisia'},
  {aliases:['جربة','Djerba','Djerba Island'],query:'Djerba, Tunisia'},
  {aliases:['حومة السوق','Houmt Souk','Houmt-Souk'],query:'Houmt Souk, Djerba, Tunisia'},
  {aliases:['ميدون','Midoun'],query:'Midoun, Djerba, Tunisia'},
  {aliases:['اجيم','أجيم','Ajim'],query:'Ajim, Djerba, Tunisia'},
  {aliases:['اغير','أغير','Aghir'],query:'Aghir, Djerba, Tunisia'},
  {aliases:['مزارع','Mellita Djerba','مليتة جربة'],query:'Mellita, Djerba, Tunisia'},
  {aliases:['جرجيس','Zarzis','Zarzis Tunisia'],query:'Zarzis, Tunisia'},
  {aliases:['ميناء جرجيس','Port Zarzis','Port de Zarzis'],query:'Port Zarzis, Tunisia'},
  {aliases:['بنقردان','بن قردان','Ben Guerdane'],query:'Ben Guerdane, Tunisia'},
  {aliases:['الكتف','Ras Jedir','رأس جدير'],query:'Ras Jedir, Tunisia'},

  // Common beach-name forms found on Tunisian maps
  {aliases:['شاطئ الحمامات','Plage Hammamet'],query:'Hammamet, Tunisia'},
  {aliases:['شاطئ سيدي الجديدي','Plage Sidi Jedidi'],query:'Sidi Jedidi, Nabeul, Tunisia'},
  {aliases:['شاطئ المنصورة','Plage El Mansourah'],query:'El Mansourah Beach, Tunisia'},
  {aliases:['شاطئ الفتحة','Plage El Fatha'],query:'El Fatha Beach, Tunisia'},
  {aliases:['شاطئ الزوارع','Plage Zouaraa'],query:'Plage Zouaraa, Tunisia'},
  {aliases:['شاطئ راس الديماس','Plage Rass Dimas','Rass Dimas'],query:'Rass Dimas, Tunisia'},
  {aliases:['راس الديماس','Ras Dimas'],query:'Ras Dimas, Tunisia'},
  {aliases:['شاطئ الشرف','Plage Chraff','Chraff'],query:'Chraff, Tunisia'},
  {aliases:['شاطئ غدابنة','Plage Ghedhabna','Ghedhabna'],query:'Ghedhabna, Tunisia'},
  {aliases:['شاطئ سيدي جمر','Plage Sidi Jmour','Sidi Jmour'],query:'Sidi Jmour, Djerba, Tunisia'},
  {aliases:['راس الرمل','رأس الرمل','Ras Rmel','Ras Errmal'],query:'Ras Rmel, Djerba, Tunisia'},
  {aliases:['شاطئ الاميرة','Plage Amira','Amira Beach'],query:'Amira Beach, Tunisia'},
  {aliases:['شاطئ الباطوار','Plage El Battoir','El Battoir'],query:'El Battoir, Tunisia'}
];

const localQueryFor = (normalized: string) => {
  const stripped = stripCoastalPrefix(normalized);
  const hit = LOCAL_TUNISIAN_QUERIES.find(entry => entry.aliases.some(alias => {
    const a = normalizeText(alias);
    return a === normalized || a === stripped || a.includes(normalized) || normalized.includes(a) ||
      a.includes(stripped) || stripped.includes(a);
  }));
  return hit?.query ?? null;
};

const localAliasesFor = (raw: string) => {
  const normalized = normalizeText(raw);
  const stripped = stripCoastalPrefix(raw);
  const hits = LOCAL_TUNISIAN_QUERIES
    .filter(entry => entry.aliases.some(alias => {
      const a = normalizeText(alias);
      return a === normalized || a === stripped || a.includes(normalized) || normalized.includes(a) ||
        a.includes(stripped) || stripped.includes(a);
    }))
    .flatMap(entry => [entry.query, ...entry.aliases.slice(0, 3)])
    .filter(Boolean);
  return Array.from(new Set(hits)).slice(0, 8);
};

const uniquePlaces = (places: PlaceResult[]) => {
  const seen = new Set<string>();
  return places.filter(p => {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return false;
    // Reject obvious non-Tunisian coordinates even when a provider ignores countryCode.
    if (p.latitude < 30 || p.latitude > 38.8 || p.longitude < 7 || p.longitude > 12.5) return false;
    const key = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
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
      timezone: item.timezone,
      source: 'open-meteo' as const
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
      admin1: item.address?.state || item.address?.province || item.address?.governorate,
      source: 'nominatim' as const
    }))
    .filter((item: PlaceResult) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
};

const fromArcGIS = async (query: string) => {
  // Standard Esri World Geocoding endpoint. It is used as a third independent
  // source for POIs, beaches, capes and marinas that city-oriented geocoders miss.
  const url = new URL('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates');
  url.searchParams.set('SingleLine', query);
  url.searchParams.set('countryCode', 'TUN');
  url.searchParams.set('maxLocations', '10');
  url.searchParams.set('outFields', 'PlaceName,Type,City,Region,Country');
  url.searchParams.set('forStorage', 'false');
  url.searchParams.set('f', 'json');

  const response = await fetch(url);
  if (!response.ok) return [] as PlaceResult[];
  const data = await response.json();
  return (data.candidates ?? [])
    .filter((item: any) => {
      const country = String(item?.attributes?.Country ?? item?.attributes?.CountryCode ?? '');
      return /tunisia|tunisie|tun|تونس/i.test(country) ||
        (Number(item?.location?.y) >= 30 && Number(item?.location?.y) <= 38.8 &&
         Number(item?.location?.x) >= 7 && Number(item?.location?.x) <= 12.5);
    })
    .map((item: any) => ({
      name: item?.attributes?.PlaceName || item?.address || query,
      latitude: Number(item?.location?.y),
      longitude: Number(item?.location?.x),
      country: item?.attributes?.Country || 'Tunisia',
      admin1: item?.attributes?.Region || item?.attributes?.City,
      source: 'arcgis' as const
    }))
    .filter((item: PlaceResult) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
};

const variantsFor = (raw: string) => {
  const normalized = normalizeText(raw);
  const stripped = stripCoastalPrefix(raw);
  const localQuery = localQueryFor(normalized);
  const aliasQueries = localAliasesFor(raw);
  const candidates = [
    localQuery,
    ...aliasQueries,
    raw,
    `${raw}, Tunisia`,
    `${stripped}, Tunisia`,
    `${stripped}, Tunisie`,
    `${normalized}, Tunisia`
  ];
  return Array.from(new Set(candidates.filter(Boolean).map(v => String(v).trim()))).slice(0, 12);
};

const scorePlace = (place: PlaceResult, normalizedQuery: string) => {
  const names = [place.name, place.admin1, place.country].filter(Boolean).map(normalizeText);
  const stripped = stripCoastalPrefix(normalizedQuery);
  const aliasTerms = localAliasesFor(normalizedQuery).map(normalizeText);
  if (names.some(name => name === normalizedQuery || name === stripped || aliasTerms.includes(name))) return 0;
  if (names.some(name => name.startsWith(normalizedQuery) || name.startsWith(stripped))) return 1;
  if (names.some(name => name.includes(normalizedQuery) || normalizedQuery.includes(name))) return 2;
  if (aliasTerms.some(alias => names.some(name => name.includes(alias) || alias.includes(name)))) return 2;
  return 3;
};

export class GeocodingService {
  async search(query: string): Promise<PlaceResult[]> {
    const raw = query.trim();
    if (!raw) return [];

    const normalized = normalizeText(raw);
    const variants = variantsFor(raw);

    // Query independent providers in parallel. A provider failing must not
    // block the others, which is important on mobile networks.
    const providerResults = await Promise.all(
      variants.slice(0, 8).flatMap(q => [
        fromOpenMeteo(q, 'ar').catch(() => [] as PlaceResult[]),
        fromOpenMeteo(q, 'fr').catch(() => [] as PlaceResult[]),
        fromNominatim(q).catch(() => [] as PlaceResult[]),
        fromArcGIS(q).catch(() => [] as PlaceResult[])
      ])
    );

    let places = uniquePlaces(providerResults.flat());

    // Prefer exact/local-alias matches. If providers returned weak matches,
    // run the local canonical query explicitly before giving up.
    if (!places.some(p => scorePlace(p, normalized) <= 2)) {
      const canonical = localQueryFor(normalized);
      if (canonical) {
        const extra = await Promise.all([
          fromNominatim(canonical).catch(() => [] as PlaceResult[]),
          fromArcGIS(canonical).catch(() => [] as PlaceResult[]),
          fromOpenMeteo(canonical, 'ar').catch(() => [] as PlaceResult[]),
          fromOpenMeteo(canonical, 'fr').catch(() => [] as PlaceResult[])
        ]);
        places = uniquePlaces([...places, ...extra.flat()]);
      }
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
