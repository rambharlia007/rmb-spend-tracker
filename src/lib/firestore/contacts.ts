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

export function subscribeContacts(cb: (items: Contact[]) => void) {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  // contacts path uses googleUid — we look up internalId at write time
  // but for the subscribe we still need the path key; we use googleUid here
  // because auth.currentUser.uid is always available synchronously
  const q = query(collection(db, 'users', uid, 'contacts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, 'id'>) })));
  });
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

export function subscribeContactInvites(cb: (items: ContactInvite[]) => void) {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  const q = query(collection(db, 'users', uid, 'contactInvites'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ContactInvite, 'id'>),
      }))
    );
  });
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

  // Save to my contacts subcollection (using my googleUid as path, internalId as FK)
  const myContactRef = doc(collection(db, 'users', me.uid, 'contacts'));

  if (profile.isRegistered && profile.googleUid) {
    // Registered user → send invite
    await setDoc(myContactRef, {
      email: profile.email,
      displayName: displayName || profile.displayName,
      refUserId: profile.internalId,
      status: 'invite_sent',
      createdAt: serverTimestamp(),
    });

    // Drop invite into their contactInvites subcollection (using their googleUid as path)
    const inviteRef = doc(collection(db, 'users', profile.googleUid, 'contactInvites'));
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

export async function acceptContactInvite(invite: ContactInvite, _myInternalId: string) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');

  // Create contact on my side
  const myContactRef = doc(collection(db, 'users', me.uid, 'contacts'));
  await setDoc(myContactRef, {
    email: invite.senderEmail,
    displayName: invite.senderName,
    refUserId: invite.senderInternalId,
    status: 'connected',
    createdAt: serverTimestamp(),
  });

  // Flip sender's contact doc to connected (need sender's googleUid)
  // We find sender via their internalId stored in invite
  // The myContactDocId points to the sender's contact doc for me
  if (invite.myContactDocId && invite.senderInternalId) {
    const senderSnap = await getDoc(doc(db, 'users', invite.senderInternalId));
    if (senderSnap.exists()) {
      const senderGoogleUid = senderSnap.data().googleUid as string | null;
      if (senderGoogleUid) {
        await updateDoc(
          doc(db, 'users', senderGoogleUid, 'contacts', invite.myContactDocId),
          { status: 'connected' }
        );
      }
    }
    await updateDoc(myContactRef, { status: 'connected' });
  }

  // Delete invite
  await deleteDoc(doc(db, 'users', me.uid, 'contactInvites', invite.id));
}

// --- Decline invite ---

export async function declineContactInvite(inviteId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await deleteDoc(doc(db, 'users', uid, 'contactInvites', inviteId));
}

// --- Remove contact ---

export async function removeContact(contactId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await deleteDoc(doc(db, 'users', uid, 'contacts', contactId));
}
