import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, HandCoins, ArrowDownToLine, Users, Tags,
  CreditCard, Settings, LogOut, User, Database, Wallet, MoreHorizontal, X,
  ChevronRight, Bug, StickyNote, TrendingUp
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
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/payment-sources', label: 'Sources', icon: CreditCard },
];

const SETTINGS_NAV = [
  { to: '/settings/workspace', label: 'Workspace', icon: Settings },
  { to: '/settings/profile', label: 'Profile', icon: User },
  { to: '/settings/backup', label: 'Backup & Data', icon: Database },
];

// Primary 5 tabs always visible on mobile
const MOBILE_PRIMARY = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/spends', label: 'Spends', icon: Receipt },
  { to: '/loans-given', label: 'Loans', icon: HandCoins },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/notes', label: 'Notes', icon: StickyNote },
];

// "More" drawer sections
const MORE_SECTIONS = [
  {
    title: 'Personal',
    items: [
      { to: '/investments', label: 'Investments', icon: TrendingUp },
    ],
  },
  {
    title: 'Loans',
    items: [
      { to: '/loans-given', label: 'Loans Given', icon: HandCoins },
      { to: '/loans-taken', label: 'Loans Taken', icon: ArrowDownToLine },
    ],
  },
  {
    title: 'Manage',
    items: [
      { to: '/categories', label: 'Categories', icon: Tags },
      { to: '/payment-sources', label: 'Payment Sources', icon: CreditCard },
    ],
  },
  {
    title: 'Settings',
    items: [
      { to: '/settings/workspace', label: 'Workspace', icon: Settings },
      { to: '/settings/profile', label: 'Profile', icon: User },
      { to: '/settings/backup', label: 'Backup & Data', icon: Database },
    ],
  },
];

const ADMIN_EMAIL = 'rambharlia007@gmail.com';

export default function Layout() {
  const { user, signOut } = useAuth();
  const { workspace, loading, error, retry } = useWorkspace();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Wallet className="h-8 w-8 text-foreground animate-pulse" />
        <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-sm space-y-4">
        <Wallet className="h-8 w-8 text-muted-foreground mx-auto" />
        <div>
          <p className="font-semibold text-destructive">Error loading workspace</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={retry}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
          <button
            onClick={() => signOut()}
            className="w-full rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  function handleMoreNav(to: string) {
    setMoreOpen(false);
    navigate(to);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">

      {/* ── Sidebar (desktop only) ─────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r bg-card">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b">
          <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center shrink-0">
            <Wallet className="h-3.5 w-3.5 text-background" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground leading-none mb-0.5">Workspace</div>
            <div className="font-semibold text-sm truncate">{workspace?.name ?? '—'}</div>
          </div>
        </div>

        <nav className="flex flex-col p-2 gap-0.5 flex-1 overflow-y-auto">
          {MAIN_NAV.map((item) => <SidebarLink key={item.to} {...item} />)}
          <div className="mt-3 mb-1 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Settings
          </div>
          {SETTINGS_NAV.map((item) => <SidebarLink key={item.to} {...item} />)}
          {user?.email === ADMIN_EMAIL && (
            <>
              <div className="mt-3 mb-1 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Admin
              </div>
              <SidebarLink to="/admin/logs" label="Error Logs" icon={Bug} />
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 p-3 border-t">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate leading-none">{user?.displayName}</div>
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

      {/* ── Main content ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto" style={{ paddingBottom: 'calc(3.5rem + max(0px, env(safe-area-inset-bottom)))' }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* ── Mobile bottom nav ──────────────────────── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background flex"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {MOBILE_PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </nav>
      </div>

      {/* ── More drawer (mobile) ───────────────────────── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Handle + header */}
            <div className="relative flex items-center justify-between px-4 pt-3 pb-2 border-b">
              <div className="mx-auto w-8 h-1 rounded-full bg-muted-foreground/30 absolute left-1/2 -translate-x-1/2 top-2" />
              <span className="text-sm font-semibold">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User info */}
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full shrink-0" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.displayName}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </div>
            </div>

            {/* Nav sections */}
            <div className="overflow-y-auto max-h-[60vh]">
              {MORE_SECTIONS.map((section) => (
                <div key={section.title}>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </div>
                  {section.items.map((item) => (
                    <button
                      key={item.to}
                      onClick={() => handleMoreNav(item.to)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm">{item.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </button>
                  ))}
                </div>
              ))}

              {/* Admin section */}
              {user?.email === ADMIN_EMAIL && (
                <>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Admin
                  </div>
                  <button
                    onClick={() => handleMoreNav('/admin/logs')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Bug className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">Error Logs</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </button>
                </>
              )}

              {/* Sign out */}
              <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account
              </div>
              <button
                onClick={() => { setMoreOpen(false); signOut(); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-sm">Sign Out</span>
              </button>

              <div className="h-2" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SidebarLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
