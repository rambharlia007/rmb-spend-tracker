/**
 * Maps Firebase / generic errors to user-friendly messages.
 * Never exposes raw stack traces or internal error strings to the UI.
 */

const FIREBASE_MAP: Record<string, string> = {
  // Auth
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-email': 'Invalid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password is too weak.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/popup-closed-by-user': 'Sign-in cancelled.',
  'auth/cancelled-popup-request': 'Sign-in cancelled.',
  'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
  // Firestore
  'permission-denied': 'You do not have permission to perform this action.',
  'not-found': 'The requested data was not found.',
  'already-exists': 'This record already exists.',
  'resource-exhausted': 'Too many requests. Please slow down.',
  'unavailable': 'Service temporarily unavailable. Please try again.',
  'deadline-exceeded': 'Request timed out. Please try again.',
  'cancelled': 'Operation was cancelled.',
  'unauthenticated': 'You must be signed in to do this.',
  'invalid-argument': 'Invalid data provided.',
  'failed-precondition': 'Operation cannot be completed in the current state.',
  'aborted': 'Operation was aborted due to a conflict. Please try again.',
  'out-of-range': 'Value is out of the allowed range.',
  'unimplemented': 'This feature is not supported.',
  'internal': 'An internal error occurred. Please try again.',
  'data-loss': 'Data could not be retrieved.',
};

export function friendlyError(e: unknown): string {
  if (e == null) return 'Something went wrong.';

  // Firebase errors have a `code` field
  if (typeof e === 'object' && 'code' in e) {
    const code = (e as { code: string }).code;
    // Try exact match first, then strip prefix (e.g. "firestore/permission-denied" → "permission-denied")
    if (FIREBASE_MAP[code]) return FIREBASE_MAP[code];
    const stripped = code.includes('/') ? code.split('/').slice(1).join('/') : code;
    if (FIREBASE_MAP[stripped]) return FIREBASE_MAP[stripped];
  }

  // Standard Error with a message — but we still don't expose raw internals
  // Only surface it if it looks like a developer-safe message (no stack traces etc.)
  if (e instanceof Error && e.message && e.message.length < 200) {
    // Filter out messages that look like internal Firebase/JS noise
    const msg = e.message;
    if (
      !msg.includes('at Object.') &&
      !msg.includes('firebase') &&
      !msg.includes('firestore') &&
      !msg.includes('undefined') &&
      !msg.toLowerCase().includes('internal')
    ) {
      return msg;
    }
  }

  return 'Something went wrong. Please try again.';
}
