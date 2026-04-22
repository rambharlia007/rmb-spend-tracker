import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { subscribeRepayments, addRepayment } from '@/lib/firestore/loans';
import { formatINR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus } from 'lucide-react';
import type { SharedLoan } from '@/types';
import type { Repayment } from '@/lib/firestore/loans';

const STATUS_COLORS: Record<string, string> = {
  unconfirmed: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  accepted: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  disputed: 'text-red-600 bg-red-100 dark:bg-red-900/30',   // legacy — same as closed
  closed: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  settled: 'text-green-600 bg-green-100 dark:bg-green-900/30',
};

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const { internalId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loan, setLoan] = useState<SharedLoan | null | 'loading'>('loading');
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [repOpen, setRepOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [repForm, setRepForm] = useState({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  // Live-updating loan snapshot (not one-shot getDoc)
  useEffect(() => {
    if (!id) return;
    const loanUnsub = onSnapshot(
      doc(db, 'sharedLoans', id),
      (snap) => {
        if (!snap.exists()) { setLoan(null); return; }
        setLoan({ id: snap.id, ...(snap.data() as Omit<SharedLoan, 'id'>) });
      },
      () => setLoan(null)
    );
    const repUnsub = subscribeRepayments(id, setRepayments);
    return () => { loanUnsub(); repUnsub(); };
  }, [id]);

  async function handleAddRepayment() {
    if (!internalId) { toast('User not ready', 'error'); return; }
    const amt = Math.round(parseFloat(repForm.amount) * 100) / 100;
    if (isNaN(amt) || amt <= 0) { toast('Enter a valid amount', 'error'); return; }

    // Guard against overpayment
    if (loan !== 'loading' && loan !== null && amt > loan.outstandingAmount) {
      toast(`Amount exceeds outstanding balance of ${formatINR(loan.outstandingAmount)}`, 'error');
      return;
    }

    setSaving(true);
    try {
      await addRepayment(id!, internalId, {
        amount: amt,
        // Parse as local midnight to avoid UTC off-by-one in IST
        date: new Date(repForm.date + 'T00:00:00'),
        notes: repForm.notes,
      });
      toast('Repayment recorded', 'success');
      setRepOpen(false);
      setRepForm({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loan === 'loading') return <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (!loan) return <div className="p-6 text-destructive">Loan not found.</div>;
  // Wait for internalId before computing role — prevents wrong button shown and null FK writes
  if (!internalId) return <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  const isGiver = loan.giverInternalId === internalId;
  const totalPaid = repayments.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="rounded-lg border p-4 space-y-1 bg-card">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{isGiver ? 'Lent to' : 'Borrowed from'}</div>
          <Badge variant="secondary" className={STATUS_COLORS[loan.status]}>
            {loan.status === 'closed' || loan.status === 'disputed' ? 'Disputed' : loan.status}
          </Badge>
        </div>
        <div className="font-semibold">{isGiver ? (loan.receiverName || loan.receiverEmail) : (loan.giverName || loan.giverEmail)}</div>
        <div className="text-xs text-muted-foreground">{format(loan.date.toDate(), 'dd MMM yyyy')}{loan.notes ? ` · ${loan.notes}` : ''}</div>

        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Original</div>
            <div className="font-semibold tabular-nums">{formatINR(loan.amount)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="font-semibold tabular-nums">{formatINR(totalPaid)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className={`font-semibold tabular-nums ${loan.outstandingAmount > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatINR(loan.outstandingAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Repayments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Repayments</h2>
          {/* Only the receiver (borrower) can add repayments — not on settled or closed/disputed loans */}
          {loan.status !== 'settled' && loan.status !== 'closed' && loan.status !== 'disputed' && !isGiver && (
            <Button size="sm" onClick={() => setRepOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          )}
        </div>
        {repayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No repayments yet.</p>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {repayments.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-card">
                <div>
                  <div className="text-sm">{format(r.date.toDate(), 'dd MMM yyyy')}</div>
                  {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                </div>
                <div className="text-sm font-semibold tabular-nums">{formatINR(r.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add repayment dialog */}
      <Dialog open={repOpen} onOpenChange={setRepOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Repayment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" inputMode="decimal" min={1} value={repForm.amount} onChange={(e) => setRepForm((f) => ({ ...f, amount: e.target.value }))} placeholder="500" />
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={repForm.date} onChange={(e) => setRepForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={repForm.notes} onChange={(e) => setRepForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRepayment} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
