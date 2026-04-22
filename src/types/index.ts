import type { Timestamp } from 'firebase/firestore';

export type UserDoc = {
  // internalId = Firestore doc id (stable FK used everywhere)
  internalId: string;
  // googleUid = Firebase Auth UID (null until user registers)
  googleUid: string | null;
  email: string;
  displayName: string;
  photoURL: string | null;
  isRegistered: boolean;
  // null until user registers and workspace is created
  currentWorkspaceId: string | null;
  createdAt: Timestamp;
};

export type Workspace = {
  id: string;
  name: string;
  // ownerInternalId stores the internalId (stable FK) of the owner — NOT a Firebase Auth UID
  ownerInternalId: string;
  members: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

export type PaymentSourceType = 'bank' | 'credit_card' | 'wallet' | 'cash' | 'upi';

export type PaymentSource = {
  id: string;
  name: string;
  type: PaymentSourceType;
  last4: string | null;
  active: boolean;
  createdAt: Timestamp;
};

export type Spend = {
  id: string;
  date: Timestamp;
  amount: number;
  categoryId: string;
  paymentSourceId: string;
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Contact = {
  id: string;
  email: string;
  displayName: string;
  // internalId of the contact in /users collection (stable FK)
  refUserId: string | null;
  status: 'pending_signup' | 'invite_sent' | 'connected';
  createdAt: Timestamp;
};

export type LoanStatus = 'unconfirmed' | 'accepted' | 'disputed' | 'settled';

export type SharedLoan = {
  id: string;
  // internalIds (stable FKs from /users collection)
  giverInternalId: string;
  giverEmail: string;
  giverName: string;
  receiverInternalId: string | null;
  receiverEmail: string;
  receiverName: string;
  sourceWorkspaceId: string;
  sourcePaymentSourceId: string;
  amount: number;
  date: Timestamp;
  notes?: string;
  status: LoanStatus;
  outstandingAmount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
