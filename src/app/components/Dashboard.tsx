import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../hooks/useWorkspaceStore';
import {
  Plus, Radio, ExternalLink, Users, Calendar, TrendingUp,
  Search, Filter, ChevronDown, ChevronUp, Check, X,
  Clock, BookOpen, Shield, AlertTriangle,
  Pencil, UserPlus, Download, Lock, Unlock, Info, ArrowRight, Tag, Bell,
} from 'lucide-react';
import { Link } from 'react-router';
// mockData is no longer used directly — all data comes from workspace localStorage
import { WelcomeBanner } from './WelcomeBanner';
import { Faculty, DayAvailability } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getRoleLabel } from '../auth/session';
import { useSession } from '../auth/SessionContext';

const DAYS_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const DEFAULT_PROFESSOR_TAGS = ['Core', 'Lab', 'Adjunct', 'Visiting'];
const FACULTY_REGISTRY_STORAGE_KEY = 'chronolink.admin.faculty-registry.v2';
const FACULTY_TAGS_STORAGE_KEY = 'chronolink.admin.professor-tags.v1';

function createDefaultAvailability(): Record<string, DayAvailability> {
  return DAYS_FULL.reduce((acc, day) => {
    acc[day] = {
      available: true,
      from: '09:00',
      to: '17:00',
      lockedByAdmin: false,
    };
    return acc;
  }, {} as Record<string, DayAvailability>);
}

function normalizeFacultyRecord(faculty: Faculty): Faculty {
  const baseAvailability = faculty.preferences?.availability ?? {};
  const normalizedAvailability = DAYS_FULL.reduce((acc, day) => {
    const dayValue = baseAvailability[day];
    acc[day] = dayValue
      ? { ...dayValue }
      : {
          available: true,
          from: '09:00',
          to: '17:00',
          lockedByAdmin: false,
        };
    return acc;
  }, {} as Record<string, DayAvailability>);

  return {
    ...faculty,
    tags: faculty.tags ?? [],
    preferences: {
      availability: normalizedAvailability,
      maxClassesPerDay: faculty.preferences?.maxClassesPerDay ?? 4,
      maxConsecutiveHours: faculty.preferences?.maxConsecutiveHours ?? 3,
      notes: faculty.preferences?.notes,
    },
  };
}

