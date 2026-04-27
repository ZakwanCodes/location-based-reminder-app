import React, { useCallback, useEffect, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { HomeTabParamList } from '../navigation/HomePageNavigator';
import {
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import {
  createReminder,
  deleteReminder,
  getUserReminders,
  updateReminder,
} from '../services/databaseService';
import { getCurrentUser } from '../services/authService';
import {
  requestLocationPermissions,
  getCurrentLocation,
  getAddressFromCoords,
  searchPlaces,
  type LocationSearchResult,
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

/** Returns the number of days in a given month/year (handles leap years via Date overflow). */
function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

type DatePickerModalProps = {
  visible: boolean;
  selected: Date | null;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

/** Modal calendar picker. Syncs its internal month/day/year state whenever the modal opens or the selected date changes. */
function DatePickerModal({ visible, selected, onConfirm, onClose }: DatePickerModalProps) {
  const initial = selected ?? new Date();
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());
  const [pickedDay, setPickedDay] = useState(initial.getDate());

  useEffect(() => {
    if (visible) {
      const d = selected ?? new Date();
      setMonth(d.getMonth());
      setYear(d.getFullYear());
      setPickedDay(d.getDate());
    }
  }, [visible, selected]);

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

// ─── Location Search Modal ────────────────────────────────────────────────────

type LocationSearchModalProps = {
  visible: boolean;
  onConfirm: (loc: ReminderLocation) => void;
  onClose: () => void;
};

/** Modal for searching a place by name via Nominatim. Shows a map marker preview of the selected result before confirming. */
function LocationSearchModal({ visible, onConfirm, onClose }: LocationSearchModalProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [selected, setSelected] = useState<LocationSearchResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setError('');
    }
  }, [visible]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    setError('');
    setResults([]);
    setSelected(null);
    try {
      const found = await searchPlaces(query.trim());
      if (!found.length) {
        setError('No results found. Try a more specific search.');
        return;
      }
      setResults(found);
    } catch {
      setError('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = () => {
    if (!selected) return;
    const shortAddress = selected.displayName.split(',').slice(0, 3).join(',').trim();
    onConfirm({ latitude: selected.latitude, longitude: selected.longitude, radius: 200, address: shortAddress });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={searchStyles.overlay}>
        <View style={searchStyles.container}>
          <Text style={searchStyles.title}>Search a Place</Text>

          <View style={searchStyles.inputRow}>
            <TextInput
              style={searchStyles.input}
              placeholder="e.g. Walmart Toronto"
              placeholderTextColor="#4B5563"
              value={query}
              onChangeText={(t) => { setQuery(t); setError(''); setResults([]); setSelected(null); }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            <TouchableOpacity
              onPress={handleSearch}
              style={[searchStyles.searchBtn, searching && { opacity: 0.6 }]}
              disabled={searching}
            >
              {searching
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={searchStyles.searchBtnText}>Go</Text>}
            </TouchableOpacity>
          </View>

          {!!error && <Text style={searchStyles.error}>{error}</Text>}

          {results.length > 0 && (
            <ScrollView style={searchStyles.resultsList} keyboardShouldPersistTaps="handled">
              {results.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[searchStyles.resultItem, selected === r && searchStyles.resultItemSelected]}
                  onPress={() => setSelected(r)}
                >
                  <Text
                    style={[searchStyles.resultText, selected === r && searchStyles.resultTextSelected]}
                    numberOfLines={2}
                  >
                    {r.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {selected && (
            <MapView
              style={searchStyles.map}
              region={{
                latitude: selected.latitude,
                longitude: selected.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={{ latitude: selected.latitude, longitude: selected.longitude }} />
            </MapView>
          )}

          <View style={searchStyles.footer}>
            <TouchableOpacity onPress={onClose} style={searchStyles.cancelBtn}>
              <Text style={searchStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[searchStyles.confirmBtn, !selected && { opacity: 0.4 }]}
              disabled={!selected}
            >
              <Text style={searchStyles.confirmText}>Confirm</Text>
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
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState<ReminderLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [showPastReminders, setShowPastReminders] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ title?: string; description?: string; date?: string; location?: string }>({});

  const route = useRoute<RouteProp<HomeTabParamList, 'Reminders'>>();
  useEffect(() => {
    if (route.params?.expandPast) setShowPastReminders(true);
  }, [route.params?.expandPast]);
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
      const granted = await requestLocationPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Location access is required. Please enable it in app settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      const coords = await getCurrentLocation();
      const address = await getAddressFromCoords(coords.latitude, coords.longitude);
      setLocation({ ...coords, radius: 200, address });
      setErrors(e => ({ ...e, location: undefined }));
    } catch {
      Alert.alert('Location Error', 'Could not get your location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate(null);
    setLocation(null);
    setPriority('medium');
    setEditingId(null);
    setErrors({});
  };

  const handleEditReminder = (item: ReminderItem) => {
    setEditingId(item.id);
    setTitle(item.title ?? '');
    setDescription(item.description ?? '');
    setPriority(item.priority ?? 'medium');
    const d =
      item.dueDate instanceof Date ? item.dueDate
      : typeof (item.dueDate as any)?.toDate === 'function' ? (item.dueDate as any).toDate()
      : new Date();
    setDueDate(d);
    setLocation(item.location ?? null);
    setStatusMessage('');
    setErrors({});
  };

  const handleCreateReminder = async () => {
    Keyboard.dismiss();
    const userId = getUserId();
    if (!userId) return;

    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = 'Title is required.';
    if (!description.trim()) newErrors.description = 'Description is required.';
    if (!dueDate) newErrors.date = 'Please select a due date.';
    if (!location) newErrors.location = 'Please add a location.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    setIsLoading(true);
    try {
      if (editingId) {
        await updateReminder(editingId, {
          title: title.trim(),
          description: description.trim(),
          dueDate: dueDate!,
          priority,
          location: location!,
        });
        setStatusMessage('Reminder updated.');
      } else {
        await createReminder(userId, {
          title: title.trim(),
          description: description.trim(),
          dueDate: dueDate!,
          priority,
          completed: false,
          location: location!,
        });
        setStatusMessage('Reminder created.');
      }
      resetForm();
      await fetchReminders();
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to save reminder.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = async (item: ReminderItem) => {
    setIsLoading(true);
    try {
      await updateReminder(item.id, { completed: !item.completed });
      await fetchReminders();
      if (!item.completed) setStatusMessage('Reminder completed!');
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to update reminder.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmMarkDone = (item: ReminderItem) => {
    Alert.alert(
      'Mark as Complete',
      `Mark "${item.title ?? 'this reminder'}" as done?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Done', onPress: () => handleToggleComplete(item) },
      ],
    );
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
      {!!editingId && (
        <View style={styles.editBanner}>
          <MaterialIcons name="edit" size={13} color="#FBBF24" />
          <Text style={styles.editBannerText}>Editing reminder</Text>
          <TouchableOpacity onPress={resetForm} style={styles.editCancelBtn}>
            <Text style={styles.editCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!statusMessage && <Text style={styles.statusText}>{statusMessage}</Text>}

      {/* ── Form ── */}
      <TextInput
        style={[styles.input, !!errors.title && styles.inputError]}
        placeholder="Title"
        placeholderTextColor="#4B5563"
        value={title}
        onChangeText={t => { setTitle(t); if (errors.title) setErrors(e => ({ ...e, title: undefined })); }}
      />
      {!!errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

      <TextInput
        style={[styles.input, !!errors.description && styles.inputError]}
        placeholder="Description"
        placeholderTextColor="#4B5563"
        value={description}
        onChangeText={t => { setDescription(t); if (errors.description) setErrors(e => ({ ...e, description: undefined })); }}
      />
      {!!errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

      <TouchableOpacity
        style={[styles.dateButton, !!errors.date && styles.inputError]}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={[styles.dateButtonText, !dueDate && styles.placeholderText]}>
          {dueDate ? `Due: ${dueDate.toDateString()}` : 'Select due date'}
        </Text>
      </TouchableOpacity>
      {!!errors.date && <Text style={styles.errorText}>{errors.date}</Text>}

      <DatePickerModal
        visible={showDatePicker}
        selected={dueDate}
        onConfirm={(date) => { setDueDate(date); setErrors(e => ({ ...e, date: undefined })); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* ── Location ── */}
      {location ? (
        <TouchableOpacity
          style={[styles.locationButton, styles.locationButtonActive]}
          onPress={() => setLocation(null)}
        >
          <Text style={[styles.locationButtonText, styles.locationButtonTextActive]}>
            {`📍 ${location.address ?? 'Location set'}  ✕`}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.locationRow}>
          <TouchableOpacity
            style={[styles.locationHalfButton, locationLoading && { opacity: 0.6 }]}
            onPress={handleAttachLocation}
            disabled={locationLoading}
          >
            {locationLoading
              ? <ActivityIndicator size="small" color="#456FE8" />
              : <Text style={styles.locationButtonText}>📍 My Location</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.locationHalfButton}
            onPress={() => setShowLocationSearch(true)}
          >
            <Text style={styles.locationButtonText}>🔍 Search Place</Text>
          </TouchableOpacity>
        </View>
      )}

      {!!errors.location && <Text style={styles.errorText}>{errors.location}</Text>}

      <LocationSearchModal
        visible={showLocationSearch}
        onConfirm={(loc) => { setLocation(loc); setErrors(e => ({ ...e, location: undefined })); setShowLocationSearch(false); }}
        onClose={() => setShowLocationSearch(false)}
      />

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
          <Text style={styles.buttonText}>{editingId ? 'Save Changes' : 'Create'}</Text>
        </TouchableOpacity>
        {editingId ? (
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={resetForm} disabled={isLoading}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={fetchReminders} disabled={isLoading}>
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ── */}
      <FlatList
        data={reminders.filter(r => !r.completed)}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No active reminders yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title || 'Untitled'}</Text>
            {!!item.description && <Text style={styles.cardDescription}>{item.description}</Text>}
            <Text style={styles.cardMeta}>Due: {formatDueDate(item.dueDate)}</Text>
            <Text style={styles.cardMeta}>Priority: {item.priority ?? 'medium'}</Text>
            {item.location && (
              <Text style={styles.cardLocation}>📍 {item.location.address ?? `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}`}</Text>
            )}
            <View style={styles.cardButtons}>
              <TouchableOpacity
                style={[styles.smallButton, styles.editButton]}
                onPress={() => handleEditReminder(item)}
              >
                <MaterialIcons name="edit" size={13} color="#FBBF24" />
                <Text style={[styles.smallButtonText, { color: '#FBBF24' }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallButton, styles.doneButton]}
                onPress={() => confirmMarkDone(item)}
              >
                <Text style={[styles.smallButtonText, { color: '#34D399' }]}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallButton, styles.deleteButton]} onPress={() => confirmDelete(item.id)}>
                <Text style={[styles.smallButtonText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={() => {
          const past = reminders.filter(r => r.completed);
          if (past.length === 0) return null;
          return (
            <View>
              <TouchableOpacity
                style={styles.pastHeader}
                onPress={() => setShowPastReminders(v => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.pastHeaderText}>Past Reminders ({past.length})</Text>
                <MaterialIcons
                  name={showPastReminders ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color="#4B5563"
                />
              </TouchableOpacity>
              {showPastReminders && past.map(item => (
                <View key={item.id} style={styles.cardPast}>
                  <Text style={styles.cardTitlePast}>{item.title || 'Untitled'}</Text>
                  {!!item.description && <Text style={styles.cardDescription}>{item.description}</Text>}
                  <Text style={styles.cardMeta}>Due: {formatDueDate(item.dueDate)}</Text>
                  {item.location && (
                    <Text style={styles.cardLocation}>📍 {item.location.address ?? `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}`}</Text>
                  )}
                  <View style={styles.cardButtons}>
                    <TouchableOpacity
                      style={[styles.smallButton, styles.secondaryButton]}
                      onPress={() => handleToggleComplete(item)}
                    >
                      <Text style={styles.smallButtonText}>Restore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.smallButton, styles.deleteButton]} onPress={() => confirmDelete(item.id)}>
                      <Text style={[styles.smallButtonText, { color: '#EF4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          );
        }}
      />
    </View>
  );
};

export default RemindersScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#161B22', borderRadius: 16, borderWidth: 1, borderColor: '#21262D', padding: 16, width: 320 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 8 },
  navText: { fontSize: 22, color: '#6366F1', fontWeight: '600' },
  monthYear: { fontSize: 16, fontWeight: '700', color: '#E6EDF3' },
  dayLabels: { flexDirection: 'row', marginBottom: 4 },
  dayLabel: { width: 40, textAlign: 'center', fontSize: 11, color: '#4B5563', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, marginBottom: 2 },
  selectedCell: { backgroundColor: '#6366F1' },
  dayText: { fontSize: 14, color: '#8B949E' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  cancelText: { color: '#8B949E', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#6366F1', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  confirmText: { color: '#fff', fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', paddingHorizontal: 16, paddingTop: 56 },
  heading: { fontSize: 26, fontWeight: '800', color: '#E6EDF3', marginBottom: 10 },
  statusText: { fontSize: 12, color: '#4B5563', marginBottom: 10 },
  errorText: { fontSize: 12, color: '#EF4444', marginBottom: 8, marginTop: -6 },
  input: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10,
    backgroundColor: '#161B22', color: '#E6EDF3', fontSize: 14,
  },
  inputError: { borderColor: '#EF4444' },
  dateButton: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10, backgroundColor: '#161B22',
  },
  dateButtonText: { color: '#8B949E', fontSize: 14 },
  placeholderText: { color: '#4B5563' },
  locationRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  locationHalfButton: {
    flex: 1, borderWidth: 1, borderColor: '#21262D', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    backgroundColor: '#161B22', minHeight: 44, justifyContent: 'center', alignItems: 'center',
  },
  locationButton: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10,
    backgroundColor: '#161B22', minHeight: 44, justifyContent: 'center',
  },
  locationButtonActive: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' },
  locationButtonText: { color: '#4B5563', fontSize: 14 },
  locationButtonTextActive: { color: '#6366F1' },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priorityChip: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#161B22',
  },
  priorityChipActive: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.15)' },
  priorityText: { fontSize: 12, color: '#4B5563', fontWeight: '600' },
  priorityTextActive: { color: '#818CF8' },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryButton: { backgroundColor: '#6366F1' },
  secondaryButton: { backgroundColor: '#21262D' },
  buttonText: { color: '#fff', fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  emptyText: { marginTop: 24, textAlign: 'center', color: '#4B5563' },
  card: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 14,
    backgroundColor: '#161B22', padding: 14, marginBottom: 10,
  },
  cardDone: { opacity: 0.45 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#E6EDF3', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#8B949E', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#4B5563', marginBottom: 2 },
  cardLocation: { fontSize: 12, color: '#6366F1', marginBottom: 2 },
  cardButtons: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  editBannerText: { flex: 1, fontSize: 12, color: '#FBBF24', fontWeight: '600' },
  editCancelBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  editCancelText: { fontSize: 12, color: '#8B949E', fontWeight: '600' },
  smallButton: { flex: 1, flexDirection: 'row', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 4 },
  editButton: { backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  doneButton: { backgroundColor: 'rgba(52,211,153,0.15)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.35)' },
  deleteButton: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  smallButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pastHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4, marginTop: 8, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: '#21262D',
  },
  pastHeaderText: { fontSize: 13, fontWeight: '700', color: '#4B5563', letterSpacing: 0.4 },
  cardPast: {
    borderWidth: 1, borderColor: '#21262D', borderRadius: 14,
    backgroundColor: '#0D1117', padding: 14, marginBottom: 10, opacity: 0.7,
  },
  cardTitlePast: { fontSize: 16, fontWeight: '700', color: '#4B5563', marginBottom: 4 },
});

const searchStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#161B22', borderRadius: 16, borderWidth: 1, borderColor: '#21262D', padding: 20, width: 320 },
  title: { fontSize: 17, fontWeight: '700', color: '#E6EDF3', marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#21262D', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    backgroundColor: '#0D1117', color: '#E6EDF3',
  },
  searchBtn: {
    backgroundColor: '#6366F1', borderRadius: 10,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', minWidth: 44,
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { fontSize: 12, color: '#EF4444', marginBottom: 8 },
  resultsList: { maxHeight: 160, marginBottom: 8 },
  resultItem: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#21262D',
  },
  resultItemSelected: { backgroundColor: 'rgba(99,102,241,0.12)' },
  resultText: { fontSize: 13, color: '#8B949E' },
  resultTextSelected: { color: '#818CF8', fontWeight: '600' },
  map: { height: 160, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  cancelText: { color: '#8B949E', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 20, minWidth: 80, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
