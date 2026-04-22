import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type QueryConstraint
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function subscribeCollection<T>(
  path: string[],
  cb: (items: T[]) => void,
  ...constraints: QueryConstraint[]
): () => void {
  const ref = query(collection(db, path[0], ...path.slice(1)), ...constraints);
  return onSnapshot(
    ref,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[]);
    },
    (err) => {
      console.error(`subscribeCollection error [${path.join('/')}]:`, err.message);
    }
  );
}

export async function createInCollection(path: string[], data: Record<string, unknown>) {
  return addDoc(collection(db, path[0], ...path.slice(1)), {
    ...data,
    // Don't overwrite a caller-provided createdAt (e.g. during migration)
    createdAt: data.createdAt ?? serverTimestamp(),
  });
}

export async function upsertDoc(path: string[], data: Record<string, unknown>, merge = true) {
  return setDoc(doc(db, path[0], ...path.slice(1)), data, { merge });
}

export async function removeDoc(path: string[]) {
  return deleteDoc(doc(db, path[0], ...path.slice(1)));
}
