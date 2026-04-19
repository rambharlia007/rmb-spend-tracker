import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  query,
  orderBy,
  where,
  type QueryConstraint,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Spend } from '@/types';

export type SpendFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  categoryIds?: string[];
  paymentSourceIds?: string[];
};

export function subscribeSpends(wsId: string, filters: SpendFilters, cb: (items: Spend[]) => void) {
  const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
  if (filters.dateFrom) constraints.push(where('date', '>=', Timestamp.fromDate(filters.dateFrom)));
  if (filters.dateTo) constraints.push(where('date', '<=', Timestamp.fromDate(filters.dateTo)));

  // Firestore supports only one `in` per query; we'll client-filter remaining fields
  const inCategoriesFirst = (filters.categoryIds?.length ?? 0) > 0;
  if (inCategoriesFirst && filters.categoryIds!.length <= 10) {
    constraints.push(where('categoryId', 'in', filters.categoryIds!));
  } else if ((filters.paymentSourceIds?.length ?? 0) > 0 && filters.paymentSourceIds!.length <= 10) {
    constraints.push(where('paymentSourceId', 'in', filters.paymentSourceIds!));
  }

  const q = query(collection(db, 'workspaces', wsId, 'spends'), ...constraints);
  return onSnapshot(q, (snap) => {
    let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Spend, 'id'>) }));
    // Client-side filter for the condition we couldn't push to server
    if (inCategoriesFirst && (filters.paymentSourceIds?.length ?? 0) > 0) {
      rows = rows.filter((r) => filters.paymentSourceIds!.includes(r.paymentSourceId));
    } else if (!inCategoriesFirst && (filters.categoryIds?.length ?? 0) > 0) {
      rows = rows.filter((r) => filters.categoryIds!.includes(r.categoryId));
    }
    cb(rows);
  });
}

export async function createSpend(
  wsId: string,
  data: { date: Date; amount: number; categoryId: string; paymentSourceId: string; notes: string; tags?: string[] }
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return addDoc(collection(db, 'workspaces', wsId, 'spends'), {
    date: Timestamp.fromDate(data.date),
    amount: data.amount,
    categoryId: data.categoryId,
    paymentSourceId: data.paymentSourceId,
    notes: data.notes,
    tags: data.tags ?? [],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateSpend(
  wsId: string,
  id: string,
  data: Partial<{ date: Date; amount: number; categoryId: string; paymentSourceId: string; notes: string; tags: string[] }>
) {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.date) payload.date = Timestamp.fromDate(data.date);
  return updateDoc(doc(db, 'workspaces', wsId, 'spends', id), payload);
}

export async function deleteSpend(wsId: string, id: string) {
  return deleteDoc(doc(db, 'workspaces', wsId, 'spends', id));
}
