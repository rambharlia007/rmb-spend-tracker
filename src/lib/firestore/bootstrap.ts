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

async function findUserDocByGoogleUid(googleUid: string) {
  const q = query(collection(db, 'users'), where('googleUid', '==', googleUid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { internalId: d.id, data: d.data() };
}

async function findUserDocByEmail(email: string) {
  const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { internalId: d.id, data: d.data() };
}

/**
 * Bootstrap user on sign-in. Wrapped with retry logic for transient errors.
 *
 * Logic:
 * 1. Check if /users doc with googleUid already exists → already bootstrapped
 * 2. Check if /users doc with same email exists (pre-created as pending_signup contact)
 *    → update that doc with googleUid, isRegistered: true, create workspace
 * 3. Neither → create fresh /users doc with new internalId
 *
 * Returns { internalId, workspaceId }
 */
async function _bootstrapUser(user: User): Promise<{ internalId: string; workspaceId: string }> {
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

  // Only reuse stub if it is genuinely unregistered (googleUid is null/missing)
  const isUnregisteredStub =
    byEmail != null &&
    (byEmail.data.isRegistered === false || !byEmail.data.isRegistered) &&
    (byEmail.data.googleUid == null || byEmail.data.googleUid === '');

  if (isUnregisteredStub) {
    internalId = byEmail!.internalId;
    userRef = doc(db, 'users', internalId);
  } else {
    userRef = doc(collection(db, 'users'));
    internalId = userRef.id;
  }

  // Create workspace
  const wsRef = doc(collection(db, 'workspaces'));
  await setDoc(wsRef, {
    name: `${user.displayName?.split(' ')[0] ?? 'My'}'s Workspace`,
    ownerUid: internalId,
    members: [internalId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (isUnregisteredStub) {
    // Update existing stub doc — always set googleUid: null explicitly before so rule allows it
    await updateDoc(userRef, {
      googleUid: user.uid,
      displayName: user.displayName ?? byEmail!.data.displayName ?? '',
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

/** Retry wrapper — retries once on transient errors (network, token expiry) */
export async function bootstrapUser(user: User): Promise<{ internalId: string; workspaceId: string }> {
  try {
    return await _bootstrapUser(user);
  } catch (err: any) {
    // Retry once for transient errors (network, token expiry race)
    const isTransient =
      err?.code === 'unavailable' ||
      err?.code === 'deadline-exceeded' ||
      err?.code === 'unauthenticated' ||
      err?.message?.includes('network') ||
      err?.message?.includes('offline');

    if (isTransient) {
      // Wait 1.5s then retry
      await new Promise((r) => setTimeout(r, 1500));
      return await _bootstrapUser(user);
    }
    throw err;
  }
}
