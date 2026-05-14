import { Outlet, Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Calendar, Sliders, UserCircle,
  LogOut, Bell, Sun, Moon, ChevronRight,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { AccessRoleToggle } from './AccessRoleToggle';
import { useSession } from '../auth/SessionContext';
import { useWorkspaceStore } from '../hooks/useWorkspaceStore';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const navItems = [
  { path: '/faculty', icon: LayoutDashboard, label: 'My Dashboard', exact: true },
  { path: '/faculty/schedule', icon: Calendar, label: 'My Schedule' },
  { path: '/faculty/preferences', icon: Sliders, label: 'Preferences' },
  { path: '/faculty/profile', icon: UserCircle, label: 'My Profile' },
];

export function FacultyLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Real live data hooks
  const { user } = useSession();
  const workspace = useWorkspaceStore();

  // Find the faculty member matching the logged-in user, or create a safe fallback
  const me = workspace.teachers.find(t => t.email.toLowerCase() === user.email.toLowerCase() || t.name.includes(user.name))
    || { name: user.name, department: 'Unassigned', isAbsent: false };

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AccessRoleToggle />

      {/* ── Faculty sidebar ── */}
      <aside className="w-60 border-r border-border flex flex-col bg-background">

        {/* Brand */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              CL
            </div>
            <span className="font-semibold text-sm">ChronoLink</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20">
              Faculty Portal
            </span>
          </div>
        </div>

        {/* Avatar card */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-md bg-card border border-border">
            <div className="w-9 h-9 rounded-md flex items-center justify-center text-sm text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              {initials(me.name)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{me.name.split(' ').slice(-1)[0]}, {me.name.split(' ')[0]}</div>
              <div className="text-[10px] text-muted-foreground truncate">{me.department}</div>
            </div>
            <div className="ml-auto w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{ background: me.isAbsent ? '#ef4444' : '#10b981' }} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className="px-2 py-1 mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Menu</span>
          </div>
          {navItems.map(item => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path) && item.path !== '/faculty';
            const isExactRoot = item.exact && location.pathname === '/faculty';

            const active = item.exact ? isExactRoot : location.pathname.startsWith(item.path);

            return (
              <Link key={item.path} to={item.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all group"
                style={{
                  background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: active ? '#3b82f6' : 'var(--muted-foreground)',
                  border: `1px solid ${active ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                }}>
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-border space-y-1">
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm w-full text-muted-foreground hover:bg-accent/30 transition-colors">
            <Bell className="w-4 h-4 shrink-0" />
            <span>Notifications</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ background: '#ef4444' }}>2</span>
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm w-full text-muted-foreground hover:bg-accent/30 transition-colors"
          >
            {mounted && theme === 'dark'
              ? <><Sun className="w-4 h-4" /><span>Light Mode</span></>
              : <><Moon className="w-4 h-4" /><span>Dark Mode</span></>}
          </button>
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm w-full text-muted-foreground hover:bg-accent/30 transition-colors">
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}