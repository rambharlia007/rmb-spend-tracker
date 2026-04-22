import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { subscribeLoansReceived, acceptLoan, disputeLoan, createLoanTaken, addRepayment } from '@/lib/firestore/loans';
import { subscribeContacts } from '@/lib/firestore/contacts';
import { findUserByEmail } from '@/lib/firestore/userLookup';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';
import { formatINR } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownToLine, Check, AlertTriangle, Plus, CreditCard } from 'lucide-react';
import type { SharedLoan, Contact } from '@/types';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS: Record<string, string> = {
  unconfirmed: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  accepted: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  disputed: 'text-red-600 bg-red-100 dark:bg-red-900/30',   // legacy
  closed: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  settled: 'text-green-600 bg-green-100 dark:bg-green-900/30',
};

export default function LoansTaken() {
  const { toast } = useToast();
  const { internalId, user } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<SharedLoan[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);

  // --- New loan taken form ---
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    giverContactId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  // --- Quick repayment ---
  const [repTarget, setRepTarget] = useState<SharedLoan | null>(null);
  const [repSaving, setRepSaving] = useState(false);
  const [repForm, setRepForm] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansReceived(internalId, setLoans);
  }, [internalId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeContacts(internalId, setContacts);
  }, [internalId]);

  async function handleAccept(loanId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setAccepting(loanId);
    try {
      await acceptLoan(loanId);
      toast('Loan accepted', 'success');
    } catch (err: unknown) {
      logError('LoansTaken.acceptLoan', err);
      toast(friendlyError(err), 'error');
    } finally {
      setAccepting(null);
    }
  }

  async function handleDispute(loanId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDisputing(loanId);
    try {
      await disputeLoan(loanId);
      toast('Loan closed as disputed — create a new one if needed', 'success');
    } catch (err: unknown) {
      logError('LoansTaken.disputeLoan', err);
      toast(friendlyError(err), 'error');
    } finally {
      setDisputing(null);
    }
  }

  async function handleSave() {
    const amt = Math.round(parseFloat(form.amount) * 100) / 100;
    if (!form.giverContactId || isNaN(amt) || amt <= 0) {
      toast('Fill all required fields', 'error');
      return;
    }
    const contact = contacts.find((c) => c.id === form.giverContactId);
    if (!contact || !internalId) return;
    setSaving(true);
    try {
      // Resolve lender's internalId if they're on the app
      let giverInternalId = contact.refUserId ?? null;
      if (!giverInternalId) {
        const profile = await findUserByEmail(contact.email);
        giverInternalId = profile?.internalId ?? null;
      }
      await createLoanTaken({
        myInternalId: internalId,
        myEmail: user?.email ?? '',
        myName: user?.displayName ?? '',
        giverInternalId,
        giverEmail: contact.email,
        giverName: contact.displayName,
        amount: amt,
        date: new Date(form.date + 'T00:00:00'),
        notes: form.notes,
      });
      toast('Loan recorded', 'success');
      setOpen(false);
      setForm({ giverContactId: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    } catch (e: unknown) {
      logError('LoansTaken.createLoanTaken', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePay() {
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
      logError('LoansTaken.addRepayment', e);
      toast(friendlyError(e), 'error');
    } finally {
      setRepSaving(false);
    }
  }

  const isTerminal = (l: SharedLoan) => l.status === 'settled' || l.status === 'closed' || l.status === 'disputed';
  const activeLoans = loans?.filter((l) => !isTerminal(l)) ?? [];
  const closedLoans = loans?.filter((l) => isTerminal(l)) ?? [];
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstandingAmount, 0);
  const pendingConfirmation = activeLoans.filter((l) => l.status === 'unconfirmed');

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loans Taken</h1>
          <p className="text-sm text-muted-foreground">Money others lent to you.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record
        </Button>
      </header>

      {/* Pending confirmation banner */}
      {pendingConfirmation.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {pendingConfirmation.length} loan{pendingConfirmation.length > 1 ? 's' : ''} awaiting your confirmation — review below.
        </div>
      )}

      {loans === null ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : loans.length === 0 ? (
        <EmptyState icon={ArrowDownToLine} title="No loans taken" description="Record a loan you took, or when someone records one for you it'll appear here." />
      ) : (
        <>
          {activeLoans.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Outstanding</h2>
                <span className="text-sm font-semibold tabular-nums">{formatINR(totalOutstanding)}</span>
              </div>
              <div className="space-y-2">
                {activeLoans.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border bg-card px-4 py-3 cursor-pointer"
                    onClick={() => navigate(`/loan/${l.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{l.giverName || l.giverEmail}</div>
                      <div className="text-sm font-semibold tabular-nums shrink-0">{formatINR(l.outstandingAmount)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(l.date.toDate(), 'dd MMM yyyy')}{l.notes ? ` · ${l.notes}` : ''}
                    </div>
                    {l.outstandingAmount !== l.amount && (
                      <div className="text-xs text-muted-foreground">of {formatINR(l.amount)}</div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="secondary" className={STATUS_COLORS[l.status]}>
                        {l.status === 'closed' || l.status === 'disputed' ? 'Disputed' : l.status}
                      </Badge>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {l.status === 'accepted' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); setRepTarget(l); setRepForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' }); }}
                          >
                            <CreditCard className="h-3 w-3 mr-1" /> Pay
                          </Button>
                        )}
                        {l.status === 'unconfirmed' && (
                          <>
                            <Button size="sm" onClick={(e) => handleAccept(l.id, e)} disabled={accepting === l.id || disputing === l.id}>
                              <Check className="h-3 w-3 mr-1" /> {accepting === l.id ? 'Accepting…' : 'Accept'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={(e) => handleDispute(l.id, e)} disabled={accepting === l.id || disputing === l.id}>
                              <AlertTriangle className="h-3 w-3 mr-1" /> {disputing === l.id ? 'Closing…' : 'Dispute'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {closedLoans.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">History</h2>
              <div className="space-y-2 opacity-60">
                {closedLoans.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => navigate(`/loan/${l.id}`)}
                    className="rounded-lg border bg-card px-4 py-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{l.giverName || l.giverEmail}</div>
                      <span className="text-sm tabular-nums shrink-0">{formatINR(l.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-muted-foreground">{format(l.date.toDate(), 'dd MMM yyyy')}</div>
                      <Badge variant="secondary" className={STATUS_COLORS[l.status]}>
                        {l.status === 'closed' || l.status === 'disputed' ? 'Disputed' : 'Settled'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Record Loan Taken Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Loan Taken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Lender (who gave you money)</Label>
              <Select value={form.giverContactId} onValueChange={(v) => setForm((f) => ({ ...f, giverContactId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.length === 0
                    ? <SelectItem value="__none__" disabled>No contacts yet — add from Contacts page</SelectItem>
                    : contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.displayName || c.email}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. Borrowed for rent"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick repayment dialog */}
      {repTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) setRepTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 pb-1 text-sm text-muted-foreground">
              Paying back to <span className="font-medium text-foreground">{repTarget.giverName || repTarget.giverEmail}</span>
              {' · '}Outstanding: <span className="font-medium text-foreground">{formatINR(repTarget.outstandingAmount)}</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  placeholder="0.00"
                  value={repForm.amount}
                  onChange={(e) => setRepForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={repForm.date}
                  onChange={(e) => setRepForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="e.g. Paid via UPI"
                  value={repForm.notes}
                  onChange={(e) => setRepForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setRepTarget(null)} disabled={repSaving}>Cancel</Button>
              <Button size="sm" onClick={handlePay} disabled={repSaving}>{repSaving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
