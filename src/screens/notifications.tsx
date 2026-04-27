import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  date: Date;
};

const NotificationsScreen = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    const presented = await Notifications.getPresentedNotificationsAsync();
    setItems(
      presented.map(n => ({
        id: n.request.identifier,
        title: n.request.content.title ?? 'Reminder',
        body: n.request.content.body ?? '',
        date: new Date(n.date),
      })).reverse(),
    );
  }, []);

  useEffect(() => {
    load();
    const sub = Notifications.addNotificationReceivedListener(load);
    return () => sub.remove();
  }, [load]);

  const clearAll = async () => {
    await Notifications.dismissAllNotificationsAsync();
    setItems([]);
  };

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

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications yet.{'\n'}They will appear here when a location reminder triggers.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {!!item.body && <Text style={styles.cardBody}>{item.body}</Text>}
            <Text style={styles.cardTime}>{item.date.toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  heading: { fontSize: 26, fontWeight: '700', color: '#222' },
  clearText: { fontSize: 14, color: '#d9534f', fontWeight: '600' },
  listContent: { paddingBottom: 32 },
  emptyText: { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 15, lineHeight: 22 },
  card: {
    borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12,
    backgroundColor: '#f9faff', padding: 14, marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#2a2a2a', marginBottom: 2 },
  cardBody: { fontSize: 13, color: '#555', marginBottom: 4 },
  cardTime: { fontSize: 11, color: '#aaa' },
});
