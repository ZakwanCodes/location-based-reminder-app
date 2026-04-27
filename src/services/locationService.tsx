import * as Location from 'expo-location';

export type ReminderLocation = {
  latitude: number;
  longitude: number;
  radius: number;
  address?: string;
};

/** Checks existing foreground permission before prompting — avoids redundant system dialogs. */
export async function requestLocationPermissions(): Promise<boolean> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Returns the device's current GPS coordinates at high accuracy. */
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

export type LocationSearchResult = {
  latitude: number;
  longitude: number;
  displayName: string;
};

/** Searches for places by name using the Nominatim OpenStreetMap API. Returns up to 5 results. */
export async function searchPlaces(query: string): Promise<LocationSearchResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ReminderApp/1.0', 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error('Search failed');
  const data: any[] = await res.json();
  return data.map(item => ({
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    displayName: item.display_name,
  }));
}

/** Reverse geocodes coordinates into a human-readable address. Falls back to coordinate string on error. */
export async function getAddressFromCoords(latitude: number, longitude: number): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const parts = [place.name, place.street, place.city].filter(Boolean);
    return parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

/** Calculates the straight-line distance in metres between two GPS coordinates using the Haversine formula. */
export function getDistanceMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Formats a distance in metres to a readable string (e.g. "250 m" or "1.3 km"). */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
