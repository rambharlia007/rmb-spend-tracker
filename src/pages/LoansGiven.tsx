import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { subscribeLoansGiven, createLoan, settleLoan, addRepayment, bulkSettleAmount } from '@/lib/firestore/loans';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';
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
import { HandCoins, Plus, CreditCard } from 'lucide-react';
import type { SharedLoan, Contact, PaymentSource } from '@/types';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS: Record<string, string> = {
  unconfirmed: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  accepted: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  disputed: 'text-red-600 bg-red-100 dark:bg-red-900/30',   // legacy
  closed: 'text-red-600 bg-red-100 dark:bg-red-900/30',
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
  const [settleForm, setSettleForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  // Quick repayment received
  const [repTarget, setRepTarget] = useState<SharedLoan | null>(null);
  const [repSaving, setRepSaving] = useState(false);
  const [repForm, setRepForm] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  // Bulk settle (partial amount across one recipient's active loans)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  // Filter loans by recipient (empty = all)
  const [filterKey, setFilterKey] = useState<string>('');

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
    } catch (e: unknown) {
      logError('LoansGiven.createLoan', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSettle() {
    if (!settleTarget || !internalId) return;
    setSettling(true);
    try {
      await settleLoan(settleTarget.id, internalId, {
        date: new Date(settleForm.date + 'T00:00:00'),
        notes: settleForm.notes,
      });
      toast('Loan marked as settled', 'success');
      setSettleTarget(null);
      setSettleForm({ date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    } catch (e: unknown) {
      logError('LoansGiven.settleLoan', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSettling(false);
    }
  }

  async function handleReceived() {
    if (!repTarget || !internalId) return;
    const amt = Math.round(parseFloat(repForm.amount) * 100) / 100;
    if (isNaN(amt) || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (amt > repTarget.outstandingAmount) {
      toast(`Amount exceeds outstanding balance of ${formatINR(repTarget.outstandingAmount)}`, 'error');
      return;
    }
    setRepSaving(true);
    try {
      await addRepayment(repTarget.id, internalId, {
        amount: amt,
        date: new Date(repForm.date + 'T00:00:00'),
        notes: repForm.notes,
      });
      toast('Payment recorded', 'success');
      setRepTarget(null);
      setRepForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    } catch (e: unknown) {
      logError('LoansGiven.addRepayment', e);
      toast(friendlyError(e), 'error');
    } finally {
      setRepSaving(false);
    }
  }

  const isTerminal = (l: SharedLoan) => l.status === 'settled' || l.status === 'closed' || l.status === 'disputed';
  const loanKey = (l: SharedLoan) => l.receiverInternalId ?? `email:${l.receiverEmail.toLowerCase()}`;

  // Unique recipients across all loans (for the filter dropdown)
  const recipients = useMemo(() => {
    if (!loans) return [];
    const seen = new Map<string, string>();
    for (const l of loans) {
      const k = loanKey(l);
      if (!seen.has(k)) seen.set(k, l.receiverName || l.receiverEmail);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [loans]);

  const filteredLoans = (loans ?? []).filter((l) => !filterKey || loanKey(l) === filterKey);
  const activeLoans = filteredLoans.filter((l) => !isTerminal(l));
  const closedLoans = filteredLoans.filter((l) => isTerminal(l));
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstandingAmount, 0);

  // Bulk-settle is only meaningful against ONE recipient. Enable it when:
  // - user has filtered to a single recipient, OR
  // - all active loans happen to belong to the same recipient
  const activeRecipientKeys = useMemo(
    () => new Set(activeLoans.map(loanKey)),
    [activeLoans]
  );
  const canBulkSettle = activeLoans.length >= 1 && activeRecipientKeys.size === 1;
  const bulkRecipientName = activeLoans[0]?.receiverName || activeLoans[0]?.receiverEmail || '';

  async function handleBulkSettle() {
    if (!internalId) return;
    const amt = Math.round(parseFloat(bulkForm.amount) * 100) / 100;
    if (isNaN(amt) || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (amt > totalOutstanding) {
      toast(`Amount exceeds total outstanding of ${formatINR(totalOutstanding)}`, 'error');
      return;
    }
    setBulkSaving(true);
    try {
      const applied = await bulkSettleAmount(activeLoans, internalId, {
        amount: amt,
        date: new Date(bulkForm.date + 'T00:00:00'),
        notes: bulkForm.notes,
      });
      toast(`Settled ${formatINR(applied)} across ${activeLoans.length} loan${activeLoans.length > 1 ? 's' : ''}`, 'success');
      setBulkOpen(false);
      setBulkForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    } catch (e: unknown) {
      logError('LoansGiven.bulkSettle', e);
      toast(friendlyError(e), 'error');
    } finally {
      setBulkSaving(false);
    }
  }

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
          {recipients.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Filter by</Label>
              <Select value={filterKey || '__all'} onValueChange={(v) => setFilterKey(v === '__all' ? '' : v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All recipients ({recipients.length})</SelectItem>
                  {recipients.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filterKey && (
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setFilterKey('')}>Clear</Button>
              )}
            </div>
          )}
          {filteredLoans.length === 0 && (
            <EmptyState icon={HandCoins} title="No matching loans" description="No loans found for this person." />
          )}
          {activeLoans.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2 gap-2">
                <h2 className="text-sm font-semibold">Outstanding</h2>
                <div className="flex items-center gap-2">
                  {canBulkSettle && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => setBulkOpen(true)}
                      title={`Settle a partial amount across ${activeLoans.length} loan${activeLoans.length > 1 ? 's' : ''} with ${bulkRecipientName}`}
                    >
                      <CreditCard className="h-3 w-3" /> Settle amount
                    </Button>
                  )}
                  <span className="text-sm font-semibold tabular-nums">{formatINR(totalOutstanding)}</span>
                </div>
              </div>
              <LoanList loans={activeLoans} onSelect={(id) => navigate(`/loan/${id}`)} onSettle={(l) => { setSettleTarget(l); setSettleForm({ date: format(new Date(), 'yyyy-MM-dd'), notes: '' }); }} onReceived={(l) => { setRepTarget(l); setRepForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' }); }} />
            </section>
          )}
          {closedLoans.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">History</h2>
              <LoanList loans={closedLoans} onSelect={(id) => navigate(`/loan/${id}`)} dim />
            </section>
          )}
        </>
      )}

      {/* Settle loan dialog */}
      {settleTarget && (
        <Dialog open onOpenChange={(o) => { if (!o && !settling) setSettleTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Settle loan</DialogTitle></DialogHeader>
            <div className="space-y-1 pb-1 text-sm text-muted-foreground">
              Mark loan to <span className="font-medium text-foreground">{settleTarget.receiverName || settleTarget.receiverEmail}</span> as fully settled.
              {' '}Outstanding: <span className="font-medium text-foreground">{formatINR(settleTarget.outstandingAmount)}</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Settled on *</Label>
                <Input type="date" value={settleForm.date} onChange={(e) => setSettleForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Input placeholder="e.g. Cash handed over" value={settleForm.notes} onChange={(e) => setSettleForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setSettleTarget(null)} disabled={settling}>Cancel</Button>
              <Button size="sm" onClick={handleSettle} disabled={settling}>{settling ? 'Settling…' : 'Settle'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk settle (partial amount across recipient's active loans) */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!o && !bulkSaving) setBulkOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Settle amount</DialogTitle></DialogHeader>
          <div className="space-y-1 pb-1 text-sm text-muted-foreground">
            Apply a payment from <span className="font-medium text-foreground">{bulkRecipientName}</span> across {activeLoans.length} active loan{activeLoans.length > 1 ? 's' : ''}.
            {' '}Total outstanding: <span className="font-medium text-foreground">{formatINR(totalOutstanding)}</span>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={1}
                placeholder="0.00"
                value={bulkForm.amount}
                onChange={(e) => setBulkForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Applied oldest-loan first. Loans fully covered are marked settled.</p>
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" value={bulkForm.date} onChange={(e) => setBulkForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input placeholder="e.g. UPI lump sum" value={bulkForm.notes} onChange={(e) => setBulkForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Cancel</Button>
            <Button size="sm" onClick={handleBulkSettle} disabled={bulkSaving}>{bulkSaving ? 'Settling…' : 'Settle'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repayment received dialog */}
      {repTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) setRepTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Record Payment Received</DialogTitle></DialogHeader>
            <div className="space-y-1 pb-1 text-sm text-muted-foreground">
              From <span className="font-medium text-foreground">{repTarget.receiverName || repTarget.receiverEmail}</span>
              {' · '}Outstanding: <span className="font-medium text-foreground">{formatINR(repTarget.outstandingAmount)}</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Amount (₹)</Label>
                <Input type="number" inputMode="decimal" min={1} placeholder="0.00" value={repForm.amount} onChange={(e) => setRepForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={repForm.date} onChange={(e) => setRepForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Input placeholder="e.g. Received via UPI" value={repForm.notes} onChange={(e) => setRepForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setRepTarget(null)} disabled={repSaving}>Cancel</Button>
              <Button size="sm" onClick={handleReceived} disabled={repSaving}>{repSaving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function LoanList({ loans, onSelect, onSettle, onReceived, dim }: {
  loans: SharedLoan[];
  onSelect: (id: string) => void;
  onSettle?: (l: SharedLoan) => void;
  onReceived?: (l: SharedLoan) => void;
  dim?: boolean;
}) {
  return (
    <div className="space-y-2">
      {loans.map((l) => (
        <div
          key={l.id}
          className={`rounded-lg border bg-card px-4 py-3 ${dim ? 'opacity-60' : ''}`}
        >
          {/* Top row: name + amount */}
          <button onClick={() => onSelect(l.id)} className="w-full text-left">
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
          {/* Bottom row: badge + actions */}
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary" className={STATUS_COLORS[l.status]}>
              {l.status === 'closed' || l.status === 'disputed' ? 'Disputed' : l.status}
            </Badge>
            <div className="flex items-center gap-2">
              {onReceived && l.status === 'accepted' && (
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => onReceived(l)}>
                  <CreditCard className="h-3 w-3" /> Received
                </Button>
              )}
              {onSettle && l.status === 'accepted' && (
                <button onClick={() => onSettle(l)} className="text-xs font-medium text-primary underline underline-offset-2">
                  Mark settled
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
