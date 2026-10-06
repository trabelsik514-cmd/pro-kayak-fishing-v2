import 'maplibre-gl/dist/maplibre-gl.css';
import './app/app.css';
import { createApp } from './app/createApp';
import { registerOffline, watchConnection } from './offline/registerOffline';

// Service workers are intentionally disabled in development/StackBlitz preview.
// They are enabled only in the production Vite build so preview never gets
// trapped by a cached index.html or stale application shell.
if (import.meta.env.PROD) {
  registerOffline();
}

watchConnection(online => {
  document.documentElement.dataset.connection = online ? 'online' : 'offline';
});

createApp(document.querySelector('#app')!);
