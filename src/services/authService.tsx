import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { auth } from './firebase';

// ===== VALIDATION =====

/**
 * Validate email format
 */
const validateEmail = (email: string): { valid: boolean; error?: string } => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Please enter a valid email address.' };
    }
    return { valid: true };
};

/**
 * Validate password
 */
const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (!password) {
        return { valid: false, error: 'Password cannot be empty.' };
    }
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters.' };
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialCharacter) {
        return {
            valid: false,
            error: 'Password must include an uppercase letter, a lowercase letter, a number, and a special character.'
        };
    }

    return { valid: true };
};

/**
 * Validate login password input only.
 * Keep this light so failed attempts can still be checked by Firebase.
 */
const validateLoginPassword = (password: string): { valid: boolean; error?: string } => {
    if (!password) {
        return { valid: false, error: 'Password cannot be empty.' };
    }

    return { valid: true };
};

/**
 * Parse Firebase auth error codes into user-friendly messages
 */
const getErrorMessage = (errorCode: string, errorMessage: string): string => {
    switch (errorCode) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/invalid-credential':
            return 'Incorrect email or password.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/weak-password':
            return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
        default:
            return errorMessage;
    }
};

// ===== AUTH FUNCTIONS =====

/**
 * Login user with validation and error handling
 * Returns { success: boolean; error?: string }
 */
export const loginUser = async (
    email: string,
    password: string
): Promise<{ success: boolean; error?: string }> => {
    // Validate inputs
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return { success: false, error: emailValidation.error };
    }

    const passwordValidation = validateLoginPassword(password);
    if (!passwordValidation.valid) {
        return { success: false, error: passwordValidation.error };
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error: any) {
        const errorMessage = getErrorMessage(error.code, error.message);
        return { success: false, error: errorMessage };
    }
};

/**
 * Register new user with validation and error handling
 * Returns { success: boolean; error?: string }
 */
export const registerUser = async (
    email: string,
    password: string
): Promise<{ success: boolean; error?: string }> => {
    // Validate inputs
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return { success: false, error: emailValidation.error };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return { success: false, error: passwordValidation.error };
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error: any) {
        const errorMessage = getErrorMessage(error.code, error.message);
        return { success: false, error: errorMessage };
    }
};

/**
 * Logout current user
 */
export const logoutUser = async () => {
    return await signOut(auth);
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): User | null => {
    return auth.currentUser;
};
