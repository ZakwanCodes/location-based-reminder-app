import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  getStoredNotifications,
  clearStoredNotifications,
  deleteStoredNotification,
  storeNotification,
  type StoredNotification,
} from '../services/notificationService';
import { HomeTabParamList } from '../navigation/HomePageNavigator';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  date: Date;
};

const NotificationsScreen = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const navigation = useNavigation<BottomTabNavigationProp<HomeTabParamList>>();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const load = useCallback(async () => {
    const stored = await getStoredNotifications();
    setItems(stored.map(n => ({ ...n, date: new Date(n.date) })));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    // App.tsx already stores the notification — just reload the list here
    const sub = Notifications.addNotificationReceivedListener(() => load());
    return () => sub.remove();
  }, [load]);

  const handleDelete = async (id: string) => {
    swipeableRefs.current.get(id)?.close();
    await deleteStoredNotification(id);
    setItems(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    await clearStoredNotifications();
    setItems([]);
  };

  const handleTap = () => {
    navigation.navigate('Reminders', { expandPast: true });
  };

  const renderRightAction = (id: string) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(id)}>
      <MaterialIcons name="delete-outline" size={22} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Notifications</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length > 0 && (
        <Text style={styles.hint}>Swipe left to delete  ·  Tap to view reminder</Text>
      )}

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {'No notifications yet.\nThey will appear here when a location reminder triggers.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Swipeable
            ref={ref => {
              if (ref) swipeableRefs.current.set(item.id, ref);
              else swipeableRefs.current.delete(item.id);
            }}
            renderRightActions={() => renderRightAction(item.id)}
            rightThreshold={60}
          >
            <TouchableOpacity activeOpacity={0.75} onPress={handleTap}>
              <View style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={styles.bellDot}>
                    <MaterialIcons name="notifications" size={16} color="#6366F1" />
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {!!item.body && <Text style={styles.cardText}>{item.body}</Text>}
                  <Text style={styles.cardTime}>{item.date.toLocaleString()}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color="#21262D" />
              </View>
            </TouchableOpacity>
          </Swipeable>
        )}
      />
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', paddingHorizontal: 16, paddingTop: 56 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  heading: { fontSize: 26, fontWeight: '800', color: '#E6EDF3' },
  clearText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  hint: { fontSize: 11, color: '#4B5563', marginBottom: 12 },
  listContent: { paddingBottom: 32 },
  emptyText: { textAlign: 'center', marginTop: 60, color: '#4B5563', fontSize: 15, lineHeight: 22 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#21262D', borderRadius: 14,
    backgroundColor: '#161B22', padding: 14, marginBottom: 10,
  },
  cardLeft: { marginRight: 12 },
  bellDot: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#E6EDF3', marginBottom: 2 },
  cardText: { fontSize: 13, color: '#8B949E', marginBottom: 4 },
  cardTime: { fontSize: 11, color: '#4B5563' },
  deleteAction: {
    backgroundColor: '#EF4444', borderRadius: 14, marginBottom: 10,
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  deleteActionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
