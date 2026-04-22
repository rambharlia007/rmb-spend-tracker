/**
 * Centralised error logger.
 * Writes to flat Firestore collection `appLogs/{autoId}`.
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * Reads internalId from localStorage using the same key pattern as useAuth,
 * so it works outside React context (e.g. in lib functions, ErrorBoundary).
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { friendlyError } from '@/lib/errorMessages';

function getInternalId(): string | null {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return localStorage.getItem(`internalId_${user.uid}`);
  } catch {
    return null;
  }
}

function getRawMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  // Fire-and-forget — wrap everything in try/catch so logging never crashes the app
  void (async () => {
    try {
      const user = auth.currentUser;
      if (!user) return; // not signed in — nothing to log against

      const internalId = getInternalId();

      await addDoc(collection(db, 'appLogs'), {
        internalId: internalId ?? null,
        email: user.email ?? null,
        context,
        message: friendlyError(error),
        rawMessage: getRawMessage(error),
        metadata: metadata ?? null,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Logging itself failed — silently ignore to avoid infinite loops
    }
  })();
}
