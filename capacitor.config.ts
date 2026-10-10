/// <reference types="@capacitor/background-runner" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prokayakfishing.app',
  appName: 'PRO KAYAK FISHING',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#edf5fa'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    BackgroundRunner: {
      label: 'com.prokayakfishing.app.background',
      src: 'runners/background.js',
      event: 'pkfBackgroundRefresh',
      repeat: true,
      interval: 15,
      autoStart: true
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#e91e4d'
    }
  }
};

export default config;
