import {
  collection,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InvestmentType, Investment } from '@/types';

// ─── Investment Types ────────────────────────────────────────────────────────

export function subscribeInvestmentTypes(
  wsId: string,
  onData: (types: InvestmentType[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, 'workspaces', wsId, 'investmentTypes'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvestmentType, 'id'>) })));
    },
    (err) => {
      console.error('subscribeInvestmentTypes error:', err.message);
      onError?.(err);
    }
  );
}

export async function createInvestmentType(
  wsId: string,
  data: { name: string; icon: string }
): Promise<string> {
  const ref = await addDoc(collection(db, 'workspaces', wsId, 'investmentTypes'), {
    name: data.name.trim(),
    icon: data.icon,
    active: true,
    isDefault: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInvestmentType(
  wsId: string,
  typeId: string,
  data: Partial<{ name: string; icon: string; active: boolean }>
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', wsId, 'investmentTypes', typeId), data);
}

export async function deleteInvestmentType(wsId: string, typeId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', wsId, 'investmentTypes', typeId));
}

/** Seed default investment types — idempotent (only runs if none exist) */
export async function seedInvestmentTypes(wsId: string): Promise<void> {
  const existing = await getDocs(
    query(collection(db, 'workspaces', wsId, 'investmentTypes'), limit(1))
  );
  if (!existing.empty) return;

  const defaults = [
    { name: 'Gold', icon: '🥇' },
    { name: 'Silver', icon: '🥈' },
    { name: 'Mutual Fund', icon: '📈' },
    { name: 'Index Fund', icon: '📊' },
    { name: 'Stocks', icon: '📉' },
    { name: 'Real Estate', icon: '🏠' },
    { name: 'Crypto', icon: '🪙' },
    { name: 'FD', icon: '🏦' },
    { name: 'Other', icon: '💼' },
  ];

  const promises = defaults.map((d) =>
    addDoc(collection(db, 'workspaces', wsId, 'investmentTypes'), {
      name: d.name,
      icon: d.icon,
      active: true,
      isDefault: true,
      createdAt: serverTimestamp(),
    })
  );
  await Promise.all(promises);
}

// ─── Investments ─────────────────────────────────────────────────────────────

export function subscribeInvestments(
  wsId: string,
  onData: (investments: Investment[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, 'workspaces', wsId, 'investments'),
    orderBy('date', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Investment, 'id'>) })));
    },
    (err) => {
      console.error('subscribeInvestments error:', err.message);
      onError?.(err);
    }
  );
}

export async function createInvestment(
  wsId: string,
  myInternalId: string,
  data: {
    name: string;
    typeId: string;
    amount: number;
    date: Date;
    notes?: string;
    linkedInternalId?: string | null;
  }
): Promise<string> {
  const ref = await addDoc(collection(db, 'workspaces', wsId, 'investments'), {
    name: data.name.trim(),
    typeId: data.typeId,
    amount: data.amount,
    date: data.date,
    notes: data.notes?.trim() ?? '',
    linkedInternalId: data.linkedInternalId ?? null,
    createdBy: myInternalId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateInvestment(
  wsId: string,
  investmentId: string,
  data: {
    name: string;
    typeId: string;
    amount: number;
    date: Date;
    notes?: string;
    linkedInternalId?: string | null;
  }
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', wsId, 'investments', investmentId), {
    name: data.name.trim(),
    typeId: data.typeId,
    amount: data.amount,
    date: data.date,
    notes: data.notes?.trim() ?? '',
    linkedInternalId: data.linkedInternalId ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvestment(wsId: string, investmentId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', wsId, 'investments', investmentId));
}
