import { useWorkspace } from '@/hooks/useWorkspace';
import { formatINR } from '@/lib/utils';

export default function Dashboard() {
  const { workspace } = useWorkspace();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{workspace?.name}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="This month" value={formatINR(0)} />
        <StatCard label="Loans given" value={formatINR(0)} />
        <StatCard label="Loans taken" value={formatINR(0)} />
        <StatCard label="Pending" value="0" />
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        Workspace ready. Next: add spends, categories, payment sources.
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
