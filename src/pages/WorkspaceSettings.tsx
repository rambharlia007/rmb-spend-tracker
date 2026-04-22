import { useEffect, useState } from 'react';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Crown, User } from 'lucide-react';

async function lookupDisplayName(internalId: string): Promise<string> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('__name__', '==', internalId), limit(1)));
    if (!snap.empty) {
      const d = snap.docs[0].data();
      return d.displayName || d.email || internalId.slice(0, 8) + '…';
    }
  } catch { /* ignore */ }
  return internalId.slice(0, 8) + '…';
}

export default function WorkspaceSettings() {
  const { internalId } = useAuth();
  const { workspace, workspaceId } = useWorkspace();
  const { toast } = useToast();
  const [name, setName] = useState(workspace?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  // isOwner: compare internalId (stable FK) with workspace.ownerInternalId
  const isOwner = !!internalId && workspace?.ownerInternalId === internalId;

  // Look up display names for all members
  useEffect(() => {
    if (!workspace?.members?.length) return;
    Promise.all(
      workspace.members.map(async (id) => {
        const name = await lookupDisplayName(id);
        return [id, name] as [string, string];
      })
    ).then((entries) => setMemberNames(Object.fromEntries(entries)));
  }, [workspace?.members]);

  async function handleRename() {
    if (!name.trim() || !workspaceId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'workspaces', workspaceId), {
        name: name.trim(),
        updatedAt: serverTimestamp(),
      });
      toast('Workspace renamed', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Workspace</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace settings.</p>
      </header>

      {/* Rename — only owner */}
      {isOwner && (
        <div className="rounded-lg border p-4 bg-card space-y-3">
          <h2 className="text-sm font-semibold">Workspace Name</h2>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleRename} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Rename'}</Button>
        </div>
      )}

      {/* Members */}
      <div className="rounded-lg border p-4 bg-card space-y-3">
        <h2 className="text-sm font-semibold">Members</h2>
        <div className="space-y-2">
          {workspace?.members.map((memberId) => (
            <div key={memberId} className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{memberNames[memberId] ?? '…'}</span>
              {memberId === workspace.ownerInternalId && (
                <Badge variant="secondary" className="text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 shrink-0">
                  <Crown className="h-3 w-3 mr-1" /> Owner
                </Badge>
              )}
              {memberId === internalId && memberId !== workspace.ownerInternalId && (
                <Badge variant="secondary" className="shrink-0">You</Badge>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Workspace invite flow coming in a future update.</p>
      </div>

      {/* Info */}
      <div className="rounded-lg border p-4 bg-card space-y-1">
        <h2 className="text-sm font-semibold">Workspace ID</h2>
        <p className="font-mono text-xs text-muted-foreground break-all">{workspaceId}</p>
      </div>
    </div>
  );
}
