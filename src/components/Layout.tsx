import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, HandCoins, ArrowDownToLine, Users, Tags,
  CreditCard, Settings, LogOut, User, Database, Wallet
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

// Mobile bottom nav — 5 most important
const MOBILE_NAV = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/spends', label: 'Spends', icon: Receipt },
  { to: '/loans-given', label: 'Given', icon: HandCoins },
  { to: '/loans-taken', label: 'Taken', icon: ArrowDownToLine },
  { to: '/settings/profile', label: 'More', icon: Settings },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const { workspace, loading, error } = useWorkspace();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Wallet className="h-8 w-8 text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-destructive font-semibold">Error loading workspace</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar — md+ only */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 border-r bg-card">
        {/* Brand header */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground leading-none mb-0.5">Workspace</div>
            <div className="font-semibold text-sm truncate">{workspace?.name ?? '—'}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col p-3 gap-0.5 flex-1 overflow-y-auto">
          {MAIN_NAV.map((item) => <SidebarLink key={item.to} {...item} />)}

          <div className="mt-4 mb-1.5 px-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Settings
          </div>
          {SETTINGS_NAV.map((item) => <SidebarLink key={item.to} {...item} />)}
        </nav>

        {/* User footer */}
        <div className="flex items-center gap-2.5 p-3 border-t bg-muted/30">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full ring-2 ring-border shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate leading-none mb-0.5">{user?.displayName}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto pb-nav-safe md:pb-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Mobile bottom nav — fixed, with safe-area padding */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md flex pb-safe"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
        >
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-w-0',
                  'transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    'flex items-center justify-center h-7 w-7 rounded-lg transition-all',
                    isActive && 'bg-primary/10'
                  )}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className={cn(
                    'text-[10px] leading-none truncate max-w-full px-0.5',
                    isActive && 'font-semibold'
                  )}>
                    {item.label}
                  </span>
                </>
              )}
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
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
