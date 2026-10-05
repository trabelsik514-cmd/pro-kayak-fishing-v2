import maplibregl from 'maplibre-gl';

export function createMap(container: string) {
  return new maplibregl.Map({
    container,
    center: [10.7, 35.8],
    zoom: 6.5,
    attributionControl: true,
    style: {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1c28' } }]
    }
  });
}