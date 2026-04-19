import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatINR } from '@/lib/utils';
import { subscribeSpends } from '@/lib/firestore/spends';
import { subscribeCategories } from '@/lib/firestore/categories';
import { subscribeLoansGiven, subscribeLoansReceived } from '@/lib/firestore/loans';
import { Skeleton } from '@/components/ui/skeleton';
import type { Spend, Category, SharedLoan } from '@/types';

function getThisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { from, to };
}

export default function Dashboard() {
  const { workspace } = useWorkspace();


  const [monthSpends, setMonthSpends] = useState<Spend[] | null>(null);
  const [recentSpends, setRecentSpends] = useState<Spend[] | null>(null);
  const [catMap, setCatMap] = useState<Map<string, Category>>(new Map());
  const [loansGiven, setLoansGiven] = useState<SharedLoan[]>([]);
  const [loansReceived, setLoansReceived] = useState<SharedLoan[]>([]);

  const wsId = workspace?.id;

  // Subscribe categories for name lookup
  useEffect(() => {
    if (!wsId) return;
    return subscribeCategories(wsId, (cats) => {
      setCatMap(new Map(cats.map((c) => [c.id, c])));
    });
  }, [wsId]);

  // Subscribe this month's spends
  useEffect(() => {
    if (!wsId) return;
    const { from, to } = getThisMonthRange();
    return subscribeSpends(wsId, { dateFrom: from, dateTo: to }, setMonthSpends);
  }, [wsId]);

  // Subscribe recent 5 spends (no date filter — orderBy date desc, limit handled client-side)
  useEffect(() => {
    if (!wsId) return;
    return subscribeSpends(wsId, {}, (spends) => {
      setRecentSpends(spends.slice(0, 5));
    });
  }, [wsId]);

  // Subscribe loans
  useEffect(() => subscribeLoansGiven(setLoansGiven), []);
  useEffect(() => subscribeLoansReceived(setLoansReceived), []);

  const monthTotal = monthSpends?.reduce((sum, s) => sum + s.amount, 0) ?? 0;
  const loading = monthSpends === null || recentSpends === null;
  const loansGivenOutstanding = loansGiven.filter((l) => l.status !== 'settled').reduce((s, l) => s + l.outstandingAmount, 0);
  const loansReceivedOutstanding = loansReceived.filter((l) => l.status !== 'settled').reduce((s, l) => s + l.outstandingAmount, 0);
  const pendingCount = loansReceived.filter((l) => l.status === 'unconfirmed').length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{workspace?.name}</p>
      </header>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`This month (${format(new Date(), 'MMM yyyy')})`}
          value={loading ? null : formatINR(monthTotal)}
        />
        <StatCard label="Spends this month" value={loading ? null : String(monthSpends?.length ?? 0)} />
        <StatCard label="Loans given (outstanding)" value={formatINR(loansGivenOutstanding)} />
        <StatCard label="Loans taken (outstanding)" value={formatINR(loansReceivedOutstanding)} />
      </div>

      {/* Pending loans banner */}
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {pendingCount} loan{pendingCount > 1 ? 's' : ''} pending your confirmation. <a href="/loans-taken" className="underline font-medium">Review →</a>
        </div>
      )}

      {/* Recent spends */}
      <section>
        <h2 className="text-base font-semibold mb-3">Recent Spends</h2>
        {recentSpends === null ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : recentSpends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spends yet. <a href="/spends" className="underline">Add one</a>.</p>
        ) : (
          <div className="divide-y rounded-lg border overflow-hidden">
            {recentSpends.map((s) => {
              const cat = catMap.get(s.categoryId);
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors">
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

      {/* This month category breakdown */}
      {monthSpends && monthSpends.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">This Month by Category</h2>
          <CategoryBreakdown spends={monthSpends} catMap={catMap} total={monthTotal} />
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, dim }: { label: string; value: string | null; dim?: boolean }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      {value === null ? (
        <Skeleton className="h-7 w-24 mt-1" />
      ) : (
        <div className={`text-2xl font-bold mt-1 ${dim ? 'text-muted-foreground' : ''}`}>{value}</div>
      )}
    </div>
  );
}

function CategoryBreakdown({
  spends,
  catMap,
  total,
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
    <div className="space-y-2">
      {sorted.map(({ cat, amount }, i) => {
        const pct = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-base w-6 text-center">{cat?.icon ?? '💸'}</span>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-0.5">
                <span>{cat?.name ?? 'Unknown'}</span>
                <span className="tabular-nums font-medium">{formatINR(amount)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct.toFixed(1)}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}