/* ─── helpers ─────────────────────────────────────────────── */

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Computer Science': { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
  'Mathematics':      { bg: 'rgba(139,92,246,0.1)',  text: '#8b5cf6', border: 'rgba(139,92,246,0.25)' },
  'Physics':          { bg: 'rgba(20,184,166,0.1)',  text: '#14b8a6', border: 'rgba(20,184,166,0.25)' },
  'English':          { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  'Biology':          { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', border: 'rgba(16,185,129,0.25)' },
};
function deptChip(dept: string) {
  const c = DEPT_COLORS[dept] ?? { bg: 'rgba(100,100,100,0.1)', text: 'var(--muted-foreground)', border: 'rgba(100,100,100,0.2)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {dept}
    </span>
  );
}

function workloadBadge(intensity?: string) {
  if (intensity === 'high')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-500 ring-1 ring-red-500/20"><span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#ef4444]" />High</span>;
  if (intensity === 'medium')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />Medium</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />Low</span>;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
const PALETTE = ['#3b82f6','#8b5cf6','#14b8a6','#f59e0b','#10b981','#ef4444','#6366f1','#ec4899'];
function avatarColor(id: string) { return PALETTE[parseInt(id) % PALETTE.length]; }

function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function durationHrs(from: string, to: string) {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return ((th * 60 + tm) - (fh * 60 + fm)) / 60;
}

/* ─── Admin availability row ────────────────────────────── */

interface AdminDayRowProps {
  day: string;
  data: DayAvailability;
  onToggleLock: () => void;
  onSetNote: (note: string) => void;
}

function AdminDayRow({ day, data, onToggleLock, onSetNote }: AdminDayRowProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteVal, setNoteVal] = useState(data.adminNote ?? '');
  const dur = data.available ? durationHrs(data.from, data.to) : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors"
      style={{
        background: data.lockedByAdmin ? 'rgba(139,92,246,0.08)' : 'var(--surface-3)',
        border: `1px solid ${data.lockedByAdmin ? 'rgba(139,92,246,0.2)' : 'var(--surface-border)'}`,
      }}>
      {/* Day */}
      <span className="text-xs font-medium w-7 shrink-0 text-muted-foreground">{day.slice(0,3)}</span>

      {/* Available indicator */}
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${data.available ? 'bg-[#10b981]' : 'bg-[var(--muted-foreground)]'}`} />

      {/* Time window */}
      <div className="flex-1 text-xs">
        {data.available ? (
          <span className="text-foreground">{fmt12(data.from)} → {fmt12(data.to)}
            <span className="ml-1.5 text-muted-foreground">({dur}h)</span>
          </span>
        ) : (
          <span className="text-muted-foreground italic">Unavailable</span>
        )}
      </div>

      {/* Admin note (inline edit) */}
      {editingNote ? (
        <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
          <input
            autoFocus
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            onBlur={() => { setEditingNote(false); onSetNote(noteVal); }}
            onKeyDown={e => { if (e.key === 'Enter') { setEditingNote(false); onSetNote(noteVal); } }}
            className="flex-1 px-2 py-1 text-xs rounded-lg bg-input border border-border focus:outline-none"
            placeholder="Add admin note…"
          />
        </div>
      ) : (
        <button
          onClick={() => setEditingNote(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[140px] truncate text-left"
          title={data.adminNote || 'Add note'}>
          {data.adminNote
            ? <span className="italic opacity-70">"{data.adminNote}"</span>
            : <span className="opacity-30">+ note</span>}
        </button>
      )}

      {/* Lock toggle */}
      <button
        onClick={onToggleLock}
        title={data.lockedByAdmin ? 'Remove hard constraint' : 'Set as hard constraint'}
        className="p-1.5 rounded-lg transition-all shrink-0 hover:scale-110"
        style={{
          background: data.lockedByAdmin ? 'rgba(139,92,246,0.15)' : 'transparent',
          color:      data.lockedByAdmin ? '#8b5cf6' : 'var(--muted-foreground)',
          border:     `1px solid ${data.lockedByAdmin ? 'rgba(139,92,246,0.3)' : 'var(--surface-border)'}`,
        }}>
        {data.lockedByAdmin
          ? <Lock className="h-3 w-3" />
          : <Unlock className="h-3 w-3" />}
      </button>
    </div>
  );
}

/* ─── Expandable faculty row ─────────────────────────────── */

function FacultyRow({
  f,
  last,
  availableTags,
  onToggleTag,
}: {
  f: Faculty;
  last: boolean;
  availableTags: string[];
  onToggleTag: (facultyId: string, tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const p = f.preferences;
  const lockedDays = DAYS_FULL.filter(d => p?.availability?.[d]?.lockedByAdmin);

  // Local availability state for admin edits (demo-only, not persisted)
  const [avail, setAvail] = useState<Record<string, DayAvailability>>(
    p?.availability ?? {}
  );

  function toggleLock(day: string) {
    setAvail(prev => ({
      ...prev,
      [day]: { ...prev[day], lockedByAdmin: !prev[day].lockedByAdmin },
    }));
    toast.success(`${day} ${avail[day]?.lockedByAdmin ? 'unlocked' : 'locked as hard constraint'}`, {
      description: `Change applied to ${f.name.split(' ').slice(-1)[0]}'s schedule.`,
    });
  }

  function setNote(day: string, note: string) {
    setAvail(prev => ({ ...prev, [day]: { ...prev[day], adminNote: note } }));
  }

  const availDays = DAYS_FULL.filter(d => avail[d]?.available);

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-accent/20 ${!last ? 'border-b border-border' : ''} ${open ? 'bg-accent/10' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {/* Name */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white shrink-0"
              style={{ background: avatarColor(f.id) }}>
              {initials(f.name)}
            </div>
            <div>
              <div className="font-medium text-sm leading-tight">{f.name}</div>
              <div className="text-xs text-muted-foreground">{f.email}</div>
            </div>
          </div>
        </td>

        {/* Dept */}
        <td className="px-5 py-3.5">{deptChip(f.department)}</td>

        {/* Subjects */}
        <td className="px-5 py-3.5">
          <div className="flex flex-wrap gap-1">
            {f.subjects.slice(0, 2).map(s => (
              <span key={s} className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">{s}</span>
            ))}
            {f.subjects.length > 2 && (
              <span className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">+{f.subjects.length - 2}</span>
            )}
          </div>
          {(f.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(f.tags ?? []).map(tag => (
                <span
                  key={`${f.id}-${tag}`}
                  className="px-2 py-0.5 rounded text-[10px]"
                  style={{
                    background: 'rgba(59,130,246,0.08)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </td>

        {/* Available days */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1">
            {DAYS_FULL.map(day => {
              const a = avail[day];
              const locked = a?.lockedByAdmin;
              return (
                <div key={day}
                  className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-medium"
                  style={{
                    background: !a?.available ? '#111' : locked ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.15)',
                    color:      !a?.available ? 'var(--muted-foreground)'  : locked ? '#8b5cf6' : '#3b82f6',
                    border: `1px solid ${!a?.available ? 'var(--surface-border)' : locked ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  }}>
                  {day[0]}
                </div>
              );
            })}
          </div>
        </td>

        {/* Max/day */}
        <td className="px-5 py-3.5 text-sm text-center">
          <span className="font-medium">{p?.maxClassesPerDay ?? '—'}</span>
          <span className="text-muted-foreground text-xs">/day</span>
        </td>

        {/* Weekly hrs */}
        <td className="px-5 py-3.5 text-sm text-center">
          <span className="font-medium">{f.totalWeeklyHours ?? '—'}</span>
          <span className="text-muted-foreground text-xs">h</span>
        </td>

        {/* Workload */}
        <td className="px-5 py-3.5">{workloadBadge(f.workloadIntensity)}</td>

        {/* Status */}
        <td className="px-5 py-3.5">
          {f.isAbsent ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
              <X className="h-3 w-3" />Absent
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
              <Check className="h-3 w-3" />Active
            </span>
          )}
        </td>

        {/* Expand */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              onClick={e => e.stopPropagation()}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <span className="text-muted-foreground">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </div>
        </td>
      </tr>

      {/* ── Expanded row ── */}
      <AnimatePresence>
        {open && (
          <tr key={`${f.id}-exp`}>
            <td colSpan={9} className="px-0 pb-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="px-5 py-5 space-y-5 bg-card border-b border-border">

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Availability grid ── */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-medium flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          Weekly Availability Windows
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Lock className="h-2.5 w-2.5 text-violet-500" />Hard constraint
                          <Unlock className="h-2.5 w-2.5" />Soft preference
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {DAYS_FULL.map(day => (
                          <AdminDayRow
                            key={day}
                            day={day}
                            data={avail[day] ?? { available: false, from: '09:00', to: '17:00', lockedByAdmin: false }}
                            onToggleLock={() => toggleLock(day)}
                            onSetNote={note => setNote(day, note)}
                          />
                        ))}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <Info className="h-3 w-3" />
                        Click the lock icon to toggle hard constraints. Click a note to edit it.
                      </div>
                    </div>

                    {/* ── Summary + notes ── */}
                    <div className="space-y-4">

                      {/* Availability summary visual */}
                      <div>
                        <div className="text-xs font-medium mb-3 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />Availability Summary
                        </div>
                        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
                          {DAYS_FULL.map(day => {
                            const a = avail[day];
                            const locked = a?.lockedByAdmin;
                            return (
                              <div key={day} className="rounded-lg p-2 text-center"
                                style={{
                                  background: !a?.available ? 'var(--surface-3)' : locked ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)',
                                  border: `1px solid ${!a?.available ? 'var(--surface-border)' : locked ? 'rgba(139,92,246,0.25)' : 'rgba(59,130,246,0.2)'}`,
                                }}>
                                <div className="text-[10px] text-muted-foreground mb-1">{day.slice(0,3)}</div>
                                {a?.available ? (
                                  <>
                                    <div className="text-[10px] font-medium" style={{ color: locked ? '#8b5cf6' : '#3b82f6' }}>
                                      {a.from.slice(0,5)}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground">↓</div>
                                    <div className="text-[10px] font-medium" style={{ color: locked ? '#8b5cf6' : '#3b82f6' }}>
                                      {a.to.slice(0,5)}
                                    </div>
                                    {locked && <Lock className="h-2.5 w-2.5 mx-auto mt-1 text-violet-500" />}
                                  </>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground mt-1">Off</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Load limits */}
                      <div>
                        <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />Load Limits
                        </div>
                        <div className="flex gap-3">
                          {[
                            { label: 'Max/day',     value: p?.maxClassesPerDay     },
                            { label: 'Max consec.', value: p?.maxConsecutiveHours ? `${p.maxConsecutiveHours}h` : '—' },
                          ].map(s => (
                            <div key={s.label} className="flex-1 rounded-lg px-3 py-2 text-center bg-card border border-border">
                              <div className="text-sm font-semibold">{s.value ?? '—'}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                            </div>
                          ))}
                          <div className="flex-1 rounded-lg px-3 py-2 text-center bg-card border border-border">
                            <div className="text-sm font-semibold">{availDays.length}/5</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Avail. days</div>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />Professor Tags
                        </div>
                        {availableTags.length === 0 ? (
                          <div className="text-xs text-muted-foreground">
                            No tags available yet. Add tags from the toolbar to start assigning.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {availableTags.map(tag => {
                              const assigned = (f.tags ?? []).includes(tag);
                              return (
                                <button
                                  key={`${f.id}-toggle-${tag}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleTag(f.id, tag);
                                  }}
                                  className="px-2 py-1 rounded-md text-[11px] transition-colors"
                                  style={{
                                    background: assigned ? 'rgba(59,130,246,0.16)' : 'var(--surface-3)',
                                    color: assigned ? '#3b82f6' : 'var(--muted-foreground)',
                                    border: `1px solid ${assigned ? 'rgba(59,130,246,0.26)' : 'var(--surface-border)'}`,
                                  }}
                                >
                                  #{tag}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {(p?.notes || f.phone || f.joinedDate) && (
                        <div>
                          <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />Notes & Info
                          </div>
                          <div className="space-y-1.5 text-xs text-muted-foreground">
                            {p?.notes && <p className="italic">"{p.notes}"</p>}
                            {f.phone     && <p>📞 {f.phone}</p>}
                            {f.joinedDate && <p>🗓 Joined {f.joinedDate}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Faculty tab ─────────────────────────────────────────── */

function FacultyTab() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [showTagManager, setShowTagManager] = useState(false);
  const [addFacultyOpen, setAddFacultyOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');
  const [newFacultyTags, setNewFacultyTags] = useState<string[]>([]);
  const { teachers: workspaceTeachers, facultyAbsences = [] } = useWorkspaceStore();
  const [facultyRegistry, setFacultyRegistry] = useState<Faculty[]>(() => {
    // Seed from the workspace store (already reads localStorage at init)
    if (workspaceTeachers.length > 0) return workspaceTeachers.map(normalizeFacultyRecord);
    // Fall back to dashboard-specific registry key
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(FACULTY_REGISTRY_STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored) as Faculty[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeFacultyRecord);
      }
    } catch { /* */ }
    return [];
  });
  const [availableTags, setAvailableTags] = useState<string[]>(DEFAULT_PROFESSOR_TAGS);

  // Re-seed faculty when workspace data changes (import events)
  useEffect(() => {
    if (workspaceTeachers.length > 0) {
      setFacultyRegistry(prev => {
        const existingEmails = new Set(prev.map(f => f.email.toLowerCase()));
        const toAdd = workspaceTeachers
          .filter(t => !existingEmails.has((t.email ?? '').toLowerCase()))
          .map(normalizeFacultyRecord);
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceTeachers]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(FACULTY_REGISTRY_STORAGE_KEY, JSON.stringify(facultyRegistry));
  }, [facultyRegistry]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(FACULTY_TAGS_STORAGE_KEY, JSON.stringify(availableTags));
  }, [availableTags]);

  const departments = ['All', ...Array.from(new Set(facultyRegistry.map(f => f.department))).sort()];

  const filtered = facultyRegistry.filter(f => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q) ||
      f.subjects.some(s => s.toLowerCase().includes(q)) ||
      (f.tags ?? []).some(tag => tag.toLowerCase().includes(q));
    const matchDept = deptFilter === 'All' || f.department === deptFilter;
    return matchSearch && matchDept;
  });

  const absentCount = facultyRegistry.filter(f => f.isAbsent).length;
  const overloadedCount = facultyRegistry.filter(f => f.workloadIntensity === 'high').length;

  function toggleFacultyTag(facultyId: string, tag: string) {
    setFacultyRegistry(prev =>
      prev.map(faculty => {
        if (faculty.id !== facultyId) {
          return faculty;
        }

        const currentTags = faculty.tags ?? [];
        const hasTag = currentTags.includes(tag);
        return {
          ...faculty,
          tags: hasTag
            ? currentTags.filter(value => value !== tag)
            : [...currentTags, tag],
        };
      })
    );
  }

  function addAvailableTag() {
    const cleanTag = tagDraft.trim().replace(/\s+/g, ' ');
    if (!cleanTag) {
      return;
    }

    const exists = availableTags.some(tag => tag.toLowerCase() === cleanTag.toLowerCase());
    if (exists) {
      toast.error('Tag already exists', { description: `"${cleanTag}" is already available.` });
      return;
    }

    setAvailableTags(prev => [...prev, cleanTag]);
    setTagDraft('');
    toast.success('Tag added', { description: `"${cleanTag}" is now available for assignment.` });
  }

  function removeAvailableTag(tagToRemove: string) {
    setAvailableTags(prev => prev.filter(tag => tag !== tagToRemove));
    setNewFacultyTags(prev => prev.filter(tag => tag !== tagToRemove));
    setFacultyRegistry(prev =>
      prev.map(faculty => ({
        ...faculty,
        tags: (faculty.tags ?? []).filter(tag => tag !== tagToRemove),
      }))
    );
    toast.success('Tag removed', { description: `"${tagToRemove}" was removed from all professors.` });
  }

  function toggleDraftTag(tag: string) {
    setNewFacultyTags(prev =>
      prev.includes(tag)
        ? prev.filter(value => value !== tag)
        : [...prev, tag]
    );
  }

  function resetAddFacultyForm() {
    setNewFacultyName('');
    setNewFacultyEmail('');
    setNewFacultyTags([]);
  }

  function closeAddFacultyModal() {
    setAddFacultyOpen(false);
    resetAddFacultyForm();
  }

  function addFacultyFromForm() {
    const cleanName = newFacultyName.trim();
    const cleanEmail = newFacultyEmail.trim().toLowerCase();

    if (!cleanName) {
      toast.error('Name is required', { description: 'Enter a professor name to continue.' });
      return;
    }

    if (!cleanEmail) {
      toast.error('Email is required', { description: 'Enter a valid email address to continue.' });
      return;
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!isValidEmail) {
      toast.error('Invalid email', { description: 'Enter a valid email like name@university.edu.' });
      return;
    }

    const duplicate = facultyRegistry.some(faculty => faculty.email.toLowerCase() === cleanEmail);
    if (duplicate) {
      toast.error('Email already exists', { description: 'A professor with this email is already in the registry.' });
      return;
    }

    const newFacultyId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `f-${Date.now()}`;

    const newFaculty = normalizeFacultyRecord({
      id: newFacultyId,
      name: cleanName,
      email: cleanEmail,
      tags: [...newFacultyTags],
      department: 'Unassigned',
      subjects: [],
      isAbsent: false,
      totalWeeklyHours: 0,
      workloadIntensity: 'low',
      preferences: {
        availability: createDefaultAvailability(),
        maxClassesPerDay: 4,
        maxConsecutiveHours: 3,
      },
    });

    setFacultyRegistry(prev => [newFaculty, ...prev]);
    closeAddFacultyModal();
    toast.success('Faculty added', { description: `${cleanName} was added with email ${cleanEmail}.` });
  }

  return (
    <div>
      {/* Notifications / Alerts */}
      {facultyAbsences.some(a => a.status === 'pending') && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
          <Bell className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-500 mb-1">Pending Leave Requests</h3>
            <p className="text-sm text-muted-foreground">
              {facultyAbsences.filter(a => a.status === 'pending').length} faculty member(s) have requested leave. Go to the Workspace Notifications panel to review and apply constraints.
            </p>
          </div>
          <Link to="/workspace" className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap">
            Review in Workspace
          </Link>
        </div>
      )}

      {/* Quick stats 
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Faculty', value: facultyRegistry.length, icon: <Users className="h-4 w-4" />, color: '#3b82f6' },
          { label: 'Active Today',  value: facultyRegistry.length - absentCount, icon: <Check className="h-4 w-4" />, color: '#10b981' },
          { label: 'Absent Today',  value: absentCount,    icon: <X   className="h-4 w-4" />, color: '#ef4444' },
          { label: 'Overloaded',    value: overloadedCount, icon: <AlertTriangle className="h-4 w-4" />, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-md p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${s.color}18`, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="text-xl font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      */}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or subject…"
            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background:  deptFilter === d ? 'var(--accent-blue)' : 'transparent',
                color:       deptFilter === d ? '#fff' : 'var(--muted-foreground)',
                border:      `1px solid ${deptFilter === d ? 'var(--accent-blue)' : 'var(--border)'}`,
              }}>
              {d}
            </button>
          ))}
        </div>
        <button className="ml-auto flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
          <Download className="h-4 w-4" />Export
        </button>
        <button
          onClick={() => setShowTagManager(prev => !prev)}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Tag className="h-4 w-4" />{showTagManager ? 'Hide Tags' : 'Manage Tags'}
        </button>
        <button
          onClick={() => setAddFacultyOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          <UserPlus className="h-4 w-4" />Add Faculty
        </button>
      </div>

      {showTagManager && (
        <div className="bg-card border border-border rounded-md p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-[var(--accent-blue)]" />
            <h3 className="text-sm font-medium">Professor Tags</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addAvailableTag();
                }
              }}
              placeholder="Create a new tag (e.g. Mentor, First-Year)"
              className="flex-1 min-w-[240px] px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30"
            />
            <button
              onClick={addAvailableTag}
              className="px-3 py-2 rounded-lg text-sm bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
            >
              Add Tag
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTags.length === 0 ? (
              <span className="text-xs text-muted-foreground">No tags yet.</span>
            ) : (
              availableTags.map(tag => (
                <span
                  key={`available-${tag}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--surface-border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  #{tag}
                  <button
                    onClick={() => removeAvailableTag(tag)}
                    className="text-muted-foreground hover:text-[var(--status-red)] transition-colors"
                    title={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-card border-b border-border">
                {['Faculty Member','Department','Subjects','Availability','Max/Day','Weekly hrs','Workload','Status',''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-muted-foreground">No faculty match your filters.</td></tr>
              ) : (
                filtered.map((f, i) => (
                  <FacultyRow
                    key={f.id}
                    f={f}
                    last={i === filtered.length - 1}
                    availableTags={availableTags}
                    onToggleTag={toggleFacultyTag}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 flex items-center justify-between border-t border-border">
          <span className="text-xs text-muted-foreground">{filtered.length} of {facultyRegistry.length} faculty</span>
          <span className="text-xs text-muted-foreground">Click any row to expand availability & manage hard constraints</span>
        </div>
      </div>

      <AnimatePresence>
        {addFacultyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeAddFacultyModal();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-lg rounded-lg border border-border p-5 space-y-4"
              style={{ background: 'var(--card)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Add Faculty</h3>
                  <p className="text-sm text-muted-foreground mt-1">Create a professor profile using name and email.</p>
                </div>
                <button
                  onClick={closeAddFacultyModal}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                  <input
                    value={newFacultyName}
                    onChange={(event) => setNewFacultyName(event.target.value)}
                    placeholder="Dr. Jane Smith"
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <input
                    value={newFacultyEmail}
                    onChange={(event) => setNewFacultyEmail(event.target.value)}
                    placeholder="jane.smith@university.edu"
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Assign Tags</label>
                  {availableTags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No tags available. Add tags from the faculty toolbar first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map(tag => {
                        const selected = newFacultyTags.includes(tag);
                        return (
                          <button
                            key={`draft-tag-${tag}`}
                            onClick={() => toggleDraftTag(tag)}
                            className="px-2.5 py-1 rounded-md text-xs transition-colors"
                            style={{
                              background: selected ? 'rgba(59,130,246,0.16)' : 'var(--surface-3)',
                              color: selected ? '#3b82f6' : 'var(--muted-foreground)',
                              border: `1px solid ${selected ? 'rgba(59,130,246,0.28)' : 'var(--surface-border)'}`,
                            }}
                          >
                            #{tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={closeAddFacultyModal}
                  className="px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addFacultyFromForm}
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
                >
                  Add Faculty
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Overview tab ────────────────────────────────────────── */

function OverviewTab() {
  const { groups } = useWorkspaceStore();
  const liveGroups    = groups.filter((g) => g.isLive).length;
  const totalStudents = groups.reduce((sum, g) => sum + (g.studentsCount ?? 0), 0);

  return (
    <div>
      <WelcomeBanner />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {[
          { label: 'Live Timetables', value: liveGroups,    icon: <Radio      className="w-6 h-6" />, color: 'var(--status-green)'  },
          { label: 'Total Students',  value: totalStudents, icon: <Users      className="w-6 h-6" />, color: 'var(--accent-blue)'   },
          { label: 'Active Groups',   value: groups.length, icon: <Calendar   className="w-6 h-6" />, color: 'var(--accent-purple)' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-md p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: `${s.color}1a`, color: s.color }}>{s.icon}</div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="bg-card border border-border rounded-md">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Groups</h2>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-blue)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" />New Group
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  {['Group','Course','Semester','Students','Status','Actions'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-sm text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group, index) => (
                  <tr key={group.id} className={`hover:bg-accent/10 transition-colors ${index !== groups.length - 1 ? 'border-b border-border' : ''}`}>
                    <td className="px-6 py-4 font-medium">{group.name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{group.course}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">Sem {group.semester}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{group.studentsCount}</td>
                    <td className="px-6 py-4">
                      {group.isLive ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                          style={{ backgroundColor: 'var(--status-green)', color: 'white' }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Live
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">Draft</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link to="/workspace"
                          className="inline-flex items-center gap-1 text-sm text-[var(--accent-blue)] hover:underline">
                          Open <ArrowRight className="w-3 h-3" />
                        </Link>
                        {group.isLive && group.liveLink && (
                          <a href={`/live/${group.liveLink}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-[var(--status-green)] hover:underline">
                            Live <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-md p-6">
          <h3 className="font-semibold mb-4">Recent Changes</h3>
          <div className="space-y-3">
            {[
              { action: 'CS-A-2024 went live',         time: '2 hours ago', type: 'success' },
              { action: 'Faculty absence marked',       time: '5 hours ago', type: 'warning' },
              { action: 'New constraint added',         time: '1 day ago',   type: 'info' },
              { action: 'EE-A-2024 timetable updated',  time: '2 days ago',  type: 'info' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  item.type === 'success' ? 'bg-[var(--status-green)]' :
                  item.type === 'warning' ? 'bg-[var(--status-orange)]' : 'bg-[var(--accent-blue)]'
                }`} />
                <div className="flex-1">
                  <p>{item.action}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 
        <div className="bg-card border border-border rounded-md p-6">
          <h3 className="font-semibold mb-4">Quick Stats</h3>
          <div className="space-y-4">
            {[
              { label: 'Optimization Score',       value: '82%', bar: 82, color: 'var(--status-green)'  },
              { label: 'Constraint Satisfaction',   value: '75%', bar: 75, color: 'var(--status-orange)' },
              { label: 'Workload Balance',          value: '88%', bar: 88, color: 'var(--status-green)'  },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground w-44 shrink-0">{s.label}</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.bar}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="text-sm font-medium w-10 text-right">{s.value}</span>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Conflicts</span>
              <span className="font-medium" style={{ color: 'var(--status-orange)' }}>2</span>
            </div>
          </div>
        </div>
        */}
      </div>
    </div>
  );
}

/* ─── Root ────────────────────────────────────────────────── */

type Tab = 'overview' | 'faculty';

export function Dashboard() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('overview');
  const roleLabel = getRoleLabel(user.role);
  const titlePrefix = user.role === 'developer' ? 'Developer' : getRoleLabel(user.role);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview',        icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'faculty',  label: 'Faculty Registry', icon: <Users      className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-full bg-background">
      <div className="border-b border-border bg-card">
        <div className="px-8 pt-6 pb-0">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-2xl font-semibold">{titlePrefix} Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Institution-wide overview and faculty management</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-blue-500">{roleLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-all"
                style={{
                  borderColor: tab === t.id ? 'var(--accent-blue)' : 'transparent',
                  color:       tab === t.id ? 'var(--accent-blue)' : 'var(--muted-foreground)',
                  fontWeight:  tab === t.id ? 500 : 400,
                }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}>
            {tab === 'overview' ? <OverviewTab /> : <FacultyTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}


