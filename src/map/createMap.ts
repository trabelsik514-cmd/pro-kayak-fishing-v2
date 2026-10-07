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

  // Coastal labels: render as a DOM overlay positioned from map coordinates.
  // This avoids relying on MapLibre marker styling/CSS and is reliable on mobile.
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
    const container = map.getContainer();
    const layer = document.createElement('div');
    layer.className = 'pkf-coastal-label-layer';
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '8',
      pointerEvents: 'none',
      overflow: 'hidden'
    });

    const items = coastalLabels.map(({ name, lng, lat }) => {
      const el = document.createElement('div');
      el.className = 'pkf-coastal-label';
      el.textContent = name;
      Object.assign(el.style, {
        position: 'absolute',
        transform: 'translate(-50%, -100%)',
        background: 'rgba(5,18,29,.92)',
        border: '1px solid rgba(53,184,238,.65)',
        borderRadius: '999px',
        color: '#fff',
        padding: '5px 9px',
        fontSize: '12px',
        fontWeight: '800',
        lineHeight: '1.1',
        whiteSpace: 'nowrap',
        boxShadow: '0 3px 12px rgba(0,0,0,.48)',
        display: 'none'
      });
      layer.appendChild(el);
      return { el, lng, lat };
    });

    container.appendChild(layer);

    const updateLabels = () => {
      const zoom = map.getZoom();
      const visible = zoom >= 6.0;
      items.forEach(({ el, lng, lat }) => {
        const p = map.project([lng, lat]);
        const inside =
          p.x >= -120 && p.x <= container.clientWidth + 120 &&
          p.y >= -60 && p.y <= container.clientHeight + 60;
        el.style.display = visible && inside ? 'block' : 'none';
        if (inside) {
          el.style.left = Math.round(p.x) + 'px';
          el.style.top = Math.round(p.y) + 'px';
        }
      });
    };

    map.on('move', updateLabels);
    map.on('resize', updateLabels);
    updateLabels();
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