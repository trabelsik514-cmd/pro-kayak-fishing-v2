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
    attributionControl: true,
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
        }
      },
      layers: [
        { id: 'satellite', type: 'raster', source: 'esri-satellite' },
        { id: 'place-labels', type: 'raster', source: 'esri-reference', paint: { 'raster-opacity': 0.82 } }
      ]
    }
  });

  // Coastal reference labels: add after map load so they are reliably visible on MapLibre.
  const coastalLabels = [
    { name: 'طبرقة · Tabarka', lng: 8.757, lat: 36.954 },
    { name: 'بنزرت · Bizerte', lng: 9.873, lat: 37.274 },
    { name: 'تونس · Tunis', lng: 10.181, lat: 36.806 },
    { name: 'الحمامات · Hammamet', lng: 10.616, lat: 36.400 },
    { name: 'سوسة · Sousse', lng: 10.637, lat: 35.825 },
    { name: 'المنستير · Monastir', lng: 10.826, lat: 35.764 },
    { name: 'المهدية · Mahdia', lng: 11.062, lat: 35.504 },
    { name: 'صفاقس · Sfax', lng: 10.760, lat: 34.740 },
    { name: 'قابس · Gabès', lng: 10.099, lat: 33.882 },
    { name: 'جربة · Djerba', lng: 10.855, lat: 33.807 },
    { name: 'جرجيس · Zarzis', lng: 11.112, lat: 33.504 }
  ];

  const addCoastalLabels = () => {
    const labelMarkers = coastalLabels.map(({ name, lng, lat }) => {
      const el = document.createElement('div');
      el.className = 'pkf-coastal-label';
      el.textContent = name;
      Object.assign(el.style, {
        background: 'rgba(5, 18, 29, 0.90)',
        border: '1px solid rgba(70, 196, 255, 0.65)',
        borderRadius: '999px',
        color: '#f4f8fb',
        padding: '5px 9px',
        fontSize: '12px',
        fontWeight: '700',
        lineHeight: '1.1',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,.45)',
        pointerEvents: 'none',
        zIndex: '10',
        display: 'block'
      });
      return new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);
    });

    const syncCoastalLabels = () => {
      const visible = map.getZoom() >= 6.0;
      labelMarkers.forEach(marker => {
        marker.getElement().style.display = visible ? 'block' : 'none';
      });
    };

    map.on('zoomend', syncCoastalLabels);
    syncCoastalLabels();
  };

  if (map.loaded()) addCoastalLabels();
  else map.once('load', addCoastalLabels);

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