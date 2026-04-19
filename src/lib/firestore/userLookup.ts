import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserDoc } from '@/types';

export type UserProfile = { uid: string } & Pick<UserDoc, 'email' | 'displayName' | 'photoURL'>;

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as UserDoc;
  return { uid: d.id, email: data.email, displayName: data.displayName, photoURL: data.photoURL };
}
