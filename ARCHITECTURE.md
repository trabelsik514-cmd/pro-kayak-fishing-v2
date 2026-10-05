# PRO KAYAK FISHING — architecture

## Foundation
- MapLibre GL JS for the map renderer.
- PMTiles planned for offline nautical/chart data.
- TypeScript + Vite.
- Marine data isolated behind services; UI never calls APIs directly.

## Modules
- `map/`: MapLibre map, layers, tap handling, nautical charts.
- `marine/`: weather, waves, swell, currents, tides and marine providers.
- `fishing/`: fishing score, best windows, species logic.
- `kayak/`: trip planning, safety, route and sharing.
- `location/`: GPS and Tunisian coastal place resolution.
- `offline/`: cached maps and last-known data.
- `ui/`: professional responsive interface.
- `i18n/`: Arabic/French.

## Critical rule
A map tap produces coordinates first, then requests independent weather/marine datasets. Failure of one provider must not blank the entire report.

## Next implementation stages
1. Add MapLibre nautical basemap and Tunisia chart source.
2. Add Open-Meteo weather + marine provider with timeout/cache/fallback.
3. Add point report with wind/waves/swell/gusts/temperature/pressure/tide.
4. Add fishing scoring engine with explainable factors.
5. Add kayak trip and safety mode.
6. Add PMTiles offline regions.
7. Add Arabic/French UI and Android packaging.