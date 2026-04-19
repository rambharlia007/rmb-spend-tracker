import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Crown, User } from 'lucide-react';

export default function WorkspaceSettings() {
  const { user } = useAuth();
  const { workspace, workspaceId } = useWorkspace();
  const { toast } = useToast();
  const [name, setName] = useState(workspace?.name ?? '');
  const [saving, setSaving] = useState(false);

  const isOwner = workspace?.ownerUid === user?.uid;

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

      {/* Rename */}
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
          {workspace?.members.map((uid) => (
            <div key={uid} className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">{uid}</span>
              {uid === workspace.ownerUid && (
                <Badge variant="secondary" className="text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30">
                  <Crown className="h-3 w-3 mr-1" /> Owner
                </Badge>
              )}
              {uid === user?.uid && uid !== workspace.ownerUid && (
                <Badge variant="secondary">You</Badge>
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
