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
import {
  subscribeLoansGiven,
  subscribeLoansReceived,
  netSettleLoans,
} from '@/lib/firestore/loans';
import { generateLoanStatementPDF } from '@/lib/export/exporter';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Contact, SharedLoan } from '@/types';
import { Users, UserPlus, Check, X, Trash2, ArrowRightLeft, FileDown } from 'lucide-react';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';
import { formatINR } from '@/lib/utils';
import { format } from 'date-fns';

// Active loan statuses (not terminal)
const ACTIVE = new Set(['unconfirmed', 'accepted']);

type NetBalance = {
  theyOweMe: number;   // sum of my active loans given to them
  IOweТhem: number;    // sum of active loans they gave me
  net: number;         // theyOweMe - IOweТhem (positive = they owe me)
  givenLoans: SharedLoan[];
  takenLoans: SharedLoan[];
  canSettle: boolean;  // true only when both sides > 0 (netting is possible)
};

export default function Contacts() {
  const { user, internalId } = useAuth();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [invites, setInvites] = useState<ContactInvite[] | null>(null);
  const [loansGiven, setLoansGiven] = useState<SharedLoan[]>([]);
  const [loansReceived, setLoansReceived] = useState<SharedLoan[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Settlement dialog state
  const [settleTarget, setSettleTarget] = useState<{ contact: Contact; balance: NetBalance } | null>(null);
  const [settling, setSettling] = useState(false);

  // Statement dialog state
  const [statementTarget, setStatementTarget] = useState<Contact | null>(null);
  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!internalId) return;
    return subscribeContacts(internalId, setContacts);
  }, [internalId]);

  useEffect(() => {
    if (!internalId) return;
    setInviteError(null);
    return subscribeContactInvites(internalId, (raw) => setInvites(raw), (err) => {
      console.error('subscribeContactInvites error:', err.message);
      setInviteError(err.message);
    });
  }, [internalId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansGiven(internalId, setLoansGiven);
  }, [internalId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansReceived(internalId, setLoansReceived);
  }, [internalId]);

  // Compute net balance per contact (keyed by refUserId)
  function getNetBalance(contact: Contact): NetBalance | null {
    if (!contact.refUserId) return null;
    const given = loansGiven.filter(
      (l) => l.receiverInternalId === contact.refUserId && ACTIVE.has(l.status)
    );
    const taken = loansReceived.filter(
      (l) => l.giverInternalId === contact.refUserId && ACTIVE.has(l.status)
    );
    if (given.length === 0 && taken.length === 0) return null;
    const theyOweMe = given.reduce((s, l) => s + l.outstandingAmount, 0);
    const IOweТhem  = taken.reduce((s, l) => s + l.outstandingAmount, 0);
    return {
      theyOweMe,
      IOweТhem,
      net: theyOweMe - IOweТhem,
      givenLoans: given,
      takenLoans: taken,
      canSettle: theyOweMe > 0 && IOweТhem > 0,
    };
  }

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

  async function handleSettle() {
    if (!settleTarget) return;
    setSettling(true);
    try {
      await netSettleLoans(settleTarget.balance.givenLoans, settleTarget.balance.takenLoans);
      toast(`Settled with ${settleTarget.contact.displayName || settleTarget.contact.email}`, 'success');
      setSettleTarget(null);
    } catch (e: unknown) {
      logError('Contacts.netSettle', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSettling(false);
    }
  }

  function handleDownloadStatement() {
    if (!statementTarget || !user) return;
    const refId = statementTarget.refUserId;
    const given = refId ? loansGiven.filter((l) => l.receiverInternalId === refId) : [];
    const taken = refId ? loansReceived.filter((l) => l.giverInternalId === refId) : [];
    generateLoanStatementPDF({
      myName: user.displayName || user.email || 'Me',
      contactName: statementTarget.displayName || statementTarget.email,
      contactEmail: statementTarget.email,
      givenLoans: given,
      takenLoans: taken,
      fromDate: stmtFrom ? new Date(stmtFrom + 'T00:00:00') : null,
      toDate: stmtTo ? new Date(stmtTo + 'T23:59:59') : null,
    });
    setStatementTarget(null);
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
            {contacts.map((c) => {
              const bal = getNetBalance(c);
              return (
                <div key={c.id} className="px-4 py-3 bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.displayName || c.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={c.status} />
                      {bal?.canSettle && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1"
                          onClick={() => setSettleTarget({ contact: c, balance: bal })}
                        >
                          <ArrowRightLeft className="h-3 w-3" /> Settle
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Download statement"
                        onClick={() => setStatementTarget(c)}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {/* Net balance row */}
                  {bal && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {bal.theyOweMe > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          They owe you {formatINR(bal.theyOweMe)}
                        </span>
                      )}
                      {bal.IOweТhem > 0 && (
                        <span className="text-xs text-red-500 font-medium">
                          You owe them {formatINR(bal.IOweТhem)}
                        </span>
                      )}
                      {bal.net !== 0 && bal.canSettle && (
                        <span className="text-xs text-muted-foreground">
                          · Net: {bal.net > 0 ? `they owe you ${formatINR(bal.net)}` : `you owe them ${formatINR(Math.abs(bal.net))}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Remove contact"
        description={`Remove ${deleteTarget?.displayName || deleteTarget?.email}? This does not affect existing loans.`}
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />

      {/* Loan statement dialog */}
      {statementTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) setStatementTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Statement — {statementTarget.displayName || statementTarget.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <p className="text-muted-foreground">Download a bank-statement style PDF of all loans with this contact. Leave dates blank to include all history.</p>
              <div className="space-y-1">
                <Label>From date (optional)</Label>
                <Input type="date" value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To date (optional)</Label>
                <Input type="date" value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setStatementTarget(null)}>Cancel</Button>
              <Button size="sm" onClick={handleDownloadStatement}>
                <FileDown className="h-3.5 w-3.5 mr-1" /> Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Net settlement dialog */}
      {settleTarget && (
        <Dialog open onOpenChange={(o) => { if (!o && !settling) setSettleTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Settle with {settleTarget.contact.displayName || settleTarget.contact.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You lent them</span>
                  <span className="font-semibold text-green-600">{formatINR(settleTarget.balance.theyOweMe)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">They lent you</span>
                  <span className="font-semibold text-red-500">{formatINR(settleTarget.balance.IOweТhem)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Net outstanding</span>
                  <span className={settleTarget.balance.net >= 0 ? 'text-green-600' : 'text-red-500'}>
                    {settleTarget.balance.net >= 0
                      ? `They owe you ${formatINR(settleTarget.balance.net)}`
                      : `You owe them ${formatINR(Math.abs(settleTarget.balance.net))}`}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-muted-foreground text-xs">
                <p>
                  <strong className="text-foreground">
                    {settleTarget.balance.theyOweMe <= settleTarget.balance.IOweТhem
                      ? `${settleTarget.balance.givenLoans.length} loan${settleTarget.balance.givenLoans.length > 1 ? 's' : ''} you gave`
                      : `${settleTarget.balance.takenLoans.length} loan${settleTarget.balance.takenLoans.length > 1 ? 's' : ''} they gave`
                    }
                  </strong>
                  {' '}will be marked fully settled.
                </p>
                <p>
                  <strong className="text-foreground">
                    {settleTarget.balance.theyOweMe <= settleTarget.balance.IOweТhem
                      ? `${settleTarget.balance.takenLoans.length} loan${settleTarget.balance.takenLoans.length > 1 ? 's' : ''} they gave`
                      : `${settleTarget.balance.givenLoans.length} loan${settleTarget.balance.givenLoans.length > 1 ? 's' : ''} you gave`
                    }
                  </strong>
                  {' '}will be reduced by {
                    formatINR(Math.min(settleTarget.balance.theyOweMe, settleTarget.balance.IOweТhem))
                  }.
                  {settleTarget.balance.net !== 0 && (
                    <> {formatINR(Math.abs(settleTarget.balance.net))} remains outstanding.</>
                  )}
                </p>
                <p className="pt-1">Settlement notes will be added to each loan automatically.</p>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setSettleTarget(null)} disabled={settling}>Cancel</Button>
              <Button size="sm" onClick={handleSettle} disabled={settling}>
                {settling ? 'Settling…' : 'Confirm Settle'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
