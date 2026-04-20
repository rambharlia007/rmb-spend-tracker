import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  limit,
  query,
  where,
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
 * Find existing /users doc by googleUid field.
 * Returns { internalId, workspaceId } or null.
 */
async function findUserDocByGoogleUid(googleUid: string) {
  const q = query(collection(db, 'users'), where('googleUid', '==', googleUid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { internalId: d.id, data: d.data() };
}

/**
 * Find existing /users doc by email (may be pre-created by another user adding this email as contact).
 * Returns doc id (internalId) or null.
 */
async function findUserDocByEmail(email: string) {
  const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { internalId: d.id, data: d.data() };
}

/**
 * Bootstrap user on sign-in. Uses internalId as stable FK (not googleUid).
 *
 * Logic:
 * 1. Check if /users doc with googleUid already exists → already bootstrapped
 * 2. Check if /users doc with same email exists (pre-created as pending_signup contact)
 *    → update that doc with googleUid, isRegistered: true, create workspace
 * 3. Neither → create fresh /users doc with new internalId
 *
 * Returns { internalId, workspaceId }
 */
export async function bootstrapUser(user: User): Promise<{ internalId: string; workspaceId: string }> {
  // 1. Already registered? (has googleUid field)
  const byGoogleUid = await findUserDocByGoogleUid(user.uid);
  if (byGoogleUid) {
    const wsId = byGoogleUid.data.currentWorkspaceId as string;
    await seedWorkspaceData(wsId);
    return { internalId: byGoogleUid.internalId, workspaceId: wsId };
  }

  // 2. Pre-created stub by another user (pending_signup)?
  const byEmail = await findUserDocByEmail(user.email ?? '');

  let internalId: string;
  let userRef;

  if (byEmail && !byEmail.data.isRegistered) {
    // Reuse the existing doc — internalId stays the same (FK integrity maintained)
    internalId = byEmail.internalId;
    userRef = doc(db, 'users', internalId);
  } else {
    // Fresh user — generate new internalId
    userRef = doc(collection(db, 'users'));
    internalId = userRef.id;
  }

  // Create workspace
  const wsRef = doc(collection(db, 'workspaces'));
  await setDoc(wsRef, {
    name: `${user.displayName?.split(' ')[0] ?? 'My'}'s Workspace`,
    ownerUid: internalId,   // use internalId, not googleUid
    members: [internalId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (byEmail && !byEmail.data.isRegistered) {
    // Update existing stub doc
    await updateDoc(userRef, {
      googleUid: user.uid,
      displayName: user.displayName ?? byEmail.data.displayName ?? '',
      photoURL: user.photoURL ?? null,
      isRegistered: true,
      currentWorkspaceId: wsRef.id,
    });
  } else {
    // Create fresh doc
    await setDoc(userRef, {
      internalId,
      googleUid: user.uid,
      email: (user.email ?? '').toLowerCase(),
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? null,
      isRegistered: true,
      currentWorkspaceId: wsRef.id,
      createdAt: serverTimestamp(),
    });
  }

  await seedWorkspaceData(wsRef.id);
  return { internalId, workspaceId: wsRef.id };
}
