import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff, Eye, Trash2, Tags } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import { subscribeCategories, createCategory, updateCategory, deleteCategory } from '@/lib/firestore/categories';
import type { Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IconPicker, ColorPicker } from '@/components/IconColorPicker';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Form = { id?: string; name: string; icon: string; color: string; active: boolean };
const EMPTY: Form = { name: '', icon: '📦', color: '#64748b', active: true };

export default function Categories() {
  const { workspaceId } = useWorkspace();
  const { toast } = useToast();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const unsub = subscribeCategories(workspaceId, (c) => { setItems(c); setLoading(false); });
    return unsub;
  }, [workspaceId]);

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (c: Category) => { setForm({ id: c.id, name: c.name, icon: c.icon, color: c.color, active: c.active }); setOpen(true); };

  const save = async () => {
    if (!workspaceId || !form.name.trim()) return;
    try {
      if (form.id) {
        await updateCategory(workspaceId, form.id, { name: form.name.trim(), icon: form.icon, color: form.color, active: form.active });
        toast('Category updated', 'success');
      } else {
        await createCategory(workspaceId, { name: form.name.trim(), icon: form.icon, color: form.color });
        toast('Category added', 'success');
      }
      setOpen(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const toggleActive = async (c: Category) => {
    if (!workspaceId) return;
    await updateCategory(workspaceId, c.id, { active: !c.active });
  };

  const remove = async () => {
    if (!workspaceId || !confirmDel) return;
    try {
      await deleteCategory(workspaceId, confirmDel.id);
      toast('Category deleted', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">Organize your spends</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add</Button>
      </header>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Tags} title="No categories" description="Add one to get started" action={<Button onClick={openNew}>Add category</Button>} />
      ) : (
        <div className="grid gap-2">
          {items.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 p-3 border rounded-md ${!c.active && 'opacity-50'}`}>
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: c.color + '30' }}>
                <span>{c.icon}</span>
              </div>
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                {!c.active && <div className="text-xs text-muted-foreground">Inactive</div>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggleActive(c)} title={c.active ? 'Deactivate' : 'Activate'}>
                {c.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirmDel(c)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit category' : 'New category'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Coffee" className="mt-1" /></div>
            <div><Label>Icon</Label><div className="mt-1"><IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} /></div></div>
            <div><Label>Color</Label><div className="mt-1"><ColorPicker value={form.color} onChange={(v) => setForm({ ...form, color: v })} /></div></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)} title="Delete category?" description={`"${confirmDel?.name}" will be removed. Existing spends will still reference it but it won't appear in lists.`} confirmLabel="Delete" destructive onConfirm={remove} />
    </div>
  );
}
