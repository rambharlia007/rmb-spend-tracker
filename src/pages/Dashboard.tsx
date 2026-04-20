import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { formatINR } from '@/lib/utils';
import { subscribeSpends } from '@/lib/firestore/spends';
import { subscribeCategories } from '@/lib/firestore/categories';
import { subscribeLoansGiven, subscribeLoansReceived } from '@/lib/firestore/loans';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Spend, Category, SharedLoan } from '@/types';

function getThisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { from, to };
}


export default function Dashboard() {
  const { workspace } = useWorkspace();
  const { internalId } = useAuth();

  const [monthSpends, setMonthSpends] = useState<Spend[] | null>(null);
  const [recentSpends, setRecentSpends] = useState<Spend[] | null>(null);
  const [catMap, setCatMap] = useState<Map<string, Category>>(new Map());
  const [loansGiven, setLoansGiven] = useState<SharedLoan[]>([]);
  const [loansReceived, setLoansReceived] = useState<SharedLoan[]>([]);

  const wsId = workspace?.id;

  useEffect(() => {
    if (!wsId) return;
    return subscribeCategories(wsId, (cats) => {
      setCatMap(new Map(cats.map((c) => [c.id, c])));
    });
  }, [wsId]);

  useEffect(() => {
    if (!wsId) return;
    const { from, to } = getThisMonthRange();
    return subscribeSpends(wsId, { dateFrom: from, dateTo: to }, setMonthSpends);
  }, [wsId]);

  useEffect(() => {
    if (!wsId) return;
    return subscribeSpends(wsId, {}, (spends) => {
      setRecentSpends(spends.slice(0, 5));
    });
  }, [wsId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansGiven(internalId, setLoansGiven);
  }, [internalId]);
  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansReceived(internalId, setLoansReceived);
  }, [internalId]);

  const monthTotal = monthSpends?.reduce((sum, s) => sum + s.amount, 0) ?? 0;
  const loading = monthSpends === null || recentSpends === null;
  const loansGivenOutstanding = loansGiven.filter((l) => l.status !== 'settled').reduce((s, l) => s + l.outstandingAmount, 0);
  const loansReceivedOutstanding = loansReceived.filter((l) => l.status !== 'settled').reduce((s, l) => s + l.outstandingAmount, 0);
  const pendingCount = loansReceived.filter((l) => l.status === 'unconfirmed').length;

  const stats = [
    { label: format(new Date(), 'MMM yyyy'), sublabel: 'Total spent', value: loading ? null : formatINR(monthTotal) },
    { label: 'This month', sublabel: 'Transactions', value: loading ? null : String(monthSpends?.length ?? 0) },
    { label: 'Loans given', sublabel: 'Outstanding', value: formatINR(loansGivenOutstanding) },
    { label: 'Loans taken', sublabel: 'Outstanding', value: formatINR(loansReceivedOutstanding) },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{workspace?.name}</p>
      </header>

      {/* Pending banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {pendingCount} loan{pendingCount > 1 ? 's' : ''} pending your confirmation.
          </span>
          <Link to="/loans-taken" className="font-semibold underline-offset-2 hover:underline whitespace-nowrap">
            Review →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">{stat.sublabel}</div>
            {stat.value === null ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <div className="text-xl font-bold mt-1 tabular-nums leading-tight">{stat.value}</div>
            )}
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent spends */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Spends</h2>
          <Link to="/spends" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        {recentSpends === null ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : recentSpends.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No spends yet.</p>
            <Link to="/spends" className="text-sm text-primary hover:underline mt-1 inline-block">Add your first spend →</Link>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden divide-y bg-card">
            {recentSpends.map((s) => {
              const cat = catMap.get(s.categoryId);
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon ?? '💸'}</span>
                    <div>
                      <div className="text-sm font-medium">{cat?.name ?? 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(s.date.toDate(), 'dd MMM yyyy')}
                        {s.notes ? ` · ${s.notes}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatINR(s.amount)}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Category breakdown */}
      {monthSpends && monthSpends.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">This Month by Category</h2>
          <div className="rounded-lg border bg-card p-4">
            <CategoryBreakdown spends={monthSpends} catMap={catMap} total={monthTotal} />
          </div>
        </section>
      )}
    </div>
  );
}

function CategoryBreakdown({
  spends, catMap, total,
}: {
  spends: Spend[];
  catMap: Map<string, Category>;
  total: number;
}) {
  const bycat = new Map<string, { cat: Category | undefined; amount: number }>();
  for (const s of spends) {
    const entry = bycat.get(s.categoryId) ?? { cat: catMap.get(s.categoryId), amount: 0 };
    entry.amount += s.amount;
    bycat.set(s.categoryId, entry);
  }
  const sorted = Array.from(bycat.values()).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-3">
      {sorted.map(({ cat, amount }, i) => {
        const pct = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">
              {cat?.icon ?? '💸'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium truncate">{cat?.name ?? 'Unknown'}</span>
                <span className="tabular-nums font-semibold ml-2 shrink-0">{formatINR(amount)}</span>
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
  );
}
