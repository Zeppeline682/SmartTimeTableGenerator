import { useState, useEffect } from 'react';
import {
  AlertTriangle, RefreshCw, MapPin, X, Info,
  Bell, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/* ── types + data ─────────────────────────────────────── */

type AKind = 'absence' | 'substitution' | 'room-change' | 'cancellation' | 'notice';

interface Announcement {
  id: string;
  kind: AKind;
  title: string;
  detail: string;
  affectedSubject?: string;
  affectedFaculty?: string;
  suggestion?: string;
  time: Date;
  affectsYou: boolean;
  read: boolean;
}

const KIND_META: Record<AKind, { color: string; bg: string; border: string; label: string }> = {
  absence: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'Absence' },
  substitution: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Substitution' },
  'room-change': { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', label: 'Room Change' },
  cancellation: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', label: 'Cancelled' },
  notice: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', label: 'Notice' },
};

function kindIcon(k: AKind) {
  if (k === 'absence') return <AlertTriangle className="h-4 w-4" />;
  if (k === 'substitution') return <RefreshCw className="h-4 w-4" />;
  if (k === 'room-change') return <MapPin className="h-4 w-4" />;
  if (k === 'cancellation') return <X className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function relativeTime(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const INITIAL: Announcement[] = [];

type FilterKind = 'all' | AKind;

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'absence', label: 'Absences' },
  { key: 'substitution', label: 'Substitutions' },
  { key: 'room-change', label: 'Room Changes' },
  { key: 'cancellation', label: 'Cancellations' },
  { key: 'notice', label: 'Notices' },
];

/* ── component ────────────────────────────────────────── */

export function StudentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    try {
      const stored = window.localStorage.getItem('realtime-timetable.studentAnnouncements');
      if (stored) {
        const parsed = JSON.parse(stored).map((a: any) => ({ ...a, time: new Date(a.time) }));
        // If it's the old hardcoded mock data, discard it
        if (parsed.length > 0 && parsed.some((a: any) => a.id === 'a1' || a.id === 'a2')) {
          window.localStorage.removeItem('realtime-timetable.studentAnnouncements');
          return INITIAL;
        }
        return parsed;
      }
    } catch (e) { }
    return INITIAL;
  });

  // Sync to local storage on change
  useEffect(() => {
    window.localStorage.setItem('realtime-timetable.studentAnnouncements', JSON.stringify(announcements));
  }, [announcements]);

  // Listen for changes from Admin tab
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

  const [filter, setFilter] = useState<FilterKind>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const unreadCount = announcements.filter(a => !a.read).length;

  const filtered = announcements.filter(
    a => filter === 'all' || a.kind === filter
  );

  function markRead(id: string) {
    setAnnouncements(prev =>
      prev.map(a => a.id === id ? { ...a, read: true } : a)
    );
  }

  function markAllRead() {
    setAnnouncements(prev => prev.map(a => ({ ...a, read: true })));
  }

  function toggleExpand(id: string) {
    setExpanded(v => (v === id ? null : id));
    markRead(id);
  }

  return (
    <div className="min-h-full bg-background">

      {/* Header */}
      <div className="border-b border-border px-8 py-5 bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-500" />
              Announcements
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Updates from your faculty and admin
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span
                className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 ring-1 ring-red-500/20"
              >
                {unreadCount} unread
              </span>
            )}
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent/30 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map(f => {
            const count = f.key === 'all'
              ? announcements.length
              : announcements.filter(a => a.kind === f.key).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  background: active ? 'rgba(16,185,129,0.1)' : 'transparent',
                  color: active ? '#10b981' : 'var(--muted-foreground)',
                  border: `1px solid ${active ? 'rgba(16,185,129,0.25)' : 'transparent'}`,
                }}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className="text-[10px] px-1 py-0.5 rounded min-w-[18px] text-center"
                    style={{
                      background: active ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                      color: active ? '#10b981' : 'var(--muted-foreground)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Bell className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">No announcements in this category.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((ann, i) => {
                const m = KIND_META[ann.kind];
                const isExpanded = expanded === ann.id;
                return (
                  <motion.div
                    key={ann.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-md border overflow-hidden transition-all"
                    style={{
                      background: ann.read ? 'var(--surface-4)' : m.bg,
                      borderColor: ann.read ? 'var(--surface-border)' : m.border,
                    }}
                  >
                    {/* Row */}
                    <button
                      className="w-full flex items-start gap-4 px-4 py-4 text-left"
                      onClick={() => toggleExpand(ann.id)}
                    >
                      {/* Kind icon */}
                      <div className="mt-0.5 shrink-0" style={{ color: m.color }}>
                        {kindIcon(ann.kind)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!ann.read && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: m.color }}
                            />
                          )}
                          <span className="text-sm font-medium">{ann.title}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
                          >
                            {m.label}
                          </span>
                          {ann.affectsYou && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-red-500/10 text-red-500"
                            >
                              Affects you
                            </span>
                          )}
                        </div>
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {ann.detail}
                          </p>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{relativeTime(ann.time)}</span>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded body */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                            <p className="text-sm text-muted-foreground leading-relaxed pt-3">
                              {ann.detail}
                            </p>
                            {(ann.affectedSubject || ann.affectedFaculty) && (
                              <div className="flex items-center gap-3 flex-wrap">
                                {ann.affectedSubject && (
                                  <span
                                    className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20"
                                  >
                                    Subject: {ann.affectedSubject}
                                  </span>
                                )}
                                {ann.affectedFaculty && (
                                  <span
                                    className="text-xs px-2 py-1 rounded-lg bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20"
                                  >
                                    Faculty: {ann.affectedFaculty}
                                  </span>
                                )}
                              </div>
                            )}
                            {ann.suggestion && (
                              <div
                                className="flex items-start gap-2 p-3 rounded-lg text-xs bg-emerald-500/10 ring-1 ring-emerald-500/20"
                              >
                                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
                                <span className="text-muted-foreground">{ann.suggestion}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}



