import maplibregl from 'maplibre-gl';

export function createMap(container: string) {
  const map = new maplibregl.Map({
    container,
    center: [10.7, 35.8],
    zoom: 6.5,
    maxZoom: 18,
    minZoom: 5,
    maxBounds: [[7.0, 30.0], [12.5, 38.5]],
    renderWorldCopies: false,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '© Esri'
        },
        'esri-reference': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '© Esri'
        },
        'emodnet-bathymetry': {
          type: 'raster',
          tiles: ['https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.1.1&request=GetMap&layers=emodnet:mean_multicolour&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}'],
          tileSize: 256,
          attribution: '© EMODnet Bathymetry'
        },
        'emodnet-contours': {
          type: 'raster',
          tiles: ['https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.1.1&request=GetMap&layers=emodnet:contours&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}'],
          tileSize: 256,
          attribution: '© EMODnet Bathymetry'
        }
      },
      layers: [
        { id: 'nautical-background', type: 'background', paint: { 'background-color': '#062b3a' } },
        { id: 'satellite', type: 'raster', source: 'esri-satellite' },
        { id: 'nautical-bathymetry', type: 'raster', source: 'emodnet-bathymetry', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.82 } },
        { id: 'nautical-contours', type: 'raster', source: 'emodnet-contours', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.92 } },
        { id: 'place-labels', type: 'raster', source: 'esri-reference', paint: { 'raster-opacity': 0.82 } }
      ]
    }
  });

  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    trackUserLocation: true,
    showUserLocation: true,
    showAccuracyCircle: true
  });
  // The app provides its own professional map toolbar; avoid duplicate native controls.
  // Keep the GeolocateControl instance for the toolbar's GPS action.

  return { map, geolocate };
}