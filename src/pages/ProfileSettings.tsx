import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfileSettings() {
  const { user, internalId } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast('Name cannot be empty', 'error'); return; }
    if (!internalId) { toast('User not ready, please wait', 'error'); return; }
    const currentUser = auth.currentUser;
    if (!currentUser) { toast('User not ready, please wait', 'error'); return; }
    setSaving(true);
    try {
      await updateProfile(currentUser, { displayName: name.trim() });
      // Use internalId as doc key — NOT user.uid (which is Google UID)
      await updateDoc(doc(db, 'users', internalId), {
        displayName: name.trim(),
        updatedAt: serverTimestamp(),
      });
      toast('Profile updated', 'success');
    } catch (e: unknown) {
      logError('ProfileSettings.save', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Update your display name.</p>
      </header>

      <div className="space-y-4 rounded-lg border p-4 bg-card">
        <div className="flex items-center gap-3">
          {user?.photoURL && <img src={user.photoURL} alt="" className="h-12 w-12 rounded-full" />}
          <div>
            <div className="font-medium">{user?.displayName}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
        </div>
        <div>
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  );
}
