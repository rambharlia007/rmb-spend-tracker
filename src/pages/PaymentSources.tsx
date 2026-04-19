import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff, Eye, Trash2, CreditCard } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import { subscribePaymentSources, createPaymentSource, updatePaymentSource, deletePaymentSource } from '@/lib/firestore/paymentSources';
import type { PaymentSource, PaymentSourceType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Form = { id?: string; name: string; type: PaymentSourceType; last4: string; active: boolean };
const EMPTY: Form = { name: '', type: 'bank', last4: '', active: true };

const TYPE_LABELS: Record<PaymentSourceType, string> = {
  bank: 'Bank',
  credit_card: 'Credit Card',
  wallet: 'Wallet',
  cash: 'Cash',
  upi: 'UPI'
};

export default function PaymentSources() {
  const { workspaceId } = useWorkspace();
  const { toast } = useToast();
  const [items, setItems] = useState<PaymentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<PaymentSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const unsub = subscribePaymentSources(workspaceId, (s) => { setItems(s); setLoading(false); });
    return unsub;
  }, [workspaceId]);

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (s: PaymentSource) => {
    setForm({ id: s.id, name: s.name, type: s.type, last4: s.last4 ?? '', active: s.active });
    setOpen(true);
  };

  const save = async () => {
    if (!workspaceId || !form.name.trim()) return;
    try {
      const payload = { name: form.name.trim(), type: form.type, last4: form.last4.trim() || null, active: form.active };
      if (form.id) {
        await updatePaymentSource(workspaceId, form.id, payload);
        toast('Updated', 'success');
      } else {
        await createPaymentSource(workspaceId, payload);
        toast('Added', 'success');
      }
      setOpen(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const toggleActive = async (s: PaymentSource) => {
    if (!workspaceId) return;
    await updatePaymentSource(workspaceId, s.id, { active: !s.active });
  };

  const remove = async () => {
    if (!workspaceId || !confirmDel) return;
    try {
      await deletePaymentSource(workspaceId, confirmDel.id);
      toast('Deleted', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payment Sources</h1>
          <p className="text-sm text-muted-foreground">Banks, cards, wallets, cash</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add</Button>
      </header>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payment sources" action={<Button onClick={openNew}>Add source</Button>} />
      ) : (
        <div className="grid gap-2">
          {items.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 p-3 border rounded-md ${!s.active && 'opacity-50'}`}>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{s.name}{s.last4 && ` •••• ${s.last4}`}</div>
                <div className="text-xs text-muted-foreground">{TYPE_LABELS[s.type]}{!s.active && ' · Inactive'}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggleActive(s)}>{s.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirmDel(s)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit source' : 'New source'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. HDFC Credit Card" className="mt-1" /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PaymentSourceType })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as PaymentSourceType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Last 4 digits (optional)</Label><Input value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="3456" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)} title="Delete source?" description={`"${confirmDel?.name}" will be removed.`} confirmLabel="Delete" destructive onConfirm={remove} />
    </div>
  );
}
