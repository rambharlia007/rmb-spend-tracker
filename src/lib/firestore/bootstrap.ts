import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  limit,
  query
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

async function seedWorkspaceData(wsId: string) {
  const catsQ = await getDocs(query(collection(db, 'workspaces', wsId, 'categories'), limit(1)));
  if (!catsQ.empty) return;

  const batch = writeBatch(db);
  for (const cat of DEFAULT_CATEGORIES) {
    const ref = doc(collection(db, 'workspaces', wsId, 'categories'));
    batch.set(ref, { ...cat, active: true, createdAt: serverTimestamp() });
  }
  for (const src of DEFAULT_PAYMENT_SOURCES) {
    const ref = doc(collection(db, 'workspaces', wsId, 'paymentSources'));
    batch.set(ref, { ...src, active: true, createdAt: serverTimestamp() });
  }
  await batch.commit();
}

/**
 * Ensure user has a user doc + default workspace. Idempotent.
 * Returns active workspaceId.
 *
 * Sequential (not single batch) because Firestore rules evaluate
 * subcollection writes against pre-commit state — workspace doc
 * must exist before its children can be checked via get().
 */
export async function bootstrapUser(user: User): Promise<string> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists() && userSnap.data().currentWorkspaceId) {
    const wsId = userSnap.data().currentWorkspaceId as string;
    await seedWorkspaceData(wsId); // idempotent, handles partial prior bootstrap
    return wsId;
  }

  // 1. Create workspace doc
  const wsRef = doc(collection(db, 'workspaces'));
  await setDoc(wsRef, {
    name: `${user.displayName?.split(' ')[0] ?? 'My'}'s Workspace`,
    ownerUid: user.uid,
    members: [user.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 2. Create user doc pointing to workspace
  await setDoc(userRef, {
    email: user.email,
    displayName: user.displayName ?? '',
    photoURL: user.photoURL,
    currentWorkspaceId: wsRef.id,
    createdAt: serverTimestamp()
  });

  // 3. Seed defaults (now workspace exists, rules will pass)
  await seedWorkspaceData(wsRef.id);

  return wsRef.id;
}
