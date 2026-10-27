import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Push is decided and budgeted on the server (push_tick in 0003_m3.sql). The phone only hands
// over its token. Phones that cannot get push (web, Expo Go on Android, simulators) fall back to
// in app banners built from the same outbox.

export type PushKind = 'thanks' | 'sync' | 'hand' | 'nudge';

/** Why this phone has no push, or null when it can have it. */
export function pushUnavailable(): string | null {
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS === 'android' && isRunningInExpoGo()) return 'expo-go-android';
  if (!Device.isDevice) return 'simulator';
  return null;
}

// The app is live in the foreground, so it shows its own banner instead of the system one.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

let registered: string | null = null;

/** Ask once, then register this phone. Returns false when the phone stays on banners. */
export async function registerForPush(): Promise<boolean> {
  if (pushUnavailable()) return false;
  if (Platform.OS === 'android') {
    // Android 13+ asks for permission only once a channel exists.
    await Notifications.setNotificationChannelAsync('default', { name: 'usync', importance: AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return false;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { token, platform: Platform.OS });
  if (error) throw error;
  registered = token;
  return true;
}

/** Before signing out, so the next account on this phone does not get this one's pushes. */
export async function forgetPush() {
  if (!registered) return;
  const token = registered;
  registered = null;
  await supabase.rpc('forget_push_token', { token });
}
