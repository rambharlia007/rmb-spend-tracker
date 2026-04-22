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
import { db } from '@/lib/firebase';
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

  // Firestore supports only one `in` clause per query (max 10 values).
  // Strategy: push the first applicable filter to the server (if ≤10 values),
  // then client-filter everything else. When a filter has >10 values we skip the
  // server clause entirely and do a full client-side filter — this avoids silently
  // falling through to a completely different server filter.
  const catCount = filters.categoryIds?.length ?? 0;
  const srcCount = filters.paymentSourceIds?.length ?? 0;

  const serverFilterType: 'category' | 'source' | 'none' =
    catCount > 0 && catCount <= 10 ? 'category' :
    srcCount > 0 && srcCount <= 10 ? 'source' :
    'none';

  if (serverFilterType === 'category') {
    constraints.push(where('categoryId', 'in', filters.categoryIds!));
  } else if (serverFilterType === 'source') {
    constraints.push(where('paymentSourceId', 'in', filters.paymentSourceIds!));
  }

  const q = query(collection(db, 'workspaces', wsId, 'spends'), ...constraints);
  return onSnapshot(q, (snap) => {
    let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Spend, 'id'>) }));

    // Client-side filter for anything not pushed to the server
    if (serverFilterType !== 'category' && catCount > 0) {
      rows = rows.filter((r) => filters.categoryIds!.includes(r.categoryId));
    }
    if (serverFilterType !== 'source' && srcCount > 0) {
      rows = rows.filter((r) => filters.paymentSourceIds!.includes(r.paymentSourceId));
    }

    cb(rows);
  });
}

export async function createSpend(
  wsId: string,
  myInternalId: string,
  data: { date: Date; amount: number; categoryId: string; paymentSourceId: string; notes: string; tags?: string[] }
) {
  if (!myInternalId) throw new Error('Not signed in');
  return addDoc(collection(db, 'workspaces', wsId, 'spends'), {
    date: Timestamp.fromDate(data.date),
    amount: data.amount,
    categoryId: data.categoryId,
    paymentSourceId: data.paymentSourceId,
    notes: data.notes,
    tags: data.tags ?? [],
    createdBy: myInternalId,
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
