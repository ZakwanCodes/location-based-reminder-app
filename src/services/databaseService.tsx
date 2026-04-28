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

/** Writes a new reminder document to Firestore under the 'reminders' collection. Converts dueDate to a Firestore Timestamp and strips undefined fields. */
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
    const docData = Object.fromEntries(
        Object.entries({
            userId,
            ...reminderData,
            dueDate: Timestamp.fromDate(reminderData.dueDate),
            createdAt: Timestamp.now(),
        }).filter(([, v]) => v !== undefined),
    );
    return await addDoc(collection(db, 'reminders'), docData);
};

/** Fetches all reminders belonging to the given user ID, including both active and completed. */
export const getUserReminders = async (userId: string) => {
    const q = query(collection(db, 'reminders'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
};

/** Partially updates a reminder document. Strips undefined values before writing to avoid Firestore errors. */
export const updateReminder = async (
    reminderId: string,
    updates: Partial<DocumentData>
) => {
    const reminderRef = doc(db, 'reminders', reminderId);
    const cleaned = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    return await updateDoc(reminderRef, cleaned);
};

/** Permanently deletes a reminder document from Firestore by its document ID. */
export const deleteReminder = async (reminderId: string) => {
    return await deleteDoc(doc(db, 'reminders', reminderId));
};

