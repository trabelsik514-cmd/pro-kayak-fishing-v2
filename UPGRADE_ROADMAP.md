# PRO KAYAK FISHING V2 — Pelorus Nav-Based Migration

## User's explicit direction
Use the **actual Pelorus Nav application source/UI as the navigation and charting foundation** for PRO KAYAK FISHING V2. Do not treat Pelorus as inspiration only, and do not merely imitate its appearance with a fresh mock UI. Port/adapt the real relevant modules, UI components, chart layers, route/waypoint tools, offline chart workflow, and navigation interactions, then integrate the user's fishing and Tunisia-specific modules.

## Protected project state
- Original application snapshot: `backup/pre-upgrade-2026-10-09`.
- Existing app development branch: `feature/marine-platform-upgrade`.
- Never overwrite `main) or remove the backup.
- Preserve PRO KAYAK FISHING branding, the user's icon/splash assets, Tunisia-first defaults and bounds, Arabic RTL/French localization, weather/marine services, fishing intelligence, kayak suitability assessment, fishing forecast, trip planner, trip/waypoint storage, and existing bathymetry/coast-distance endpoints.

## Upstream foundation
- Upstream: https://github.com/garyo/pelorus-nav
- Review the current upstream source tree and pin the exact upstream commit before importing code.
- Upstream uses TypeScript + Vite + MapLibre + Capacitor and is MIT licensed. Keep the applicable MIT copyright/license and NOTICE attribution, and review third-party dependency and chart-data licenses separately.
- Prefer a tested migration of the actual upstream app foundation over re-creating its UI from scratch.
- Do not import upstream brand identity as the product brand: the resulting product remains PRO KAYAK FISHING.

## Required integration approach
1. **Record baselines first**
   - Run current branch typecheck, production build, tests if present, dependency audit and Android APK workflow.
   - Save the results so upstream migration regressions are distinguishable from existing failures.
2. **Bring in actual Pelorus foundation**
   - Pin upstream commit SHA.
   - Port the real app entrypoint, core stylesheet/UI, chart manager/providers, MapLibre nautical styling, feature query, route/waypoint/track tools, chart cache/download flow and compatible Capacitor pieces.
   - Reconcile package versions and scripts carefully; do not blindly overwrite the current package/config files.
   - Retain MIT LICENSE/NOTICE attribution and document imported/adapted upstream modules.
3. **Merge PRO KAYAK FISHING modules into the real upstream UI**
   - Tunisia map bounds/default view and the user's branding.
   - Arabic RTL and French language switch with consistent translation.
   - Independent marine/weather providers, forecast timestamps, provider/model disclosure and stale/missing-data states.
   - Sea-point tap report with wind, gusts, waves, swell, period, currents where available, temperature, pressure and depth where data supports it.
   - Future-date/hour fishing planner and explainable fishing indicators; never present a suitability score as catch probability.
   - Conservative kayak risk assessment, trip planning, GPS/track, waypoints, route distance and trip sharing.
   - Offline app shell and chart/report caching with visible last-update times.
4. **Tunisia chart-data gate**
   - The upstream renderer/tools do not guarantee licensed, detailed nautical chart coverage for Tunisia.
   - Verify actual chart availability, geographic coverage, depth/sounding data and distribution rights before claiming it works. Keep Esri satellite and EMODnet bathymetry as clearly attributed fallbacks where appropriate.
5. **Quality gates**
   - Check map taps and repeated refreshes, GPS permissions, Arabic RTL/French, Android back/close behavior, app icon/splash, route/waypoint persistence, offline use and provider failure handling.
   - Run typecheck, tests, production build, security audit and Android build. Fix observed failures rather than claiming success without logs.
6. **Release discipline**
   - Keep the integration on a dedicated branch until validated.
   - Do not merge to `main) or share an APK as final until the APK artifact exists and the workflow is successful.

## Current status
- A pre-upgrade backup branch exists.
- A dedicated development branch exists.
- This roadmap records the requested upstream-based migration. The actual Pelorus source has not yet been merged into the app branch, and no migrated APK has been built or validated yet.
