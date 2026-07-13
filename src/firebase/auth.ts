import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./firebase";
import { createOrUpdateUserRecord } from "./projectService";

/**
 * Signs up a new user with email and password, optionally setting a display name.
 */
export async function signUp(email: string, password: string, displayName?: string): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, { displayName });
  }
  if (userCredential.user) {
    await createOrUpdateUserRecord(
      userCredential.user.uid,
      userCredential.user.email || email,
      displayName || userCredential.user.displayName || ""
    );
  }
  return userCredential.user;
}

/**
 * Signs in an existing user with email and password.
 */
export async function signIn(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  if (userCredential.user) {
    await createOrUpdateUserRecord(
      userCredential.user.uid,
      userCredential.user.email || email,
      userCredential.user.displayName || ""
    );
  }
  return userCredential.user;
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Returns the currently authenticated user, or null if there is none.
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Subscribes to changes in the user's authentication state.
 * Returns an unsubscribe function.
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Sends a password reset email to the specified email address.
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Updates the profile details (e.g. display name, photo URL) of the active user.
 */
export async function updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No user is currently signed in.");
  }
  await updateProfile(currentUser, updates);
}
