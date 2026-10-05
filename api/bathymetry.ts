const EMODNET_URL = 'https://rest.emodnet-bathymetry.eu/depth_sample';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 15 || lat > 90 ||
    lng < -36 || lng > 43
  ) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const geom = `POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`;
  const url = `${EMODNET_URL}?geom=${encodeURIComponent(geom)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PRO-KAYAK-FISHING/1.0'
      },
      signal: controller.signal
    });

    const body = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: 'EMODnet bathymetry service unavailable',
        upstreamStatus: response.status
      });
    }

    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return res.status(502).json({ error: 'Invalid response from EMODnet' });
    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(504).json({
      error: 'Bathymetry request timed out',
      detail: error?.name || 'unknown'
    });
  } finally {
    clearTimeout(timer);
  }
}
