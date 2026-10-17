# CurrentCast Template Adaptation — Working Plan

## Naming and branding
Do not change the app name, package/application ID, logos, splash screen, or visible brand labels during the template-adaptation phase. Branding is a final step, after the interface and features are verified.

## Source reference
- Upstream reference: https://github.com/krumenja/currentcast
- License: MIT (retain required copyright/license notices when adapting source)
- Upstream repository currently exposes App.js plus documentation/license, but not a complete React/Capacitor project manifest or full build tree. Do not assume it can be cloned and built as-is.

## Integration approach
The active project uses Vite + TypeScript + MapLibre GL + Capacitor and creates its UI from `src/app/createApp.ts`; CurrentCast uses React + Capacitor and an inline-styled React component. Preserve the existing app's working marine-data services and Android build path, and port/adapt the CurrentCast interface patterns into the existing application rather than replacing the project with an incomplete upstream checkout.

## Template features to preserve/adapt
- Satellite map with road/label overlay where suitable, search, map-tap forecast, and GPS.
- Forecast view with hourly weather, wind, pressure, sea-surface temperature, tides where a reliable local source exists, moon phase, sunrise/sunset, and fishing score.
- Saved fishing points and catch/forecast context where compatible.
- Responsive map/forecast navigation and compact dark marine dashboard styling.

## Tunisia-specific requirements
- Keep Tunisia as the map/search focus and retain Arabic/French UI.
- Keep kayak trip planning, safe-condition assessment, Garmin-style coordinates, bathymetry, current/wave/wind layers, and offline saved points.
- Do not present NOAA tide predictions as reliable for Tunisia without validating local station coverage. Clearly distinguish unavailable data from measured zero values.
- Do not claim background refresh or sound notifications work unless verified on a real Android build/device.

## Safety and release process
- Work on branch `currentcast-template-adaptation`, not directly on `main`.
- Run TypeScript checks, production build, available tests, and Android build workflow before proposing a merge.
- Verify the deployed preview and phone layout before release.
- Revisit branding/name only after feature and UI acceptance.
