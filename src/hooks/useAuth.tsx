import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

type AuthContextValue = {
  user: User | null;
  internalId: string | null;   // stable FK — use this everywhere instead of user.uid
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setInternalId: (id: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const lsKey = (uid: string) => `internalId_${uid}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [internalId, setInternalIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setInternalIdState(null);
      } else {
        // Restore cached internalId immediately so consumers don't wait for bootstrap
        const cached = localStorage.getItem(lsKey(u.uid));
        if (cached) setInternalIdState(cached);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const setInternalId = (id: string) => {
    setInternalIdState(id);
    if (user) localStorage.setItem(lsKey(user.uid), id);
  };

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    if (user) localStorage.removeItem(lsKey(user.uid));
    setInternalIdState(null);
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, internalId, loading, signIn, signOut, setInternalId: setInternalId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
