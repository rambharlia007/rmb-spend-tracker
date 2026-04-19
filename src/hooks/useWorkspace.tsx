import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setWorkspaceId(null);
      setWorkspace(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    bootstrapUser(user)
      .then((wsId) => {
        if (!cancelled) setWorkspaceId(wsId);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message ?? 'Failed to initialize workspace');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!workspaceId) return;
    const unsub = onSnapshot(
      doc(db, 'workspaces', workspaceId),
      (snap) => {
        if (snap.exists()) {
          setWorkspace({ id: snap.id, ...(snap.data() as Omit<Workspace, 'id'>) });
        }
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [workspaceId]);

  return (
    <WorkspaceContext.Provider value={{ workspaceId, workspace, loading, error }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
