import { Capacitor } from '@capacitor/core';
import { BackgroundRunner } from '@capacitor/background-runner';
import { LocalNotifications } from '@capacitor/local-notifications';

const RUNNER_LABEL = 'com.prokayakfishing.app.background';

export async function initSeaNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    await LocalNotifications.createChannel({
      id: 'pkf-sea-updates',
      name: 'تحديثات البحر',
      description: 'تحديثات حالة البحر والطقس في PRO KAYAK FISHING',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true
    });
  } catch (error) {
    console.warn('PKF notification setup failed', error);
  }
}

export async function saveBackgroundLocation(
  lat: number,
  lng: number,
  label: string | null
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await BackgroundRunner.dispatchEvent({
      label: RUNNER_LABEL,
      event: 'pkfSaveLocation',
      details: { lat, lng, label }
    });
  } catch (error) {
    console.warn('PKF background location sync failed', error);
  }
}

export async function triggerBackgroundRefresh(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await BackgroundRunner.dispatchEvent({
      label: RUNNER_LABEL,
      event: 'pkfBackgroundRefresh',
      details: {}
    });
  } catch (error) {
    console.warn('PKF background refresh trigger failed', error);
  }
}
