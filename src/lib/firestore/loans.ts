import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { SharedLoan, LoanStatus } from '@/types';

export type Repayment = {
  id: string;
  amount: number;
  date: Timestamp;
  notes: string;
  paidByInternalId: string;
  confirmedByGiver: boolean;
  createdAt: Timestamp;
};

// --- Subscribe loans given (I am giver, matched by internalId) ---
export function subscribeLoansGiven(myInternalId: string, cb: (items: SharedLoan[]) => void) {
  const q = query(
    collection(db, 'sharedLoans'),
    where('giverInternalId', '==', myInternalId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SharedLoan, 'id'>) })));
  });
}

// --- Subscribe loans received (I am receiver, matched by internalId) ---
export function subscribeLoansReceived(myInternalId: string, cb: (items: SharedLoan[]) => void) {
  const q = query(
    collection(db, 'sharedLoans'),
    where('receiverInternalId', '==', myInternalId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SharedLoan, 'id'>) })));
  });
}

// --- Subscribe repayments for a loan ---
export function subscribeRepayments(loanId: string, cb: (items: Repayment[]) => void) {
  const q = query(
    collection(db, 'sharedLoans', loanId, 'repayments'),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Repayment, 'id'>) })));
  });
}

// --- Create loan ---
export async function createLoan(data: {
  giverInternalId: string;
  giverEmail: string;
  giverName: string;
  receiverInternalId: string | null;
  receiverEmail: string;
  receiverName: string;
  sourceWorkspaceId: string;
  sourcePaymentSourceId: string;
  amount: number;
  date: Date;
  notes: string;
}) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');
  const ref = doc(collection(db, 'sharedLoans'));
  await setDoc(ref, {
    giverInternalId: data.giverInternalId,
    giverEmail: data.giverEmail,
    giverName: data.giverName,
    receiverInternalId: data.receiverInternalId,
    receiverEmail: data.receiverEmail,
    receiverName: data.receiverName,
    sourceWorkspaceId: data.sourceWorkspaceId,
    sourcePaymentSourceId: data.sourcePaymentSourceId,
    amount: data.amount,
    date: Timestamp.fromDate(data.date),
    notes: data.notes,
    status: 'unconfirmed' as LoanStatus,
    outstandingAmount: data.amount,
    createdBy: data.giverInternalId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// --- Receiver accepts loan ---
export async function acceptLoan(loanId: string) {
  await updateDoc(doc(db, 'sharedLoans', loanId), {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
}

// --- Receiver disputes loan ---
export async function disputeLoan(loanId: string) {
  await updateDoc(doc(db, 'sharedLoans', loanId), {
    status: 'disputed',
    updatedAt: serverTimestamp(),
  });
}

// --- Settle loan (giver marks as fully settled) ---
export async function settleLoan(loanId: string) {
  await updateDoc(doc(db, 'sharedLoans', loanId), {
    status: 'settled',
    outstandingAmount: 0,
    updatedAt: serverTimestamp(),
  });
}

// --- Add repayment (transaction: decrement outstanding, settle if 0) ---
export async function addRepayment(
  loanId: string,
  myInternalId: string,
  data: { amount: number; date: Date; notes: string }
) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');

  const loanRef = doc(db, 'sharedLoans', loanId);
  const repRef = doc(collection(db, 'sharedLoans', loanId, 'repayments'));

  await runTransaction(db, async (tx) => {
    const loanSnap = await tx.get(loanRef);
    if (!loanSnap.exists()) throw new Error('Loan not found');
    const loan = loanSnap.data() as Omit<SharedLoan, 'id'>;
    const newOutstanding = Math.max(0, loan.outstandingAmount - data.amount);

    tx.set(repRef, {
      amount: data.amount,
      date: Timestamp.fromDate(data.date),
      notes: data.notes,
      paidByInternalId: myInternalId,
      confirmedByGiver: false,
      createdAt: serverTimestamp(),
    });

    tx.update(loanRef, {
      outstandingAmount: newOutstanding,
      status: newOutstanding === 0 ? 'settled' : loan.status,
      updatedAt: serverTimestamp(),
    });
  });
}
