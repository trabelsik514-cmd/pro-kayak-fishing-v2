import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type DeviceLocation = { lat: number; lng: number; accuracy: number };

export async function getDeviceLocation(): Promise<DeviceLocation> {
  if (!Capacitor.isNativePlatform()) {
    return await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not available'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        p => resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
        e => reject(new Error(e.message || 'Unable to get location')),
        {enableHighAccuracy:true,maximumAge:5000,timeout:20000}
      );
    });
  }

  const permissions = await Geolocation.checkPermissions();
  if (permissions.location !== 'granted') {
    const requested = await Geolocation.requestPermissions();
    if (requested.location !== 'granted') throw new Error('Location permission denied');
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 5000
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy
  };
}
