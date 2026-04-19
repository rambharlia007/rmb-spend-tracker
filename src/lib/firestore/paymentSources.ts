import { orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { createInCollection, removeDoc, subscribeCollection, upsertDoc } from './crud';
import type { PaymentSource } from '@/types';

export function subscribePaymentSources(wsId: string, cb: (items: PaymentSource[]) => void) {
  return subscribeCollection<PaymentSource>(
    ['workspaces', wsId, 'paymentSources'],
    cb,
    orderBy('name', 'asc')
  );
}

export async function createPaymentSource(
  wsId: string,
  data: Omit<PaymentSource, 'id' | 'createdAt' | 'active'> & { active?: boolean }
) {
  return createInCollection(['workspaces', wsId, 'paymentSources'], {
    ...data,
    active: data.active ?? true
  });
}

export async function updatePaymentSource(
  wsId: string,
  id: string,
  data: Partial<Omit<PaymentSource, 'id' | 'createdAt'>>
) {
  return upsertDoc(['workspaces', wsId, 'paymentSources', id], {
    ...data,
    updatedAt: serverTimestamp() as unknown as Timestamp
  });
}

export async function deletePaymentSource(wsId: string, id: string) {
  return removeDoc(['workspaces', wsId, 'paymentSources', id]);
}
