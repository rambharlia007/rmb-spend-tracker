import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { user, signOut } = useAuth();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome, {user?.displayName}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm px-3 py-1.5 rounded-md border hover:bg-accent"
        >
          Sign out
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">This month</div>
          <div className="text-2xl font-bold mt-1">₹0</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Loans given</div>
          <div className="text-2xl font-bold mt-1">₹0</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Loans taken</div>
          <div className="text-2xl font-bold mt-1">₹0</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Pending actions</div>
          <div className="text-2xl font-bold mt-1">0</div>
        </div>
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        Scaffold running. Next: categories, payment sources, spends.
      </div>
    </div>
  );
}
