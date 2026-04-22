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
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { format } from 'date-fns';
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
  }, (err) => console.error('subscribeLoansGiven error:', err.message));
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
  }, (err) => console.error('subscribeLoansReceived error:', err.message));
}

// --- Subscribe repayments for a loan ---
export function subscribeRepayments(loanId: string, cb: (items: Repayment[]) => void) {
  const q = query(
    collection(db, 'sharedLoans', loanId, 'repayments'),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Repayment, 'id'>) })));
  }, (err) => console.error('subscribeRepayments error:', err.message));
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
    receiverInternalId: data.receiverInternalId ?? null,
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

// --- Receiver disputes loan — permanently closes it, no further action possible ---
export async function disputeLoan(loanId: string) {
  await updateDoc(doc(db, 'sharedLoans', loanId), {
    status: 'closed',
    outstandingAmount: 0,
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

    // Only auto-settle if the loan was explicitly accepted by the receiver.
    // Disputed or unconfirmed loans must be resolved manually — never auto-settle them.
    const shouldSettle = newOutstanding === 0 && loan.status === 'accepted';
    tx.update(loanRef, {
      outstandingAmount: newOutstanding,
      status: shouldSettle ? 'settled' : loan.status,
      updatedAt: serverTimestamp(),
    });
  });
}

// --- Self-record a loan taken (I borrowed from someone, auto-accepted) ---
// Used when the lender is not on the app or hasn't recorded it themselves.
// Status is immediately 'accepted' since the borrower is self-reporting.
export async function createLoanTaken(data: {
  myInternalId: string;
  myEmail: string;
  myName: string;
  giverInternalId: string | null;
  giverEmail: string;
  giverName: string;
  amount: number;
  date: Date;
  notes: string;
}) {
  const me = auth.currentUser;
  if (!me) throw new Error('Not signed in');
  const ref = doc(collection(db, 'sharedLoans'));
  await setDoc(ref, {
    giverInternalId: data.giverInternalId ?? null,
    giverEmail: data.giverEmail,
    giverName: data.giverName,
    receiverInternalId: data.myInternalId,
    receiverEmail: data.myEmail,
    receiverName: data.myName,
    sourceWorkspaceId: null,
    sourcePaymentSourceId: null,
    amount: data.amount,
    date: Timestamp.fromDate(data.date),
    notes: data.notes,
    status: 'accepted' as LoanStatus,   // self-reported — no confirmation needed
    outstandingAmount: data.amount,
    createdBy: data.myInternalId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// --- Net settlement between two parties ---
// Given loans I gave to person X, and loans X gave me:
// - Marks all loans on the smaller side as settled
// - Reduces outstanding on the larger side (smallest loans first) by the netting amount
// - Adds repayment sub-docs on each reduced loan documenting the offset
export async function netSettleLoans(
  givenLoans: SharedLoan[],  // loans I gave to person X (active only)
  takenLoans: SharedLoan[],  // loans X gave me (active only)
) {
  if (!auth.currentUser) throw new Error('Not signed in');

  const dateStr = format(new Date(), 'dd MMM yyyy');
  const settlementNote = `Net settled on ${dateStr}`;
  const partialNote = (amt: number) => `Partially net settled on ${dateStr} (₹${amt.toLocaleString('en-IN')} offset)`;

  const givenTotal = givenLoans.reduce((s, l) => s + l.outstandingAmount, 0);
  const takenTotal = takenLoans.reduce((s, l) => s + l.outstandingAmount, 0);

  // Determine which side is smaller (gets fully settled) and which is larger (gets reduced)
  const smallerSide = givenTotal <= takenTotal ? givenLoans : takenLoans;
  const largerSide  = givenTotal <= takenTotal ? takenLoans : givenLoans;
  const offsetAmount = Math.min(givenTotal, takenTotal); // amount to net off from larger side

  const batch = writeBatch(db);

  // 1. Mark all smaller-side loans as settled
  for (const loan of smallerSide) {
    batch.update(doc(db, 'sharedLoans', loan.id), {
      status: 'settled' as LoanStatus,
      outstandingAmount: 0,
      notes: loan.notes ? `${loan.notes} · ${settlementNote}` : settlementNote,
      updatedAt: serverTimestamp(),
    });
    // Add repayment sub-doc to document the net settlement
    const repRef = doc(collection(db, 'sharedLoans', loan.id, 'repayments'));
    batch.set(repRef, {
      amount: loan.outstandingAmount,
      date: Timestamp.fromDate(new Date()),
      notes: settlementNote,
      paidByInternalId: auth.currentUser!.uid,
      confirmedByGiver: true,
      createdAt: serverTimestamp(),
    });
  }

  // 2. Reduce larger-side loans (smallest first) by offsetAmount
  // Sort smallest outstanding first
  const sortedLarger = [...largerSide].sort((a, b) => a.outstandingAmount - b.outstandingAmount);
  let remaining = offsetAmount;

  for (const loan of sortedLarger) {
    if (remaining <= 0) break;
    const reduce = Math.min(loan.outstandingAmount, remaining);
    const newOutstanding = Math.round((loan.outstandingAmount - reduce) * 100) / 100;
    remaining = Math.round((remaining - reduce) * 100) / 100;

    const isFullySettled = newOutstanding === 0;
    batch.update(doc(db, 'sharedLoans', loan.id), {
      outstandingAmount: newOutstanding,
      status: isFullySettled ? ('settled' as LoanStatus) : loan.status,
      notes: loan.notes
        ? `${loan.notes} · ${isFullySettled ? settlementNote : partialNote(reduce)}`
        : (isFullySettled ? settlementNote : partialNote(reduce)),
      updatedAt: serverTimestamp(),
    });
    // Add repayment sub-doc for the reduced amount
    const repRef = doc(collection(db, 'sharedLoans', loan.id, 'repayments'));
    batch.set(repRef, {
      amount: reduce,
      date: Timestamp.fromDate(new Date()),
      notes: isFullySettled ? settlementNote : partialNote(reduce),
      paidByInternalId: auth.currentUser!.uid,
      confirmedByGiver: true,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}
