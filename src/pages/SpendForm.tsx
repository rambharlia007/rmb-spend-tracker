import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { createSpend, updateSpend } from '@/lib/firestore/spends';
import type { Category, PaymentSource, Spend } from '@/types';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';

export function SpendForm({
  open,
  onOpenChange,
  editing,
  categories,
  sources
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Spend | null;
  categories: Category[];
  sources: PaymentSource[];
}) {
  const { workspaceId } = useWorkspace();
  const { internalId } = useAuth();
  const { toast } = useToast();
  const activeCats = categories.filter((c) => c.active);
  const activeSrcs = sources.filter((s) => s.active);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [categoryId, setCategoryId] = useState('');
  const [paymentSourceId, setPaymentSourceId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAmount(String(editing.amount));
      setDate(format(editing.date.toDate(), 'yyyy-MM-dd'));
      setCategoryId(editing.categoryId);
      setPaymentSourceId(editing.paymentSourceId);
      setNotes(editing.notes);
    } else {
      setAmount('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setCategoryId(activeCats[0]?.id ?? '');
      setPaymentSourceId(activeSrcs[0]?.id ?? '');
      setNotes('');
    }
  }, [open, editing]);

  const save = async () => {
    if (!workspaceId || !internalId) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (!categoryId) { toast('Select a category', 'error'); return; }
    if (!paymentSourceId) { toast('Select a payment source', 'error'); return; }

    setSaving(true);
    try {
      const payload = {
        // Parse date as local midnight, not UTC — avoids wrong-day bug in IST
        date: new Date(date + 'T00:00:00'),
        amount: amt,
        categoryId,
        paymentSourceId,
        notes: notes.trim()
      };
      if (editing) {
        await updateSpend(workspaceId, editing.id, payload);
        toast('Spend updated', 'success');
      } else {
        await createSpend(workspaceId, internalId, payload);
        toast('Spend added', 'success');
      }
      onOpenChange(false);
    } catch (e: unknown) {
      logError('SpendForm.save', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Edit spend' : 'New spend'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="0" className="mt-1 text-lg" />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {activeCats.map((c) => (<SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Paid from</Label>
            <Select value={paymentSourceId} onValueChange={setPaymentSourceId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {activeSrcs.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}{s.last4 && ` ••${s.last4}`}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
