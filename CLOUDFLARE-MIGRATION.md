# Cloudflare migration — PRO KAYAK FISHING V2

This branch prepares the existing Vite app for Cloudflare Pages without changing
`main` or disabling the current Vercel deployment.

## What is prepared

- Vite production output remains `dist`.
- Cloudflare Pages Functions expose the existing server API routes:
  - `/api/chlorophyll`
  - `/api/bathymetry`
  - `/api/coast-distance`
- A small compatibility adapter forwards Pages Function requests to the existing
  handlers under `api/`, avoiding a risky rewrite of marine-data logic.
- `wrangler.toml` declares the Pages output directory and runtime compatibility date.

## Deploy the preview first

1. In Cloudflare Dashboard, open **Workers & Pages** and create a **Pages** project.
2. Connect GitHub repository `trabelsik514-cmd/pro-kayak-fishing-v2`.
3. Select branch `cloudflare-migration` for the initial preview.
4. Build command: `npm run build`.
5. Build output directory: `dist`.
6. Deploy, then test the three API routes and the UI before changing the Android API base URL.
7. After all checks pass, merge the migration into `main` and switch production traffic.

## Smoke tests

Replace `<CLOUDFLARE-PAGES-DOMAIN>` with the actual domain assigned by Cloudflare:

- `/api/chlorophyll?lat=36.82&lng=10.30` — should return JSON. A null chlorophyll value can still mean the satellite dataset has no usable pixel; it is not the same as an API routing failure.
- `/api/bathymetry?lat=36.82&lng=10.30` — should return JSON containing `depthMeters` or an explicit no-data result.
- `/api/coast-distance?lat=36.82&lng=10.30` — should return JSON containing `distanceMeters` or null.

Check response status, JSON content type, CORS headers, and browser console. Do not switch the APK's default API URL until these tests pass. The Cloudflare project URL cannot be known from this repository alone and must not be guessed.

## Important limitations

- These changes prepare the source code; they do not create a Cloudflare account/project or deploy it.
- Existing Vercel remains available until Cloudflare is verified.
- The current Android app still uses the Vercel fallback for native API requests. Update that fallback only after the real Cloudflare Pages URL is confirmed.
- Do not delete the Vercel project before the website and Android APK both pass smoke tests.
