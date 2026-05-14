import { useState, useMemo } from 'react';
import type { DragEvent } from 'react';
import {
  Plus, Trash2, Users, BookOpen, UserPlus, GripVertical,
  CheckCircle2, Layers, Beaker, X, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router';

import type {
  Faculty, Room, Group, Subject,
  ClassConfig, ClassSubjectRow, GroupFacultyAssignment, TimeSlot,
} from '../types';

/* ── Types ── */

interface ClassConfigPanelProps {
  teachers: Faculty[];
  rooms: Room[];
  groups: Group[];
  subjects: Subject[];
  groupFaculty: GroupFacultyAssignment[];
  activeGroupId: string;
  classConfigs: ClassConfig[];
  scheduledSlots: TimeSlot[];
  onClassConfigsChange: (configs: ClassConfig[]) => void;
  onGroupFacultyChange: (gf: GroupFacultyAssignment[]) => void;
}

/* ── Helpers ── */

const TYPE_META = {
  lecture: { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', label: 'LEC', icon: BookOpen },
  practical: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'PRC', icon: Beaker },
} as const;

function SpinButton({
  value, min = 0, max = 10, onChange,
}: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  const safeValue = value ?? 0;
  return (
    <div className="flex items-center gap-0 border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => onChange(Math.max(min, safeValue - 1))}
        className="w-6 h-6 flex items-center justify-center text-xs hover:bg-muted transition-colors text-muted-foreground font-bold"
      >−</button>
      <span className="w-6 text-center text-xs font-bold font-mono">{safeValue}</span>
      <button
        onClick={() => onChange(Math.min(max, safeValue + 1))}
        className="w-6 h-6 flex items-center justify-center text-xs hover:bg-muted transition-colors text-muted-foreground font-bold"
      >+</button>
    </div>
  );
}

/* ── Main Component ── */

export function ClassConfigPanel({
  teachers,
  rooms,
  groups,
  subjects,
  groupFaculty,
  activeGroupId,
  classConfigs,
  scheduledSlots,
  onClassConfigsChange,
  onGroupFacultyChange,
}: ClassConfigPanelProps) {

  /* ── Form state for adding a new row ── */
  const [addSubjectId, setAddSubjectId] = useState(subjects[0]?.id ?? '');
  const [addTeacherId, setAddTeacherId] = useState('');
  const [addRoomId, setAddRoomId] = useState('');
  const [addLectures, setAddLectures] = useState(3);
  const [addPracticals, setAddPracticals] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFacultyMgr, setShowFacultyMgr] = useState(false);

  /* ── Derived data for active group ── */
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const assignedFaculty = useMemo(() => {
    const assignment = groupFaculty.find(gf => gf.groupId === activeGroupId);
    if (!assignment) return teachers; // fallback: show all
    return teachers.filter(t => assignment.teacherIds.includes(t.id));
  }, [groupFaculty, activeGroupId, teachers]);

  const activeConfig = classConfigs.find(c => c.groupId === activeGroupId)
    ?? { groupId: activeGroupId, rows: [] };

  /* ── Count placed sessions for a row ── */
  function countPlaced(row: ClassSubjectRow, type: 'lecture' | 'practical'): number {
    const subjectName = subjects.find(s => s.id === row.subjectId)?.name;
    if (!subjectName) return 0;
    return scheduledSlots.filter(s => {
      // Must match subject and session type
      if (s.subject !== subjectName || s.type !== type) return false;
      // Must belong to the active group (or have no group set)
      if (s.groupId && s.groupId !== activeGroupId) return false;
      // If a teacher is assigned, also match by teacher to avoid cross-row collisions
      if (row.teacherId) {
        const teacherName = teachers.find(t => t.id === row.teacherId)?.name;
        if (teacherName && s.faculty !== teacherName) return false;
      }
      return true;
    }).length;
  }

  /* ── Update helper ── */
  function updateConfig(newRows: ClassSubjectRow[]) {
    const next = classConfigs.filter(c => c.groupId !== activeGroupId);
    onClassConfigsChange([...next, { groupId: activeGroupId, rows: newRows }]);
  }

  function updateRow(id: string, patch: Partial<ClassSubjectRow>) {
    updateConfig(activeConfig.rows.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function deleteRow(id: string) {
    updateConfig(activeConfig.rows.filter(r => r.id !== id));
  }

  function addRow() {
    if (!addSubjectId) {
      toast.error('Missing Information', { description: 'Please select a Subject to add.' });
      return;
    }
    const subName = subjects.find(s => s.id === addSubjectId)?.name ?? 'Subject';
    const newRow: ClassSubjectRow = {
      id: uuidv4(),
      subjectId: addSubjectId,
      teacherId: addTeacherId,
      roomId: addRoomId || undefined,
      lecturesPerWeek: addLectures ?? 0,
      practicalsPerWeek: addPracticals ?? 0,
    };
    updateConfig([...activeConfig.rows, newRow]);
    setShowAddForm(false);
    toast.success(`Added ${subName} to curriculum.`);
  }

  /* ── Faculty roster management ── */
  function toggleFaculty(teacherId: string) {
    const current = groupFaculty.find(gf => gf.groupId === activeGroupId);
    const currentIds = current?.teacherIds ?? teachers.map(t => t.id);
    const next = currentIds.includes(teacherId)
      ? currentIds.filter(id => id !== teacherId)
      : [...currentIds, teacherId];
    const filtered = groupFaculty.filter(gf => gf.groupId !== activeGroupId);
    onGroupFacultyChange([...filtered, { groupId: activeGroupId, teacherIds: next }]);
  }

  /* ── Drag start ── */
  function handleBlockDragStart(
    e: DragEvent<HTMLDivElement>,
    row: ClassSubjectRow,
    sessionType: 'lecture' | 'practical',
  ) {
    const payload = JSON.stringify({
      rowId: row.id,
      subjectId: row.subjectId,
      teacherId: row.teacherId,
      roomId: row.roomId ?? null,
      sessionType,
    });
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'copy';

    const subjectName = subjects.find(s => s.id === row.subjectId)?.name ?? 'Session';
    const meta = TYPE_META[sessionType];
    const ghost = document.createElement('div');
    ghost.textContent = `${meta.label}  ${subjectName}`;
    ghost.style.cssText = [
      'position:fixed', 'top:-300px', 'left:-300px',
      `background:${meta.color}`, 'color:white',
      'padding:5px 12px', 'border-radius:8px',
      'font-size:11px', 'font-weight:700', 'white-space:nowrap',
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
    ].join(';');
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 16);
    setTimeout(() => {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 0);
  }

  /* ── Stats ── */
  const totalLec = activeConfig.rows.reduce((s, r) => s + (r.lecturesPerWeek ?? 0), 0);
  const totalPrc = activeConfig.rows.reduce((s, r) => s + (r.practicalsPerWeek ?? 0), 0);
  const placedLec = activeConfig.rows.reduce((s, r) => s + countPlaced(r, 'lecture'), 0);
  const placedPrc = activeConfig.rows.reduce((s, r) => s + countPlaced(r, 'practical'), 0);

  /* ── Render ── */
  return (
    <div className="flex flex-col h-full overflow-hidden text-[13px]">

      {/* ── Header ── */}
      <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
            {activeGroup?.name ?? 'Class'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/60">
            <span className="text-blue-400 font-bold">{placedLec}/{totalLec}</span> lec
            {' · '}
            <span className="text-violet-400 font-bold">{placedPrc}/{totalPrc}</span> prc
          </span>
          <button
            onClick={() => setShowFacultyMgr(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-muted-foreground hover:bg-muted transition-colors border border-transparent hover:border-border"
            title="Manage assigned professors"
          >
            <Users className="h-3 w-3" /> Faculty
          </button>
        </div>
      </div>

      {/* ── Subject rows ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* ── Faculty Manager (inline) ── */}
        {showFacultyMgr && (
          <div className="rounded-md border border-border bg-card p-3 mb-2 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Assigned Professors
              </span>
              <button onClick={() => setShowFacultyMgr(false)} className="text-muted-foreground/40 hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {teachers.length === 0 ? (
                <div className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No faculty in directory.</div>
              ) : teachers.map(t => {
                const assigned = assignedFaculty.some(f => f.id === t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleFaculty(t.id)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all border"
                    style={assigned ? {
                      background: 'rgba(59,130,246,0.12)',
                      borderColor: 'rgba(59,130,246,0.35)',
                      color: '#3b82f6',
                    } : {
                      background: 'transparent',
                      borderColor: 'var(--border)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {assigned ? '✓ ' : ''}{t.name.split(' ').slice(-1)[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeConfig.rows.length === 0 && !showAddForm && (
          <div className="h-36 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-md opacity-30 gap-2">
            <BookOpen className="h-8 w-8" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-center">
              No subjects configured
            </span>
          </div>
        )}

        {/* Sorted: lectures come before practicals — shown as inline draggable chips */}
        {activeConfig.rows.map((row) => {
          const subject = subjects.find(s => s.id === row.subjectId);
          const teacher = teachers.find(t => t.id === row.teacherId);
          const room = rooms.find(r => r.id === row.roomId);
          const rowLecs = row.lecturesPerWeek ?? 0;
          const rowPracs = row.practicalsPerWeek ?? 0;
          const placedL = countPlaced(row, 'lecture');
          const placedP = countPlaced(row, 'practical');
          const remL = Math.max(0, rowLecs - placedL);
          const remP = Math.max(0, rowPracs - placedP);
          const doneL = remL === 0;
          const doneP = remP === 0 || rowPracs === 0;

          return (
            <div
              key={row.id}
              className="rounded-md border border-border bg-card shadow-sm group/row"
            >
              {/* ── Row header ── */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-foreground truncate">
                    {subject?.name ?? '—'}
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 truncate flex items-center gap-1">
                    <UserPlus className="h-2.5 w-2.5 inline" />
                    {teacher?.name ?? '—'}
                    {room && <><span className="mx-0.5 opacity-40">·</span>{room.name}</>}
                  </div>
                </div>
                {/* Inline spinners */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-blue-400 font-bold uppercase leading-none">LEC</span>
                    <SpinButton
                      value={rowLecs}
                      onChange={v => updateRow(row.id, { lecturesPerWeek: v })}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-violet-400 font-bold uppercase leading-none">PRC</span>
                    <SpinButton
                      value={rowPracs}
                      onChange={v => updateRow(row.id, { practicalsPerWeek: v })}
                    />
                  </div>
                </div>
                <button
                  onClick={() => deleteRow(row.id)}
                  className="p-1 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors text-muted-foreground/20 opacity-0 group-hover/row:opacity-100 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── Draggable blocks ── */}
              <div className="px-3 pb-3 space-y-1.5">

                {/* Lecture blocks */}
                {Array.from({ length: remL }).map((_, i) => (
                  <div
                    key={`l-${i}`}
                    draggable
                    onDragStart={e => handleBlockDragStart(e, row, 'lecture')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing select-none transition-all hover:scale-[1.02] hover:shadow-md border"
                    style={{
                      background: TYPE_META.lecture.bg,
                      borderColor: `${TYPE_META.lecture.color}40`,
                    }}
                    title={`Drag to place ${subject?.name} lecture`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0" style={{ color: TYPE_META.lecture.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold truncate" style={{ color: TYPE_META.lecture.color }}>
                        {subject?.name ?? 'Lecture'}
                      </div>
                      {teacher && (
                        <div className="text-[9px] text-muted-foreground/70 truncate">{teacher.name}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${TYPE_META.lecture.color}20`, color: TYPE_META.lecture.color }}>
                      LEC {i + 1}/{remL}
                    </span>
                  </div>
                ))}

                {/* Practical blocks */}
                {Array.from({ length: remP }).map((_, i) => (
                  <div
                    key={`p-${i}`}
                    draggable
                    onDragStart={e => handleBlockDragStart(e, row, 'practical')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing select-none transition-all hover:scale-[1.02] hover:shadow-md border"
                    style={{
                      background: TYPE_META.practical.bg,
                      borderColor: `${TYPE_META.practical.color}40`,
                    }}
                    title={`Drag to place ${subject?.name} practical`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0" style={{ color: TYPE_META.practical.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold truncate" style={{ color: TYPE_META.practical.color }}>
                        {subject?.name ?? 'Practical'}
                      </div>
                      {teacher && (
                        <div className="text-[9px] text-muted-foreground/70 truncate">{teacher.name}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${TYPE_META.practical.color}20`, color: TYPE_META.practical.color }}>
                      PRC {i + 1}/{remP}
                    </span>
                  </div>
                ))}

                {/* Done indicators */}
                {doneL && rowLecs > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] font-semibold text-emerald-500">{rowLecs} lecture{rowLecs !== 1 ? 's' : ''} placed</span>
                  </div>
                )}
                {doneP && rowPracs > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] font-semibold text-emerald-500">{rowPracs} practical{rowPracs !== 1 ? 's' : ''} placed</span>
                  </div>
                )}

                {/* Progress badge */}
                {(remL > 0 || remP > 0) && (placedL > 0 || placedP > 0) && (
                  <div className="text-[9px] text-muted-foreground/40 text-right px-1">
                    {placedL + placedP}/{rowLecs + rowPracs} placed
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Add row form ── */}
        {showAddForm ? (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Map Subject & Teacher</span>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground/40 hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {subjects.length === 0 && (
              <div className="text-[10px] text-amber-500 bg-amber-500/10 p-2 rounded flex items-start gap-2">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>No subjects globally registered. Go to <Link to="/directory" className="underline font-bold">Directory</Link> to add subjects first.</span>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground/60">Subject</label>
              <select
                value={addSubjectId}
                onChange={e => setAddSubjectId(e.target.value)}
                disabled={subjects.length === 0}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-semibold focus:outline-none"
              >
                <option value="">Select subject...</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Professor — Optional */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground/60">Professor (Optional)</label>
              <select
                value={addTeacherId}
                onChange={e => setAddTeacherId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-semibold focus:outline-none"
              >
                <option value="">TBA / Unassigned</option>
                {assignedFaculty.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Room */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground/60">Room (Optional)</label>
              <select
                value={addRoomId}
                onChange={e => setAddRoomId(e.target.value)}
                disabled={rooms.length === 0}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-semibold focus:outline-none"
              >
                <option value="">Auto-assign / Flexible</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity})</option>)}
              </select>
            </div>

            {/* Counts */}
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-bold uppercase text-blue-400">Lectures / wk</label>
                <SpinButton value={addLectures} onChange={setAddLectures} />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-bold uppercase text-violet-400">Practicals / wk</label>
                <SpinButton value={addPracticals} onChange={setAddPracticals} />
              </div>
            </div>

            <button
              onClick={addRow}
              disabled={!addSubjectId}
              className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50 active:scale-[0.98]"
              style={{ background: '#3b82f6' }}
            >
              Save Mapping
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setAddTeacherId(assignedFaculty[0]?.id ?? ''); setShowAddForm(true); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border-2 border-dashed border-border text-xs font-bold text-muted-foreground hover:border-blue-500/50 hover:text-blue-400 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Add Subject to Class
          </button>
        )}
      </div>

      {/* ── Drag hint ── */}
      <div className="shrink-0 px-4 py-2 border-t border-border bg-muted/10 text-[9px] text-muted-foreground/40 text-center font-medium">
        Drag <span className="text-blue-400 font-bold">LEC</span> or <span className="text-violet-400 font-bold">PRC</span> blocks onto the grid to place sessions
      </div>
    </div>
  );
}