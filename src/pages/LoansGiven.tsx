import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { subscribeLoansGiven, createLoan, settleLoan } from '@/lib/firestore/loans';
import { subscribeContacts } from '@/lib/firestore/contacts';
import { findUserByEmail } from '@/lib/firestore/userLookup';
import { subscribePaymentSources } from '@/lib/firestore/paymentSources';
import { formatINR } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HandCoins, Plus } from 'lucide-react';
import type { SharedLoan, Contact, PaymentSource } from '@/types';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const STATUS_COLORS: Record<string, string> = {
  unconfirmed: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  accepted: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  disputed: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  settled: 'text-green-600 bg-green-100 dark:bg-green-900/30',
};

export default function LoansGiven() {
  const { workspace } = useWorkspace();
  const { internalId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loans, setLoans] = useState<SharedLoan[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settleTarget, setSettleTarget] = useState<SharedLoan | null>(null);
  const [settling, setSettling] = useState(false);

  const [form, setForm] = useState({
    receiverContactId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    sourceId: '',
  });

  const wsId = workspace?.id;

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansGiven(internalId, setLoans);
  }, [internalId]);

  useEffect(() => { if (!wsId) return; return subscribePaymentSources(wsId, setSources); }, [wsId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeContacts(internalId, setContacts);
  }, [internalId]);

  // Show all contacts (connected or pending) in loan form — we record the loan regardless
  const selectableContacts = contacts;

  async function handleSave() {
    const amt = Math.round(parseFloat(form.amount) * 100) / 100;
    if (!form.receiverContactId || isNaN(amt) || amt <= 0 || !form.sourceId || !wsId) {
      toast('Fill all required fields', 'error');
      return;
    }
    const contact = contacts.find((c) => c.id === form.receiverContactId);
    if (!contact || !internalId) return;
    setSaving(true);
    try {
      // refUserId may be missing on old contact docs — look up by email
      let receiverInternalId = contact.refUserId ?? null;
      if (!receiverInternalId) {
        const profile = await findUserByEmail(contact.email);
        receiverInternalId = profile?.internalId ?? null;
      }
      await createLoan({
        giverInternalId: internalId,
        giverEmail: user?.email ?? '',
        giverName: user?.displayName ?? '',
        receiverInternalId,
        receiverEmail: contact.email,
        receiverName: contact.displayName,
        sourceWorkspaceId: wsId,
        sourcePaymentSourceId: form.sourceId,
        amount: amt,
        date: new Date(form.date + 'T00:00:00'),
        notes: form.notes,
      });
      toast('Loan recorded', 'success');
      setOpen(false);
      setForm({ receiverContactId: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', sourceId: '' });
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSettle() {
    if (!settleTarget) return;
    setSettling(true);
    try {
      await settleLoan(settleTarget.id);
      toast('Loan marked as settled', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSettling(false);
      setSettleTarget(null);
    }
  }

  const activeLoans = loans?.filter((l) => l.status !== 'settled') ?? [];
  const settledLoans = loans?.filter((l) => l.status === 'settled') ?? [];
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstandingAmount, 0);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loans Given</h1>
          <p className="text-sm text-muted-foreground">Money you lent to others.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Loan
        </Button>
      </header>

      {loans === null ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : loans.length === 0 ? (
        <EmptyState icon={HandCoins} title="No loans given" description="Record money you lent using the button above." />
      ) : (
        <>
          {activeLoans.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Outstanding</h2>
                <span className="text-sm font-semibold tabular-nums">{formatINR(totalOutstanding)}</span>
              </div>
              <LoanList loans={activeLoans} onSelect={(id) => navigate(`/loan/${id}`)} onSettle={(l) => setSettleTarget(l)} />
            </section>
          )}
          {settledLoans.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Settled</h2>
              <LoanList loans={settledLoans} onSelect={(id) => navigate(`/loan/${id}`)} dim />
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!settleTarget}
        onOpenChange={(o) => { if (!o) setSettleTarget(null); }}
        title="Settle loan"
        description={`Mark this loan to ${settleTarget?.receiverName || settleTarget?.receiverEmail} as fully settled?`}
        confirmLabel={settling ? 'Settling…' : 'Settle'}
        onConfirm={handleSettle}
      />

      {/* New loan dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Loan Given</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>To *</Label>
              <Select value={form.receiverContactId} onValueChange={(v) => setForm((f) => ({ ...f, receiverContactId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  {selectableContacts.length === 0 && <SelectItem value="__none" disabled>No contacts yet — add from Contacts page</SelectItem>}
                  {selectableContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName || c.email}
                      {c.status !== 'connected' ? ' (pending)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" min={1} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="1000" />
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Payment source *</Label>
              <Select value={form.sourceId} onValueChange={(v) => setForm((f) => ({ ...f, sourceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {sources.filter((s) => s.active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoanList({ loans, onSelect, onSettle, dim }: { loans: SharedLoan[]; onSelect: (id: string) => void; onSettle?: (l: SharedLoan) => void; dim?: boolean }) {
  return (
    <div className="space-y-2">
      {loans.map((l) => (
        <div
          key={l.id}
          className={`rounded-lg border bg-card px-4 py-3 ${dim ? 'opacity-60' : ''}`}
        >
          {/* Top row: name + amount */}
          <button
            onClick={() => onSelect(l.id)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm truncate">{l.receiverName || l.receiverEmail}</div>
              <div className="text-sm font-semibold tabular-nums shrink-0">{formatINR(l.outstandingAmount)}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(l.date.toDate(), 'dd MMM yyyy')}{l.notes ? ` · ${l.notes}` : ''}
            </div>
            {l.outstandingAmount !== l.amount && (
              <div className="text-xs text-muted-foreground">of {formatINR(l.amount)}</div>
            )}
          </button>
          {/* Bottom row: badge + settle */}
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary" className={STATUS_COLORS[l.status]}>{l.status}</Badge>
            {onSettle && (
              <button
                onClick={() => onSettle(l)}
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                Mark settled
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
