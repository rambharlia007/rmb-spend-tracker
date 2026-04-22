import {
  collection,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Contact } from '@/types';
import { findUserByEmail } from '@/lib/firestore/userLookup';

// --- My contacts ---
// myInternalId: the stable FK (Firestore doc ID) of the current user
export function subscribeContacts(myInternalId: string, cb: (items: Contact[]) => void) {
  const q = query(collection(db, 'users', myInternalId, 'contacts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => { cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, 'id'>) }))); },
    (err) => { console.error('subscribeContacts error:', err.message); }
  );
}

// --- My incoming invites ---
export type ContactInvite = {
  id: string;
  senderInternalId: string;
  senderEmail: string;
  senderName: string;
  senderPhoto: string | null;
  myContactDocId?: string;
};

export function subscribeContactInvites(myInternalId: string, cb: (items: ContactInvite[]) => void) {
  const q = query(collection(db, 'users', myInternalId, 'contactInvites'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContactInvite, 'id'>) })));
    },
    (err) => { console.error('subscribeContactInvites error:', err.message); }
  );
}

/**
 * Add a contact by email + optional display name.
 *
 * Flow:
 * 1. Look up email in global /users collection
 * 2a. Found + registered → send invite (connected flow)
 * 2b. Found but not registered (pending_signup stub) → save contact ref
 * 2c. Not found → create stub in /users, save contact ref
 *
 * Uses internalId (stable FK) everywhere, never googleUid.
 */
export async function addContact(
  email: string,
  displayName: string,
  myInternalId: string
): Promise<'invited' | 'pending'> {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');

  const trimmedEmail = email.toLowerCase().trim();

  // Look up global users table
  let profile = await findUserByEmail(trimmedEmail);

  if (!profile) {
    // Create a stub entry in global /users for this email
    const stubRef = doc(collection(db, 'users'));
    await setDoc(stubRef, {
      internalId: stubRef.id,
      googleUid: null,
      email: trimmedEmail,
      displayName: displayName || trimmedEmail,
      photoURL: null,
      isRegistered: false,
      currentWorkspaceId: null,
      createdAt: serverTimestamp(),
    });
    profile = {
      internalId: stubRef.id,
      googleUid: null,
      email: trimmedEmail,
      displayName: displayName || trimmedEmail,
      photoURL: null,
      isRegistered: false,
    };
  }

  // Save to my contacts subcollection (using my internalId as path)
  const myContactRef = doc(collection(db, 'users', myInternalId, 'contacts'));

  if (profile.isRegistered && profile.googleUid) {
    // Registered user → send invite
    await setDoc(myContactRef, {
      email: profile.email,
      displayName: displayName || profile.displayName,
      refUserId: profile.internalId,
      status: 'invite_sent',
      createdAt: serverTimestamp(),
    });

    // Drop invite into their contactInvites subcollection (using their internalId as path)
    const inviteRef = doc(collection(db, 'users', profile.internalId, 'contactInvites'));
    await setDoc(inviteRef, {
      senderInternalId: myInternalId,
      senderEmail: me.email ?? '',
      senderName: me.displayName ?? '',
      senderPhoto: me.photoURL ?? null,
      myContactDocId: myContactRef.id,
      createdAt: serverTimestamp(),
    });

    return 'invited';
  } else {
    // Not registered yet → pending
    await setDoc(myContactRef, {
      email: profile.email,
      displayName: displayName || profile.displayName,
      refUserId: profile.internalId,
      status: 'pending_signup',
      createdAt: serverTimestamp(),
    });

    return 'pending';
  }
}

// --- Accept invite ---
export async function acceptContactInvite(invite: ContactInvite, myInternalId: string) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');

  // Create contact on my side (already connected), using my internalId as path
  const myContactRef = doc(collection(db, 'users', myInternalId, 'contacts'));
  await setDoc(myContactRef, {
    email: invite.senderEmail,
    displayName: invite.senderName,
    refUserId: invite.senderInternalId,
    status: 'connected',
    createdAt: serverTimestamp(),
  });

  // Flip sender's contact doc to connected (their path uses their internalId directly)
  if (invite.myContactDocId && invite.senderInternalId) {
    await updateDoc(
      doc(db, 'users', invite.senderInternalId, 'contacts', invite.myContactDocId),
      { status: 'connected' }
    );
  }

  // Delete invite from my contactInvites (using my internalId as path)
  await deleteDoc(doc(db, 'users', myInternalId, 'contactInvites', invite.id));
}

// --- Decline invite ---
export async function declineContactInvite(inviteId: string, myInternalId: string) {
  if (!auth.currentUser) throw new Error('Not signed in');
  await deleteDoc(doc(db, 'users', myInternalId, 'contactInvites', inviteId));
}

// --- Remove contact ---
export async function removeContact(contactId: string, myInternalId: string) {
  if (!auth.currentUser) throw new Error('Not signed in');
  await deleteDoc(doc(db, 'users', myInternalId, 'contacts', contactId));
}
