# PRO KAYAK FISHING V2 — Marine Platform Upgrade

## Safety of the migration
- The original `main` branch remains unchanged.
- `backup/pre-upgrade-2026-10-09` is the frozen pre-upgrade snapshot.
- All work for the upgraded app belongs on `feature/marine-platform-upgrade`.
- Keep the current TypeScript/Vite/MapLibre/Capacitor stack unless a measured test proves a change is necessary.
- Preserve the existing app modules, Tunisian branding, Arabic/French support, marine services, fishing intelligence, kayak assessment, trips, waypoints, GPS, bathymetry, and offline shell.

## Baseline discovered
- MapLibre map centered on Tunisia with satellite, EMODnet bathymetry, and contour layers.
- Marine data service with multiple forecast-related outputs and model comparison.
- Fishing intelligence uses Open-Meteo Marine sea-surface temperature and optional NOAA CoastWatch chlorophyll.
- Kayak assessment evaluates wind, gusts, waves, swell, period, currents, and incomplete-data penalties.
- Capacitor Android build workflow and offline service worker already exist.
- `pmtiles` is a dependency, but no PMTiles protocol/source integration was found in the current source tree.

## Upgrade direction
1. **Baseline and regression checks**
   - Run TypeScript checks, production build, dependency audit, and Android debug build.
   - Record existing failures before modifying behavior.
2. **Marine chart architecture**
   - Add a tested PMTiles protocol/source adapter.
   - Do not claim detailed nautical-chart coverage until a licensed chart dataset covering Tunisia is confirmed.
   - Keep satellite imagery and EMODnet layers as independent fallbacks.
3. **Reliable marine data**
   - Keep each provider isolated with timeout, cache, freshness timestamp, and graceful fallback.
   - Display source, model, forecast valid time, and missing-data warnings.
   - Never present unavailable measurements as zero or as live data.
4. **Planning by future time**
   - Select location, date, and departure time before analysis.
   - Compare available forecast hours and models; separate kayak safety from fishing suitability.
5. **Kayak route and safety**
   - Preserve trip storage, waypoints, GPS, route/track support, and sharing.
   - Make the risk assessment conservative and explain each limiting factor.
6. **Offline-first**
   - Cache app shell and last-known reports with timestamps.
   - Add chart downloads only where data license and storage strategy permit.
7. **Quality gate**
   - Test Arabic RTL and French, map taps, GPS, sea-point refresh, missing providers, offline behavior, and Android icon/splash.
   - Do not merge to `main` or label a release final until checks pass.

## Licensing and attribution
Pelorus Nav is MIT-licensed and may be studied for architecture or selectively reused subject to retaining its copyright/license notices. Do not copy its complete source blindly; assess file-level dependencies, attribution, chart-data licensing, and compatibility first. NOAA/EMODnet/Esri data terms remain separate from software licenses.

## Current status
- Backup branch created from the exact pre-upgrade `main` commit.
- Development branch created from the same snapshot.
- Implementation and builds are not yet validated; this file is the initial migration checklist, not a claim that the upgrade is complete.
