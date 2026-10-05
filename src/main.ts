import 'maplibre-gl/dist/maplibre-gl.css';
import './app/app.css';
import { createApp } from './app/createApp';
import { registerOffline, watchConnection } from './offline/registerOffline';
registerOffline();
watchConnection(online => document.documentElement.dataset.connection = online ? 'online' : 'offline';);

createApp(document.querySelector('#app')!);