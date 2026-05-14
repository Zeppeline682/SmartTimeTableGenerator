import { Outlet, Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Calendar, Bell, UserCircle,
  LogOut, Sun, Moon, ChevronRight, GraduationCap, Radio,
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
  { path: '/student', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/student/timetable', icon: Calendar, label: 'My Timetable' },
  { path: '/student/announcements', icon: Bell, label: 'Announcements' },
  { path: '/student/profile', icon: UserCircle, label: 'My Profile' },
];

const UNREAD = 3;

export function StudentLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Real live data hooks
  const { user } = useSession();
  const workspace = useWorkspaceStore();

  // Find the live group, or fallback to the first available group
  const liveGroup = workspace.groups.find(g => g.isLive) || workspace.groups[0] || { name: 'Unassigned Group', course: 'N/A', semester: 1, isLive: false };

  // Dynamic student profile based on login
  const ME_STUDENT = {
    name: (user.role === 'developer' && user.email === '12345@gmail.com') ? 'Jash' : user.name,
    studentId: `STU-${new Date().getFullYear()}-001`,
    group: liveGroup,
    email: user.email,
    gpa: 4.0,
  };

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AccessRoleToggle />

      {/* ── Student sidebar ─────────────────────────── */}
      <aside className="w-60 border-r border-border flex flex-col bg-background">

        {/* Brand */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-0.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-white"
              style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}
            >
              CL
            </div>
            <span className="font-semibold text-sm">ChronoLink</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
            >
              Student Portal
            </span>
            {ME_STUDENT.group.isLive && (
              <span
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500"
              >
                <Radio className="w-2.5 h-2.5" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* Avatar card */}
        <div className="px-4 py-4 border-b border-border">
          <div
            className="flex items-center gap-3 px-2 py-2.5 rounded-md bg-card border border-border"
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center text-sm text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}
            >
              {initials(ME_STUDENT.name)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{ME_STUDENT.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {ME_STUDENT.group.name} · Sem {ME_STUDENT.group.semester}
              </div>
            </div>
            <div
              className="ml-auto w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{ background: ME_STUDENT.group.isLive ? '#10b981' : '#6b7280' }}
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className="px-2 py-1 mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Menu</span>
          </div>
          {navItems.map(item => {
            const active = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all"
                style={{
                  background: active ? 'rgba(16,185,129,0.1)' : 'transparent',
                  color: active ? '#10b981' : 'var(--muted-foreground)',
                  border: `1px solid ${active ? 'rgba(16,185,129,0.2)' : 'transparent'}`,
                }}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.path === '/student/announcements' && !active && UNREAD > 0 && (
                  <span
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: '#ef4444' }}
                  >
                    {UNREAD}
                  </span>
                )}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </Link>
            );
          })}

          {/* Separator + quick info */}
          <div className="pt-4 mt-2 border-t border-border">
            <div className="px-3 py-2 rounded-md bg-card border border-border">
              <div className="flex items-center gap-2 mb-1.5">
                <GraduationCap className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span className="text-[11px] text-muted-foreground">{ME_STUDENT.group.course}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {ME_STUDENT.studentId}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">GPA</span>
                <span className="text-[11px] font-medium text-emerald-500">{ME_STUDENT.gpa}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-border space-y-0.5">
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

      {/* ── Main content ──────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}



