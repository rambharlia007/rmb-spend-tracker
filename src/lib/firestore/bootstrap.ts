import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍽️', color: '#f59e0b' },
  { name: 'Groceries', icon: '🛒', color: '#10b981' },
  { name: 'Transport', icon: '🚗', color: '#3b82f6' },
  { name: 'Rent', icon: '🏠', color: '#8b5cf6' },
  { name: 'Utilities', icon: '💡', color: '#ef4444' },
  { name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { name: 'Entertainment', icon: '🎬', color: '#f97316' },
  { name: 'Health', icon: '⚕️', color: '#14b8a6' },
  { name: 'Education', icon: '📚', color: '#6366f1' },
  { name: 'Travel', icon: '✈️', color: '#0ea5e9' },
  { name: 'Other', icon: '📦', color: '#64748b' }
];

const DEFAULT_PAYMENT_SOURCES = [
  { name: 'Cash', type: 'cash' as const, last4: null },
  { name: 'UPI', type: 'upi' as const, last4: null }
];

/**
 * Ensure user has a user doc + default workspace. Idempotent.
 * Returns the active workspaceId.
 */
export async function bootstrapUser(user: User): Promise<string> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    if (data.currentWorkspaceId) return data.currentWorkspaceId as string;
  }

  const wsRef = doc(collection(db, 'workspaces'));
  const batch = writeBatch(db);

  batch.set(wsRef, {
    name: `${user.displayName?.split(' ')[0] ?? 'My'}'s Workspace`,
    ownerUid: user.uid,
    members: [user.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = doc(collection(db, 'workspaces', wsRef.id, 'categories'));
    batch.set(catRef, { ...cat, active: true, createdAt: serverTimestamp() });
  }

  for (const src of DEFAULT_PAYMENT_SOURCES) {
    const srcRef = doc(collection(db, 'workspaces', wsRef.id, 'paymentSources'));
    batch.set(srcRef, { ...src, active: true, createdAt: serverTimestamp() });
  }

  batch.set(userRef, {
    email: user.email,
    displayName: user.displayName ?? '',
    photoURL: user.photoURL,
    currentWorkspaceId: wsRef.id,
    createdAt: serverTimestamp()
  });

  await batch.commit();
  return wsRef.id;
}
