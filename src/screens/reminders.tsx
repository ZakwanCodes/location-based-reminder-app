import React, { useCallback, useEffect, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { HomeTabParamList } from '../navigation/HomePageNavigator';
import LocationSearchModal from '../components/LocationSearchModal';
import {
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

/**
 * Renders the reminders screen and manages reminder form, date, location, and list interactions.
 */
const RemindersScreen = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [draftDate, setDraftDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState<ReminderLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [showPastReminders, setShowPastReminders] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ title?: string; description?: string; date?: string; location?: string }>({});

  const route = useRoute<RouteProp<HomeTabParamList, 'Reminders'>>();
  const expandPast = (route.params as { expandPast?: boolean } | undefined)?.expandPast;

  useEffect(() => {
    if (expandPast) setShowPastReminders(true);
  }, [expandPast]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  /** Returns the authenticated user id, or sets a status message if no user is logged in. */
  const getUserId = () => {
    const user = getCurrentUser();
    if (!user) {
      setStatusMessage('No logged in user. Please log in first.');
      return null;
    }
    return user.uid;
  };

  /** Loads reminders for the current user from the database and updates loading/status state. */
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

  useEffect(() => {
    if (editingId) {
      setShowCreateForm(true);
    }
  }, [editingId]);

  /** Attaches the current device location to the reminder, or clears it if already set. */
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

  /** Clears all reminder form fields and resets editing/error state. */
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate(null);
    setLocation(null);
    setPriority('medium');
    setEditingId(null);
    setErrors({});
  };

  /** Prefills the form with an existing reminder so it can be edited. */
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

  /** Validates and creates a new reminder or updates the selected reminder being edited. */
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

  /** Toggles completion status for a reminder and refreshes the list. */
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

  /** Shows a confirmation prompt before marking a reminder as complete. */
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

  /** Deletes a reminder by id and refreshes reminder data. */
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

  /** Shows a destructive confirmation prompt before deleting a reminder. */
  const confirmDelete = (id: string) => {
    Alert.alert('Delete Reminder', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteReminder(id) },
    ]);
  };

  /** Formats reminder due date values from string, Date, or Firestore timestamp-like objects. */
  const formatDueDate = (date: ReminderItem['dueDate']) => {
    if (!date) return 'No date';
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toDateString();
    if (typeof date.toDate === 'function') return date.toDate().toDateString();
    return 'Unknown date';
  };

  /** Opens the date picker and initializes the draft date from current due date or today. */
  const openDatePicker = () => {
    setDraftDate(dueDate ?? new Date());
    setShowDatePicker(true);
  };

  /** Handles platform-specific date picker changes and commits selection when appropriate. */
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        setDueDate(selectedDate);
        setErrors(e => ({ ...e, date: undefined }));
      }
      return;
    }

    if (selectedDate) {
      setDraftDate(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="notifications-active" size={24} color="#6366F1" />
        </View>
        <Text style={styles.heading}>My Reminders</Text>
      </View>
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

      <TouchableOpacity style={styles.createToggle} onPress={() => setShowCreateForm(v => !v)} activeOpacity={0.8}>
        <View>
          <Text style={styles.createToggleTitle}>Create Reminder</Text>
          <Text style={styles.createToggleSubtitle}>Tap to {showCreateForm ? 'collapse' : 'expand'} the form</Text>
        </View>
        <MaterialIcons name={showCreateForm ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} color="#6366F1" />
      </TouchableOpacity>

      {showCreateForm && (
        <View style={styles.createCard}>
          {/* ── Form ── */}
          <Text style={styles.sectionTitle}>Details</Text>
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
            onPress={openDatePicker}
          >
            <Text style={[styles.dateButtonText, !dueDate && styles.placeholderText]}>
              {dueDate ? `Due: ${dueDate.toDateString()}` : 'Select due date'}
            </Text>
          </TouchableOpacity>
          {!!errors.date && <Text style={styles.errorText}>{errors.date}</Text>}

          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          <Modal
            visible={showDatePicker && Platform.OS === 'ios'}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalCard}>
                <Text style={styles.dateModalTitle}>Pick a due date</Text>
                <DateTimePicker
                  value={draftDate}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  textColor="#E6EDF3"
                  accentColor="#818CF8"
                  onChange={handleDateChange}
                  style={styles.dateModalPicker}
                />
                <View style={styles.dateModalActions}>
                  <TouchableOpacity
                    style={[styles.dateModalBtn, styles.dateModalBtnGhost]}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.dateModalBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateModalBtn, styles.dateModalBtnPrimary]}
                    onPress={() => {
                      setDueDate(draftDate);
                      setErrors(e => ({ ...e, date: undefined }));
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={styles.dateModalBtnPrimaryText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ── Location ── */}
          <Text style={styles.sectionTitle}>Location</Text>
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

          <Text style={styles.sectionTitle}>Priority</Text>
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
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  resetForm();
                  fetchReminders();
                }}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Refresh</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117', paddingHorizontal: 16, paddingTop: 56 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(99,102,241,0.12)' },
  heading: { fontSize: 26, fontWeight: '800', color: '#E6EDF3', marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#6366F1', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },
  createCard: { borderWidth: 1, borderColor: '#21262D', borderRadius: 14, backgroundColor: '#161B22', padding: 14, marginTop: 6, marginBottom: 12 },
  createToggle: { borderWidth: 1, borderColor: '#21262D', borderRadius: 14, backgroundColor: '#161B22', paddingHorizontal: 14, paddingVertical: 12, marginTop: 6, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  createToggleTitle: { fontSize: 15, fontWeight: '700', color: '#E6EDF3' },
  createToggleSubtitle: { fontSize: 11, color: '#8B949E', marginTop: 2 },
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
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dateModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#161B22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#21262D',
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  dateModalTitle: {
    color: '#E6EDF3',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  dateModalPicker: {
    alignSelf: 'center',
    height: 150,
    marginVertical: 2,
  },
  dateModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dateModalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateModalBtnGhost: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  dateModalBtnPrimary: {
    backgroundColor: '#6366F1',
  },
  dateModalBtnGhostText: {
    color: '#8B949E',
    fontWeight: '700',
  },
  dateModalBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
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

