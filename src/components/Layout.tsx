import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, HandCoins, ArrowDownToLine, Users, Tags,
  CreditCard, Settings, LogOut, User, Database
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const MAIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/spends', label: 'Spends', icon: Receipt },
  { to: '/loans-given', label: 'Loans Given', icon: HandCoins },
  { to: '/loans-taken', label: 'Loans Taken', icon: ArrowDownToLine },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/payment-sources', label: 'Sources', icon: CreditCard },
];

const SETTINGS_NAV = [
  { to: '/settings/workspace', label: 'Workspace', icon: Settings },
  { to: '/settings/profile', label: 'Profile', icon: User },
  { to: '/settings/backup', label: 'Backup', icon: Database },
];

// Mobile bottom nav — only top 5
const MOBILE_NAV = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/spends', label: 'Spends', icon: Receipt },
  { to: '/loans-given', label: 'Given', icon: HandCoins },
  { to: '/loans-taken', label: 'Taken', icon: ArrowDownToLine },
  { to: '/settings/profile', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const { workspace, loading, error } = useWorkspace();

  if (loading) return <div className="p-8 text-center text-muted-foreground">Setting up…</div>;
  if (error) return <div className="p-8 text-center text-destructive">Error: {error}</div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar — md+ only */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:border-r bg-card">
        <div className="p-4 border-b">
          <div className="text-xs text-muted-foreground">Workspace</div>
          <div className="font-semibold truncate">{workspace?.name ?? '—'}</div>
        </div>

        <nav className="flex flex-col p-2 gap-0.5 flex-1 overflow-y-auto">
          {MAIN_NAV.map((item) => <SidebarLink key={item.to} {...item} />)}

          <div className="mt-3 mb-1 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Settings</div>
          {SETTINGS_NAV.map((item) => <SidebarLink key={item.to} {...item} />)}
        </nav>

        <div className="flex items-center gap-2 p-3 border-t">
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card flex z-50">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px]',
                  'hover:bg-accent transition-colors',
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function SidebarLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
          isActive && 'bg-accent text-accent-foreground font-medium'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}
