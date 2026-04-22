import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  subscribeContacts,
  subscribeContactInvites,
  addContact,
  acceptContactInvite,
  declineContactInvite,
  removeContact,
  type ContactInvite,
} from '@/lib/firestore/contacts';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Contact } from '@/types';
import { Users, UserPlus, Check, X, Trash2 } from 'lucide-react';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';

export default function Contacts() {
  const { user, internalId } = useAuth();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [invites, setInvites] = useState<ContactInvite[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  useEffect(() => {
    if (!internalId) return;
    return subscribeContacts(internalId, setContacts);
  }, [internalId]);

  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!internalId) return;
    setInviteError(null);
    return subscribeContactInvites(internalId, (raw) => setInvites(raw), (err) => {
      console.error('subscribeContactInvites error:', err.message);
      setInviteError(err.message);
    });
  }, [internalId]);

  async function handleAdd() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedEmail) return;
    if (trimmedEmail === user?.email?.toLowerCase()) {
      toast('Cannot add yourself', 'error');
      return;
    }
    if (contacts?.some((c) => c.email.toLowerCase() === trimmedEmail)) {
      toast('Contact already added', 'error');
      return;
    }
    if (!internalId) {
      toast('Still loading, please try again', 'error');
      return;
    }
    setAdding(true);
    try {
      const result = await addContact(trimmedEmail, trimmedName, internalId);
      setEmail('');
      setName('');
      if (result === 'invited') {
        toast(`Invite sent to ${trimmedName || trimmedEmail}`, 'success');
      } else {
        toast('Contact saved. They\'ll connect when they sign up.', 'success');
      }
    } catch (e: unknown) {
      logError('Contacts.addContact', e);
      toast(friendlyError(e), 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleAccept(invite: ContactInvite) {
    if (!internalId) return;
    try {
      await acceptContactInvite(invite, internalId);
      toast(`Connected with ${invite.senderName || invite.senderEmail}`, 'success');
    } catch (e: unknown) {
      logError('Contacts.acceptInvite', e);
      toast(friendlyError(e), 'error');
    }
  }

  async function handleDecline(invite: ContactInvite) {
    if (!internalId) return;
    try {
      await declineContactInvite(invite.id, internalId);
      toast('Invite declined');
    } catch (e: unknown) {
      logError('Contacts.declineInvite', e);
      toast(friendlyError(e), 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !internalId) return;
    try {
      await removeContact(deleteTarget.id, internalId);
      toast('Contact removed');
    } catch (e: unknown) {
      logError('Contacts.removeContact', e);
      toast(friendlyError(e), 'error');
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
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Input
            type="email"
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
        </div>
        <Button onClick={handleAdd} disabled={adding || !email.trim()} className="w-full sm:w-auto">
          <UserPlus className="h-4 w-4 mr-1" />
          {adding ? 'Saving…' : 'Add Contact'}
        </Button>
      </div>

      {/* Incoming invites error */}
      {inviteError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load invites: {inviteError}
        </div>
      )}

      {/* Incoming invites */}
      {invites && invites.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 text-amber-600">Pending Invites</h2>
          <div className="divide-y rounded-lg border overflow-hidden">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/20">
                <div>
                  <div className="text-sm font-medium">{inv.senderName || inv.senderEmail}</div>
                  <div className="text-xs text-muted-foreground">{inv.senderEmail}</div>
                </div>
                <div className="flex gap-2 self-end sm:self-auto shrink-0">
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
