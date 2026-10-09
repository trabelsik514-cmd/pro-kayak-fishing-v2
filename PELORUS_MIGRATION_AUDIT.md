# Pelorus Nav upstream audit — PRO KAYAK FISHING V2

Audit date: 2026-10-09

## Pinned upstream source
- Repository: https://github.com/garyo/pelorus-nav
- Branch inspected: `main`
- Tree/commit SHA observed: `333bf05174683b566bf68f66246a3bed12222827`
- License: MIT; preserve the upstream copyright and include its applicable `LICENSE.md` and `NOTICE` when importing source.
- Upstream package version observed: `0.28.0`

## Compatibility findings
Both applications use TypeScript, Vite, MapLibre GL JS and Capacitor, so there is a credible technical path to using the actual Pelorus application as the chartplotter foundation. They are not drop-in compatible: upstream has a larger application architecture and its own scripts, workers, asset pipelines and tests. Package/config files must be reconciled rather than blindly replaced.

Pelorus features documented upstream include nautical chart providers, chart/region downloads, offline chart use, routes/waypoints/tracks, GPS/navigation, tides/currents and chart-feature identification. These are the actual modules to adapt; a visual-only recreation would not meet the requirement.

## Critical Tunisia coverage finding
Pelorus' built-in official NOAA ENC coverage is documented for US coastal waters, the Great Lakes, Puerto Rico/US Virgin Islands and Hawaii. This does **not** establish official detailed nautical chart coverage for Tunisia. The migration must not present US chart coverage as Tunisian coverage. Before enabling any chart provider for Tunisia, validate the provider's actual geographic coverage, depth/sounding quality, update date, attribution and redistribution license. Keep the existing attributed satellite and EMODnet bathymetry layers as fallbacks where they are available; do not describe satellite imagery or a bathymetry raster as an official nautical chart.

## Current migration state
- The user's original application snapshot is preserved in `backup/pre-upgrade-2026-10-09`.
- Work is isolated on `feature/marine-platform-upgrade`; `main` has not been modified.
- This audit pins the source and records compatibility/coverage gates. It is **not** evidence that Pelorus source files have been imported, that the integration builds, or that an APK is ready.
- Next implementation gate: import the upstream source with its license/notice, reconcile dependencies and entrypoints, integrate PRO KAYAK FISHING modules into the real chartplotter UI, then run automated checks and the Android APK workflow before distributing a build.
