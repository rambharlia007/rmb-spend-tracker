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
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Contact } from '@/types';

// --- My contacts ---

export function subscribeContacts(cb: (items: Contact[]) => void) {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  const q = query(collection(db, 'users', uid, 'contacts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, 'id'>) })));
  });
}

// --- My incoming invites ---

export type ContactInvite = {
  id: string;
  senderUid: string;
  senderEmail: string;
  senderName: string;
  senderPhoto: string | null;
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

// --- Send invite ---

export async function sendContactInvite(targetProfile: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');

  // 1. Create contact doc on my side
  const myContactRef = doc(collection(db, 'users', me.uid, 'contacts'));
  await setDoc(myContactRef, {
    email: targetProfile.email,
    displayName: targetProfile.displayName,
    contactUid: targetProfile.uid,
    status: 'invite_sent',
    createdAt: serverTimestamp(),
  });

  // 2. Drop invite into target's subcollection
  const inviteRef = doc(collection(db, 'users', targetProfile.uid, 'contactInvites'));
  await setDoc(inviteRef, {
    senderUid: me.uid,
    senderEmail: me.email ?? '',
    senderName: me.displayName ?? '',
    senderPhoto: me.photoURL ?? null,
    myContactDocId: myContactRef.id, // so receiver can flip status
    createdAt: serverTimestamp(),
  });
}

// --- Accept invite ---

export async function acceptContactInvite(invite: ContactInvite & { myContactDocId?: string }) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');

  // 1. Create contact on my side (connected)
  const myContactRef = doc(collection(db, 'users', me.uid, 'contacts'));
  await setDoc(myContactRef, {
    email: invite.senderEmail,
    displayName: invite.senderName,
    contactUid: invite.senderUid,
    status: 'connected',
    createdAt: serverTimestamp(),
  });

  // 2. Flip sender's contact doc to connected
  if (invite.myContactDocId) {
    await updateDoc(doc(db, 'users', invite.senderUid, 'contacts', invite.myContactDocId), {
      status: 'connected',
    });
  }

  // 3. Delete invite
  await deleteDoc(doc(db, 'users', me.uid, 'contactInvites', invite.id));
}

// --- Decline invite ---

export async function declineContactInvite(inviteId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await deleteDoc(doc(db, 'users', uid, 'contactInvites', inviteId));
}

// --- Add pending contact (user not yet registered) ---

export async function addPendingContact(email: string) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');
  const myContactRef = doc(collection(db, 'users', me.uid, 'contacts'));
  await setDoc(myContactRef, {
    email,
    displayName: email,
    contactUid: null,
    status: 'pending_signup',
    createdAt: serverTimestamp(),
  });
}

// --- Remove contact ---

export async function removeContact(contactId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await deleteDoc(doc(db, 'users', uid, 'contacts', contactId));
}
