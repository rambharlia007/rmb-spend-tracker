import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Bug } from 'lucide-react';

const ADMIN_EMAIL = 'rambharlia007@gmail.com';

type AppLog = {
  id: string;
  internalId: string | null;
  email: string | null;
  context: string;
  message: string;
  rawMessage: string;
  metadata: Record<string, unknown> | null;
  createdAt: Timestamp | null;
};

export default function AdminLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AppLog[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Hard redirect for non-admin
  if (user && user.email !== ADMIN_EMAIL) {
    return <Navigate to="/dashboard" replace />;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const q = query(
      collection(db, 'appLogs'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    return onSnapshot(q, (snap) => {
      setLogs(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppLog, 'id'>) }))
      );
    }, (err) => {
      console.error('AdminLogs snapshot error:', err.message);
    });
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-center gap-2">
        <Bug className="h-5 w-5 text-destructive" />
        <div>
          <h1 className="text-2xl font-bold">Error Logs</h1>
          <p className="text-sm text-muted-foreground">Last 100 errors across all users.</p>
        </div>
      </header>

      {logs === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No errors logged yet.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden divide-y text-sm">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[160px_180px_160px_1fr] gap-3 px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Timestamp</div>
            <div>User</div>
            <div>Context</div>
            <div>Message</div>
          </div>

          {logs.map((log) => {
            const isOpen = expanded.has(log.id);
            const hasExtra = log.rawMessage !== log.message || log.metadata;
            const ts = log.createdAt
              ? format(log.createdAt.toDate(), 'dd MMM yy HH:mm:ss')
              : '—';

            return (
              <div key={log.id} className="bg-card">
                {/* Main row */}
                <button
                  className="w-full text-left px-4 py-3 hover:bg-accent/30 transition-colors"
                  onClick={() => hasExtra && toggleExpand(log.id)}
                >
                  <div className="sm:grid sm:grid-cols-[160px_180px_160px_1fr] sm:gap-3 space-y-1 sm:space-y-0 sm:items-start">
                    <div className="text-xs text-muted-foreground tabular-nums">{ts}</div>
                    <div className="text-xs truncate" title={log.email ?? ''}>
                      {log.email ?? <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="font-mono text-xs text-amber-600 dark:text-amber-400 truncate">
                      {log.context}
                    </div>
                    <div className="text-xs flex items-center gap-1">
                      <span className="flex-1 text-destructive">{log.message}</span>
                      {hasExtra && (
                        <span className="text-muted-foreground shrink-0">
                          {isOpen ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className="px-4 pb-3 space-y-2 border-t bg-muted/30">
                    {log.rawMessage && log.rawMessage !== log.message && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Raw error</div>
                        <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {log.rawMessage}
                        </pre>
                      </div>
                    )}
                    {log.metadata && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Metadata</div>
                        <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      internalId: <span className="font-mono">{log.internalId ?? '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
