import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Category, PaymentSource } from '@/types';
import { PRESET_LABELS, type DateRangePreset } from '@/lib/dateRanges';

export type FilterState = {
  preset: DateRangePreset;
  customFrom?: string;
  customTo?: string;
  categoryIds: string[];
  paymentSourceIds: string[];
  search: string;
};

export function FilterBar({
  value,
  onChange,
  categories,
  sources
}: {
  value: FilterState;
  onChange: (v: FilterState) => void;
  categories: Category[];
  sources: PaymentSource[];
}) {
  const [open, setOpen] = useState(false);

  const toggleCat = (id: string) => {
    const ids = value.categoryIds.includes(id)
      ? value.categoryIds.filter((x) => x !== id)
      : [...value.categoryIds, id];
    onChange({ ...value, categoryIds: ids });
  };
  const toggleSrc = (id: string) => {
    const ids = value.paymentSourceIds.includes(id)
      ? value.paymentSourceIds.filter((x) => x !== id)
      : [...value.paymentSourceIds, id];
    onChange({ ...value, paymentSourceIds: ids });
  };

  const activeCount = value.categoryIds.length + value.paymentSourceIds.length + (value.search ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={value.preset} onValueChange={(v) => onChange({ ...value, preset: v as DateRangePreset })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((p) => (
              <SelectItem key={p} value={p}>{PRESET_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value.preset === 'custom' && (
          <>
            <Input type="date" value={value.customFrom ?? ''} onChange={(e) => onChange({ ...value, customFrom: e.target.value })} className="w-auto" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={value.customTo ?? ''} onChange={(e) => onChange({ ...value, customTo: e.target.value })} className="w-auto" />
          </>
        )}

        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          Filters {activeCount > 0 && <Badge variant="secondary" className="ml-1">{activeCount}</Badge>} <ChevronDown className="h-3 w-3" />
        </Button>

        <Input
          placeholder="Search notes…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="max-w-xs"
        />

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...value, categoryIds: [], paymentSourceIds: [], search: '' })}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {open && (
        <div className="border rounded-md p-3 space-y-3 bg-card">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {categories.filter((c) => c.active).map((c) => {
                const sel = value.categoryIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${sel ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}>
                    <span>{c.icon}</span> {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Payment Sources</div>
            <div className="flex flex-wrap gap-1.5">
              {sources.filter((s) => s.active).map((s) => {
                const sel = value.paymentSourceIds.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleSrc(s.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${sel ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}>
                    {s.name}{s.last4 && ` ••${s.last4}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
