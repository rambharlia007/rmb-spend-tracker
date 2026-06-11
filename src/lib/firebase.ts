import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// PWA recovery: when the page returns to foreground after the OS share sheet
// (or any background pause), Firestore long-poll listeners can be left in a
// stalled state — listeners stop receiving snapshots even though the page is
// visible. Cycling the network on `pageshow` / `visibilitychange→visible`
// forces the SDK to drop and re-establish all active subscriptions, which
// fixes the "app won't load any data" symptom users see after downloading.
//
// Throttled (5s) so rapid focus toggles don't thrash the connection.
if (typeof window !== 'undefined') {
  let lastKickAt = 0;
  const KICK_THROTTLE_MS = 5000;
  const kick = () => {
    const now = performance.now();
    if (now - lastKickAt < KICK_THROTTLE_MS) return;
    lastKickAt = now;
    // disable → enable is the documented way to flush stuck listeners.
    // Best-effort: swallow errors so a transient failure doesn't crash boot.
    disableNetwork(db)
      .then(() => enableNetwork(db))
      .catch((err) => console.warn('[firestore] reconnect kick failed:', err));
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick();
  });
  // pageshow with persisted=true fires when restored from bfcache; the regular
  // case (fresh load) is harmless since the SDK has nothing to flush yet.
  window.addEventListener('pageshow', () => kick());
}
