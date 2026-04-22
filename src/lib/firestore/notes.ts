import {
  collection,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Timestamp } from 'firebase/firestore';

export type Note = {
  id: string;
  title: string;
  body: string;
  createdBy: string; // internalId
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// Subscribe to personal notes in a workspace (only notes created by this user)
export function subscribeNotes(
  wsId: string,
  myInternalId: string,
  onData: (notes: Note[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, 'workspaces', wsId, 'notes'),
    where('createdBy', '==', myInternalId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Note, 'id'>) })));
    },
    (err) => {
      console.error('subscribeNotes error:', err.message);
      onError?.(err);
    }
  );
}

export async function createNote(
  wsId: string,
  myInternalId: string,
  title: string,
  body: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'workspaces', wsId, 'notes'), {
    title: title.trim(),
    body: body.trim(),
    createdBy: myInternalId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNote(
  wsId: string,
  noteId: string,
  title: string,
  body: string
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', wsId, 'notes', noteId), {
    title: title.trim(),
    body: body.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(wsId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', wsId, 'notes', noteId));
}
