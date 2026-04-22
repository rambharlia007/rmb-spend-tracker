import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff, Eye, Trash2, TrendingUp } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import {
  subscribeInvestmentTypes,
  createInvestmentType,
  updateInvestmentType,
  deleteInvestmentType,
} from '@/lib/firestore/investments';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';
import type { InvestmentType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconPicker } from '@/components/IconColorPicker';

type Form = { id?: string; name: string; icon: string; isDefault: boolean };
const EMPTY: Form = { name: '', icon: '💼', isDefault: false };

export default function InvestmentTypes() {
  const { workspaceId } = useWorkspace();
  const { toast } = useToast();
  const [items, setItems] = useState<InvestmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<InvestmentType | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    return subscribeInvestmentTypes(
      workspaceId,
      (types) => { setItems(types); setLoading(false); },
      (err) => { logError('InvestmentTypes.subscribe', err); toast(friendlyError(err), 'error'); }
    );
  }, [workspaceId]);

  function openNew() { setForm(EMPTY); setOpen(true); }
  function openEdit(t: InvestmentType) {
    setForm({ id: t.id, name: t.name, icon: t.icon, isDefault: t.isDefault });
    setOpen(true);
  }

  async function handleSave() {
    if (!workspaceId || !form.name.trim()) return;
    setSaving(true);
    try {
      if (form.id) {
        await updateInvestmentType(workspaceId, form.id, { name: form.name.trim(), icon: form.icon });
        toast('Investment type updated', 'success');
      } else {
        await createInvestmentType(workspaceId, { name: form.name.trim(), icon: form.icon });
        toast('Investment type added', 'success');
      }
      setOpen(false);
    } catch (e: unknown) {
      logError('InvestmentTypes.save', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: InvestmentType) {
    if (!workspaceId) return;
    try {
      await updateInvestmentType(workspaceId, t.id, { active: !t.active });
    } catch (e: unknown) {
      logError('InvestmentTypes.toggleActive', e);
      toast(friendlyError(e), 'error');
    }
  }

  async function handleDelete() {
    if (!workspaceId || !confirmDel) return;
    try {
      await deleteInvestmentType(workspaceId, confirmDel.id);
      toast('Investment type deleted', 'success');
    } catch (e: unknown) {
      logError('InvestmentTypes.delete', e);
      toast(friendlyError(e), 'error');
    } finally {
      setConfirmDel(null);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Investment Types</h1>
          <p className="text-sm text-muted-foreground">Manage your investment categories</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </header>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No investment types" description="Add one to get started" action={<Button onClick={openNew}>Add type</Button>} />
      ) : (
        <div className="grid gap-2">
          {items.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 p-3 border rounded-md ${!t.active && 'opacity-50'}`}>
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
                {t.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium">{t.name}</div>
                {!t.active && <div className="text-xs text-muted-foreground">Inactive</div>}
                {t.isDefault && <div className="text-xs text-muted-foreground">Default</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggleActive(t)} title={t.active ? 'Deactivate' : 'Activate'}>
                {t.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                <Pencil className="h-4 w-4" />
              </Button>
              {!t.isDefault && (
                <Button variant="ghost" size="icon" onClick={() => setConfirmDel(t)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit type' : 'New investment type'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bonds" className="mt-1" />
            </div>
            <div>
              <Label>Icon</Label>
              <div className="mt-1"><IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => { if (!o) setConfirmDel(null); }}
        title="Delete investment type?"
        description={`"${confirmDel?.name}" will be removed. Existing investments referencing it will still exist.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
