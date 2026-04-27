import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import {
  createReminder,
  deleteReminder,
  getUserReminders,
  updateReminder,
} from '../services/databaseService';
import { getCurrentUser } from '../services/authService';
import {
  getCurrentLocation,
  getAddressFromCoords,
  type ReminderLocation,
} from '../services/locationService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderItem = {
  id: string;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  dueDate?: { toDate?: () => Date } | Date | string;
  location?: ReminderLocation;
};

// ─── Date Picker ──────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

type DatePickerModalProps = {
  visible: boolean;
  selected: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

function DatePickerModal({ visible, selected, onConfirm, onClose }: DatePickerModalProps) {
  const [month, setMonth] = useState(selected.getMonth());
  const [year, setYear] = useState(selected.getFullYear());
  const [pickedDay, setPickedDay] = useState(selected.getDate());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(month, year);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.container}>
          <View style={pickerStyles.header}>
            <TouchableOpacity onPress={prevMonth} style={pickerStyles.navBtn}>
              <Text style={pickerStyles.navText}>{'‹'}</Text>
            </TouchableOpacity>
            <Text style={pickerStyles.monthYear}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={pickerStyles.navBtn}>
              <Text style={pickerStyles.navText}>{'›'}</Text>
            </TouchableOpacity>
          </View>
          <View style={pickerStyles.dayLabels}>
            {DAY_LABELS.map(d => (
              <Text key={d} style={pickerStyles.dayLabel}>{d}</Text>
            ))}
          </View>
          <View style={pickerStyles.grid}>
            {cells.map((day, i) =>
              day === null ? (
                <View key={`e-${i}`} style={pickerStyles.cell} />
              ) : (
                <TouchableOpacity
                  key={day}
                  style={[pickerStyles.cell, pickedDay === day && pickerStyles.selectedCell]}
                  onPress={() => setPickedDay(day)}
                >
                  <Text style={[pickerStyles.dayText, pickedDay === day && pickerStyles.selectedDayText]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
          <View style={pickerStyles.footer}>
            <TouchableOpacity onPress={onClose} style={pickerStyles.cancelBtn}>
              <Text style={pickerStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(new Date(year, month, pickedDay))}
              style={pickerStyles.confirmBtn}
            >
              <Text style={pickerStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const RemindersScreen = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState<ReminderLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const getUserId = () => {
    const user = getCurrentUser();
    if (!user) {
      setStatusMessage('No logged in user. Please log in first.');
      return null;
    }
    return user.uid;
  };

  const fetchReminders = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await getUserReminders(userId);
      const items = data as ReminderItem[];
      setReminders(items);
      setStatusMessage(`${items.length} reminder(s) loaded.`);
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to load reminders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleAttachLocation = async () => {
    if (location) {
      setLocation(null);
      return;
    }
    setLocationLoading(true);
    try {
      const coords = await getCurrentLocation();
      const address = await getAddressFromCoords(coords.latitude, coords.longitude);
      setLocation({ ...coords, radius: 200, address });
    } catch {
      Alert.alert('Location Error', 'Could not get your location. Make sure location permission is granted.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleCreateReminder = async () => {
    Keyboard.dismiss();
    const userId = getUserId();
    if (!userId) return;
    if (!title.trim()) {
      setStatusMessage('Title is required.');
      return;
    }
    setIsLoading(true);
    try {
      await createReminder(userId, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        priority,
        completed: false,
        location: location ?? undefined,
      });
      setTitle('');
      setDescription('');
      setDueDate(new Date());
      setLocation(null);
      setStatusMessage('Reminder created.');
      await fetchReminders();
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to create reminder.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = async (item: ReminderItem) => {
    setIsLoading(true);
    try {
      await updateReminder(item.id, { completed: !item.completed });
      await fetchReminders();
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to update reminder.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteReminder(id);
      await fetchReminders();
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to delete reminder.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete Reminder', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteReminder(id) },
    ]);
  };

  const formatDueDate = (date: ReminderItem['dueDate']) => {
    if (!date) return 'No date';
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toDateString();
    if (typeof date.toDate === 'function') return date.toDate().toDateString();
    return 'Unknown date';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Reminders</Text>
      {!!statusMessage && <Text style={styles.statusText}>{statusMessage}</Text>}

      {/* ── Form ── */}
      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} />

      <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateButtonText}>Due: {dueDate.toDateString()}</Text>
      </TouchableOpacity>

      <DatePickerModal
        visible={showDatePicker}
        selected={dueDate}
        onConfirm={(date) => { setDueDate(date); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* ── Location button ── */}
      <TouchableOpacity
        style={[styles.locationButton, location ? styles.locationButtonActive : null]}
        onPress={handleAttachLocation}
        disabled={locationLoading}
      >
        {locationLoading ? (
          <ActivityIndicator size="small" color="#456FE8" />
        ) : (
          <Text style={[styles.locationButtonText, location ? styles.locationButtonTextActive : null]}>
            {location ? `📍 ${location.address ?? 'Location set'}  ✕` : '📍 Add My Location'}
          </Text>
        )}
      </TouchableOpacity>

      {/* ── Priority ── */}
      <View style={styles.priorityRow}>
        {(['low', 'medium', 'high'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.priorityChip, priority === value && styles.priorityChipActive]}
            onPress={() => setPriority(value)}
          >
            <Text style={[styles.priorityText, priority === value && styles.priorityTextActive]}>
              {value.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleCreateReminder} disabled={isLoading}>
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={fetchReminders} disabled={isLoading}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* ── List ── */}
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No reminders yet.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, item.completed && styles.cardDone]}>
            <Text style={styles.cardTitle}>{item.title || 'Untitled'}</Text>
            {!!item.description && <Text style={styles.cardDescription}>{item.description}</Text>}
            <Text style={styles.cardMeta}>Due: {formatDueDate(item.dueDate)}</Text>
            <Text style={styles.cardMeta}>Priority: {item.priority ?? 'medium'}</Text>
            {item.location && (
              <Text style={styles.cardLocation}>📍 {item.location.address ?? `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}`}</Text>
            )}
            <Text style={styles.cardMeta}>Status: {item.completed ? 'Completed' : 'Pending'}</Text>

            <View style={styles.cardButtons}>
              <TouchableOpacity style={[styles.smallButton, styles.secondaryButton]} onPress={() => handleToggleComplete(item)}>
                <Text style={styles.smallButtonText}>{item.completed ? 'Mark Pending' : 'Mark Done'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallButton, styles.deleteButton]} onPress={() => confirmDelete(item.id)}>
                <Text style={styles.smallButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
};

export default RemindersScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: 320 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 8 },
  navText: { fontSize: 22, color: '#456FE8', fontWeight: '600' },
  monthYear: { fontSize: 16, fontWeight: '700', color: '#222' },
  dayLabels: { flexDirection: 'row', marginBottom: 4 },
  dayLabel: { width: 40, textAlign: 'center', fontSize: 11, color: '#999', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, marginBottom: 2 },
  selectedCell: { backgroundColor: '#456FE8' },
  dayText: { fontSize: 14, color: '#333' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  cancelText: { color: '#888', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#456FE8', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  confirmText: { color: '#fff', fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56 },
  heading: { fontSize: 26, fontWeight: '700', color: '#222', marginBottom: 10 },
  statusText: { fontSize: 12, color: '#777', marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: '#fff',
  },
  dateButton: {
    borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: '#fff',
  },
  dateButtonText: { color: '#333', fontSize: 14 },
  locationButton: {
    borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    backgroundColor: '#fff', minHeight: 42, justifyContent: 'center',
  },
  locationButtonActive: { borderColor: '#456FE8', backgroundColor: '#eef1ff' },
  locationButtonText: { color: '#888', fontSize: 14 },
  locationButtonTextActive: { color: '#456FE8' },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priorityChip: {
    borderWidth: 1, borderColor: '#b3b3b3', borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  priorityChipActive: { borderColor: '#456FE8', backgroundColor: '#e8edff' },
  priorityText: { fontSize: 12, color: '#555', fontWeight: '600' },
  priorityTextActive: { color: '#1f4cd8' },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryButton: { backgroundColor: '#456FE8' },
  secondaryButton: { backgroundColor: '#6a7db8' },
  buttonText: { color: '#fff', fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  emptyText: { marginTop: 24, textAlign: 'center', color: '#888' },
  card: {
    borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 10,
    backgroundColor: '#f9faff', padding: 12, marginBottom: 10,
  },
  cardDone: { opacity: 0.55 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2a2a2a', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#555', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#666', marginBottom: 2 },
  cardLocation: { fontSize: 12, color: '#456FE8', marginBottom: 2 },
  cardButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallButton: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  deleteButton: { backgroundColor: '#d9534f' },
  smallButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
