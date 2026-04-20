import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserDoc } from '@/types';

export type UserProfile = {
  internalId: string;
  googleUid: string | null;
  email: string;
  displayName: string;
  photoURL: string | null;
  isRegistered: boolean;
};

/**
 * Find a user by email in the global /users collection.
 * Returns null if not found or on permission error.
 */
export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase().trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data() as UserDoc;
    return {
      internalId: d.id,
      googleUid: data.googleUid ?? null,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL ?? null,
      isRegistered: data.isRegistered ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Find a user by their Google UID (used during bootstrap / auth flows).
 */
export async function findUserByGoogleUid(googleUid: string): Promise<UserProfile | null> {
  try {
    const q = query(
      collection(db, 'users'),
      where('googleUid', '==', googleUid),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data() as UserDoc;
    return {
      internalId: d.id,
      googleUid: data.googleUid ?? null,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL ?? null,
      isRegistered: data.isRegistered ?? false,
    };
  } catch {
    return null;
  }
}
