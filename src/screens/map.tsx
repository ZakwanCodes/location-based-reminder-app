import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { getUserReminders } from '../services/databaseService';
import { getCurrentUser } from '../services/authService';
import {
  getCurrentLocation,
  getAddressFromCoords,
  getDistanceMetres,
  formatDistance,
  type ReminderLocation,
} from '../services/locationService';

type ReminderItem = {
  id: string;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  location?: ReminderLocation;
};

type NearbyReminder = ReminderItem & { distanceMetres: number };

const PRIORITY_COLOR: Record<string, string> = {
  low: '#5cb85c',
  medium: '#f0ad4e',
  high: '#d9534f',
};

const MapScreen = () => {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userAddress, setUserAddress] = useState('');
  const [nearby, setNearby] = useState<NearbyReminder[]>([]);
  const [noLocation, setNoLocation] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const notifiedIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const user = getCurrentUser();
    if (!user) {
      setStatusMessage('Log in to see your reminders.');
      return;
    }

    setLoading(true);
    setStatusMessage('');
    try {
      const [coords, data] = await Promise.all([
        getCurrentLocation(),
        getUserReminders(user.uid),
      ]);

      setUserLocation(coords);
      const address = await getAddressFromCoords(coords.latitude, coords.longitude);
      setUserAddress(address);

      const reminders = data as ReminderItem[];
      const active = reminders.filter(r => !r.completed);

      const withDist: NearbyReminder[] = active
        .filter(r => r.location?.latitude != null)
        .map(r => ({
          ...r,
          distanceMetres: getDistanceMetres(
            coords.latitude, coords.longitude,
            r.location!.latitude, r.location!.longitude,
          ),
        }))
        .sort((a, b) => a.distanceMetres - b.distanceMetres);

      setNearby(withDist);
      setNoLocation(active.filter(r => !r.location));

      // Fire a local notification for any reminder the user is currently inside
      for (const r of withDist) {
        if (r.distanceMetres <= r.location!.radius && !notifiedIds.current.has(r.id)) {
          notifiedIds.current.add(r.id);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Location Reminder',
              body: r.title ?? 'You are near a reminder location',
            },
            trigger: null,
          });
        }
      }
    } catch (err: any) {
      setStatusMessage(err?.message ?? 'Failed to load location data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const renderNearby = ({ item }: { item: NearbyReminder }) => {
    const isVeryClose = item.distanceMetres <= item.location!.radius;
    return (
      <View style={[styles.card, isVeryClose && styles.cardAlert]}>
        {isVeryClose && <Text style={styles.alertBadge}>YOU ARE HERE</Text>}
        <Text style={styles.cardTitle}>{item.title ?? 'Untitled'}</Text>
        {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
        <Text style={styles.cardAddress}>📍 {item.location?.address ?? 'Unknown location'}</Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLOR[item.priority ?? 'medium'] }]}>
            {(item.priority ?? 'medium').toUpperCase()}
          </Text>
          <Text style={[styles.distance, isVeryClose && styles.distanceClose]}>
            {formatDistance(item.distanceMetres)} away
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Nearby Reminders</Text>

      {/* Current location */}
      <View style={styles.locationBar}>
        {loading ? (
          <ActivityIndicator size="small" color="#456FE8" />
        ) : (
          <Text style={styles.locationText}>
            {userAddress ? `📍 ${userAddress}` : 'Location unavailable'}
          </Text>
        )}
        <TouchableOpacity onPress={refresh} disabled={loading} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {!!statusMessage && <Text style={styles.status}>{statusMessage}</Text>}

      {!loading && nearby.length === 0 && noLocation.length === 0 && (
        <Text style={styles.emptyText}>No active reminders found.</Text>
      )}

      <FlatList
        data={nearby}
        keyExtractor={item => item.id}
        renderItem={renderNearby}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          nearby.length > 0 ? (
            <Text style={styles.sectionHeader}>Location-based ({nearby.length})</Text>
          ) : null
        }
        ListFooterComponent={
          noLocation.length > 0 ? (
            <View>
              <Text style={styles.sectionHeader}>No location set ({noLocation.length})</Text>
              {noLocation.map(item => (
                <View key={item.id} style={styles.cardSimple}>
                  <Text style={styles.cardTitle}>{item.title ?? 'Untitled'}</Text>
                  {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
};

export default MapScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56 },
  heading: { fontSize: 26, fontWeight: '700', color: '#222', marginBottom: 12 },
  locationBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f0f3ff', borderRadius: 10, padding: 10, marginBottom: 12,
  },
  locationText: { flex: 1, fontSize: 13, color: '#456FE8', flexWrap: 'wrap' },
  refreshBtn: { marginLeft: 8, backgroundColor: '#456FE8', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  refreshText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  status: { fontSize: 12, color: '#d9534f', marginBottom: 8 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8, marginTop: 4 },
  listContent: { paddingBottom: 32 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#aaa', fontSize: 15 },
  card: {
    borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12,
    backgroundColor: '#f9faff', padding: 14, marginBottom: 10,
  },
  cardAlert: { borderColor: '#456FE8', backgroundColor: '#eef1ff' },
  alertBadge: {
    alignSelf: 'flex-start', backgroundColor: '#456FE8', color: '#fff',
    fontSize: 10, fontWeight: '700', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6,
  },
  cardSimple: {
    borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12,
    backgroundColor: '#fafafa', padding: 12, marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2a2a2a', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#666', marginBottom: 4 },
  cardAddress: { fontSize: 12, color: '#456FE8', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityBadge: {
    fontSize: 10, fontWeight: '700', color: '#fff',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  distance: { fontSize: 13, color: '#666', fontWeight: '600' },
  distanceClose: { color: '#456FE8' },
});
