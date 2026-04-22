import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { bootstrapUser } from '@/lib/firestore/bootstrap';
import type { Workspace } from '@/types';

type WorkspaceContextValue = {
  workspaceId: string | null;
  workspace: Workspace | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, setInternalId } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  }, []);

  // Bootstrap effect — re-runs on user change or manual retry
  useEffect(() => {
    if (!user) {
      setWorkspaceId(null);
      setWorkspace(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    bootstrapUser(user)
      .then(({ internalId, workspaceId: wsId }) => {
        if (cancelled) return;
        setInternalId(internalId);
        setWorkspaceId(wsId);
        // Set loading=false now — onSnapshot will update workspace data when it fires.
        // This prevents the 8s timeout being the only escape hatch on fast unmounts.
        setLoading(false);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const msg = e?.message ?? 'Failed to initialize workspace. Check your connection and try again.';
        setError(msg);
        setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, retryCount, setInternalId]);

  // Safety timeout — if onSnapshot hasn't fired 8s after bootstrap, stop spinning
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading && !error) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoading((prev) => {
          if (prev) {
            setError('Loading timed out. Please check your connection.');
            return false;
          }
          return prev;
        });
      }, 8000);
    }
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [loading, error, retryCount]);

  // Workspace snapshot effect
  useEffect(() => {
    if (!workspaceId) return;
    const unsub = onSnapshot(
      doc(db, 'workspaces', workspaceId),
      (snap) => {
        if (snap.exists()) {
          setWorkspace({ id: snap.id, ...(snap.data() as Omit<Workspace, 'id'>) });
        } else {
          // Workspace doc was deleted — clear stale data and surface an error
          setWorkspace(null);
          setError('Workspace not found. Please contact support.');
        }
        setLoading(false);
        setError((prev) => snap.exists() ? null : prev);
      },
      (e) => {
        // Permission errors on snapshot — likely transient token issue, surface it
        setError(e.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [workspaceId]);

  return (
    <WorkspaceContext.Provider value={{ workspaceId, workspace, loading, error, retry }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
