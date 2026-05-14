import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../hooks/useWorkspaceStore';
import { useSession } from '../auth/SessionContext';
import { Link } from 'react-router';
import {
  AlertCircle, Clock, MapPin, BookOpen, Bell,
  CheckCircle2, TrendingUp, Award, ChevronRight,
  Calendar, Sliders, AlertTriangle, RefreshCw, X, Info
} from 'lucide-react';
import { mockFaculty, mockTimeSlots } from '../mockData';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

/* ─── shared helpers ───────────────────────────────────────── */

export const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const TYPE_META = {
  lecture: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.25)', label: 'Lecture' },
  practical: { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6', border: 'rgba(139,92,246,0.25)', label: 'Practical' },
  tutorial: { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.25)', label: 'Tutorial' },
};

export function typePill(type?: string) {
  const m = TYPE_META[(type as keyof typeof TYPE_META)] ?? TYPE_META.lecture;
  return (
    <span className="px-2 py-0.5 rounded text-xs"
      style={{ background: m.bg, color: m.text, border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  );
}

export function barColor(hrs: number) {
  if (hrs >= 5) return '#ef4444';
  if (hrs >= 3) return '#f59e0b';
  return '#10b981';
}

/* ── announcement seed data ───────────────────────────── */

type AKind = 'absence' | 'substitution' | 'room-change' | 'cancellation' | 'notice';

interface Announcement {
  id: string;
  kind: AKind;
  title: string;
  detail: string;
  time: Date;
  affectsYou: boolean;
}

const KIND_META: Record<AKind, { color: string; bg: string; border: string; label: string }> = {
  absence:       { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  label: 'Absence'      },
  substitution:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Substitution' },
  'room-change': { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', label: 'Room Change'  },
  cancellation:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', label: 'Cancelled'    },
  notice:        { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', label: 'Notice'       },
};

function kindIcon(k: AKind) {
  if (k === 'absence')       return <AlertTriangle className="h-3.5 w-3.5" />;
  if (k === 'substitution')  return <RefreshCw     className="h-3.5 w-3.5" />;
  if (k === 'room-change')   return <MapPin        className="h-3.5 w-3.5" />;
  if (k === 'cancellation')  return <X             className="h-3.5 w-3.5" />;
  return                            <Info          className="h-3.5 w-3.5" />;
}

function timeAgo(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Today's mini-timeline ─────────────────────────────────── */

function TodayTimeline({ facultyName, workspaceSlots }: { facultyName: string, workspaceSlots: any[] }) {
  const now = '09:30'; // demo "current time"
  const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const displayDay = (currentDay === 'Sunday' || currentDay === 'Saturday') ? 'Monday' : currentDay;
  const todaySlots = workspaceSlots
    .filter(s => s.faculty === facultyName && s.day === displayDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todaySlots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <CheckCircle2 className="h-7 w-7 opacity-25" />
        <p className="text-sm">No classes today</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {todaySlots.map((slot, i) => {
        const isPast = slot.endTime < now;
        const isCurrent = slot.startTime <= now && slot.endTime > now;
        const m = TYPE_META[(slot.type as keyof typeof TYPE_META)] ?? TYPE_META.lecture;

        return (
          <motion.div key={slot.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-stretch gap-3"
          >
            <div className="flex flex-col items-center w-6 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ background: isCurrent ? m.text : isPast ? 'var(--muted-foreground)' : 'var(--surface-border-accent)', border: `2px solid ${isCurrent ? m.text : 'var(--surface-border-accent)'}` }} />
              {i < todaySlots.length - 1 && (
                <div className="flex-1 w-px mt-1" style={{ background: 'var(--surface-border)' }} />
              )}
            </div>

            <div className="flex-1 mb-2 rounded-md p-3.5 transition-all"
              style={{
                background: isCurrent ? m.bg : isPast ? 'var(--surface-3)' : 'var(--surface-4)',
                border: `1px solid ${isCurrent ? m.border : 'var(--surface-border)'}`,
                opacity: isPast ? 0.5 : 1,
              }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate"
                    style={{ color: isCurrent ? m.text : undefined }}>{slot.subject}</div>
                  <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{slot.startTime}–{slot.endTime}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.room}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {typePill(slot.type)}
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] animate-pulse bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                      Now
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Main overview ────────────────────────────────────────── */

export function FacultyDashboard() {
  const workspace = useWorkspaceStore();
  const { user } = useSession();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    try {
      const stored = window.localStorage.getItem('realtime-timetable.studentAnnouncements');
      if (stored) {
        return JSON.parse(stored).map((a: any) => ({ ...a, time: new Date(a.time) }));
      }
    } catch (e) { }
    return [];
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = window.localStorage.getItem('realtime-timetable.studentAnnouncements');
        if (stored) {
          setAnnouncements(JSON.parse(stored).map((a: any) => ({ ...a, time: new Date(a.time) })));
        }
      } catch (e) { }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('chronolink:import' as any, handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('chronolink:import' as any, handleStorage);
    };
  }, []);

  // 1. Find the logged-in teacher in the workspace, fallback to first teacher
  const realTeacherIndex = workspace.teachers.findIndex(t => (t.email && t.email.toLowerCase() === user.email.toLowerCase()) || t.name.toLowerCase().includes(user.name.toLowerCase())) >= 0
    ? workspace.teachers.findIndex(t => (t.email && t.email.toLowerCase() === user.email.toLowerCase()) || t.name.toLowerCase().includes(user.name.toLowerCase()))
    : 0;

  const me = workspace.teachers[realTeacherIndex] || mockFaculty[0];
  const absent = me.isAbsent;

  const weeklySlots = workspace.slots.filter(s => s.faculty === me.name);
  const weeklyHours = me.totalWeeklyHours ?? 0;

  // 2. Global State Update Function
  function toggleAbsence(status: boolean) {
    const raw = window.localStorage.getItem('realtime-timetable.workspace.v2');
    if (raw) {
      const ws = JSON.parse(raw);
      if (ws.teachers && ws.teachers[realTeacherIndex]) {
        ws.teachers[realTeacherIndex].isAbsent = status;
        window.localStorage.setItem('realtime-timetable.workspace.v2', JSON.stringify(ws));
        window.dispatchEvent(new CustomEvent('chronolink:import', { detail: ws }));
        toast.success(status ? 'Absence marked' : 'Marked as present', {
          description: status ? 'Admin has been notified. Classes will be rescheduled.' : 'Your schedule is restored.'
        });
      }
    }
  }

  return (
    <div className="min-h-full bg-background">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5 bg-background">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Good morning, {me.name.split(' ').pop()} 👋</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Here's your overview for today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm">
              <div className={`w-2 h-2 rounded-full ${absent ? 'bg-[#ef4444]' : 'bg-[#10b981] animate-pulse'}`} />
              {absent ? 'Absent today' : 'Active today'}
            </div>
            {absent ? (
              <button onClick={() => toggleAbsence(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border hover:bg-accent transition-colors">
                <CheckCircle2 className="h-4 w-4 text-[#10b981]" />Mark Present
              </button>
            ) : (
              <button onClick={() => toggleAbsence(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border hover:bg-accent transition-colors">
                <AlertCircle className="h-4 w-4 text-[#ef4444]" />Mark Absent
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Classes this week', value: weeklySlots.length, icon: <BookOpen className="h-4 w-4" />, color: '#3b82f6' },
            { label: 'Teaching hours', value: `${weeklyHours}h`, icon: <Clock className="h-4 w-4" />, color: weeklyHours >= 20 ? '#ef4444' : weeklyHours >= 15 ? '#f59e0b' : '#10b981' },
            { label: 'Subjects', value: me.subjects?.length || 0, icon: <Award className="h-4 w-4" />, color: '#8b5cf6' },
            { label: 'Faculty Score', value: '80%', icon: <TrendingUp className="h-4 w-4" />, color: '#10b981' },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-md p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.color}18`, color: s.color }}>
                {s.icon}
              </div>
              <div>
                <div className="text-xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 2-col row: timeline + side widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
              <h2 className="font-medium text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />Today's Classes
              </h2>
              <Link to="/faculty/schedule" className="text-xs flex items-center gap-1 hover:underline text-blue-500">
                Full schedule <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-5">
              <TodayTimeline facultyName={me.name} workspaceSlots={workspace.slots} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />Recent Announcements
                </h3>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {announcements.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                      No recent announcements.
                    </div>
                  ) : announcements.slice(0, 4).map((ann, i) => {
                    const m = KIND_META[ann.kind] || KIND_META['notice'];
                    return (
                      <motion.div
                        key={ann.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-md border"
                        style={{ background: m.bg, borderColor: m.border }}
                      >
                        <div className="mt-0.5" style={{ color: m.color }}>
                          {kindIcon(ann.kind)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{ann.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ann.detail}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(ann.time)}</span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}