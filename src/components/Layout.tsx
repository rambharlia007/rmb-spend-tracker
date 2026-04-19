import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Receipt, HandCoins, ArrowDownToLine, Users, Tags, CreditCard, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/spends', label: 'Spends', icon: Receipt },
  { to: '/loans-given', label: 'Loans Given', icon: HandCoins },
  { to: '/loans-taken', label: 'Loans Taken', icon: ArrowDownToLine },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/payment-sources', label: 'Sources', icon: CreditCard },
  { to: '/settings/workspace', label: 'Settings', icon: Settings }
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const { workspace, loading, error } = useWorkspace();

  if (loading) return <div className="p-8 text-center text-muted-foreground">Setting up…</div>;
  if (error) return <div className="p-8 text-center text-destructive">Error: {error}</div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar on md+, bottom bar on mobile */}
      <aside className="md:w-56 md:border-r border-b md:border-b-0 bg-card">
        <div className="hidden md:block p-4 border-b">
          <div className="text-xs text-muted-foreground">Workspace</div>
          <div className="font-semibold truncate">{workspace?.name ?? '—'}</div>
        </div>

        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 md:p-2 gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground font-medium'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 p-3 border-t mt-auto">
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.displayName}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-md hover:bg-accent"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
