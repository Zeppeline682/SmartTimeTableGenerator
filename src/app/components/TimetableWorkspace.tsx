import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Save, Play, Download, Upload, ChevronDown, Search,
  Link2, Copy, Check, X, FileJson, FileSpreadsheet,
  Radio, Users, GitBranch, RotateCcw, GripVertical,
  AlertTriangle, DoorOpen, BookOpen, ZoomIn, ZoomOut, Layout, Bell, Trash2, Plus,
} from 'lucide-react';
import { ConstraintBuilder } from './ConstraintBuilder';
import { ClassConfigPanel } from './ClassConfigPanel';
import { ClassManagerPanel } from './ClassManagerPanel';
import { BulkDataImporter } from './BulkDataImporter';
import { SecurityFailureModal, type SecurityFailureDetails } from './SecurityFailureModal';
import { mockTimeSlots, mockGroups, mockFaculty, mockRooms, mockSubjects, mockGroupFaculty, mockClassConfigs } from '../mockData';
import { v4 as uuidv4 } from 'uuid';
import {
  TimetableGrid,
  dayIndexToName,
  dayNameToIndex,
  slotDuration, canDropAt, newEndTime,
  slotIndexToEndTimeLabel,
  slotIndexToTimeLabel,
  timeLabelToSlotIndex,
  type DndState,
} from './TimetableGrid';
import { ConstraintCreateDTO, TimeSlot, Faculty, Room, Group, Subject, ClassConfig, ClassSubjectRow, GroupFacultyAssignment, SessionBlueprintDTO, SolveApiResponse } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const WORKSPACE_STORAGE_KEY = 'realtime-timetable.workspace.v2';

type WorkspaceMode = 'workbench' | 'live';

interface TimeBlockWindow {
  id: string;
  name: string;
  enabled: boolean;
  startTime: string;
  durationMinutes: number;
  reason?: string;
}

interface WorkspacePersistedState {
  teachers: Faculty[];
  rooms: Room[];
  groups: Group[];
  subjects: Subject[];
  classConfigs: ClassConfig[];
  groupFaculty: GroupFacultyAssignment[];
  slots: TimeSlot[];
  activeGroupId: string;
  liveGroupId: string | null;
  workspaceMode: WorkspaceMode;
  rightPanelTab: 'constraints' | 'classes' | 'errors';
  periodDurationMinutes: number;
  dayStartTime: string;
  schoolEndTime: string;
  breakWindows: TimeBlockWindow[];
  solverConstraints?: any[];
  facultyAbsences?: any[];
}

function minutesFromTimeLabel(value: string): number {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return 0;
  }
  return h * 60 + m;
}

function normalizeSchoolWindow(startTime: string, endTime: string): { start: string; end: string } {
  const start = minutesFromTimeLabel(startTime);
  const end = minutesFromTimeLabel(endTime);
  if (end <= start) {
    return { start: startTime, end: '18:00' };
  }
  return { start: startTime, end: endTime };
}

function safeParsePersistedState(raw: string | null): WorkspacePersistedState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspacePersistedState>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    // Accept any object that has at least one of: groups, teachers, or rooms.
    // A completely empty object returns null so we don't override the empty-state UX.
    const hasAnyData =
      (Array.isArray(parsed.groups) && parsed.groups.length > 0) ||
      (Array.isArray(parsed.teachers) && parsed.teachers.length > 0) ||
      (Array.isArray(parsed.rooms) && parsed.rooms.length > 0) ||
      (Array.isArray(parsed.slots) && parsed.slots.length > 0);
    if (!hasAnyData) {
      return null;
    }

    const groups = Array.isArray(parsed.groups) ? parsed.groups : [];
    const fallbackGroupId = parsed.activeGroupId ?? groups[0]?.id ?? '';
    const normalizedWindow = normalizeSchoolWindow(parsed.dayStartTime ?? '09:00', parsed.schoolEndTime ?? '18:00');

    return {
      teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      groups,
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      classConfigs: Array.isArray(parsed.classConfigs) ? parsed.classConfigs : [],
      groupFaculty: Array.isArray(parsed.groupFaculty) ? parsed.groupFaculty : [],
      slots: Array.isArray(parsed.slots) ? parsed.slots : [],
      activeGroupId: fallbackGroupId,
      liveGroupId: typeof parsed.liveGroupId === 'string' ? parsed.liveGroupId : null,
      workspaceMode: parsed.workspaceMode === 'live' ? 'live' : 'workbench',
      rightPanelTab:
        parsed.rightPanelTab === 'classes'
          ? 'classes'
          : parsed.rightPanelTab === 'errors'
            ? 'errors'
            : 'constraints',
      periodDurationMinutes: typeof parsed.periodDurationMinutes === 'number' ? parsed.periodDurationMinutes : 30,
      dayStartTime: normalizedWindow.start,
      schoolEndTime: normalizedWindow.end,
      breakWindows: Array.isArray(parsed.breakWindows) && parsed.breakWindows.length > 0
        ? parsed.breakWindows.map((w, idx) => ({
          id: `${w.id ?? `block-${idx}`}`,
          name: `${w.name ?? `Block ${idx + 1}`}`,
          enabled: !!w.enabled,
          startTime: `${w.startTime ?? '12:00'}`,
          durationMinutes: typeof w.durationMinutes === 'number' ? w.durationMinutes : 60,
          reason: typeof w.reason === 'string' ? w.reason : '',
        }))
        : [
          { id: 'block-short-break', name: 'Short Break', enabled: true, startTime: '11:00', durationMinutes: 30, reason: '' },
          { id: 'block-lunch', name: 'Lunch Break', enabled: true, startTime: '13:00', durationMinutes: 60, reason: '' },
        ],
      solverConstraints: Array.isArray(parsed.solverConstraints) ? parsed.solverConstraints : [],
      facultyAbsences: Array.isArray(parsed.facultyAbsences) ? parsed.facultyAbsences : [],
    };
  } catch {
    return null;
  }
}


interface BackendScheduledSession {
  id: string;
  day_of_week: number;
  start_slot: number;
  teacher_id: string;
  room_id: string;
  student_group_id: string;
  subject_id: string;
  duration?: number;
}


function isBackendScheduledSession(value: unknown): value is BackendScheduledSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<BackendScheduledSession>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.day_of_week === 'number' &&
    typeof candidate.start_slot === 'number' &&
    typeof candidate.teacher_id === 'string' &&
    (typeof candidate.room_id === 'string' || candidate.room_id === null) &&
    typeof candidate.student_group_id === 'string' &&
    typeof candidate.subject_id === 'string'
  );
}

function shortId(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 8)}...`;
}

function getApiBaseUrl(): string {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!envBase) {
    return 'http://localhost:8000';
  }
  return envBase.replace(/\/$/, '');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deterministicUuid(seed: string): string {
  const source = seed || 'seed';
  const hash32 = (input: string): number => {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const a = hash32(`a:${source}`);
  const b = hash32(`b:${source}`);
  const c = hash32(`c:${source}`);
  const d = hash32(`d:${source}`);
  const hex = [a, b, c, d].map((n) => n.toString(16).padStart(8, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizeUuid(value: string | undefined | null, namespace: string): string {
  const raw = `${value ?? ''}`.trim();
  if (UUID_PATTERN.test(raw)) {
    return raw;
  }
  return deterministicUuid(`${namespace}:${raw}`);
}

/* ─── Helpers ─── */
function getUniqueSubjects(slots: TimeSlot[]): Subject[] {
  const names = Array.from(new Set(slots.map(s => s.subject).filter(Boolean)));
  return names.map(name => ({ id: name!, name: name! }));
}

/* ─── Group selector ─────────────────────────────────────────────── */

function GroupSelector({
  active, groups, onChange,
}: { active: string; groups: Group[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const group = groups.find(g => g.id === active) ?? groups[0] ?? null;

  const groupedAndFiltered = useMemo(() => {
    let filtered = groups;
    if (search.trim()) {
      const lower = search.toLowerCase();
      filtered = groups.filter(g =>
        g.name.toLowerCase().includes(lower) ||
        g.course.toLowerCase().includes(lower) ||
        `sem ${g.semester}`.includes(lower)
      );
    }

    const map = new Map<string, Group[]>();
    filtered.forEach(g => {
      const course = g.course || 'Other';
      if (!map.has(course)) map.set(course, []);
      map.get(course)!.push(g);
    });

    // Sort courses alphabetically, and then sort groups within course by semester
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([course, courseGroups]) => ({
        course,
        items: courseGroups.sort((a, b) => a.semester - b.semester)
      }));
  }, [groups, search]);

  const navigate = useNavigate();

  if (!group) {
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-border text-sm">
        <span className="text-muted-foreground">No classes available.</span>
        <button
          onClick={() => navigate('/classes')}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Class
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
      >
        <span className="font-medium">{group.name}</span>
        <span className="text-muted-foreground">Sem {group.semester}</span>
        {group.isLive && (
          <span
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />Live
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute top-full mt-1 left-0 z-50 w-72 rounded-md border border-border shadow-xl overflow-hidden bg-card flex flex-col"
            >
              {/* Search Bar */}
              <div className="p-2 border-b border-border bg-muted/20">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />

                  <input
                    autoFocus
                    type="text"
                    placeholder="Search classes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {/* Grouped List */}
              <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                {groupedAndFiltered.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No classes found</div>
                ) : (
                  groupedAndFiltered.map(({ course, items }) => (
                    <div key={course} className="pb-1">
                      <div className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 px-3 py-1.5 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {course}
                      </div>
                      <div className="py-1">
                        {items.map(g => (
                          <button
                            key={g.id}
                            onClick={() => { onChange(g.id); setOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left ${g.id === active ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-accent/40'}`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="font-medium truncate text-foreground">{g.name}</div>
                              <div className="text-xs text-muted-foreground truncate">Semester {g.semester}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {g.isLive && <Radio className="h-3.5 w-3.5 text-[#10b981]" />}
                              {g.id === active && <Check className="h-3.5 w-3.5 text-blue-500" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Bottom Actions */}
              <div className="p-2 border-t border-border bg-muted/10">
                <button
                  onClick={() => { navigate('/classes'); setOpen(false); }}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500 hover:text-white rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Manage Classes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Go Live modal ──────────────────────────────────────────────── */

