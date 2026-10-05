import maplibregl from 'maplibre-gl';

export function createMap(container: string) {
  const map = new maplibregl.Map({
    container,
    center: [10.7, 35.8],
    zoom: 6.5,
    maxZoom: 18,
    minZoom: 5,
    maxBounds: [[7.0, 30.0], [12.5, 38.5]],
    attributionControl: true,
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '© Esri'
        }
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'esri-satellite' }]
    }
  });

  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    trackUserLocation: true,
    showUserLocation: true,
    showAccuracyCircle: true
  });
  map.addControl(geolocate, 'top-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

  return { map, geolocate };
}