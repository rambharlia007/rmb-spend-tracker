import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Receipt, FileDown } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import { subscribeSpends, deleteSpend } from '@/lib/firestore/spends';
import { subscribeCategories } from '@/lib/firestore/categories';
import { subscribePaymentSources } from '@/lib/firestore/paymentSources';
import type { Category, PaymentSource, Spend } from '@/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FilterBar, type FilterState } from '@/components/FilterBar';
import { formatINR } from '@/lib/utils';
import { getDateRange } from '@/lib/dateRanges';
import { SpendForm } from '@/pages/SpendForm';
import { exportSpendsCSV, exportSpendsPDF } from '@/lib/export/exporter';

export default function Spends() {
  const { workspaceId, workspace } = useWorkspace();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [items, setItems] = useState<Spend[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    preset: 'thisMonth',
    categoryIds: [],
    paymentSourceIds: [],
    search: ''
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Spend | null>(null);
  const [confirmDel, setConfirmDel] = useState<Spend | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const u1 = subscribeCategories(workspaceId, setCategories);
    const u2 = subscribePaymentSources(workspaceId, setSources);
    return () => { u1(); u2(); };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const range = filters.preset === 'custom'
      ? { from: filters.customFrom ? new Date(filters.customFrom) : undefined, to: filters.customTo ? new Date(filters.customTo + 'T23:59:59') : undefined }
      : getDateRange(filters.preset);
    setLoading(true);
    const unsub = subscribeSpends(workspaceId, {
      dateFrom: range.from,
      dateTo: range.to,
      categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
      paymentSourceIds: filters.paymentSourceIds.length ? filters.paymentSourceIds : undefined
    }, (s) => { setItems(s); setLoading(false); });
    return unsub;
  }, [workspaceId, filters.preset, filters.customFrom, filters.customTo, filters.categoryIds, filters.paymentSourceIds]);

  const filtered = useMemo(() => {
    if (!filters.search.trim()) return items;
    const q = filters.search.toLowerCase();
    return items.filter((s) => s.notes.toLowerCase().includes(q));
  }, [items, filters.search]);

  const total = useMemo(() => filtered.reduce((a, b) => a + b.amount, 0), [filtered]);

  const byMonth = useMemo(() => {
    const groups = new Map<string, Spend[]>();
    for (const s of filtered) {
      const key = format(s.date.toDate(), 'MMM yyyy');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const srcMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const remove = async () => {
    if (!workspaceId || !confirmDel) return;
    try { await deleteSpend(workspaceId, confirmDel.id); toast('Deleted', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Spends</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} entries · {formatINR(total)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSpendsCSV(filtered, catMap, srcMap)} disabled={filtered.length === 0}>
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportSpendsPDF(filtered, catMap, srcMap, workspace?.name ?? '', filters)} disabled={filtered.length === 0}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </header>

      <div className="mb-4">
        <FilterBar value={filters} onChange={setFilters} categories={categories} sources={sources} />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No spends" description="Add your first spend to start tracking" />
      ) : (
        <div className="space-y-6">
          {byMonth.map(([month, rows]) => {
            const monthTotal = rows.reduce((a, b) => a + b.amount, 0);
            return (
              <div key={month}>
                <div className="flex items-center justify-between px-1 pb-2 border-b mb-2">
                  <div className="font-semibold text-sm">{month}</div>
                  <div className="text-sm text-muted-foreground">{formatINR(monthTotal)}</div>
                </div>
                <div className="space-y-1">
                  {rows.map((s) => {
                    const cat = catMap.get(s.categoryId);
                    const src = srcMap.get(s.paymentSourceId);
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-3 border rounded-md hover:bg-accent/30">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: (cat?.color ?? '#64748b') + '30' }}>
                          <span>{cat?.icon ?? '📦'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            <span>{cat?.name ?? '—'}</span>
                            <span className="text-xs text-muted-foreground font-normal">· {src?.name ?? '—'}{src?.last4 && ` ••${src.last4}`}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {format(s.date.toDate(), 'dd MMM yyyy')}{s.notes && ` · ${s.notes}`}
                          </div>
                        </div>
                        <div className="font-semibold tabular-nums">{formatINR(s.amount)}</div>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDel(s)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SpendForm open={formOpen} onOpenChange={setFormOpen} editing={editing} categories={categories} sources={sources} />
      <ConfirmDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)} title="Delete spend?" confirmLabel="Delete" destructive onConfirm={remove} />
    </div>
  );
}
