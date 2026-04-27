import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    Timestamp,
    DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

// ===== REMINDERS =====

/**
 * Create a new reminder for the user
 */
export const createReminder = async (
    userId: string,
    reminderData: {
        title: string;
        description?: string;
        dueDate: Date;
        priority?: 'low' | 'medium' | 'high';
        completed?: boolean;
        location?: {
            latitude: number;
            longitude: number;
            radius: number;
            address?: string;
        };
    }
) => {
    return await addDoc(collection(db, 'reminders'), {
        userId,
        ...reminderData,
        dueDate: Timestamp.fromDate(reminderData.dueDate),
        createdAt: Timestamp.now(),
    });
};

/**
 * Get all reminders for a specific user
 */
export const getUserReminders = async (userId: string) => {
    const q = query(collection(db, 'reminders'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
};

/**
 * Update a reminder
 */
export const updateReminder = async (
    reminderId: string,
    updates: Partial<DocumentData>
) => {
    const reminderRef = doc(db, 'reminders', reminderId);
    return await updateDoc(reminderRef, updates);
};

/**
 * Delete a reminder
 */
export const deleteReminder = async (reminderId: string) => {
    return await deleteDoc(doc(db, 'reminders', reminderId));
};

// ===== USER PROFILE =====

/**
 * Create or update user profile
 */
export const saveUserProfile = async (
    userId: string,
    profileData: {
        displayName?: string;
        email: string;
        photoURL?: string;
    }
) => {
    return await addDoc(collection(db, 'users'), {
        userId,
        ...profileData,
        createdAt: Timestamp.now(),
    });
};

/**
 * Get user profile
 */
export const getUserProfile = async (userId: string) => {
    const q = query(collection(db, 'users'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};
