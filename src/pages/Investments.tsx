import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, TrendingUp, Settings2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  subscribeInvestments,
  subscribeInvestmentTypes,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '@/lib/firestore/investments';
import { subscribeContacts } from '@/lib/firestore/contacts';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';
import { formatINR } from '@/lib/utils';
import type { Investment, InvestmentType, Contact } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';

type InvForm = {
  name: string;
  typeId: string;
  amount: string;
  date: string;
  notes: string;
  linkedInternalId: string;
};

const EMPTY_FORM: InvForm = {
  name: '',
  typeId: '',
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
  linkedInternalId: '',
};

export default function Investments() {
  const { workspace } = useWorkspace();
  const { internalId } = useAuth();
  const { toast } = useToast();

  const [investments, setInvestments] = useState<Investment[] | null>(null);
  const [types, setTypes] = useState<InvestmentType[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [form, setForm] = useState<InvForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const wsId = workspace?.id;

  useEffect(() => {
    if (!wsId) return;
    const u1 = subscribeInvestments(
      wsId,
      setInvestments,
      (err) => { logError('Investments.subscribe', err); toast(friendlyError(err), 'error'); }
    );
    const u2 = subscribeInvestmentTypes(wsId, setTypes);
    return () => { u1(); u2(); };
  }, [wsId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeContacts(internalId, setContacts);
  }, [internalId]);

  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.refUserId ?? '', c])), [contacts]);
  const activeTypes = useMemo(() => types.filter((t) => t.active), [types]);

  // Group investments by type for summary
  const summary = useMemo(() => {
    if (!investments) return [];
    const byType = new Map<string, { type: InvestmentType | undefined; total: number }>();
    for (const inv of investments) {
      const entry = byType.get(inv.typeId) ?? { type: typeMap.get(inv.typeId), total: 0 };
      entry.total += inv.amount;
      byType.set(inv.typeId, entry);
    }
    return Array.from(byType.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([typeId, { type, total }]) => ({ typeId, type, total }));
  }, [investments, typeMap]);

  const grandTotal = useMemo(
    () => investments?.reduce((s, i) => s + i.amount, 0) ?? 0,
    [investments]
  );

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(inv: Investment) {
    setEditing(inv);
    setForm({
      name: inv.name,
      typeId: inv.typeId,
      amount: String(inv.amount),
      date: format(inv.date instanceof Timestamp ? inv.date.toDate() : new Date(inv.date), 'yyyy-MM-dd'),
      notes: inv.notes ?? '',
      linkedInternalId: inv.linkedInternalId ?? '',
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!wsId || !internalId) return;
    const amt = Math.round(parseFloat(form.amount) * 100) / 100;
    if (!form.name.trim() || !form.typeId || isNaN(amt) || amt <= 0 || !form.date) {
      toast('Fill all required fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        typeId: form.typeId,
        amount: amt,
        date: new Date(form.date + 'T00:00:00'),
        notes: form.notes,
        linkedInternalId: form.linkedInternalId || null,
      };
      if (editing) {
        await updateInvestment(wsId, editing.id, payload);
        toast('Investment updated', 'success');
      } else {
        await createInvestment(wsId, internalId, payload);
        toast('Investment added', 'success');
      }
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (e: unknown) {
      logError('Investments.save', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!wsId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInvestment(wsId, deleteTarget.id);
      toast('Investment deleted');
    } catch (e: unknown) {
      logError('Investments.delete', e);
      toast(friendlyError(e), 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function getLinkedName(linkedInternalId?: string | null): string | null {
    if (!linkedInternalId) return null;
    // Check if it's the current user
    if (linkedInternalId === internalId) return 'You';
    const contact = contactMap.get(linkedInternalId);
    return contact?.displayName || contact?.email || linkedInternalId.slice(0, 8) + '…';
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investments</h1>
          <p className="text-sm text-muted-foreground">Track your investment portfolio.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/investment-types"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Settings2 className="h-4 w-4" /> Types
          </Link>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </header>

      {investments === null ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : investments.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No investments yet"
          description="Start recording your investments using the Add button."
          action={<Button onClick={openNew}>Add investment</Button>}
        />
      ) : (
        <>
          {/* Summary card */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Portfolio Summary</h2>
              <span className="text-lg font-bold tabular-nums">{formatINR(grandTotal)}</span>
            </div>
            <div className="space-y-2">
              {summary.map(({ typeId, type, total }) => {
                const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                return (
                  <div key={typeId} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
                      {type?.icon ?? '💼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate font-medium">{type?.name ?? 'Unknown'}</span>
                        <span className="tabular-nums font-semibold ml-2 shrink-0">{formatINR(total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-9 text-right tabular-nums shrink-0">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Investments list */}
          <section>
            <h2 className="text-sm font-semibold mb-2">All Investments</h2>
            <div className="divide-y rounded-lg border overflow-hidden bg-card">
              {investments.map((inv) => {
                const type = typeMap.get(inv.typeId);
                const linkedName = getLinkedName(inv.linkedInternalId);
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
                      {type?.icon ?? '💼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{inv.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {type?.name ?? '—'}
                        {' · '}
                        {format(inv.date instanceof Timestamp ? inv.date.toDate() : new Date(inv.date), 'dd MMM yyyy')}
                        {linkedName && ` · ${linkedName}`}
                        {inv.notes && ` · ${inv.notes}`}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0">{formatINR(inv.amount)}</div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(inv)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(inv)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Investment' : 'New Investment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. SBI Gold Bond 2024"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={form.typeId} onValueChange={(v) => setForm((f) => ({ ...f, typeId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {activeTypes.length === 0 && (
                    <SelectItem value="__none" disabled>No types — add from Types page</SelectItem>
                  )}
                  {activeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={1}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="50000"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Linked person (optional)</Label>
              <Select value={form.linkedInternalId || '__none'} onValueChange={(v) => setForm((f) => ({ ...f, linkedInternalId: v === '__none' ? '' : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {contacts.length === 0 && (
                    <SelectItem value="__no_contacts" disabled>No contacts yet — add from Contacts page</SelectItem>
                  )}
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.refUserId ?? c.id}>
                      {c.displayName || c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                rows={2}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Delete investment"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
