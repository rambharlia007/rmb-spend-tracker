import type { Timestamp } from 'firebase/firestore';

export type UserDoc = {
  email: string;
  displayName: string;
  photoURL: string | null;
  currentWorkspaceId: string;
  createdAt: Timestamp;
};

export type Workspace = {
  id: string;
  name: string;
  ownerUid: string;
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
  notes: string;
  tags: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Contact = {
  id: string;
  email: string;
  displayName: string;
  contactUid: string | null;
  status: 'pending_signup' | 'invite_sent' | 'connected';
  createdAt: Timestamp;
};

export type LoanStatus = 'unconfirmed' | 'accepted' | 'disputed' | 'settled';

export type SharedLoan = {
  id: string;
  giverUid: string;
  giverEmail: string;
  receiverUid: string | null;
  receiverEmail: string;
  sourceWorkspaceId: string;
  sourcePaymentSourceId: string;
  amount: number;
  date: Timestamp;
  notes: string;
  status: LoanStatus;
  outstandingAmount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
