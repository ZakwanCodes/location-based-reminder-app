import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createReminder,
  deleteReminder,
  getUserReminders,
  updateReminder,
} from '../services/databaseService';
import { getCurrentUser } from '../services/authService';

type ReminderItem = {
  id: string;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  dueDate?: { toDate?: () => Date } | Date | string;
};

const RemindersScreen = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDateInput, setDueDateInput] = useState('');
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to test Firestore endpoints.');

  const getUserId = () => {
    const user = getCurrentUser();
    if (!user) {
      setStatusMessage('No logged in user found. Login first to test reminders.');
      return null;
    }
    return user.uid;
  };

  const fetchReminders = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      return;
    }

    setIsLoading(true);
    try {
      const data = await getUserReminders(userId);
      setReminders(data as ReminderItem[]);
      setStatusMessage(`Fetched ${data.length} reminder(s).`);
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to fetch reminders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleCreateReminder = async () => {
    Keyboard.dismiss();
    const userId = getUserId();
    if (!userId) {
      return;
    }
    if (!title.trim()) {
      setStatusMessage('Title is required.');
      return;
    }

    const parsedDate = dueDateInput.trim() ? new Date(dueDateInput.trim()) : new Date();
    if (Number.isNaN(parsedDate.getTime())) {
      setStatusMessage('Invalid due date. Use YYYY-MM-DD or leave empty.');
      return;
    }

    setIsLoading(true);
    try {
      await createReminder(userId, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: parsedDate,
        priority,
        completed: false,
      });
      setTitle('');
      setDescription('');
      setDueDateInput('');
      setStatusMessage('Reminder created successfully.');
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
      setStatusMessage('Reminder updated successfully.');
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
      setStatusMessage('Reminder deleted successfully.');
      await fetchReminders();
    } catch (error: any) {
      setStatusMessage(error?.message ?? 'Failed to delete reminder.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteReminder(id) },
    ]);
  };

  const formatDueDate = (dueDate: ReminderItem['dueDate']) => {
    if (!dueDate) {
      return 'No date';
    }
    if (typeof dueDate === 'string') {
      return dueDate;
    }
    if (dueDate instanceof Date) {
      return dueDate.toDateString();
    }
    if (typeof dueDate.toDate === 'function') {
      return dueDate.toDate().toDateString();
    }
    return 'Unknown date';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Reminders Endpoint Test</Text>
      <Text style={styles.statusText}>{statusMessage}</Text>

      <TextInput
        style={styles.input}
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        style={styles.input}
        placeholder="Due Date (YYYY-MM-DD)"
        value={dueDateInput}
        onChangeText={setDueDateInput}
      />

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
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleCreateReminder}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={fetchReminders}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No reminders yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title || 'Untitled reminder'}</Text>
            {!!item.description && <Text style={styles.cardDescription}>{item.description}</Text>}
            <Text style={styles.cardMeta}>Priority: {item.priority || 'medium'}</Text>
            <Text style={styles.cardMeta}>Due: {formatDueDate(item.dueDate)}</Text>
            <Text style={styles.cardMeta}>Status: {item.completed ? 'Completed' : 'Pending'}</Text>

            <View style={styles.cardButtons}>
              <TouchableOpacity
                style={[styles.smallButton, styles.secondaryButton]}
                onPress={() => handleToggleComplete(item)}
              >
                <Text style={styles.smallButtonText}>{item.completed ? 'Mark Pending' : 'Mark Done'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallButton, styles.deleteButton]}
                onPress={() => confirmDelete(item.id)}
              >
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7d7d7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priorityChip: {
    borderWidth: 1,
    borderColor: '#b3b3b3',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  priorityChipActive: {
    borderColor: '#456FE8',
    backgroundColor: '#e8edff',
  },
  priorityText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  priorityTextActive: {
    color: '#1f4cd8',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#456FE8',
  },
  secondaryButton: {
    backgroundColor: '#6a7db8',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
    color: '#888',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 10,
    backgroundColor: '#f9faff',
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2a2a2a',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  cardButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#d9534f',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
