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
 * Bootstrap user on sign-in.
 *
 * Logic:
 * 1. Already registered? findByGoogleUid → found → seed + return early. Done.
 * 2. Email lookup found a doc with currentWorkspaceId already set → registered user
 *    with missing fields (e.g. googleUid was null due to old schema / interrupted write).
 *    Patch the missing fields only — NEVER create a new workspace.
 * 3. Email lookup found a genuine unregistered stub (no currentWorkspaceId, no googleUid)
 *    → atomically create workspace + update stub doc via writeBatch.
 * 4. No doc at all → atomically create workspace + new user doc via writeBatch.
 *
 * All workspace+user writes are in a single writeBatch so a crash/retry can never
 * leave partial state or create a duplicate workspace.
 */
async function _bootstrapUser(user: User): Promise<{ internalId: string; workspaceId: string }> {
  // ── Step 1: Already fully registered ───────────────────────────────────────
  const byGoogleUid = await findUserDocByGoogleUid(user.uid);
  if (byGoogleUid) {
    const wsId = byGoogleUid.data.currentWorkspaceId as string;
    await seedWorkspaceData(wsId);
    return { internalId: byGoogleUid.internalId, workspaceId: wsId };
  }

  // ── Step 2/3/4: Email lookup ────────────────────────────────────────────────
  const byEmail = await findUserDocByEmail(user.email ?? '');

  // Case 2: Doc exists AND already has a workspace → registered user with missing fields.
  // Just patch — never create a new workspace.
  const existingWsId = byEmail?.data.currentWorkspaceId as string | null | undefined;
  if (byEmail && existingWsId) {
    const userRef = doc(db, 'users', byEmail.internalId);
    await updateDoc(userRef, {
      googleUid: user.uid,
      displayName: user.displayName ?? byEmail.data.displayName ?? '',
      photoURL: user.photoURL ?? byEmail.data.photoURL ?? null,
      isRegistered: true,
      // Ensure internalId field is present (old docs may be missing it)
      internalId: byEmail.internalId,
    });
    await seedWorkspaceData(existingWsId);
    return { internalId: byEmail.internalId, workspaceId: existingWsId };
  }

  // Case 3 or 4: Genuine unregistered stub OR brand new user.
  // Determine internalId and userRef before the batch.
  const isUnregisteredStub =
    byEmail != null &&
    (byEmail.data.isRegistered === false || !byEmail.data.isRegistered) &&
    (byEmail.data.googleUid == null || byEmail.data.googleUid === '') &&
    !existingWsId;

  let internalId: string;
  let userRef;

  if (isUnregisteredStub) {
    internalId = byEmail!.internalId;
    userRef = doc(db, 'users', internalId);
  } else {
    userRef = doc(collection(db, 'users'));
    internalId = userRef.id;
  }

  // Create workspace ref — but don't write yet (batch below)
  const wsRef = doc(collection(db, 'workspaces'));

  // ── Atomic batch: workspace + user doc ─────────────────────────────────────
  const batch = writeBatch(db);

  batch.set(wsRef, {
    name: `${user.displayName?.split(' ')[0] ?? 'My'}'s Workspace`,
    ownerInternalId: internalId,
    members: [internalId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (isUnregisteredStub) {
    batch.update(userRef, {
      googleUid: user.uid,
      displayName: user.displayName ?? byEmail!.data.displayName ?? '',
      photoURL: user.photoURL ?? null,
      isRegistered: true,
      internalId,
      currentWorkspaceId: wsRef.id,
    });
  } else {
    batch.set(userRef, {
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

  await batch.commit();
  await seedWorkspaceData(wsRef.id);
  return { internalId, workspaceId: wsRef.id };
}

/** Retry wrapper — retries once on transient errors (network, token expiry) */
export async function bootstrapUser(user: User): Promise<{ internalId: string; workspaceId: string }> {
  try {
    return await _bootstrapUser(user);
  } catch (err: any) {
    const isTransient =
      err?.code === 'unavailable' ||
      err?.code === 'deadline-exceeded' ||
      err?.code === 'unauthenticated' ||
      err?.message?.includes('network') ||
      err?.message?.includes('offline');

    if (isTransient) {
      await new Promise((r) => setTimeout(r, 1500));
      return await _bootstrapUser(user);
    }
    throw err;
  }
}
