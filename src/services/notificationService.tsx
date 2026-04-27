import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notifications_history';

export type StoredNotification = {
  id: string;
  title: string;
  body: string;
  date: string;
};

/** Configures how notifications behave when the app is in the foreground (show alert, play sound, set badge). */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/** Checks existing permission before prompting — avoids redundant system dialogs. Returns true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Returns whether notification permission is currently granted without triggering a permission prompt. */
export async function getNotificationPermissionStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Persists a received notification to AsyncStorage. Deduplicates by request identifier so the same notification is never stored twice. */
export async function storeNotification(notification: Notifications.Notification): Promise<void> {
  const existing = await getStoredNotifications();
  const id = notification.request.identifier;
  if (existing.some(n => n.id === id)) return;
  const item: StoredNotification = {
    id,
    title: notification.request.content.title ?? 'Reminder',
    body: notification.request.content.body ?? '',
    date: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...existing]));
}

/** Reads and returns all stored notifications from AsyncStorage, newest first. Returns empty array on error. */
export async function getStoredNotifications(): Promise<StoredNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Removes a single notification from storage by its ID. */
export async function deleteStoredNotification(id: string): Promise<void> {
  const existing = await getStoredNotifications();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(n => n.id !== id)));
}

/** Wipes the entire notification history from AsyncStorage. */
export async function clearStoredNotifications(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
