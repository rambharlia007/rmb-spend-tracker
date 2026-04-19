import { orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { createInCollection, removeDoc, subscribeCollection, upsertDoc } from './crud';
import type { Category } from '@/types';

export function subscribeCategories(wsId: string, cb: (items: Category[]) => void) {
  return subscribeCollection<Category>(
    ['workspaces', wsId, 'categories'],
    cb,
    orderBy('name', 'asc')
  );
}

export async function createCategory(
  wsId: string,
  data: Omit<Category, 'id' | 'createdAt' | 'active'> & { active?: boolean }
) {
  return createInCollection(['workspaces', wsId, 'categories'], {
    ...data,
    active: data.active ?? true
  });
}

export async function updateCategory(
  wsId: string,
  id: string,
  data: Partial<Omit<Category, 'id' | 'createdAt'>>
) {
  return upsertDoc(['workspaces', wsId, 'categories', id], {
    ...data,
    updatedAt: serverTimestamp() as unknown as Timestamp
  });
}

export async function deleteCategory(wsId: string, id: string) {
  return removeDoc(['workspaces', wsId, 'categories', id]);
}
