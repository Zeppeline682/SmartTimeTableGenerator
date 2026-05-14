import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Calendar, Clock, MapPin, BookOpen, FlaskConical, ChevronRight,
  AlertTriangle, RefreshCw, Info, X, Radio, Zap, TrendingUp,
  GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mockTimeSlots } from '../../mockData';
import { useStudentProfile } from '../../hooks/useStudentProfile';

/* ── helpers ──────────────────────────────────────────── */

function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function slotDurationHrs(s: typeof mockTimeSlots[0]) {
  return (toMins(s.endTime) - toMins(s.startTime)) / 60;
}

function greetingPhrase() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/* ── type styling ─────────────────────────────────────── */

const TYPE_META = {
  lecture:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  label: 'Lecture',   Icon: BookOpen    },
  practical: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  label: 'Practical', Icon: FlaskConical },
  tutorial:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  label: 'Tutorial',  Icon: GraduationCap },
};

function TypeBadge({ type }: { type?: string }) {
  const m = TYPE_META[type as keyof typeof TYPE_META] ?? TYPE_META.lecture;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
    >
      <m.Icon className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

/* ── announcement seed data ───────────────────────────── */

type AKind = 'absence' | 'substitution' | 'time-change' | 'cancellation' | 'notice';

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
  'time-change': { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', label: 'Room Change'  },
  cancellation:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', label: 'Cancelled'    },
  notice:        { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', label: 'Notice'       },
};

function kindIcon(k: AKind) {
  if (k === 'absence')       return <AlertTriangle className="h-3.5 w-3.5" />;
  if (k === 'substitution')  return <RefreshCw     className="h-3.5 w-3.5" />;
  if (k === 'time-change')   return <MapPin        className="h-3.5 w-3.5" />;
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

const SEED_ANNOUNCEMENTS: Announcement[] = [];

/* ── week hours bar chart ─────────────────────────────── */

const WEEK_HOURS: Record<string, number> = {
  Monday:    4,
  Tuesday:   2,
  Wednesday: 2,
  Thursday:  2,
  Friday:    4,
};

const MAX_HOURS = Math.max(...Object.values(WEEK_HOURS));

function weekBarColor(h: number) {
  if (h <= 2) return '#10b981';
  if (h <= 4) return '#f59e0b';
  return '#ef4444';
}

/* ── Next-class countdown ────────────────────────────── */

function useNow(interval = 10000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

function getNextClass(todaySlots: typeof mockTimeSlots, nowMins: number) {
  const upcoming = todaySlots
    .filter(s => toMins(s.startTime) > nowMins)
    .sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
  return upcoming[0] ?? null;
}

function formatCountdown(minsLeft: number) {
  if (minsLeft < 60) return `${minsLeft}m`;
  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── Component ────────────────────────────────────────── */

export function StudentDashboard() {
  const ME_STUDENT = useStudentProfile();
  const now       = useNow(30000);
  const todayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const nowMins   = now.getHours() * 60 + now.getMinutes();

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

  const todaySlots = mockTimeSlots
    .filter(s => s.day === todayName)
    .sort((a, b) => toMins(a.startTime) - toMins(b.startTime));

  const nextClass   = getNextClass(todaySlots, nowMins);
  const activeClass = todaySlots.find(
    s => toMins(s.startTime) <= nowMins && nowMins < toMins(s.endTime)
  ) ?? null;

  const minsUntilNext = nextClass
    ? toMins(nextClass.startTime) - nowMins
    : null;

  // total weekly stats
  const totalSessions  = mockTimeSlots.length;
  const totalHrs       = mockTimeSlots.reduce((acc, s) => acc + slotDurationHrs(s), 0);
  const practicalCount = mockTimeSlots.filter(s => s.type === 'practical').length;

  return (
    <div className="min-h-full bg-background">

      {/* ── Header ──────────────────────────────────── */}
      <div className="border-b border-border px-8 py-6 bg-background">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-0.5">{formatDate(now)}</p>
            <h1 className="text-2xl font-semibold">
              {greetingPhrase()}, {ME_STUDENT.name.split(' ')[0]}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {ME_STUDENT.group.isLive && (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                {ME_STUDENT.group.name} is Live
              </span>
            )}
            <span
              className="px-3 py-1.5 rounded-lg text-sm bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20"
            >
              Sem {ME_STUDENT.group.semester} · {ME_STUDENT.group.course}
            </span>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* ── Today's classes ─────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Today's Classes
              <span className="text-xs text-muted-foreground font-normal">
                · {todayName} · {todaySlots.length} session{todaySlots.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <Link
              to="/student/timetable"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Full week <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {todaySlots.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border text-muted-foreground text-sm"
            >
              <Calendar className="w-8 h-8 mb-3 opacity-30" />
              No classes scheduled today. Enjoy your day!
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {todaySlots.map(slot => {
                const isActive = toMins(slot.startTime) <= nowMins && nowMins < toMins(slot.endTime);
                const isPast   = toMins(slot.endTime) <= nowMins;
                const m        = TYPE_META[slot.type as keyof typeof TYPE_META] ?? TYPE_META.lecture;
                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="shrink-0 w-56 rounded-lg p-4 border transition-all"
                    style={{
                      background:   isActive ? m.bg : isPast ? 'rgba(255,255,255,0.02)' : 'var(--surface-4)',
                      borderColor:  isActive ? m.border : 'var(--surface-border)',
                      opacity:      isPast ? 0.5 : 1,
                    }}
                  >
                    {isActive && (
                      <div
                        className="flex items-center gap-1 text-[10px] mb-2 px-1.5 py-0.5 rounded w-fit"
                        style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: m.color }} />
                        In Progress
                      </div>
                    )}
                    <TypeBadge type={slot.type} />
                    <div className="mt-2 font-medium text-sm leading-snug">{slot.subject}</div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {slot.room}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground truncate">
                      {slot.faculty}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Three info cards ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Next class */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">
                {activeClass ? 'Right Now' : 'Next Class'}
              </span>
            </div>
            {activeClass ? (
              <>
                <div className="text-lg font-semibold mb-1">{activeClass.subject}</div>
                <TypeBadge type={activeClass.type} />
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Clock  className="w-3.5 h-3.5" />{fmt12(activeClass.startTime)} – {fmt12(activeClass.endTime)}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{activeClass.room}</div>
                </div>
                <div
                  className="mt-3 text-xs px-2 py-1 rounded-lg w-fit bg-emerald-500/10 text-emerald-500"
                >
                  Ends in {formatCountdown(toMins(activeClass.endTime) - nowMins)}
                </div>
              </>
            ) : nextClass ? (
              <>
                <div className="text-lg font-semibold mb-1">{nextClass.subject}</div>
                <TypeBadge type={nextClass.type} />
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Clock  className="w-3.5 h-3.5" />{fmt12(nextClass.startTime)} – {fmt12(nextClass.endTime)}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{nextClass.room}</div>
                </div>
                <div
                  className="mt-3 text-xs px-2 py-1 rounded-lg w-fit bg-amber-500/10 text-amber-500"
                >
                  Starts in {formatCountdown(minsUntilNext!)}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground pt-2">
                No more classes today.
                <div className="mt-1 text-xs opacity-70">
                  {DAYS_ORDER[(DAYS_ORDER.indexOf(todayName) + 1) % 5] ?? 'Monday'}'s schedule →
                </div>
              </div>
            )}
          </div>

          {/* Weekly bar chart */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">This Week</span>
            </div>
            <div className="flex items-end gap-2 h-16">
              {DAYS_ORDER.map(day => {
                const hrs  = WEEK_HOURS[day] ?? 0;
                const pct  = MAX_HOURS > 0 ? (hrs / MAX_HOURS) * 100 : 0;
                const col  = weekBarColor(hrs);
                const isToday = day === todayName;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t" style={{ height: `${pct}%`, minHeight: 4, background: isToday ? col : `${col}55` }} />
                    <span className={`text-[9px] ${isToday ? 'font-semibold' : 'text-muted-foreground'}`}
                      style={{ color: isToday ? col : undefined }}>
                      {day.slice(0, 1)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-base font-semibold">{totalSessions}</div>
                <div className="text-[10px] text-muted-foreground">Sessions</div>
              </div>
              <div>
                <div className="text-base font-semibold">{totalHrs}h</div>
                <div className="text-[10px] text-muted-foreground">Total hrs</div>
              </div>
              <div>
                <div className="text-base font-semibold">{practicalCount}</div>
                <div className="text-[10px] text-muted-foreground">Labs</div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium">Quick Access</span>
            </div>
            {[
              { to: '/student/timetable',     label: 'Full Weekly Timetable', sub: `${mockTimeSlots.length} sessions`,  color: '#3b82f6' },
              { to: '/student/announcements', label: 'Announcements',         sub: `${announcements.length} unread`, color: '#ef4444' },
              { to: '/student/profile',       label: 'My Profile',            sub: ME_STUDENT.studentId,                 color: '#8b5cf6' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center justify-between px-3 py-2.5 rounded-md border border-border hover:bg-accent/20 transition-colors group"
              >
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Announcements preview ────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Recent Announcements
            </h2>
            <Link
              to="/student/announcements"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {announcements.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                  No recent announcements.
                </div>
              ) : announcements.slice(0, 3).map((ann, i) => {
                const m = KIND_META[ann.kind] || KIND_META['notice'];
                return (
                  <motion.div
                    key={ann.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-4 px-4 py-3.5 rounded-md border"
                    style={{ background: m.bg, borderColor: m.border }}
                  >
                    <div className="mt-0.5" style={{ color: m.color }}>
                      {kindIcon(ann.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{ann.title}</span>
                        {ann.affectsYou && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500"
                          >
                            Affects you
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ann.detail}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(ann.time)}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}