function GoLiveModal({ group, onClose, onConfirm }: {
  group: Group;
  onClose: () => void;
  onConfirm: (slug: string) => void;
}) {
  const [slug, setSlug] = useState(group.liveLink ?? group.name.toLowerCase().replace(/\s+/g, '-'));
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/live/${slug}`;

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-md rounded-lg border border-border p-6 space-y-5 bg-card"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Radio className="h-5 w-5 text-[#10b981]" />Go Live
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Publish <span className="text-foreground font-medium">{group.name}</span>'s timetable.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          {[
            { label: 'No unresolved hard conflicts', ok: true },
            { label: 'All faculty availability respected', ok: true },
            { label: 'Optimization score ≥ 70', ok: true },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-[#10b981]/15' : 'bg-[#ef4444]/15'}`}>
                {item.ok
                  ? <Check className="h-3 w-3 text-[#10b981]" />
                  : <X className="h-3 w-3 text-[#ef4444]" />}
              </div>
              <span className={item.ok ? 'text-foreground' : 'text-[#ef4444]'}>{item.label}</span>
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Public link slug</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">{window.location.origin}/live/</span>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 px-3 py-2 rounded-lg text-xs text-muted-foreground truncate bg-card border border-border">
              {url}
            </div>
            <button onClick={copy} className="p-2 rounded-lg border border-border hover:bg-accent transition-colors">
              {copied ? <Check className="h-4 w-4 text-[#10b981]" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2.5 rounded-lg bg-card border border-border">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span>{group.studentsCount} students in group · link requires no login</span>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(slug)}
            className="flex-1 py-2.5 rounded-md text-sm text-white flex items-center justify-center gap-2 hover:opacity-90"
            style={{ background: '#10b981' }}>
            <Radio className="h-4 w-4" />Publish Live
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddEntityModal({ title, onClose, onConfirm, children }: {
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-sm rounded-lg border border-border p-6 shadow-2xl relative bg-card"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-semibold text-lg mb-4">{title}</h2>
        <div className="space-y-4">
          {children}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-2.5 rounded-md text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-blue)' }}>
              Add Entity
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── IO Panel ───────────────────────────────────────────────────── */

function IOPanel({
  onClose,
  onExportJson,
  onImportJson,
}: {
  onClose: () => void;
  onExportJson: () => void;
  onImportJson: (payload: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      if (!file.name.toLowerCase().endsWith('.json')) {
        toast.error('Only JSON import is supported right now.');
        return;
      }
      const parsed = JSON.parse(text) as unknown;
      onImportJson(parsed);
      toast.success('Import complete', { description: `${file.name} loaded into local workspace.` });
      onClose();
    } catch {
      toast.error('Import failed', { description: 'Could not parse JSON payload.' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        className="w-full max-w-sm rounded-lg border border-border p-6 space-y-4 bg-card"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Import / Export</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Export</p>
          {[
            { label: 'Download as Excel (.xlsx)', icon: <FileSpreadsheet className="h-4 w-4" />, color: '#10b981', fmt: 'xlsx' },
            { label: 'Download as JSON', icon: <FileJson className="h-4 w-4" />, color: '#3b82f6', fmt: 'json' },
          ].map(item => (
            <button key={item.fmt}
              onClick={() => {
                if (item.fmt === 'json') {
                  onExportJson();
                  toast.success('Workspace exported as JSON.');
                } else {
                  toast.info('Excel export is not wired yet. Use JSON export for now.');
                }
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-border text-sm hover:bg-accent/20 transition-colors">
              <span style={{ color: item.color }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Import</p>
          <button onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-dashed border-border text-sm hover:bg-accent/20 transition-colors text-muted-foreground">
            <Upload className="h-4 w-4" />
            {importing ? 'Processing…' : 'Upload Excel or JSON file'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.json" className="hidden" onChange={handleFile} />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Move toast ─────────────────────────────────────────────────── */

function moveToastContent(slot: TimeSlot, day: string, start: string, end: string, conflictNames: string[]) {
  if (conflictNames.length === 0) {
    toast.success(`${slot.subject} moved`, {
      description: `${day} · ${start}–${end}`,
      duration: 3000,
    });
  } else {
    toast.warning(`${slot.subject} moved — conflict flagged`, {
      description: `Overlaps: ${conflictNames.join(', ')} · ${day} ${start}–${end}`,
      duration: 5000,
    });
  }
}

/* ─── Main workspace ─────────────────────────────────────────────── */

export function TimetableWorkspace() {
  const persistedRef = useRef<WorkspacePersistedState | null>(
    typeof window === 'undefined'
      ? null
      : safeParsePersistedState(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)),
  );
  const persisted = persistedRef.current;

  /* ── Metadata State ── */
  const [teachers, setTeachers] = useState<Faculty[]>(persisted?.teachers ?? []);
  const [rooms, setRooms] = useState<Room[]>(persisted?.rooms ?? []);
  const [groups, setGroups] = useState<Group[]>(persisted?.groups ?? []);
  const [subjects, setSubjects] = useState<Subject[]>(persisted?.subjects ?? []);
  const [classConfigs, setClassConfigs] = useState<ClassConfig[]>(persisted?.classConfigs ?? []);
  const [groupFaculty, setGroupFaculty] = useState<GroupFacultyAssignment[]>(persisted?.groupFaculty ?? []);

  const [activeGroupId, setActiveGroupId] = useState(persisted?.activeGroupId ?? '');
  const [liveGroupId, setLiveGroupId] = useState<string | null>(() => {
    if (persisted?.liveGroupId) {
      return persisted.liveGroupId;
    }
    const firstLive = (persisted?.groups ?? []).find((g) => g.isLive);
    return firstLive?.id ?? null;
  });
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(persisted?.workspaceMode ?? 'workbench');
  const [rightPanelTab, setRightPanelTab] = useState<'constraints' | 'classes' | 'errors'>((persisted?.rightPanelTab as any) === 'customization' ? 'constraints' : persisted?.rightPanelTab ?? 'constraints');
  const [zoomScale, setZoomScale] = useState(1);
  const [gridPerspective, setGridPerspective] = useState<'student' | 'faculty' | 'room'>('student');
  const [perspectiveTargetId, setPerspectiveTargetId] = useState<string>('');

  // Sync activeGroupId with URL param
  useEffect(() => {
    if (groupId && groupId !== activeGroupId) {
      const exists = groups.some(g => g.id === groupId);
      if (exists) {
        setActiveGroupId(groupId);
      }
    }
  }, [groupId, groups, activeGroupId]);

  // Update URL when activeGroupId changes manually (via selector)
  const handleGroupChange = (id: string) => {
    setActiveGroupId(id);
    navigate(`/workspace/${id}`);
  };
  const [showGoLive, setShowGoLive] = useState(false);
  const [showIO, setShowIO] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const [solverConstraints, setSolverConstraints] = useState<ConstraintCreateDTO[]>(persisted?.solverConstraints ?? []);
  const [facultyAbsences, setFacultyAbsences] = useState<any[]>(persisted?.facultyAbsences ?? []);

  // Poll for external faculty absence changes from local storage
  useEffect(() => {
    function handleStorageEvent() {
      try {
        const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.facultyAbsences) {
            setFacultyAbsences(parsed.facultyAbsences);
          }
          if (parsed.solverConstraints) {
            setSolverConstraints(parsed.solverConstraints);
          }
        }
      } catch (e) { }
    }
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('chronolink:import', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('chronolink:import', handleStorageEvent);
    };
  }, []);
  const [isSolving, setIsSolving] = useState(false);
  const [conflictingConstraintIds, setConflictingConstraintIds] = useState<string[]>([]);
  const [solverConflictMessages, setSolverConflictMessages] = useState<string[]>([]);
  const hasSolverErrors = conflictingConstraintIds.length > 0 || solverConflictMessages.length > 0;
  const [securityFailure, setSecurityFailure] = useState<SecurityFailureDetails | null>(null);
  const solverAbortRef = useRef<AbortController | null>(null);
  const totalDays = 5;
  const [periodDurationMinutes, setPeriodDurationMinutes] = useState(persisted?.periodDurationMinutes ?? 30);
  const [dayStartTime, setDayStartTime] = useState(persisted?.dayStartTime ?? '09:00');
  const [schoolEndTime, setSchoolEndTime] = useState(persisted?.schoolEndTime ?? '18:00');
  const normalizedSchoolWindow = useMemo(
    () => normalizeSchoolWindow(dayStartTime, schoolEndTime),
    [dayStartTime, schoolEndTime],
  );
  const [breakWindows, setBreakWindows] = useState<TimeBlockWindow[]>(
    persisted?.breakWindows ?? [
      { id: 'block-short-break', name: 'Short Break', enabled: true, startTime: '11:00', durationMinutes: 30, reason: '' },
      { id: 'block-lunch', name: 'Lunch Break', enabled: true, startTime: '13:00', durationMinutes: 60, reason: '' },
    ],
  );

  const { timeline, totalSlotsPerDay, breakSlotIndexes, breakNamesBySlot } = useMemo(() => {
    const blocks: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = [];
    const startMins = minutesFromTimeLabel(normalizedSchoolWindow.start);
    const endMins = minutesFromTimeLabel(normalizedSchoolWindow.end);
    let currentMins = startMins;

    const activeBreaks = breakWindows.filter(b => b.enabled).map(b => ({
      ...b,
      startMins: minutesFromTimeLabel(b.startTime)
    })).sort((a, b) => a.startMins - b.startMins);

    while (currentMins < endMins) {
      const exactBreak = activeBreaks.find(b => b.startMins === currentMins);
      if (exactBreak) {
        blocks.push({
          isBreak: true,
          name: exactBreak.name,
          startMins: currentMins,
          endMins: currentMins + exactBreak.durationMinutes
        });
        currentMins += exactBreak.durationMinutes;
        continue;
      }

      const upcomingBreak = activeBreaks.find(b => b.startMins > currentMins && b.startMins < currentMins + periodDurationMinutes);
      let dur = periodDurationMinutes;
      if (upcomingBreak) dur = upcomingBreak.startMins - currentMins;
      if (currentMins + dur > endMins) dur = endMins - currentMins;

      if (dur > 0) {
        blocks.push({
          isBreak: false,
          name: 'Period',
          startMins: currentMins,
          endMins: currentMins + dur
        });
        currentMins += dur;
      } else break;
    }

    const slotIdxs: number[] = [];
    const nameMap = new Map<number, string>();
    blocks.forEach((b, i) => {
      if (b.isBreak) {
        slotIdxs.push(i);
        nameMap.set(i, b.name);
      }
    });

    return {
      timeline: blocks,
      totalSlotsPerDay: blocks.length,
      breakSlotIndexes: slotIdxs,
      breakNamesBySlot: nameMap
    };
  }, [normalizedSchoolWindow, periodDurationMinutes, breakWindows]);

  const intervalMinutes = periodDurationMinutes;

  /* ── Timetable state (mutable, with history for undo) ── */
  const [slots, setSlots] = useState<TimeSlot[]>(persisted?.slots ?? []);
  const [history, setHistory] = useState<TimeSlot[][]>([]);

  /* ── DnD state ── */
  const [dragSlotId, setDragSlotId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: string; time: string } | null>(null);
  const [dropConflict, setDropConflict] = useState(false);
  const [dropOutOfBounds, setDropOutOfBounds] = useState(false);

  /* Keep a ref to dragSlotId so drop handler always has current value */
  const dragSlotIdRef = useRef<string | null>(null);

  /* ── Derived ── */
  const group = useMemo(() => groups.find(g => g.id === activeGroupId) ?? groups[0] ?? null, [groups, activeGroupId]);
  const viewingGroupId = activeGroupId;
  const viewingGroup = useMemo(
    () => groups.find((g) => g.id === viewingGroupId) ?? groups[0] ?? null,
    [groups, viewingGroupId],
  );
  const isReadOnlyMode = workspaceMode === 'live';
  const hasChanges = useMemo(() => history.length > 0, [history]);
  const canUndo = history.length > 0;

  /* ── React to import-wizard writes to localStorage ──
      The ImportWizard writes directly to localStorage from a different component.
      'storage' fires in other tabs; 'chronolink:import' fires in the same tab. */
  useEffect(() => {
    function applyWorkspaceObject(ws: Record<string, unknown>) {
      if (Array.isArray(ws.teachers) && ws.teachers.length > 0) setTeachers(ws.teachers as Faculty[]);
      if (Array.isArray(ws.rooms) && ws.rooms.length > 0) setRooms(ws.rooms as Room[]);
      // Always sync groups & classConfigs (no length guard) — admin pages may add/remove entries
      if (Array.isArray(ws.groups)) {
        setGroups(ws.groups as Group[]);
        const currentOrFirst = (ws.activeGroupId as string) || (ws.groups as Group[])[0]?.id;
        if (currentOrFirst) setActiveGroupId(currentOrFirst);
      }
      if (Array.isArray(ws.subjects)) setSubjects(ws.subjects as Subject[]);
      if (Array.isArray(ws.classConfigs)) setClassConfigs(ws.classConfigs as ClassConfig[]);
      if (Array.isArray(ws.groupFaculty)) setGroupFaculty(ws.groupFaculty as GroupFacultyAssignment[]);
      if (Array.isArray(ws.slots) && ws.slots.length > 0) setSlots(ws.slots as TimeSlot[]);
      if (ws.activeGroupId) setActiveGroupId(ws.activeGroupId as string);
      // Sync school-window settings so the grid adjusts to imported data
      if (typeof ws.dayStartTime === 'string') setDayStartTime(ws.dayStartTime);
      if (typeof ws.schoolEndTime === 'string') setSchoolEndTime(ws.schoolEndTime);
      if (typeof ws.periodDurationMinutes === 'number') setPeriodDurationMinutes(ws.periodDurationMinutes);
      if (Array.isArray(ws.breakWindows) && ws.breakWindows.length > 0) {
        setBreakWindows(ws.breakWindows as TimeBlockWindow[]);
      }
      if (Array.isArray(ws.facultyAbsences)) {
        setFacultyAbsences(ws.facultyAbsences as any[]);
      }
      if (Array.isArray(ws.solverConstraints)) {
        setSolverConstraints(ws.solverConstraints as any[]);
      }
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== WORKSPACE_STORAGE_KEY || !e.newValue) return;
      try {
        const ws = JSON.parse(e.newValue) as Record<string, unknown>;
        applyWorkspaceObject(ws);
      } catch { /* ignore */ }
    }
    function onImport(e: Event) {
      const detail = (e as CustomEvent<Record<string, unknown>>).detail;
      if (!detail) return;
      applyWorkspaceObject(detail);
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('chronolink:import', onImport);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('chronolink:import', onImport);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const payload: WorkspacePersistedState = {
      teachers,
      rooms,
      groups,
      subjects,
      classConfigs,
      groupFaculty,
      slots,
      activeGroupId,
      liveGroupId,
      workspaceMode,
      rightPanelTab,
      periodDurationMinutes,
      dayStartTime: normalizedSchoolWindow.start,
      schoolEndTime: normalizedSchoolWindow.end,
      breakWindows,
      solverConstraints,
      facultyAbsences,
    };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
  }, [
    teachers,
    rooms,
    groups,
    subjects,
    classConfigs,
    groupFaculty,
    slots,
    activeGroupId,
    liveGroupId,
    workspaceMode,
    rightPanelTab,
    periodDurationMinutes,
    normalizedSchoolWindow,
    breakWindows,
    solverConstraints,
    facultyAbsences,
  ]);

  useEffect(() => {
    if (hasSolverErrors && rightPanelTab === 'classes') {
      setRightPanelTab('errors');
      return;
    }
    if (!hasSolverErrors && rightPanelTab === 'errors') {
      setRightPanelTab('constraints');
    }
  }, [hasSolverErrors, rightPanelTab]);





  /* ── Entity Registries for Grid (Derived from State) ── */
  const facultyRegistry = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);
  const roomRegistry = useMemo(() => new Map(rooms.map(r => [r.id, r.name])), [rooms]);
  const roomIdRegistry = useMemo(() => new Map(rooms.map(r => [r.roomId, r.name])), [rooms]);
  const subjectRegistry = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);
  const normalizedFacultyRegistry = useMemo(
    () => new Map(teachers.map((t) => [normalizeUuid(t.id, 'teacher'), t.name])),
    [teachers],
  );
  const normalizedRoomRegistry = useMemo(
    () => new Map(rooms.map((r) => [normalizeUuid(r.id, 'room'), r.name])),
    [rooms],
  );
  const normalizedSubjectRegistry = useMemo(
    () => new Map(subjects.map((s) => [normalizeUuid(s.id, 'subject'), s.name])),
    [subjects],
  );
  // Reverse-lookup: normalizedUUID → original group ID (so solver results can be matched to the grid filter)
  const normalizedGroupIdRegistry = useMemo(
    () => new Map(groups.map((g) => [normalizeUuid(g.id, 'group'), g.id])),
    [groups],
  );


  const overlapsBreak = useCallback((startSlot: number, durationSlots: number) => {
    if (breakSlotIndexes.length === 0) return false;
    const endSlotExclusive = startSlot + durationSlots;
    return breakSlotIndexes.some((breakSlot) => breakSlot >= startSlot && breakSlot < endSlotExclusive);
  }, [breakSlotIndexes]);

  /* ── Helpers ── */
  const getConflicts = useCallback((slotId: string, day: string, start: string, end: string): TimeSlot[] => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) {
      return [];
    }
    return slots.filter(s =>
      s.id !== slotId &&
      s.day === day &&
      s.startTime < end &&
      s.endTime > start &&
      (
        (!!slot.faculty && !!s.faculty && slot.faculty === s.faculty) ||
        (!!slot.room && !!s.room && slot.room === s.room)
      )
    );
  }, [slots]);

  /* ── DnD handlers ── */

  const handleDragStart = useCallback((e: React.DragEvent, slotId: string) => {
    e.dataTransfer.setData('text/plain', slotId);
    e.dataTransfer.effectAllowed = 'move';
    dragSlotIdRef.current = slotId;
    setDragSlotId(slotId);
    console.log('[DnD] dragStart:', slotId);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragSlotIdRef.current = null;
    setDragSlotId(null);
    setDropTarget(null);
    setDropConflict(false);
    setDropOutOfBounds(false);
  }, []);

  const handleCellDragOver = useCallback((e: React.DragEvent, day: string, time: string) => {
    if (isReadOnlyMode) {
      return;
    }
    e.preventDefault(); // Always call this — needed for both internal and external drags

    const slotId = dragSlotIdRef.current;

    // External block drag (from ClassConfigPanel) — allow drop, show blue highlight
    if (!slotId) {
      const startSlot = timeLabelToSlotIndex(time, intervalMinutes, dayStartTime, breakWindows, timeline);
      const isBreak = startSlot >= 0 && breakSlotIndexes.includes(startSlot);
      setDropTarget(prev => (prev?.day === day && prev?.time === time) ? prev : { day, time });
      setDropConflict(false);
      setDropOutOfBounds(isBreak);
      e.dataTransfer.dropEffect = isBreak ? 'none' : 'copy';
      return;
    }

    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    /* Same cell as origin — no indicator */
    if (slot.day === day && slot.startTime === time) {
      setDropTarget(prev => prev === null ? prev : null);
      return;
    }

    /* Out of bounds check */
    if (!canDropAt(slot, time, totalSlotsPerDay, intervalMinutes, dayStartTime, breakWindows, timeline)) {
      setDropTarget(prev => (prev?.day === day && prev?.time === time) ? prev : { day, time });
      setDropConflict(false);
      setDropOutOfBounds(true);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const dropStartSlot = timeLabelToSlotIndex(time, intervalMinutes, dayStartTime, breakWindows, timeline);
    const movingDurationSlots = slotDuration(slot, intervalMinutes, dayStartTime, breakWindows, timeline);
    if (dropStartSlot >= 0 && overlapsBreak(dropStartSlot, movingDurationSlots)) {
      setDropTarget(prev => (prev?.day === day && prev?.time === time) ? prev : { day, time });
      setDropConflict(false);
      setDropOutOfBounds(true);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const end = newEndTime(slot, time, totalSlotsPerDay, intervalMinutes, dayStartTime, breakWindows, timeline);
    const conflicts = getConflicts(slotId, day, time, end);

    setDropTarget(prev => (prev?.day === day && prev?.time === time) ? prev : { day, time });
    setDropConflict(prev => prev === (conflicts.length > 0) ? prev : (conflicts.length > 0));
    setDropOutOfBounds(false);
    e.dataTransfer.dropEffect = 'move';
  }, [isReadOnlyMode, slots, breakSlotIndexes, intervalMinutes, dayStartTime, totalSlotsPerDay, overlapsBreak, breakWindows, getConflicts, timeline]);

  const handleCellDragLeave = useCallback(() => {
    /* Don't clear on leave — only clear on dragEnd or successful drop.
       This prevents flickering when hovering over child elements. */
  }, []);

  const handleCellDrop = useCallback((e: React.DragEvent, day: string, time: string) => {
    if (isReadOnlyMode) {
      return;
    }
    e.preventDefault();

    // ── Check payload ──
    const textData = e.dataTransfer.getData('text/plain') || '';

    // ── External block from ClassConfigPanel ──
    if (textData.startsWith('{')) {
      try {
        const { subjectId, teacherId, roomId, sessionType } = JSON.parse(textData) as {
          rowId: string; subjectId: string; teacherId: string; roomId?: string | null;
          sessionType: 'lecture' | 'practical';
        };
        const subject = subjects.find(s => s.id === subjectId);
        const teacher = teachers.find(t => t.id === teacherId);
        const room = roomId ? rooms.find(r => r.id === roomId) : undefined;
        const startSlotIdx = timeLabelToSlotIndex(time, intervalMinutes, dayStartTime, breakWindows, timeline);
        const durationSlots = sessionType === 'practical' ? (periodDurationMinutes >= 60 ? 1 : 2) : 1;
        if (overlapsBreak(startSlotIdx, durationSlots)) {
          toast.error('Cannot place during break', { description: 'This slot is inside a configured break window.' });
          handleDragEnd();
          return;
        }
        const end = slotIndexToEndTimeLabel(startSlotIdx, durationSlots, intervalMinutes, dayStartTime, breakWindows, timeline);
        const newSlot: TimeSlot = {
          id: uuidv4(), day, startTime: time, endTime: end,
          subject: subject?.name, faculty: teacher?.name,
          room: room?.name ?? 'Auto room', type: sessionType,
          groupId: activeGroupId
        };
        setHistory(prev => [...prev, [...slots]]);
        setSlots(prev => [...prev, newSlot]);
        toast.success(
          `${sessionType === 'practical' ? '🧪' : '📘'} ${subject?.name}`,
          { description: `${day} · ${time}–${end} · ${room?.name ?? 'Auto room'}` },
        );
      } catch {
        toast.error('Failed to place block');
      }
      handleDragEnd();
      return;
    }

    const slotId = textData || dragSlotIdRef.current;
    console.log('[DnD] drop: textData=', JSON.stringify(textData), 'ref=', dragSlotIdRef.current, 'slotId=', slotId, 'day=', day, 'time=', time);
    if (!slotId) { console.warn('[DnD] drop: no slotId, aborting'); return; }

    const slot = slots.find(s => s.id === slotId);
    if (!slot) { console.warn('[DnD] drop: slot not found in', slots.length, 'slots'); return; }

    /* No-op: same position */
    if (slot.day === day && slot.startTime === time) {
      handleDragEnd();
      return;
    }

    /* Out of bounds */
    if (!canDropAt(slot, time, totalSlotsPerDay, intervalMinutes, dayStartTime, breakWindows, timeline)) {
      toast.error('Cannot place here', { description: 'Session would extend past 18:00.' });
      handleDragEnd();
      return;
    }

    const moveStartSlot = timeLabelToSlotIndex(time, intervalMinutes, dayStartTime, breakWindows, timeline);
    const moveDurationSlots = slotDuration(slot, intervalMinutes, dayStartTime, breakWindows, timeline);
    if (overlapsBreak(moveStartSlot, moveDurationSlots)) {
      toast.error('Cannot place during break', { description: 'This slot is inside a configured break window.' });
      handleDragEnd();
      return;
    }

    const end = newEndTime(slot, time, totalSlotsPerDay, intervalMinutes, dayStartTime, breakWindows, timeline);
    const conflicts = getConflicts(slotId, day, time, end);
    const dur = slotDuration(slot, intervalMinutes, dayStartTime, breakWindows, timeline);

    /* Push to history (enables undo) */
    setHistory(prev => [...prev, [...slots]]);

    /* Apply the move */
    setSlots(prev => prev.map(s =>
      s.id === slotId
        ? { ...s, day, startTime: time, endTime: end }
        : s
    ));

    /* Feedback */
    moveToastContent(
      { ...slot, day, startTime: time, endTime: end, id: slotId } as TimeSlot,
      day, time, end,
      conflicts.map(c => c.subject ?? c.id),
    );

    void dur; // used only for endTime calculation via newEndTime
    handleDragEnd();
  }, [isReadOnlyMode, slots, handleDragEnd, overlapsBreak, intervalMinutes, dayStartTime, totalSlotsPerDay, activeGroupId, breakWindows, timeline, getConflicts, subjects, teachers, rooms, periodDurationMinutes]);

  const handleSlotsChange = useCallback((newFilteredSlots: TimeSlot[]) => {
    setHistory(prev => [...prev, [...slots]]);

    // Preserve slots from other groups
    const otherGroupSlots = slots.filter(s => s.groupId && s.groupId !== activeGroupId);
    // Combine with new slots from this group
    const merged = [...otherGroupSlots, ...newFilteredSlots.map(s => ({ ...s, groupId: activeGroupId }))];

    setSlots(merged);
  }, [slots, activeGroupId]);

  const handleDeleteSlot = useCallback((slotId: string) => {
    const slotToDelete = slots.find(s => s.id === slotId);
    if (!slotToDelete) return;
    setHistory(prev => [...prev, [...slots]]);
    setSlots(prev => prev.filter(s => s.id !== slotId));
    toast.success('Session removed', {
      description: `${slotToDelete.subject ?? 'Session'} · ${slotToDelete.day} ${slotToDelete.startTime}-${slotToDelete.endTime}`,
    });
  }, [slots]);

  /* ── Save / Undo ── */

  function handleSave() {
    if (isReadOnlyMode) {
      toast.info('Switch to Workbench mode to edit and save drafts.');
      return;
    }
    setHistory([]);
    toast.success('Draft saved to localhost', { description: `${slots.length} sessions saved and retained locally.` });
  }

  function handleUndo() {
    if (isReadOnlyMode) {
      return;
    }
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setSlots(prev);
    setHistory(h => h.slice(0, -1));
    toast.success('Move undone');
  }

  function confirmGoLive(slug: string) {
    setLiveGroupId(activeGroupId);
    setGroups((previous) =>
      previous.map((item) => {
        if (item.id === activeGroupId) {
          return { ...item, isLive: true, liveLink: slug };
        }
        return { ...item, isLive: false };
      }),
    );
    if (workspaceMode === 'live') {
      setWorkspaceMode('workbench');
    }
    setShowGoLive(false);

    // Push a dynamic announcement to students
    try {
      const stored = window.localStorage.getItem('realtime-timetable.studentAnnouncements');
      let announcements = [];
      if (stored) {
        announcements = JSON.parse(stored);
      }
      const changedSubjects = [...new Set(slots.filter(s => s.groupId === activeGroupId).map(s => s.subject).filter(Boolean))];
      const newAnnouncement = {
        id: `pub-${Date.now()}`,
        kind: 'notice',
        title: `${group?.name ?? 'Timetable'} Published`,
        detail: `Your timetable for ${group?.course ?? ''} has been updated. Changes affect the following subjects: ${changedSubjects.join(', ')}. Please review your new schedule.`,
        time: new Date().toISOString(),
        affectsYou: true,
        read: false,
      };
      announcements.unshift(newAnnouncement);
      window.localStorage.setItem('realtime-timetable.studentAnnouncements', JSON.stringify(announcements));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Failed to create announcement:', e);
    }

    toast.success(`${group?.name ?? 'Timetable'} is now live!`, {
      description: `Share: ${window.location.origin}/live/${slug}`,
      duration: 6000,
    });
  }

  function exportWorkspaceAsJson() {
    const payload: WorkspacePersistedState = {
      teachers,
      rooms,
      groups,
      subjects,
      classConfigs,
      groupFaculty,
      slots,
      activeGroupId,
      liveGroupId,
      workspaceMode,
      rightPanelTab,
      periodDurationMinutes,
      dayStartTime: normalizedSchoolWindow.start,
      schoolEndTime: normalizedSchoolWindow.end,
      breakWindows,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const fileName = `timetable-workspace-${stamp}.json`;
    anchor.href = url;
    anchor.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 800);
  }

  function importWorkspaceFromJson(payload: unknown) {
    try {
      const raw = JSON.stringify(payload);
      const parsed = safeParsePersistedState(raw);
      if (!parsed) {
        throw new Error('Invalid workspace file format.');
      }

      setTeachers(parsed.teachers);
      setRooms(parsed.rooms);
      setGroups(parsed.groups);
      setSubjects(parsed.subjects);
      setClassConfigs(parsed.classConfigs);
      setGroupFaculty(parsed.groupFaculty);
      setSlots(parsed.slots);
      setActiveGroupId(parsed.activeGroupId);
      setLiveGroupId(parsed.liveGroupId);
      setWorkspaceMode(parsed.workspaceMode);
      setRightPanelTab(parsed.rightPanelTab);
      setPeriodDurationMinutes(parsed.periodDurationMinutes);
      setDayStartTime(parsed.dayStartTime);
      setSchoolEndTime(parsed.schoolEndTime);
      setBreakWindows(parsed.breakWindows);
      setHistory([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      toast.error('Import failed', { description: message });
    }
  }

  function handleBulkApply(payload: { faculty: Faculty[]; rooms: Room[]; studentGroups?: Array<{ name: string; code?: string; size?: number; course?: string; semester?: number }> }) {
    if (payload.faculty.length > 0) {
      const incomingByEmail = new Map(
        payload.faculty
          .filter((f) => f.email?.trim())
          .map((f) => [f.email.trim().toLowerCase(), f]),
      );
      setTeachers((previous) => {
        const existingEmails = new Set(previous.map((f) => f.email.trim().toLowerCase()));
        const toAdd = Array.from(incomingByEmail.entries())
          .filter(([email]) => !existingEmails.has(email))
          .map(([, row]) => row);
        return [...previous, ...toAdd];
      });
    }

    if (payload.rooms.length > 0) {
      const incomingByName = new Map(
        payload.rooms
          .filter((r) => r.name?.trim())
          .map((r) => [r.name.trim().toLowerCase(), r]),
      );
      setRooms((previous) => {
        const existingNames = new Set(previous.map((r) => r.name.trim().toLowerCase()));
        const toAdd = Array.from(incomingByName.entries())
          .filter(([name]) => !existingNames.has(name))
          .map(([, row]) => row);
        return [...previous, ...toAdd];
      });
    }

    if (payload.studentGroups && payload.studentGroups.length > 0) {
      setGroups((previous) => {
        const existingCodes = new Set(previous.map((g) => g.name.toLowerCase()));
        const toAdd: Group[] = payload.studentGroups!
          .filter((sg) => sg.name?.trim() && !existingCodes.has(sg.name.trim().toLowerCase()))
          .map((sg) => ({
            id: crypto.randomUUID ? crypto.randomUUID() : `grp-${Date.now()}-${Math.random()}`,
            name: sg.code?.trim() || sg.name.trim(),
            course: sg.course?.trim() || 'Unknown Course',
            semester: sg.semester ?? 1,
            studentsCount: sg.size ?? 30,
            isLive: false,
          }));
        return [...previous, ...toAdd];
      });
    }

    const groupCount = payload.studentGroups?.length ?? 0;
    const total = payload.faculty.length + payload.rooms.length + groupCount;
    toast.success('Bulk data applied.', {
      description: `${payload.faculty.length} faculty · ${payload.rooms.length} rooms · ${groupCount} classes (${total} total).`,
    });
  }

  async function handleRunSolver() {
    if (isReadOnlyMode) {
      toast.info('Switch to Workbench mode to run solver for testing.');
      return;
    }
    if (isSolving) return;

    setIsSolving(true);
    setConflictingConstraintIds([]); // Clear previous conflicts
    setSolverConflictMessages([]);

    try {
      // Synthesize session blueprints from classConfigs
      const sessionBlueprints: Array<SessionBlueprintDTO & { id: string; duration: number }> = [];
      const sessionTypeByBlueprintId = new Map<string, 'lecture' | 'practical'>();
      let autoRoomCursorLecture = 0;
      let autoRoomCursorPractical = 0;
      // Build a set of absent teacher IDs so we can skip their sessions entirely.
      // When a teacher is absent, their sessions simply won't happen that week —
      // this avoids the infeasible state of "must schedule + blocked from all slots".
      const absentTeacherIds = new Set(
        teachers.filter((t) => t.isAbsent).map((t) => t.id),
      );
      const skippedAbsentSubjects: string[] = [];

      classConfigs.forEach(cfg => {
        cfg.rows.forEach(row => {
          // Resolve teacher: use assigned one, or fall back to first available non-absent teacher (TBA)
          const resolvedTeacherId = row.teacherId && teachers.find(t => t.id === row.teacherId)
            ? row.teacherId
            : teachers.filter(t => !absentTeacherIds.has(t.id))[0]?.id ?? '';

          // Skip sessions for absent teachers — those subjects won't happen this week
          if (absentTeacherIds.has(resolvedTeacherId)) {
            const subjectName = subjects.find(s => s.id === row.subjectId)?.name ?? row.subjectId;
            const teacherName = teachers.find(t => t.id === resolvedTeacherId)?.name ?? resolvedTeacherId;
            skippedAbsentSubjects.push(`${subjectName} (${teacherName})`);
            return;
          }

          // If truly no teacher exists in the system at all, we must skip this row
          if (!resolvedTeacherId) {
            const subjectName = subjects.find(s => s.id === row.subjectId)?.name ?? row.subjectId;
            skippedAbsentSubjects.push(`${subjectName} (No faculty — add a professor first)`);
            return;
          }

          const appendBlueprint = (sessionType: 'lecture' | 'practical') => {
            let resolvedRoomId = row.roomId;
            const isLabRoom = rooms.find(r => r.id === resolvedRoomId)?.type === 'lab';

            // HARD CONSTRAINT: Practicals MUST be in labs.
            // If the Excel assigned a practical to a non-lab, ignore it.
            if (sessionType === 'practical' && (!resolvedRoomId || !isLabRoom)) {
              resolvedRoomId = ''; // Force auto-assign
            }

            if (!resolvedRoomId) {
              const eligibleRooms = sessionType === 'practical'
                ? rooms.filter(r => r.type === 'lab')
                : rooms.filter(r => r.type !== 'lab');

              const pool = eligibleRooms.length > 0 ? eligibleRooms : rooms;

              if (pool.length === 0) {
                throw new Error('No rooms available to auto-assign. Add at least one room before running solver.');
              }

              if (sessionType === 'practical') {
                resolvedRoomId = pool[autoRoomCursorPractical % pool.length].id;
                autoRoomCursorPractical += 1;
              } else {
                resolvedRoomId = pool[autoRoomCursorLecture % pool.length].id;
                autoRoomCursorLecture += 1;
              }
            }
            const durationSlots = sessionType === 'practical' ? (periodDurationMinutes >= 60 ? 1 : 2) : 1;
            const blueprintId = uuidv4();
            sessionBlueprints.push({
              id: blueprintId,
              teacher_id: normalizeUuid(resolvedTeacherId, 'teacher'),
              room_id: normalizeUuid(resolvedRoomId, 'room'),
              student_group_id: normalizeUuid(cfg.groupId, 'group'),
              subject_id: normalizeUuid(row.subjectId, 'subject'),
              duration: durationSlots,
            });
            sessionTypeByBlueprintId.set(blueprintId, sessionType);
          };

          // Use exact counts from classConfig — do NOT fall back to 1 for rows that
          // genuinely have 0 lectures (e.g. practical-only rows split out during import).
          const lectureSessionsToGenerate = row.lecturesPerWeek ?? 0;
          const practicalSessionsToGenerate = row.practicalsPerWeek ?? 0;

          // Safety: skip rows with nothing to schedule
          if (lectureSessionsToGenerate === 0 && practicalSessionsToGenerate === 0) return;

          for (let i = 0; i < lectureSessionsToGenerate; i++) {
            appendBlueprint('lecture');
          }
          for (let i = 0; i < practicalSessionsToGenerate; i++) {
            appendBlueprint('practical');
          }
        });
      });

      // ── Second Pass: Room Load Balancing (Soft Constraints) ──
      // If a specific room requested by the Excel sheet is mathematically overbooked,
      // we greedily move excess sessions to other rooms that have spare capacity.
      {
        const availableSlotsPerDay = totalSlotsPerDay - breakSlotIndexes.length;
        const totalAvailableSlots = availableSlotsPerDay * 5;

        const roomDemand = new Map<string, number>();
        rooms.forEach(r => roomDemand.set(normalizeUuid(r.id, 'room'), 0));

        sessionBlueprints.forEach(bp => {
          const d = roomDemand.get(bp.room_id) || 0;
          roomDemand.set(bp.room_id, d + bp.duration);
        });

        const labRoomIds = rooms.filter(r => r.type === 'lab').map(r => normalizeUuid(r.id, 'room'));
        const classroomRoomIds = rooms.filter(r => r.type !== 'lab').map(r => normalizeUuid(r.id, 'room'));

        for (const [roomId, demand] of roomDemand.entries()) {
          if (demand > totalAvailableSlots) {
            let excessSlots = demand - totalAvailableSlots;
            const movableSessions = sessionBlueprints.filter(bp => bp.room_id === roomId);

            for (const bp of movableSessions) {
              if (excessSlots <= 0) break;

              const isP = sessionTypeByBlueprintId.get(bp.id) === 'practical';
              const eligiblePool = isP ? labRoomIds : classroomRoomIds;
              const fallbackPool = eligiblePool.length > 0 ? eligiblePool : Array.from(roomDemand.keys());

              let targetRoomId = roomId;
              for (const candId of fallbackPool) {
                const candDemand = roomDemand.get(candId) || 0;
                if (candDemand + bp.duration <= totalAvailableSlots) {
                  targetRoomId = candId;
                  break;
                }
              }

              if (targetRoomId !== roomId) {
                bp.room_id = targetRoomId;
                roomDemand.set(roomId, roomDemand.get(roomId)! - bp.duration);
                roomDemand.set(targetRoomId, (roomDemand.get(targetRoomId) || 0) + bp.duration);
                excessSlots -= bp.duration;
              }
            }
          }
        }
      }

      // Notify the user about sessions skipped due to faculty absence
      if (skippedAbsentSubjects.length > 0) {
        const uniqueSkipped = [...new Set(skippedAbsentSubjects)];
        toast.info(`${uniqueSkipped.length} subject(s) excluded due to faculty absence`, {
          description: uniqueSkipped.slice(0, 4).join(', ') + (uniqueSkipped.length > 4 ? ` +${uniqueSkipped.length - 4} more` : ''),
          duration: 6000,
        });
      }

      if (sessionBlueprints.length === 0) {
        const absentNote = absentTeacherIds.size > 0
          ? ` (${absentTeacherIds.size} teacher(s) are marked absent — their sessions were excluded.)`
          : '';
        toast.error('No sessions to solve', {
          description: `Configure subjects in the Customization panel first, or import data with a Timetable sheet.${absentNote}`,
          duration: 6000,
        });
        setIsSolving(false);
        return;
      }

      /* ── Pre-flight feasibility checks ──────────────────────────── */
      {
        const preflightErrors: string[] = [];
        const availableSlotsPerDay = totalSlotsPerDay - breakSlotIndexes.length;
        const totalAvailableSlots = availableSlotsPerDay * 5;

        // Count rooms by type
        const labRooms = rooms.filter(r => r.type === 'lab');
        const classroomRooms = rooms.filter(r => r.type !== 'lab');

        // Count sessions by type
        const lectureBlueprints = sessionBlueprints.filter(bp => {
          const t = sessionTypeByBlueprintId.get(bp.id);
          return t === 'lecture';
        });
        const practicalBlueprints = sessionBlueprints.filter(bp => {
          const t = sessionTypeByBlueprintId.get(bp.id);
          return t === 'practical';
        });

        // Check: practicals exist but no lab rooms
        if (practicalBlueprints.length > 0 && labRooms.length === 0) {
          preflightErrors.push(
            `🔬 No lab rooms available — you have ${practicalBlueprints.length} practical session(s) that need labs, but 0 rooms are typed as "lab". Add lab rooms or change room types.`
          );
        }

        // Check: lectures exist but no classrooms
        if (lectureBlueprints.length > 0 && classroomRooms.length === 0) {
          preflightErrors.push(
            `🏫 No classrooms available — you have ${lectureBlueprints.length} lecture session(s), but 0 rooms are typed as "classroom"/"lecture-hall"/"seminar". Add classroom rooms or change room types.`
          );
        }

        // Check per-group slot demand vs capacity
        const groupSlotDemand = new Map<string, { lectureSlots: number; practicalSlots: number; groupName: string }>();
        sessionBlueprints.forEach(bp => {
          const gid = bp.student_group_id;
          if (!groupSlotDemand.has(gid)) {
            const g = groups.find(gr => normalizeUuid(gr.id, 'group') === gid);
            groupSlotDemand.set(gid, { lectureSlots: 0, practicalSlots: 0, groupName: g?.name ?? gid.slice(0, 8) });
          }
          const entry = groupSlotDemand.get(gid)!;
          const isP = sessionTypeByBlueprintId.get(bp.id) === 'practical';
          if (isP) entry.practicalSlots += bp.duration;
          else entry.lectureSlots += bp.duration;
        });
        for (const [, info] of groupSlotDemand) {
          const totalDemand = info.lectureSlots + info.practicalSlots;
          if (totalDemand > totalAvailableSlots) {
            preflightErrors.push(
              `⏰ Time capacity exceeded for "${info.groupName}" — needs ${totalDemand} time slots (${info.lectureSlots} lecture + ${info.practicalSlots} practical) but only ${totalAvailableSlots} non-break slots exist across 5 days (${availableSlotsPerDay}/day × 5).`
            );
          }
        }

        // Check per-room overload
        const roomDemand = new Map<string, { slots: number; roomName: string }>();
        sessionBlueprints.forEach(bp => {
          const rid = bp.room_id;
          if (!roomDemand.has(rid)) {
            const r = rooms.find(rm => normalizeUuid(rm.id, 'room') === rid);
            roomDemand.set(rid, { slots: 0, roomName: r?.name ?? rid.slice(0, 8) });
          }
          roomDemand.get(rid)!.slots += bp.duration;
        });
        for (const [, info] of roomDemand) {
          if (info.slots > totalAvailableSlots) {
            preflightErrors.push(
              `🚪 Room "${info.roomName}" is overbooked — ${info.slots} slots assigned but only ${totalAvailableSlots} available. Spread sessions across more rooms.`
            );
          }
        }

        // Check per-teacher overload
        const teacherDemand = new Map<string, { slots: number; teacherName: string }>();
        sessionBlueprints.forEach(bp => {
          const tid = bp.teacher_id;
          if (!teacherDemand.has(tid)) {
            const t = teachers.find(tc => normalizeUuid(tc.id, 'teacher') === tid);
            teacherDemand.set(tid, { slots: 0, teacherName: t?.name ?? tid.slice(0, 8) });
          }
          teacherDemand.get(tid)!.slots += bp.duration;
        });
        for (const [, info] of teacherDemand) {
          if (info.slots > totalAvailableSlots) {
            preflightErrors.push(
              `👩‍🏫 Teacher "${info.teacherName}" is overloaded — ${info.slots} slots assigned but only ${totalAvailableSlots} available. Reduce classes or assign multiple teachers.`
            );
          }
        }

        // Check: not enough lab rooms for concurrent practicals
        if (practicalBlueprints.length > 0 && labRooms.length > 0) {
          const totalPracticalSlots = practicalBlueprints.reduce((s, bp) => s + bp.duration, 0);
          const labCapacity = labRooms.length * totalAvailableSlots;
          if (totalPracticalSlots > labCapacity) {
            preflightErrors.push(
              `🔬 Not enough lab rooms — ${totalPracticalSlots} practical slots needed, but only ${labRooms.length} lab(s) × ${totalAvailableSlots} slots = ${labCapacity} capacity. Add ${Math.ceil((totalPracticalSlots - labCapacity) / totalAvailableSlots)} more lab(s).`
            );
          }
        }

        // Check: not enough classrooms for concurrent lectures
        if (lectureBlueprints.length > 0 && classroomRooms.length > 0) {
          const totalLectureSlots = lectureBlueprints.reduce((s, bp) => s + bp.duration, 0);
          const classroomCapacity = classroomRooms.length * totalAvailableSlots;
          if (totalLectureSlots > classroomCapacity) {
            preflightErrors.push(
              `🏫 Not enough classrooms — ${totalLectureSlots} lecture slots needed, but only ${classroomRooms.length} classroom(s) × ${totalAvailableSlots} slots = ${classroomCapacity} capacity. Add ${Math.ceil((totalLectureSlots - classroomCapacity) / totalAvailableSlots)} more classroom(s).`
            );
          }
        }

        if (preflightErrors.length > 0) {
          setSolverConflictMessages(preflightErrors);
          setConflictingConstraintIds(['preflight-check']);
          setRightPanelTab('errors');
          toast.error('Cannot run solver — feasibility issues detected', {
            description: `${preflightErrors.length} issue(s) found. Check the Errors panel for details.`,
            duration: 8000,
          });
          setIsSolving(false);
          return;
        }
      }

      const backendIdToLocalId = new Map<string, string>();
      const normalizedConstraints = solverConstraints.map((constraint, index) => {
        const localId = String(constraint.id ?? `solver-constraint-${index}`);
        const backendId = normalizeUuid(localId, 'constraint');
        backendIdToLocalId.set(backendId, localId);
        return {
          ...constraint,
          id: backendId,
          ...(constraint.target_id
            ? { target_id: normalizeUuid(constraint.target_id, `${constraint.target_type}`.toLowerCase()) }
            : {}),
        };
      });

      const breakConstraints: ConstraintCreateDTO[] = breakSlotIndexes.length > 0
        ? groups.map((g) => ({
          id: deterministicUuid(`break:${normalizeUuid(g.id, 'group')}:${breakSlotIndexes.join(',')}`),
          target_type: 'StudentGroup' as const,
          target_id: normalizeUuid(g.id, 'group'),
          rule_type: 'Availability' as const,
          value: { unavailable_slots: breakSlotIndexes },
        }))
        : [];

      // ── Faculty Absence & Per-Day Availability Constraints ──
      // 
      // Two layers of protection:
      // a) isAbsent === true → blueprints were already excluded above, so this
      //    constraint is a harmless safety net (no matching sessions exist).
      // b) preferences.availability → specific days marked unavailable generate
      //    day/slot pair constraints so the solver avoids scheduling on those days.

      const absenceConstraints: ConstraintCreateDTO[] = [];

      // (a) Full-week absence safety net (blueprints already excluded above)
      teachers
        .filter((t) => t.isAbsent)
        .forEach((t) => {
          absenceConstraints.push({
            id: deterministicUuid(`absence:${normalizeUuid(t.id, 'teacher')}`),
            target_type: 'Teacher' as const,
            target_id: normalizeUuid(t.id, 'teacher'),
            rule_type: 'Availability' as const,
            value: { unavailable_slots: Array.from({ length: totalSlotsPerDay }, (_, i) => i) },
          });
        });

      // (b) Per-day availability from preferences.availability
      // Map day names to solver day indexes (Monday=0 ... Friday=4)
      const dayNameToSolverIndex: Record<string, number> = {
        Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4,
      };

      teachers
        .filter((t) => !t.isAbsent && t.preferences?.availability)
        .forEach((t) => {
          const avail = t.preferences!.availability;
          const unavailablePairs: Array<{ day: number; slot: number }> = [];

          for (const [dayName, dayAvail] of Object.entries(avail)) {
            const dayIdx = dayNameToSolverIndex[dayName];
            if (dayIdx === undefined) continue;

            if (!dayAvail.available) {
              // Teacher is unavailable the entire day — block all slots on that day
              for (let slot = 0; slot < totalSlotsPerDay; slot++) {
                unavailablePairs.push({ day: dayIdx, slot });
              }
            }
          }

          if (unavailablePairs.length > 0) {
            absenceConstraints.push({
              id: deterministicUuid(`day-avail:${normalizeUuid(t.id, 'teacher')}:${unavailablePairs.map(p => `${p.day}-${p.slot}`).join(',')}`),
              target_type: 'Teacher' as const,
              target_id: normalizeUuid(t.id, 'teacher'),
              rule_type: 'Availability' as const,
              value: { unavailable: unavailablePairs },
            });
          }
        });

      // ── Minimal Perturbation Constraints ──
      // If there are existing slots, we send them as LocationPreference soft constraints
      // so the solver avoids moving them unless necessary.
      const perturbationConstraints: ConstraintCreateDTO[] = [];
      const intervalMinutes = periodDurationMinutes;
      slots.forEach((slot, idx) => {
        const dayIndex = dayNameToIndex(slot.day);
        const startSlotIndex = timeLabelToSlotIndex(slot.startTime, intervalMinutes, dayStartTime, breakWindows, timeline);
        if (dayIndex >= 0 && startSlotIndex >= 0 && slot.subject && slot.groupId) {
          perturbationConstraints.push({
            id: deterministicUuid(`perturbation:${slot.id ?? idx}`),
            target_type: 'StudentGroup' as const,
            target_id: normalizeUuid(slot.groupId, 'group'),
            rule_type: 'LocationPreference' as const,
            value: {
              subject_id: normalizeUuid(slot.subject, 'subject'),
              preferred_day: dayIndex,
              preferred_slot: startSlotIndex
            }
          });
        }
      });

      // 2. Merge them to send to the solver
      const mergedConstraints = [...normalizedConstraints, ...breakConstraints, ...absenceConstraints, ...perturbationConstraints];

      const conflictLabelById = new Map<string, string>();
      normalizedConstraints.forEach((constraint, idx) => {
        const readableTargetId = constraint.target_id ? String(constraint.target_id).slice(0, 8) : 'n/a';
        conflictLabelById.set(
          String(constraint.id),
          `Rule ${idx + 1}: ${constraint.rule_type} on ${constraint.target_type} (${readableTargetId})`,
        );
      });

      /* ── Build per-group demand breakdown for diagnostics ── */
      const availableSlotsPerDay = totalSlotsPerDay - breakSlotIndexes.length;
      const totalAvailableSlots = availableSlotsPerDay * 5;

      const groupDemandMap = new Map<string, {
        name: string, lec: number, lecSlots: number, prac: number, pracSlots: number, totalSlots: number
      }>();

      let totalLectureSlotsDemand = 0;
      let totalPracticalSlotsDemand = 0;

      sessionBlueprints.forEach(bp => {
        const gid = bp.student_group_id;
        if (!groupDemandMap.has(gid)) {
          const g = groups.find(gr => normalizeUuid(gr.id, 'group') === gid);
          groupDemandMap.set(gid, { name: g?.name ?? 'Unknown', lec: 0, lecSlots: 0, prac: 0, pracSlots: 0, totalSlots: 0 });
        }
        const stat = groupDemandMap.get(gid)!;
        const isP = sessionTypeByBlueprintId.get(bp.id) === 'practical';
        if (isP) {
          totalPracticalSlotsDemand += bp.duration;
          stat.prac++;
          stat.pracSlots += bp.duration;
        } else {
          totalLectureSlotsDemand += bp.duration;
          stat.lec++;
          stat.lecSlots += bp.duration;
        }
        stat.totalSlots += bp.duration;
      });

      /* ── Pre-flight feasibility checks ──────────────────────────── */
      {
        const preflightErrors: string[] = [];

        // Count rooms by type
        const labRooms = rooms.filter(r => r.type === 'lab');
        const classroomRooms = rooms.filter(r => r.type !== 'lab');

        // 1. Global Room Capacity Check (The "Musical Chairs" Problem)
        const totalRoomCapacity = rooms.length * totalAvailableSlots;
        const totalDemand = totalLectureSlotsDemand + totalPracticalSlotsDemand;

        if (totalDemand > totalRoomCapacity) {
          preflightErrors.push(
            `🚫 **NOT ENOUGH ROOMS:** You have ${groups.length} classes trying to share ${rooms.length} rooms. ` +
            `Total time needed is ${totalDemand} slots, but all rooms combined only have ${totalRoomCapacity} slots. ` +
            `**Fix:** Add at least ${Math.ceil((totalDemand - totalRoomCapacity) / totalAvailableSlots)} more room(s) or reduce the number of sessions.`
          );
        }

        // 2. Specific Lab Capacity Check
        const totalLabCapacity = labRooms.length * totalAvailableSlots;
        if (totalPracticalSlotsDemand > totalLabCapacity) {
          preflightErrors.push(
            `🔬 **LAB SHORTAGE:** Your practical sessions (labs) need ${totalPracticalSlotsDemand} slots total, ` +
            `but your ${labRooms.length} lab(s) only have ${totalLabCapacity} slots available. ` +
            `**Fix:** Add more labs or change some "Classrooms" to "Labs" in the Rooms tab.`
          );
        }

        // 3. Individual Group Capacity Check
        groupDemandMap.forEach((stat) => {
          if (stat.totalSlots > totalAvailableSlots) {
            preflightErrors.push(
              `⏰ **TIME OVERFLOW for "${stat.name}":** This class needs ${stat.totalSlots} slots, but there are only ${totalAvailableSlots} slots ` +
              `available in a week after excluding breaks. ` +
              `**Fix:** Reduce their sessions or extend the school day.`
            );
          }
        });

        // 4. Concurrent Group Check (Peak Hour Bottleneck)
        const avgDemandPerGroup = totalDemand / groups.length;
        const roomToGroupRatio = rooms.length / groups.length;
        if (avgDemandPerGroup > (totalAvailableSlots * roomToGroupRatio)) {
          preflightErrors.push(
            `🚦 **CONGESTION:** You have too many groups (${groups.length}) for the number of rooms (${rooms.length}). ` +
            `On average, each group needs ${avgDemandPerGroup.toFixed(1)} slots, but with only ${rooms.length} rooms, ` +
            `each group can only be in class for ${(totalAvailableSlots * roomToGroupRatio).toFixed(1)} slots on average. ` +
            `**Fix:** Add more rooms so more classes can happen at the same time.`
          );
        }

        if (preflightErrors.length > 0) {
          setSolverConflictMessages(preflightErrors);
          setConflictingConstraintIds(['preflight-check']);
          setRightPanelTab('errors');
          toast.error('Schedule is impossible with current rooms/time', {
            description: `Detected ${preflightErrors.length} capacity issues.`,
            duration: 8000,
          });
          setIsSolving(false);
          return;
        }
      }

      breakConstraints.forEach((constraint) => {
        const gid = constraint.target_id!;
        const demand = groupDemandMap.get(gid);
        if (!demand) {
          conflictLabelById.set(String(constraint.id), `Break window conflict for unknown group`);
          return;
        }

        conflictLabelById.set(
          String(constraint.id),
          `⚠️ **"${demand.name}" exceeds available time:** ` +
          `Needs ${demand.lec} lectures + ${demand.prac} practicals. ` +
          `Even though it fits in ${demand.totalSlots} slots, it's blocked because other classes are using the available rooms or teachers at those times. ` +
          `**Solution:** Add 1-2 more rooms so classes don't have to "wait" for a free room.`
        );
      });

      // mergedConstraints is already declared above including absences
      // ── Diagnostic: log constraints being sent ──
      console.group('[Solver] Constraint Debug');
      console.log(`Total constraints: ${mergedConstraints.length} (${normalizedConstraints.length} user + ${breakConstraints.length} breaks + ${absenceConstraints.length} absences)`);
      mergedConstraints.forEach((c, i) => {
        if (c.rule_type === 'Availability') {
          const valueKeys = Object.keys(c.value);
          const slotCount = c.value.unavailable_slots?.length ?? c.value.unavailable?.length ?? 0;
          console.log(`  [${i}] ${c.rule_type} on ${c.target_type} target=${c.target_id?.toString().slice(0, 8)}... | value_keys=${valueKeys} | blocked_slots=${slotCount}`);
        }
      });
      // Log session blueprint teacher IDs for comparison
      const uniqueTeacherIds = [...new Set(sessionBlueprints.map(bp => bp.teacher_id))];
      console.log(`Session blueprint teacher IDs: ${uniqueTeacherIds.map(id => id?.toString().slice(0, 8)).join(', ')}`);
      console.groupEnd();

      const controller = new AbortController();
      solverAbortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 120_000);

      const response = await fetch(`${getApiBaseUrl()}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          constraints: mergedConstraints,
          sessions: sessionBlueprints,
          teachers,
          rooms,
          groups,
          subjects,
          total_days: 5,
          total_slots_per_day: totalSlotsPerDay,
          day_start_time: dayStartTime,
          persist_solution: true,
          max_time_seconds: 60,
        }),
      });
      clearTimeout(timeoutId);

      const payload = (await response.json().catch(() => ({}))) as SolveApiResponse;

      if (!response.ok) {
        if (response.status === 500) {
          const detail = (payload as any).detail;
          if (typeof detail === 'object' && detail?.message === 'Zero-trust verification failed') {
            setSecurityFailure({
              reason: detail.reason ?? 'Unknown constraint violation.',
              verificationHash: response.headers.get('x-verification-secured') ?? undefined,
            });
            return;
          }
        }
        if (response.status === 422 || response.status === 442) {
          const detail = (payload as any).detail;
          const extractedIds = (typeof detail === 'object' && detail?.conflicting_constraint_ids) || [];

          if (Array.isArray(extractedIds) && extractedIds.length > 0) {
            const idsForUi = Array.from(
              new Set(
                extractedIds.flatMap((id) => {
                  const backendId = String(id);
                  const localId = backendIdToLocalId.get(backendId);
                  return localId && localId !== backendId ? [backendId, localId] : [backendId];
                }),
              ),
            );
            setConflictingConstraintIds(idsForUi);

            // Build human-readable diagnostics
            const backendDiagnostics: string[] = Array.isArray(detail?.diagnostics) ? detail.diagnostics : [];
            const conflictLabels = extractedIds.map((id) => {
              const label = conflictLabelById.get(String(id));
              if (label) return label;
              // Fallback: try finding by part of the ID or just rule index
              return `Infeasible rule [${String(id).slice(0, 8)}]`;
            });

            const messages: string[] = [];

            // 1. Add Smart Diagnostics (warnings)
            const warnings = conflictLabels.filter(l => l.includes('⚠️') || l.includes('🚫') || l.includes('⏰') || l.includes('🔬') || l.includes('🚦'));
            if (warnings.length > 0) {
              messages.push(...warnings);
            }

            // 2. Add Backend Diagnostics
            if (backendDiagnostics.length > 0) {
              if (messages.length > 0) messages.push('');
              messages.push(...backendDiagnostics);
            }

            // 3. Add General Rules
            const generalRules = conflictLabels.filter(l => !warnings.includes(l));
            if (generalRules.length > 0) {
              if (messages.length > 0) messages.push('', '--- Conflicting Rules ---');
              messages.push(...generalRules);
            }

            // Ensure we have SOMETHING to show
            if (messages.length === 0 && extractedIds.length > 0) {
              messages.push(`Solver found ${extractedIds.length} conflicting constraints.`);
            }

            setSolverConflictMessages(messages);
            setRightPanelTab('errors');
            toast.error('Schedule cannot be built', {
              description: `Check the Errors panel for details on why this schedule is impossible.`,
              duration: 8000,
            });
            return;
          }

          if (Array.isArray(detail)) {
            const validationSummary = detail
              .slice(0, 2)
              .map((issue) => {
                const path = Array.isArray(issue?.loc) ? issue.loc.join('.') : 'request';
                const msg = typeof issue?.msg === 'string' ? issue.msg : 'invalid value';
                return `${path}: ${msg}`;
              })
              .join(' | ');
            throw new Error(`Solver request invalid. ${validationSummary}`);
          }
        }

        const detail = (payload as any).detail;
        const message = typeof detail === 'object'
          ? detail.message ?? `Solve failed with HTTP ${response.status}`
          : typeof detail === 'string'
            ? detail
            : `Solve failed with HTTP ${response.status}`;
        throw new Error(message);
      }

      const scheduleId = typeof payload.schedule_id === 'string' ? payload.schedule_id : '';
      if (scheduleId) {
        setGroups((previous) => previous.map((g) => (
          g.id === activeGroupId ? { ...g, liveLink: scheduleId } : g
        )));
        try {
          await fetch(`${getApiBaseUrl()}/schedules/${scheduleId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          console.warn('[ChronoLink] Auto-publish failed for schedule', scheduleId);
        }
      }

      const rawScheduledSessions = Array.isArray(payload.scheduled_sessions)
        ? payload.scheduled_sessions
        : [];

      const normalizedScheduledSessions = rawScheduledSessions
        .filter(isBackendScheduledSession)
        .filter((session) => session.day_of_week >= 0 && session.day_of_week < totalDays)
        .filter((session) => session.start_slot >= 0 && session.start_slot < totalSlotsPerDay);

      if (normalizedScheduledSessions.length > 0) {
        // Translate current visual day/time labels into integer grid indexes first.
        const visualSlotByGridIndex = new Map<string, TimeSlot>();
        for (const slot of slots) {
          const dayIndex = dayNameToIndex(slot.day);
          const startSlotIndex = timeLabelToSlotIndex(slot.startTime, intervalMinutes, dayStartTime, breakWindows, timeline);
          if (dayIndex < 0 || startSlotIndex < 0) {
            continue;
          }
          visualSlotByGridIndex.set(`${dayIndex}-${startSlotIndex}`, slot);
        }

        const nextSlots: TimeSlot[] = normalizedScheduledSessions.map((session) => {
          const gridKey = `${session.day_of_week}-${session.start_slot}`;
          const previousVisualSlot = visualSlotByGridIndex.get(gridKey);

          const day = dayIndexToName(session.day_of_week) ?? 'Monday';
          const startTime = slotIndexToTimeLabel(session.start_slot, intervalMinutes, dayStartTime, breakWindows, timeline) ?? '09:00';
          const durationSlots = typeof session.duration === 'number' && session.duration > 0 ? session.duration : 2;
          const endTime = slotIndexToEndTimeLabel(session.start_slot, durationSlots, intervalMinutes, dayStartTime, breakWindows, timeline) ?? startTime;

          // Registry Lookup (Data Integrity Fix)
          const subject =
            subjectRegistry.get(session.subject_id) ??
            normalizedSubjectRegistry.get(session.subject_id) ??
            previousVisualSlot?.subject ??
            `Subject ${shortId(session.subject_id)}`;
          const faculty =
            facultyRegistry.get(session.teacher_id) ??
            normalizedFacultyRegistry.get(session.teacher_id) ??
            previousVisualSlot?.faculty ??
            `Teacher ${shortId(session.teacher_id)}`;
          const room =
            roomRegistry.get(session.room_id) ??
            normalizedRoomRegistry.get(session.room_id) ??
            roomIdRegistry.get(session.room_id) ??
            previousVisualSlot?.room ??
            `Room ${shortId(session.room_id)}`;

          return {
            id: session.id,
            day,
            startTime,
            endTime,
            subject,
            faculty,
            room,
            // Translate the normalized group UUID back to the original group ID so the grid filter matches
            groupId: normalizedGroupIdRegistry.get(session.student_group_id) ?? session.student_group_id,
            type: sessionTypeByBlueprintId.get(session.id) ?? previousVisualSlot?.type ?? 'lecture',
          };
        });

        setSlots(nextSlots);
        setHistory([]);
      }

      toast.success('Solver run complete.', {
        description: scheduleId
          ? `Persisted schedule_id: ${scheduleId}`
          : `Solver completed with ${normalizedScheduledSessions.length} scheduled sessions.`,
      });
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        toast.error('Solver timed out.', { description: 'Request exceeded 90 seconds. Try reducing class configs.' });
      } else {
        let message = error instanceof Error ? error.message : 'Unknown solver error';
        if (message === 'Failed to fetch') {
          message = 'Could not connect to the solver API. Is the backend running on http://localhost:8000?';
        }
        toast.error('Failed to run solver.', { description: message });
      }
    } finally {
      solverAbortRef.current = null;
      setIsSolving(false);
    }
  }

  /* ── DnD state bundle ── */
  const dndState: DndState = { dragSlotId, dropTarget, dropConflict, dropOutOfBounds };

  /* ─────────────────────────────────────────────── */

  return (
    <div className="h-full flex flex-col bg-background">

      {/* ── ZeroTrust Security Failure Modal ── */}
      <AnimatePresence>
        {securityFailure && (
          <SecurityFailureModal
            details={securityFailure}
            onClose={() => setSecurityFailure(null)}
            onRetry={() => { setSecurityFailure(null); void handleRunSolver(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Solving Overlay ── */}
      <AnimatePresence>
        {isSolving && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-6 bg-black/75 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4 text-center max-w-xs">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)' }}>
                <Play className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Solving…</h3>
                <p className="text-sm text-white/60 mt-1">CP-SAT is searching for a valid timetable.</p>
                <p className="text-xs text-white/40 mt-0.5">This may take up to 60 seconds. Do not close this tab.</p>
              </div>
              <button
                onClick={() => { solverAbortRef.current?.abort(); }}
                className="mt-2 px-4 py-2 rounded-lg border border-white/20 text-white/70 text-sm hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toolbar ── */}
      <div className="border-b border-border px-5 py-3 bg-background">
        <div className="flex items-center justify-between gap-4 flex-wrap">

          {/* Left: group + version */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setWorkspaceMode('workbench')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${workspaceMode === 'workbench' ? 'bg-blue-500 text-white' : 'hover:bg-accent'}`}
              >
                Workbench
              </button>
              <button
                onClick={() => setWorkspaceMode('live')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${workspaceMode === 'live' ? 'bg-emerald-500 text-white' : 'hover:bg-accent'}`}
              >
                Live Tab
              </button>
            </div>

            <GroupSelector
              active={activeGroupId}
              groups={groups}
              onChange={handleGroupChange}
            />

            {/* Perspective Toggle: Main Timetable vs Room View */}
            <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/50 ring-1 ring-border/5">
              <button
                onClick={() => {
                  setGridPerspective('student');
                  setPerspectiveTargetId('');
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${gridPerspective === 'student' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Main Timetable
              </button>
              <button
                onClick={() => {
                  setGridPerspective('room');
                  setPerspectiveTargetId('');
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${gridPerspective === 'room' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Room View
              </button>

              {gridPerspective === 'room' && (
                <div className="flex items-center gap-2 border-l border-border/50 ml-1 pl-2">
                  <Layout className="h-3.5 w-3.5 text-emerald-500/50" />
                  <select
                    value={perspectiveTargetId}
                    onChange={(e) => setPerspectiveTargetId(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer min-w-[120px]"
                  >
                    <option value="">Select Room...</option>
                    {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-4">
              <GitBranch className="h-3.5 w-3.5" />
              <span>Draft v{history.length + 1}</span>
            </div>

            <div className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground">
              Testing: <span className="font-semibold text-foreground">{group?.name ?? 'None'}</span>
            </div>

            {group?.isLive && group?.liveLink && (
              <a
                href={`/live/${group.liveLink}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
              >
                <Radio className="h-3 w-3 animate-pulse" />Live: {group.name}
                <Link2 className="h-3 w-3" />
              </a>
            )}

            <div className="text-[11px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
              Auto-saved on localhost
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Drag mode hint */}
            {!dragSlotId && !isReadOnlyMode && (
              <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground/50 mr-1">
                <GripVertical className="h-3.5 w-3.5" />
                <span>Drag to reschedule</span>
              </div>
            )}

            {/* Unsaved changes badge */}
            {hasChanges && (
              <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
                {history.length} unsaved move{history.length !== 1 ? 's' : ''}
              </div>
            )}

            {/* Add Entity Buttons */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowAddRoom(true)}
                disabled={isReadOnlyMode}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-accent transition-colors">
                <DoorOpen className="w-3.5 h-3.5 text-emerald-500" /> Room
              </button>
              <button onClick={() => setShowBulkImport(true)}
                disabled={isReadOnlyMode}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-accent transition-colors">
                <Upload className="w-3.5 h-3.5 text-violet-500" /> Bulk Import
              </button>
              <button onClick={() => setShowAddSubject(true)}
                disabled={isReadOnlyMode}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-accent transition-colors">
                <BookOpen className="w-3.5 h-3.5 text-violet-500" /> Subject
              </button>
            </div>

            {/* Undo */}
            <button
              onClick={handleUndo}
              disabled={!canUndo || isReadOnlyMode}
              title="Undo last move"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Undo</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border border-border rounded-lg bg-card px-1 py-1 h-[38px]">
              <button
                onClick={() => setZoomScale(z => Math.max(0.5, z - 0.1))}
                className="p-1 text-muted-foreground hover:bg-accent rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono w-9 text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale(z => Math.min(2.0, z + 0.1))}
                className="p-1 text-muted-foreground hover:bg-accent rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button onClick={() => setShowIO(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
              <Upload className="w-4 h-4" />Import
            </button>
            <button onClick={() => setShowIO(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
              <Download className="w-4 h-4" />Export
            </button>
            <button
              onClick={() => { void handleRunSolver(); }}
              disabled={isSolving || isReadOnlyMode}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-blue-500 hover:shadow-[0_0_15px_5px_rgba(59,130,246,0.2)] active:scale-95 group"
            >
              <Play className={`w-3.5 h-3.5 ${isSolving ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
              {isSolving ? 'Running…' : 'Run Solver'}
            </button>

            <button
              onClick={handleSave}
              disabled={isReadOnlyMode}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors"
              style={hasChanges ? { borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' } : {}}
            >
              <Save className="w-3.5 h-3.5" />Save
            </button>
            <button
              onClick={() => {
                const isAllLive = groups.length > 0 && groups.every(g => g.isLive);
                const nextLiveStatus = !isAllLive;

                // Update ALL groups to reflect the new live status
                setGroups((prev) => prev.map((g) => ({
                  ...g,
                  isLive: nextLiveStatus,
                  liveLink: nextLiveStatus ? (g.liveLink || g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')) : undefined
                })));

                if (nextLiveStatus) {
                  // Push a dynamic announcement to students
                  try {
                    const stored = window.localStorage.getItem('realtime-timetable.studentAnnouncements');
                    let announcements = [];
                    if (stored) {
                      announcements = JSON.parse(stored);
                    }

                    const changedSubjects = [...new Set(slots.map(s => s.subject).filter(Boolean))];

                    const newAnnouncement = {
                      id: `pub-${Date.now()}`,
                      kind: 'notice',
                      title: 'Timetable Published',
                      detail: `Your timetable has been updated. Changes affect the following subjects: ${changedSubjects.join(', ')}. Please review your new schedule.`,
                      time: new Date().toISOString(),
                      affectsYou: true,
                      read: false,
                    };

                    announcements.unshift(newAnnouncement);
                    window.localStorage.setItem('realtime-timetable.studentAnnouncements', JSON.stringify(announcements));
                    // Manually dispatch storage event for same-window updates
                    window.dispatchEvent(new Event('storage'));
                  } catch (e) {
                    console.error('Failed to create announcement:', e);
                  }

                  toast.success('All timetables published LIVE!', {
                    description: 'Notifications sent to faculty and students.',
                    duration: 5000
                  });
                } else {
                  toast.success('Timetables taken offline', {
                    duration: 4000
                  });
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-white hover:scale-105 transition-all shadow-sm"
              style={{ background: (groups.length > 0 && groups.every(g => g.isLive)) ? '#10b981' : 'linear-gradient(135deg, #059669, #10b981)' }}
            >
              {(groups.length > 0 && groups.every(g => g.isLive)) ? <Radio className="w-3.5 h-3.5 animate-pulse text-white" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {(groups.length > 0 && groups.every(g => g.isLive)) ? 'All Currently Live' : 'Publish All Live'}
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="px-2 py-1 rounded-full border border-border">
            Viewing: <strong className="text-foreground">{viewingGroup?.name ?? 'Unknown group'}</strong>
          </span>
          <span className="px-2 py-1 rounded-full border border-border">
            School window: <strong className="text-foreground">{normalizedSchoolWindow.start} - {normalizedSchoolWindow.end}</strong>
          </span>
          <span className="px-2 py-1 rounded-full border border-border">
            Slot size: <strong className="text-foreground">{periodDurationMinutes}m</strong>
          </span>
          {isReadOnlyMode && (
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
              Live mode is read-only
            </span>
          )}
        </div>

        {/* Conflict warning strip — shown when a drag-drop created conflicts */}
        <AnimatePresence>
          {hasChanges && (() => {
            /* compute in-grid conflicts among current slots */
            const inlineConflicts: string[] = [];
            slots.forEach(s => {
              slots.forEach(t => {
                if (s.id >= t.id) return;
                if (s.day === t.day && s.startTime < t.endTime && s.endTime > t.startTime) {
                  const sameFaculty = !!s.faculty && !!t.faculty && s.faculty === t.faculty;
                  const sameRoom = !!s.room && !!t.room && s.room === t.room;
                  if (sameFaculty || sameRoom) {
                    inlineConflicts.push(`${s.subject} ↔ ${t.subject} (${s.day})`);
                  }
                }
              });
            });
            if (inlineConflicts.length === 0) return null;
            return (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 overflow-hidden"
              >
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>
                    <strong>{inlineConflicts.length} time conflict{inlineConflicts.length !== 1 ? 's' : ''} detected: </strong>
                    {inlineConflicts.slice(0, 3).join(' · ')}
                    {inlineConflicts.length > 3 && ` +${inlineConflicts.length - 3} more`}
                  </span>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          {hasSolverErrors && (
            <div className="mx-5 mt-5 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <div className="flex items-center gap-2 text-red-500 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Schedule cannot be built — {solverConflictMessages.filter(l => l.startsWith('⚠️') || l.startsWith('🔬') || l.startsWith('🏫') || l.startsWith('⏰') || l.startsWith('🚪') || l.startsWith('👩')).length || solverConflictMessages.length} issue(s) detected
              </div>
              <div className="mt-2 max-h-28 overflow-auto space-y-1.5 pr-1">
                {solverConflictMessages
                  .filter(l => l.trim() && !l.startsWith('---') && !l.startsWith('Rule '))
                  .slice(0, 3)
                  .map((line, idx) => (
                    <div key={`grid-error-${idx}`} className="text-[11px] text-red-500/90 break-words leading-relaxed">
                      {line}
                    </div>
                  ))}
                {solverConflictMessages.length > 3 && (
                  <div className="text-[11px] text-red-400/70 italic">
                    See Errors panel for full details →
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className="flex-1 overflow-auto p-5 pt-3 relative"
            onDragOver={(e) => {
              e.preventDefault();
              // When dragging over the outer container (outside the grid),
              // show "remove" indicator for internal drags
              if (dragSlotId) {
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              // If an internal slot was dragged outside the grid, remove it
              const textData = e.dataTransfer.getData('text/plain') || '';
              const slotId = textData || dragSlotIdRef.current;
              if (slotId && !textData.startsWith('{')) {
                const slotToRemove = slots.find(s => s.id === slotId);
                if (slotToRemove) {
                  setHistory(prev => [...prev, [...slots]]);
                  setSlots(prev => prev.filter(s => s.id !== slotId));
                  toast.success('Session removed', {
                    description: `${slotToRemove.subject ?? 'Session'} dragged out of timetable`,
                  });
                }
              }
              handleDragEnd();
            }}
          >
            {/* Drag-out removal indicator */}
            <AnimatePresence>
              {dragSlotId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 pointer-events-none flex items-end justify-center pb-6"
                >
                  <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-sm">
                    <Trash2 className="w-3.5 h-3.5" />
                    Drop outside grid to remove session
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <TimetableGrid
              slots={slots.filter(s => {
                if (gridPerspective === 'faculty') return s.faculty === perspectiveTargetId;
                if (gridPerspective === 'room') return s.room === perspectiveTargetId;
                // Default: Student View
                return !s.groupId || s.groupId === viewingGroupId;
              })}
              isReadOnly={isReadOnlyMode}
              {...dndState}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onCellDragOver={handleCellDragOver}
              onCellDragLeave={handleCellDragLeave}
              onCellDrop={handleCellDrop}
              onDeleteSlot={handleDeleteSlot}
              totalDays={totalDays}
              totalSlotsPerDay={totalSlotsPerDay}
              dayStartTime={dayStartTime}
              intervalMinutes={intervalMinutes}
              breakSlotIndexes={breakSlotIndexes}
              breakNames={breakNamesBySlot}
              breakWindows={breakWindows}
              timeline={timeline}
              zoomScale={zoomScale}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-96 border-l border-border bg-card flex flex-col overflow-hidden">
          {/* Tabs Header */}
          <div className="flex border-b border-border bg-muted/20">
            <button
              onClick={() => setRightPanelTab('classes')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${rightPanelTab === 'classes' ? 'text-blue-500 border-b-2 border-blue-500 bg-card' : 'text-muted-foreground hover:bg-muted/30'}`}
            >
              Classes
            </button>

            {hasSolverErrors ? (
              <button
                onClick={() => setRightPanelTab('errors')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${rightPanelTab === 'errors' ? 'text-red-500 border-b-2 border-red-500 bg-card' : 'text-red-500/80 hover:bg-red-500/5'}`}
              >
                Errors ({conflictingConstraintIds.length || solverConflictMessages.length})
              </button>
            ) : (
              <button
                onClick={() => setRightPanelTab('constraints')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${rightPanelTab === 'constraints' ? 'text-blue-500 border-b-2 border-blue-500 bg-card' : 'text-muted-foreground hover:bg-muted/30'}`}
              >
                Solver Rules
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {isReadOnlyMode ? (
              <div className="h-full p-4">
                <div className="rounded-md border border-border p-4 text-sm space-y-2 bg-card">
                  <p className="font-semibold">Live Tab</p>
                  <p className="text-muted-foreground">
                    This tab is locked for safe viewing. Switch to Workbench to edit the testing group, run solver, and publish changes.
                  </p>
                </div>
              </div>
            ) : rightPanelTab === 'classes' ? (
              <ClassConfigPanel
                teachers={teachers}
                rooms={rooms}
                groups={groups}
                subjects={subjects}
                groupFaculty={groupFaculty}
                activeGroupId={activeGroupId}
                classConfigs={classConfigs}
                scheduledSlots={slots}
                onClassConfigsChange={setClassConfigs}
                onGroupFacultyChange={setGroupFaculty}
              />
            ) : rightPanelTab === 'errors' ? (
              <div className="h-full p-4 overflow-auto">
                <div className="rounded-md border border-red-500/40 bg-red-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-red-500 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4" /> Scheduling Issues Detected
                  </div>
                  <p className="text-xs text-red-500/90">
                    {solverConflictMessages.length} issue(s) preventing a valid schedule.
                  </p>
                  <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                    {(solverConflictMessages.length > 0
                      ? solverConflictMessages
                      : conflictingConstraintIds.map((id) => `Infeasible rule [${id}]`)
                    ).map((line, idx) => {
                      if (line.startsWith('---')) {
                        return <div key={idx} className="my-2 h-px bg-red-500/20" />;
                      }
                      if (/^-{3,}/.test(line)) {
                        return (
                          <div key={`solver-error-${idx}`} className="text-[10px] font-bold uppercase tracking-wider text-red-400/70 pt-2 border-t border-red-500/20">
                            {line.replace(/^-+\s*/, '').replace(/\s*-+$/, '')}
                          </div>
                        );
                      }
                      if (!line.trim()) return <div key={`solver-error-${idx}`} className="h-1" />;
                      const isDiagnostic = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(line);
                      if (isDiagnostic) {
                        return (
                          <div key={`solver-error-${idx}`}
                            className="text-xs leading-relaxed p-2.5 rounded-md border border-red-500/20 bg-red-500/[0.03]">
                            {line}
                          </div>
                        );
                      }
                      return (
                        <div key={`solver-error-${idx}`} className="text-[11px] font-mono text-red-500/70 break-all pl-2">
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <ConstraintBuilder
                initialConstraints={solverConstraints}
                onConstraintsChange={setSolverConstraints}
                conflictingIds={conflictingConstraintIds}
                conflictMessages={solverConflictMessages}
                teachers={teachers}
                rooms={rooms}
                groups={groups}
                subjects={subjects}
                periodDurationMinutes={periodDurationMinutes}
                onPeriodDurationChange={(val) => {
                  setPeriodDurationMinutes(val);
                  if (slots.length > 0) {
                    setSlots([]);
                    setHistory([]);
                    toast.info('Timetable cleared due to grid configuration change.');
                  }
                }}
                dayStartTime={dayStartTime}
                onDayStartTimeChange={(val) => {
                  setDayStartTime(val);
                  if (slots.length > 0) {
                    setSlots([]);
                    setHistory([]);
                    toast.info('Timetable cleared due to school start time change.');
                  }
                }}
                schoolEndTime={schoolEndTime}
                onSchoolEndTimeChange={(val) => {
                  setSchoolEndTime(val);
                  if (slots.length > 0) {
                    setSlots([]);
                    setHistory([]);
                    toast.info('Timetable cleared due to school end time change.');
                  }
                }}
                breakWindows={breakWindows}
                onBreakWindowChange={(id, next) => {
                  setBreakWindows((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)));
                }}
                onAddBreakWindow={() => {
                  setBreakWindows((prev) => [
                    ...prev,
                    {
                      id: `block-${Date.now()}`,
                      name: `Event Block ${prev.length + 1}`,
                      enabled: true,
                      startTime: dayStartTime,
                      durationMinutes: 60,
                      reason: '',
                    },
                  ]);
                }}
                onRemoveBreakWindow={(id) => {
                  setBreakWindows((prev) => prev.filter((item) => item.id !== id));
                }}
                totalSlotsPerDay={totalSlotsPerDay}
                intervalMinutes={intervalMinutes}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddRoom && (
          <AddEntityModal title="Add Room" onClose={() => setShowAddRoom(false)} onConfirm={() => {
            const name = (document.getElementById('room-name') as HTMLInputElement).value;
            const rid = (document.getElementById('room-id') as HTMLInputElement).value;
            if (!name || !rid) return toast.error('Required fields missing');
            const id = uuidv4();
            setRooms(prev => [...prev, { id, roomId: rid, name, capacity: 40, type: 'classroom', equipment: [], isAvailable: true }]);
            setShowAddRoom(false);
            toast.success(`Room ${name} created.`);
          }}>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Display Name</label>
                <input id="room-name" className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Room 505" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">System ID</label>
                <input id="room-id" className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. R505" />
              </div>
            </div>
          </AddEntityModal>
        )}

        {showAddSubject && (
          <AddEntityModal title="Add Subject" onClose={() => setShowAddSubject(false)} onConfirm={() => {
            const name = (document.getElementById('sub-name') as HTMLInputElement).value;
            if (!name) return toast.error('Subject name is required');
            const id = uuidv4();
            setSubjects(prev => [...prev, { id, name }]);
            setShowAddSubject(false);
            toast.success(`Subject ${name} added.`);
          }}>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Subject Name</label>
                <input id="sub-name" className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Theory of Computation" />
              </div>
            </div>
          </AddEntityModal>
        )}
        {showGoLive && group && (
          <GoLiveModal group={group} onClose={() => setShowGoLive(false)} onConfirm={confirmGoLive} />
        )}
        {showIO && (
          <IOPanel
            onClose={() => setShowIO(false)}
            onExportJson={exportWorkspaceAsJson}
            onImportJson={importWorkspaceFromJson}
          />
        )}
        {showBulkImport && (
          <BulkDataImporter
            open={showBulkImport}
            onClose={() => setShowBulkImport(false)}
            onApply={handleBulkApply}
          />
        )}
      </AnimatePresence>
    </div>
  );
}