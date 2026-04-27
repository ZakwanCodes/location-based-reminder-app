import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthNavigator';
import { getCurrentUser, logoutUser } from '../services/authService';
import { getUserReminders } from '../services/databaseService';
import { getNotificationPermissionStatus } from '../services/notificationService';
import { getLocationPermissionStatus } from '../services/locationService';

type ReminderItem = {
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
};

type StatFilter = 'total' | 'done' | 'inProgress';

const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const user = getCurrentUser();
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState({ notifications: false, location: false });
  const [activeFilter, setActiveFilter] = useState<StatFilter | null>(null);

  const email = user?.email ?? 'Unknown';
  const initials = email.charAt(0).toUpperCase();
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  const loadStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const reminders = (await getUserReminders(user.uid)) as ReminderItem[];
      setReminders(reminders);
      setStats({
        total: reminders.length,
        completed: reminders.filter(r => r.completed).length,
        inProgress: reminders.filter(r => !r.completed).length,
      });
    } catch {
      // stats are decorative — fail silently
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  const loadPermissionStatus = useCallback(async () => {
    try {
      const [notifications, location] = await Promise.all([
        getNotificationPermissionStatus(),
        getLocationPermissionStatus(),
      ]);
      setPermissionStatus({ notifications, location });
    } catch {
      setPermissionStatus({ notifications: false, location: false });
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadStats();
    loadPermissionStatus();
  }, [loadStats, loadPermissionStatus]));

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logoutUser();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const openStatDetails = (filter: StatFilter) => {
    setActiveFilter(filter);
  };

  const closeStatDetails = () => {
    setActiveFilter(null);
  };

  const filteredReminders =
    activeFilter === 'done'
      ? reminders.filter(r => !!r.completed)
      : activeFilter === 'inProgress'
        ? reminders.filter(r => !r.completed)
        : reminders;

  const filterTitle =
    activeFilter === 'done'
      ? 'Done Reminders'
      : activeFilter === 'inProgress'
        ? 'In-Progress Reminders'
        : 'All Reminders';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.memberText}>Member since {memberSince}</Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsCard}>
          {statsLoading ? (
            <ActivityIndicator color="#6366F1" style={{ paddingVertical: 8 }} />
          ) : (
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => openStatDetails('total')} activeOpacity={0.7}>
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>TOTAL</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem} onPress={() => openStatDetails('done')} activeOpacity={0.7}>
                <Text style={[styles.statNumber, { color: '#34D399' }]}>{stats.completed}</Text>
                <Text style={styles.statLabel}>DONE</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem} onPress={() => openStatDetails('inProgress')} activeOpacity={0.7}>
                <Text style={[styles.statNumber, { color: '#FBBF24' }]}>{stats.inProgress}</Text>
                <Text style={styles.statLabel}>IN-PROGRESS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Account section ── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuRow}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <MaterialIcons name="mail" size={17} color="#6366F1" />
            </View>
            <Text style={styles.menuLabel}>Email</Text>
            <Text style={styles.menuValue} numberOfLines={1}>{email}</Text>
          </View>
          <View style={styles.menuDivider} />
          <View style={styles.menuRow}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(34,211,238,0.15)' }]}>
              <MaterialIcons name="notifications" size={17} color="#22D3EE" />
            </View>
            <Text style={styles.menuLabel}>Notifications</Text>
            <Text style={permissionStatus.notifications ? styles.menuValueEnabled : styles.menuValueDisabled}>
              {permissionStatus.notifications ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <View style={styles.menuDivider} />
          <View style={styles.menuRow}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
              <MaterialIcons name="location-on" size={17} color="#34D399" />
            </View>
            <Text style={styles.menuLabel}>Location</Text>
            <Text style={permissionStatus.location ? styles.menuValueEnabled : styles.menuValueDisabled}>
              {permissionStatus.location ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* ── App section ── */}
        <Text style={styles.sectionLabel}>APP</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuRow}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(251,191,36,0.15)' }]}>
              <MaterialIcons name="info" size={17} color="#FBBF24" />
            </View>
            <Text style={styles.menuLabel}>Version</Text>
            <Text style={styles.menuValue}>1.0.0</Text>
          </View>
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <MaterialIcons name="logout" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Remindify · Never forget what matters</Text>
      </ScrollView>

      <Modal visible={!!activeFilter} transparent animationType="fade" onRequestClose={closeStatDetails}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{filterTitle}</Text>
              <TouchableOpacity onPress={closeStatDetails} style={styles.closeBtn}>
                <MaterialIcons name="close" size={20} color="#8B949E" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredReminders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No reminders in this category.</Text>}
              renderItem={({ item }) => (
                <View style={styles.modalItem}>
                  <Text style={styles.modalItemTitle}>{item.title ?? 'Untitled'}</Text>
                  {!!item.description && <Text style={styles.modalItemDesc}>{item.description}</Text>}
                  {!!item.location && (
                    <Text style={styles.modalItemMeta}>
                      📍 {item.location.address ?? `${item.location.latitude?.toFixed?.(4)}, ${item.location.longitude?.toFixed?.(4)}`}
                    </Text>
                  )}
                  <Text style={[styles.modalItemMeta, item.completed && { color: '#34D399' }]}>
                    {item.completed ? 'Completed' : 'Active'}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1117' },
  scroll: { paddingBottom: 48 },

  header: {
    alignItems: 'center', paddingTop: 36, paddingBottom: 28,
    paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#21262D',
  },
  avatarRing: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderWidth: 2, borderColor: '#6366F1',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#6366F1' },
  emailText: { fontSize: 16, fontWeight: '600', color: '#E6EDF3', marginBottom: 5 },
  memberText: { fontSize: 12, color: '#8B949E' },

  statsCard: {
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: '#161B22', borderRadius: 14,
    borderWidth: 1, borderColor: '#21262D', padding: 20,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 10 },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#6366F1' },
  statLabel: { fontSize: 10, color: '#8B949E', marginTop: 3, fontWeight: '700', letterSpacing: 0.8 },
  statDivider: { width: 1, height: 38, backgroundColor: '#21262D' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#4B5563',
    letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
  },
  menuCard: {
    marginHorizontal: 20, backgroundColor: '#161B22',
    borderRadius: 14, borderWidth: 1, borderColor: '#21262D', overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuIcon: {
    width: 34, height: 34, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  menuLabel: { flex: 1, fontSize: 14, color: '#E6EDF3', fontWeight: '500' },
  menuValue: { fontSize: 12, color: '#8B949E', maxWidth: 150 },
  menuValueEnabled: { fontSize: 12, color: '#34D399', fontWeight: '700', maxWidth: 150 },
  menuValueDisabled: { fontSize: 12, color: '#EF4444', fontWeight: '700', maxWidth: 150 },
  menuDivider: { height: 1, backgroundColor: '#21262D', marginLeft: 62 },

  signOutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 28,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', paddingVertical: 14,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  footer: { textAlign: 'center', marginTop: 28, fontSize: 11, color: '#21262D' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '78%',
    backgroundColor: '#161B22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#21262D',
    padding: 16,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#E6EDF3' },
  closeBtn: { padding: 4 },
  modalListContent: { paddingBottom: 8 },
  modalEmpty: { color: '#4B5563', textAlign: 'center', marginTop: 22 },
  modalItem: {
    borderWidth: 1,
    borderColor: '#21262D',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#0D1117',
    marginBottom: 8,
  },
  modalItemTitle: { fontSize: 14, fontWeight: '700', color: '#E6EDF3', marginBottom: 2 },
  modalItemDesc: { fontSize: 12, color: '#8B949E', marginBottom: 3 },
  modalItemMeta: { fontSize: 11, color: '#6366F1' },
});
