import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getUserReminders } from '../services/databaseService';
import { getCurrentUser } from '../services/authService';
import {
  requestLocationPermissions,
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
  dueDate?: { toDate?: () => Date } | Date | string;
  location?: ReminderLocation;
};

type NearbyReminder = ReminderItem & { distanceMetres: number };

const PRIORITY_COLOR: Record<string, string> = {
  low: '#34D399',
  medium: '#FBBF24',
  high: '#EF4444',
};

const formatDueDate = (date: ReminderItem['dueDate']) => {
  if (!date) return 'No date';
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toDateString();
  if (typeof (date as any).toDate === 'function') return (date as any).toDate().toDateString();
  return 'Unknown date';
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

type DetailModalProps = {
  item: NearbyReminder | null;
  onClose: () => void;
};

function DetailModal({ item, onClose }: DetailModalProps) {
  if (!item) return null;
  const isClose = item.distanceMetres <= item.location!.radius;

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title} numberOfLines={2}>{item.title ?? 'Untitled'}</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <MaterialIcons name="close" size={20} color="#8B949E" />
            </TouchableOpacity>
          </View>

          {isClose && (
            <View style={modalStyles.alertBanner}>
              <MaterialIcons name="location-on" size={14} color="#6366F1" />
              <Text style={modalStyles.alertText}>You are currently within this reminder zone</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {!!item.description && (
              <Text style={modalStyles.description}>{item.description}</Text>
            )}

            <View style={modalStyles.row}>
              <View style={modalStyles.rowIcon}>
                <MaterialIcons name="flag" size={15} color="#8B949E" />
              </View>
              <Text style={modalStyles.rowLabel}>Priority</Text>
              <View style={[modalStyles.priorityBadge, { backgroundColor: PRIORITY_COLOR[item.priority ?? 'medium'] + '28' }]}>
                <Text style={[modalStyles.priorityText, { color: PRIORITY_COLOR[item.priority ?? 'medium'] }]}>
                  {(item.priority ?? 'medium').toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={modalStyles.row}>
              <View style={modalStyles.rowIcon}>
                <MaterialIcons name="event" size={15} color="#8B949E" />
              </View>
              <Text style={modalStyles.rowLabel}>Due</Text>
              <Text style={modalStyles.rowValue}>{formatDueDate(item.dueDate)}</Text>
            </View>

            <View style={modalStyles.row}>
              <View style={modalStyles.rowIcon}>
                <MaterialIcons name="location-on" size={15} color="#8B949E" />
              </View>
              <Text style={modalStyles.rowLabel}>Location</Text>
              <Text style={modalStyles.rowValue} numberOfLines={2}>
                {item.location?.address ?? `${item.location?.latitude.toFixed(4)}, ${item.location?.longitude.toFixed(4)}`}
              </Text>
            </View>

            <View style={modalStyles.row}>
              <View style={modalStyles.rowIcon}>
                <MaterialIcons name="near-me" size={15} color="#8B949E" />
              </View>
              <Text style={modalStyles.rowLabel}>Distance</Text>
              <Text style={[modalStyles.rowValue, isClose && { color: '#6366F1' }]}>
                {formatDistance(item.distanceMetres)} away
              </Text>
            </View>

            <View style={modalStyles.row}>
              <View style={modalStyles.rowIcon}>
                <MaterialIcons name="radar" size={15} color="#8B949E" />
              </View>
              <Text style={modalStyles.rowLabel}>Trigger radius</Text>
              <Text style={modalStyles.rowValue}>{item.location?.radius ?? 200} m</Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={modalStyles.doneBtn} onPress={onClose}>
            <Text style={modalStyles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const MapScreen = () => {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userAddress, setUserAddress] = useState('');
  const [nearby, setNearby] = useState<NearbyReminder[]>([]);
  const [noLocation, setNoLocation] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedReminder, setSelectedReminder] = useState<NearbyReminder | null>(null);
  const notifiedIds = useRef<Set<string>>(new Set());
  const [idsLoaded, setIdsLoaded] = useState(false);

  useEffect(() => {
    const loadIds = async () => {
      const user = getCurrentUser();
      if (user) {
        try {
          const raw = await AsyncStorage.getItem(`notified_ids_${user.uid}`);
          if (raw) notifiedIds.current = new Set(JSON.parse(raw));
        } catch { }
      }
      setIdsLoaded(true);
    };
    loadIds();
  }, []);

  const refresh = useCallback(async (showPermissionAlert = false) => {
    const user = getCurrentUser();
    if (!user) {
      setStatusMessage('Log in to see your reminders.');
      return;
    }
    setLoading(true);
    setStatusMessage('');
    try {
      const granted = await requestLocationPermissions();
      if (!granted) {
        setUserAddress('');
        setUserLocation(null);
        setNearby([]);
        setStatusMessage('Location permission is disabled. Enable it in Settings to refresh nearby reminders.');
        if (showPermissionAlert) {
          Alert.alert(
            'Location Disabled',
            'Location access is required to refresh nearby reminders. Please enable it in app settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
        return;
      }

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

      let idsChanged = false;
      for (const r of withDist) {
        if (r.distanceMetres <= r.location!.radius && !notifiedIds.current.has(r.id)) {
          notifiedIds.current.add(r.id);
          idsChanged = true;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Location Reminder',
              body: r.title ?? 'You are near a reminder location',
            },
            trigger: null,
          });
        }
      }
      if (idsChanged) {
        await AsyncStorage.setItem(
          `notified_ids_${user.uid}`,
          JSON.stringify([...notifiedIds.current]),
        );
      }
    } catch (err: any) {
      setStatusMessage(err?.message ?? 'Failed to load location data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (idsLoaded) refresh(false);
  }, [idsLoaded, refresh]);

  const renderNearby = ({ item }: { item: NearbyReminder }) => {
    const isVeryClose = item.distanceMetres <= item.location!.radius;
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={() => setSelectedReminder(item)}>
        <View style={[styles.card, isVeryClose && styles.cardAlert]}>
          {isVeryClose && <Text style={styles.alertBadge}>YOU ARE HERE</Text>}
          <Text style={styles.cardTitle}>{item.title ?? 'Untitled'}</Text>
          {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
          <Text style={styles.cardAddress}>📍 {item.location?.address ?? 'Unknown location'}</Text>
          <View style={styles.cardFooter}>
            <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLOR[item.priority ?? 'medium'] + '28' }]}>
              <Text style={[styles.priorityText, { color: PRIORITY_COLOR[item.priority ?? 'medium'] }]}>
                {(item.priority ?? 'medium').toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.distance, isVeryClose && styles.distanceClose]}>
              {formatDistance(item.distanceMetres)} away
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Nearby Reminders</Text>

      <View style={styles.locationBar}>
        {loading ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : (
          <Text style={styles.locationText}>
            {userAddress ? `📍 ${userAddress}` : 'Location unavailable'}
          </Text>
        )}
        <TouchableOpacity onPress={() => refresh(true)} disabled={loading} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {!!statusMessage && <Text style={styles.status}>{statusMessage}</Text>}

      {!loading && nearby.length === 0 && noLocation.length === 0 && (
        <Text style={styles.emptyText}>No active reminders found.</Text>
      )}

      {nearby.length > 0 && (
        <Text style={styles.hint}>Tap a card to view details</Text>
      )}

      <FlatList
        data={nearby}
        keyExtractor={item => item.id}
        renderItem={renderNearby}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          nearby.length > 0
            ? <Text style={styles.sectionHeader}>Location-based ({nearby.length})</Text>
            : null
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

      <DetailModal item={selectedReminder} onClose={() => setSelectedReminder(null)} />
    </View>
  );
};

export default MapScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', paddingHorizontal: 16, paddingTop: 56 },
  heading: { fontSize: 26, fontWeight: '800', color: '#E6EDF3', marginBottom: 12 },
  locationBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#161B22', borderRadius: 12, borderWidth: 1, borderColor: '#21262D',
    padding: 12, marginBottom: 12,
  },
  locationText: { flex: 1, fontSize: 13, color: '#6366F1', flexWrap: 'wrap' },
  refreshBtn: { marginLeft: 8, backgroundColor: '#6366F1', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  refreshText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  status: { fontSize: 12, color: '#EF4444', marginBottom: 8 },
  hint: { fontSize: 11, color: '#4B5563', marginBottom: 6 },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: '#4B5563', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  listContent: { paddingBottom: 32 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#4B5563', fontSize: 15 },
  card: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 14,
    backgroundColor: '#161B22', padding: 14, marginBottom: 10,
  },
  cardAlert: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.08)' },
  alertBadge: {
    alignSelf: 'flex-start', backgroundColor: '#6366F1', color: '#fff',
    fontSize: 10, fontWeight: '700', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6,
  },
  cardSimple: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 14,
    backgroundColor: '#161B22', padding: 12, marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#E6EDF3', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#8B949E', marginBottom: 4 },
  cardAddress: { fontSize: 12, color: '#6366F1', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  priorityText: { fontSize: 10, fontWeight: '700' },
  distance: { fontSize: 13, color: '#8B949E', fontWeight: '600' },
  distanceClose: { color: '#6366F1' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  container: {
    backgroundColor: '#161B22', borderRadius: 18, borderWidth: 1, borderColor: '#21262D',
    width: 320, maxHeight: '80%', padding: 20,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#E6EDF3', marginRight: 8 },
  closeBtn: { padding: 4 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 14,
  },
  alertText: { fontSize: 12, color: '#818CF8', flex: 1 },
  description: { fontSize: 14, color: '#8B949E', marginBottom: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#21262D' },
  rowIcon: { width: 28 },
  rowLabel: { fontSize: 13, color: '#4B5563', width: 100 },
  rowValue: { flex: 1, fontSize: 13, color: '#E6EDF3', textAlign: 'right' },
  priorityBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { fontSize: 11, fontWeight: '700' },
  doneBtn: {
    marginTop: 16, backgroundColor: '#6366F1', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
