import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  subscribeContacts,
  subscribeContactInvites,
  sendContactInvite,
  acceptContactInvite,
  declineContactInvite,
  removeContact,
  type ContactInvite,
} from '@/lib/firestore/contacts';
import { findUserByEmail } from '@/lib/firestore/userLookup';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Contact } from '@/types';
import { Users, UserPlus, Check, X, Trash2 } from 'lucide-react';

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [invites, setInvites] = useState<ContactInvite[] | null>(null);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  useEffect(() => subscribeContacts(setContacts), []);
  useEffect(() => subscribeContactInvites((raw) => setInvites(raw as any)), []);

  async function handleAdd() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed === user?.email?.toLowerCase()) {
      toast('Cannot add yourself', 'error');
      return;
    }
    if (contacts?.some((c) => c.email.toLowerCase() === trimmed)) {
      toast('Contact already exists', 'error');
      return;
    }
    setAdding(true);
    try {
      const profile = await findUserByEmail(trimmed);
      if (!profile) {
        toast('No account found with that email', 'error');
        return;
      }
      await sendContactInvite(profile);
      setEmail('');
      toast(`Invite sent to ${profile.displayName || profile.email}`, 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleAccept(invite: ContactInvite) {
    try {
      await acceptContactInvite(invite as any);
      toast(`Connected with ${invite.senderName || invite.senderEmail}`, 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  async function handleDecline(invite: ContactInvite) {
    try {
      await declineContactInvite(invite.id);
      toast('Invite declined');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await removeContact(deleteTarget.id);
      toast('Contact removed');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  const loading = contacts === null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-sm text-muted-foreground">Add people to share loans with.</p>
      </header>

      {/* Add contact */}
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={adding || !email.trim()}>
          <UserPlus className="h-4 w-4 mr-1" />
          {adding ? 'Sending…' : 'Add'}
        </Button>
      </div>

      {/* Incoming invites */}
      {invites && invites.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 text-amber-600">Pending Invites</h2>
          <div className="divide-y rounded-lg border overflow-hidden">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/20">
                <div>
                  <div className="text-sm font-medium">{inv.senderName || inv.senderEmail}</div>
                  <div className="text-xs text-muted-foreground">{inv.senderEmail}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAccept(inv)}>
                    <Check className="h-3 w-3 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDecline(inv)}>
                    <X className="h-3 w-3 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contacts list */}
      <section>
        <h2 className="text-sm font-semibold mb-2">My Contacts</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState icon={Users} title="No contacts yet" description="Add a friend by email above." />
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-card">
                <div>
                  <div className="text-sm font-medium">{c.displayName || c.email}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Remove contact"
        description={`Remove ${deleteTarget?.displayName || deleteTarget?.email}? This does not affect existing loans.`}
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Contact['status'] }) {
  if (status === 'connected')
    return <Badge variant="secondary" className="text-green-600 bg-green-100 dark:bg-green-900/30">Connected</Badge>;
  if (status === 'invite_sent')
    return <Badge variant="secondary" className="text-amber-600 bg-amber-100 dark:bg-amber-900/30">Invite sent</Badge>;
  return <Badge variant="secondary">Pending signup</Badge>;
}
