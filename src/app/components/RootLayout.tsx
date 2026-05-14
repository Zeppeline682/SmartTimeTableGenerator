import { Outlet, Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Calendar, Zap, Database,
  Command, Sun, Moon, Search, Shield,
  ChevronRight, Radio, DoorOpen, Settings, Users, ShieldCheck, GraduationCap, Bell,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { CommandMenu } from './CommandMenu';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { AccessRoleToggle } from './AccessRoleToggle';
import { getRoleLabel } from '../auth/session';
import { useSession } from '../auth/SessionContext';
import { useWorkspaceStore } from '../hooks/useWorkspaceStore';

/* ─── Nav structure ─────────────────────────────────────────── */

const navSections = [
  {
    label: 'Admin',
    items: [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'    },
      { path: '/notifications', icon: Bell, label: 'Notifications' },
      { path: '/access',    icon: ShieldCheck,     label: 'Access'       },
      { path: '/settings',  icon: Settings,        label: 'Settings'     },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { path: '/workspace',    icon: Calendar,   label: 'Timetable Editor' },
      { path: '/classes',      icon: GraduationCap, label: 'Classes'       },
      { path: '/integrations', icon: Database,   label: 'Integrations'     },
      { path: '/rooms',        icon: DoorOpen,   label: 'Rooms'            },
      { path: '/directory',    icon: Users,      label: 'Directory'        },
    ],
  },
];

export function RootLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useSession();
  const [mounted, setMounted]       = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const roleLabel = getRoleLabel(user.role);

  useEffect(() => { setMounted(true); }, []);

  const { groups } = useWorkspaceStore();
  const liveGroups = groups.filter(g => g.isLive);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AccessRoleToggle />
      <CommandMenu role={user.role} open={commandOpen} onOpenChange={setCommandOpen} />
      <KeyboardShortcuts />

      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col" style={{ background: 'var(--surface-0)' }}>

        {/* Logo + role */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Command className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">ChronoLink</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-violet-500" />
            <span className="text-[10px] text-violet-500">{roleLabel} workspace</span>
          </div>
          <div className="mt-3 rounded-lg px-2.5 py-2 bg-card border border-border">
            <div className="text-[10px] text-muted-foreground">Current account</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{user.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Search / ⌘K */}
        <div className="px-4 py-3 border-b border-border">
          <button
            onClick={() => setCommandOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/40 transition-colors border border-border"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-background">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {navSections.map(section => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">
                {section.label === 'Admin' ? roleLabel : section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path) && item.path.length > 1);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all"
                      style={{
                        background:  isActive ? 'rgba(59,130,246,0.1)'  : 'transparent',
                        color:       isActive ? '#3b82f6' : 'var(--muted-foreground)',
                        border:      `1px solid ${isActive ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                      }}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Live groups section */}
          {liveGroups.length > 0 && (
            <div>
              <p className="px-3 mb-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">Live Now</p>
              <div className="space-y-0.5">
                {liveGroups.map(g => (
                  <a
                    key={g.id}
                    href={`/live/${g.liveLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-accent/30 transition-all"
                  >
                    <Radio className="w-4 h-4 text-[#10b981] animate-pulse shrink-0" />
                    <span className="flex-1 truncate">{g.name}</span>
                    <span className="text-[10px] opacity-50">{g.studentsCount} students</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom: theme */}
        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md w-full text-sm text-muted-foreground hover:bg-accent/30 transition-all"
          >
            {mounted && theme === 'dark'
              ? <><Sun className="w-4 h-4" /><span>Light Mode</span></>
              : <><Moon className="w-4 h-4" /><span>Dark Mode</span></>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}


