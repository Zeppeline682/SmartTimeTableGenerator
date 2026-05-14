import { useState, useMemo } from 'react';
import {
  Plus, Search, LayoutGrid, List, DoorOpen,
  FlaskConical, Presentation, Users, MapPin,
  Cpu, Trash2, Pencil, X, Check, Building2,
  ChevronDown, CheckCircle2, XCircle, Download,
  Filter, Layers, Clock, Calendar, BookOpen, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useWorkspaceStore } from '../hooks/useWorkspaceStore';
import { useRealTimeClock } from '../hooks/useRealTime';
import type { Room, TimeSlot } from '../types';

/* ─── Real-time occupancy helpers ───────────────────────── */

/** Parse "HH:MM" into total minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Compute real-time status for a room given the current live timetable.
 * Returns: 'disabled' | 'busy' | 'free'
 */
function getRoomLiveStatus(
  room: Room,
  slots: TimeSlot[],
  dayName: string,
  timeLabel: string,
): 'disabled' | 'busy' | 'free' {
  if (!room.isAvailable) return 'disabled';
  const nowMins = toMinutes(timeLabel);
  const isBusy = slots.some(
    (s) =>
      s.room === room.name &&
      s.day === dayName &&
      nowMins >= toMinutes(s.startTime) &&
      nowMins < toMinutes(s.endTime),
  );
  return isBusy ? 'busy' : 'free';
}

/** All sessions for a specific room across the whole week, sorted Mon→Fri→time */
const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getRoomSchedule(room: Room, slots: TimeSlot[]): TimeSlot[] {
  return slots
    .filter((s) => s.room === room.name)
    .sort((a, b) => {
      const dDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
      if (dDiff !== 0) return dDiff;
      return toMinutes(a.startTime) - toMinutes(b.startTime);
    });
}


/* ─── Constants ──────────────────────────────────────── */

const TYPE_META: Record<Room['type'], { label: string; color: string; border: string; bg: string; Icon: LucideIcon }> = {
  classroom:      { label: 'Classroom',     color: '#3b82f6', border: 'rgba(59,130,246,0.25)',  bg: 'rgba(59,130,246,0.08)',  Icon: DoorOpen },
  lab:            { label: 'Lab',           color: '#10b981', border: 'rgba(16,185,129,0.25)',  bg: 'rgba(16,185,129,0.08)',  Icon: FlaskConical },
  seminar:        { label: 'Seminar',       color: '#8b5cf6', border: 'rgba(139,92,246,0.25)', bg: 'rgba(139,92,246,0.08)', Icon: Presentation },
  'lecture-hall': { label: 'Lecture Hall',  color: '#f59e0b', border: 'rgba(245,158,11,0.25)', bg: 'rgba(245,158,11,0.08)', Icon: Users },
};

const BUILDINGS = ['All Buildings', 'Main Block', 'Tech Block', 'Auditorium'];
const TYPES: (Room['type'] | 'all')[] = ['all', 'classroom', 'lab', 'seminar', 'lecture-hall'];

/* ─── Add/Edit Dialog ────────────────────────────────── */

interface RoomDialogProps {
  room?: Room;
  onClose: () => void;
  onSave: (r: Omit<Room, 'id'>) => void;
}

function RoomDialog({ room, onClose, onSave }: RoomDialogProps) {
  const [form, setForm] = useState({
    roomId:      room?.roomId      ?? '',
    name:        room?.name        ?? '',
    capacity:    room?.capacity    ?? 30,
    type:        room?.type        ?? 'classroom' as Room['type'],
    equipment:   room?.equipment?.join(', ') ?? '',
    building:    room?.building    ?? 'Main Block',
      building_tag: room?.building_tag ?? '',
    floor:       room?.floor       ?? '1',
    isAvailable: room?.isAvailable ?? true,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roomId.trim() || !form.name.trim()) {
      toast.error('Room ID and Name are required.');
      return;
    }
    onSave({
      roomId:      form.roomId.trim(),
      name:        form.name.trim(),
      capacity:    Number(form.capacity),
      type:        form.type,
      equipment:   form.equipment.split(',').map(s => s.trim()).filter(Boolean),
      building:    form.building || undefined,
        building_tag: form.building_tag.trim() || undefined,
      floor:       form.floor    || undefined,
      isAvailable: form.isAvailable,
      sessionsToday: 0,
    });
  };

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{label}</label>
      {node}
    </div>
  );

  const input = (key: keyof typeof form, type = 'text') => (
    <input
      type={type}
      value={String(form[key])}
      onChange={e => setForm(p => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
    />
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xl rounded-2xl border border-border overflow-hidden bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <DoorOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">{room ? 'Edit Room' : 'Add New Room'}</h2>
              <p className="text-xs text-muted-foreground mt-1">Configure physical space details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            {field('Room ID *', input('roomId'))}
            {field('Display Name *', input('name'))}
          </div>
          <div className="grid grid-cols-2 gap-5">
            {field('Capacity', input('capacity', 'number'))}
            {field('Type', (
              <div className="relative">
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as Room['type'] }))}
                  className="w-full appearance-none px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {(Object.keys(TYPE_META) as Room['type'][]).map(t => (
                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-5">
            {field('Building', input('building'))}
            {field('Floor', input('floor'))}
          </div>
          {field('Building Tag', input('building_tag'))}
          {field('Equipment (comma-separated)', input('equipment'))}

          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
            <div>
              <span className="text-sm font-semibold block">Available for scheduling</span>
              <span className="text-[11px] text-muted-foreground">Enable this room in the solver logic</span>
            </div>
            <button type="button"
              onClick={() => setForm(p => ({ ...p, isAvailable: !p.isAvailable }))}
              className="w-12 h-6.5 rounded-full relative transition-all duration-300 shadow-inner"
              style={{ background: form.isAvailable ? '#10b981' : 'rgba(255,255,255,0.1)', padding: '3px' }}>
              <div className="w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300"
                style={{ transform: form.isAvailable ? 'translateX(22px)' : 'translateX(0)' }} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted/50 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="px-8 py-2.5 text-sm font-bold text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
              {room ? 'Save Changes' : 'Create Room'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Room Schedule Drawer ───────────────────────────────── */

const SESSION_TYPE_STYLE = {
  lecture:   { bg: 'rgba(59,130,246,0.10)', color: '#3b82f6', label: 'Lecture' },
  practical: { bg: 'rgba(16,185,129,0.10)', color: '#10b981', label: 'Practical' },
  tutorial:  { bg: 'rgba(245,158,11,0.10)', color: '#f59e0b', label: 'Tutorial' },
};

function RoomScheduleDrawer({
  room, schedule, onClose, clock,
}: {
  room: Room;
  schedule: TimeSlot[];
  onClose: () => void;
  clock: { dayName: string; timeLabel: string };
}) {
  const meta = TYPE_META[room.type];
  const grouped = DAY_ORDER.reduce<Record<string, TimeSlot[]>>((acc, day) => {
    const daySessions = schedule.filter((s) => s.day === day);
    if (daySessions.length > 0) acc[day] = daySessions;
    return acc;
  }, {});
  const days = Object.keys(grouped);

  return (
    <div className="fixed inset-0 z-[200] flex" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="flex-1 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-xl bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-border bg-muted/20 flex items-center gap-4 shrink-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
            {(() => { const Icon = meta.Icon; return <Icon className="w-5 h-5" style={{ color: meta.color }} />; })()}
          </div>
          <div className="flex-1 overflow-hidden">
            <h2 className="font-bold text-base leading-tight truncate">{room.name}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {room.roomId} · {meta.label} · {room.capacity} seats
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/60 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live now banner */}
        <div className="px-7 py-3 border-b border-border flex items-center gap-3 bg-background/50 shrink-0">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            {clock.dayName}, {clock.timeLabel} —
          </span>
          {(() => {
            const nowMins = toMinutes(clock.timeLabel);
            const nowSession = schedule.find(
              (s) => s.day === clock.dayName &&
                nowMins >= toMinutes(s.startTime) &&
                nowMins < toMinutes(s.endTime),
            );
            if (!room.isAvailable) return <span className="text-xs font-bold text-red-500">Disabled for scheduling</span>;
            if (nowSession) return (
              <span className="text-xs font-bold text-amber-500">
                In use — {nowSession.subject} ({nowSession.faculty})
              </span>
            );
            return <span className="text-xs font-bold text-emerald-500">Currently Free</span>;
          })()}
        </div>

        {/* Schedule body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
          {days.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Calendar className="w-12 h-12 opacity-10 mb-3" />
              <p className="font-bold">No sessions scheduled</p>
              <p className="text-sm mt-1">Generate a timetable to see this room's schedule.</p>
            </div>
          ) : days.map((day) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-black uppercase tracking-widest ${day === clock.dayName ? 'text-blue-500' : 'text-muted-foreground'}`}>
                  {day}
                </span>
                {day === clock.dayName && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">Today</span>
                )}
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">{grouped[day].length} session{grouped[day].length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {grouped[day].map((s) => {
                  const sStyle = SESSION_TYPE_STYLE[s.type ?? 'lecture'] ?? SESSION_TYPE_STYLE.lecture;
                  const nowMins = toMinutes(clock.timeLabel);
                  const isNow = day === clock.dayName &&
                    nowMins >= toMinutes(s.startTime) &&
                    nowMins < toMinutes(s.endTime);
                  return (
                    <div key={s.id}
                      className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${
                        isNow ? 'border-amber-500/40 bg-amber-500/5 shadow-sm' : 'border-border/60 bg-muted/10'
                      }`}>
                      <div className="text-center shrink-0 w-16">
                        <p className="text-[11px] font-black tabular-nums">{s.startTime}</p>
                        <p className="text-[10px] text-muted-foreground">→ {s.endTime}</p>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate">{s.subject}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.faculty} · {s.groupId}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                          style={{ background: sStyle.bg, color: sStyle.color }}>
                          {sStyle.label}
                        </span>
                        {isNow && <span className="text-[10px] font-bold text-amber-500 animate-pulse">LIVE</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="px-7 py-4 border-t border-border bg-muted/10 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-muted-foreground font-medium">
            <BookOpen className="w-3.5 h-3.5 inline mr-1.5 opacity-60" />
            {schedule.length} total sessions / week
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">
            {days.length} active day{days.length !== 1 ? 's' : ''}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Room Card ──────────────────────────────────────── */

function RoomCard({
  room, liveStatus, onEdit, onDelete, onToggle, onViewSchedule,
}: {
  room: Room;
  liveStatus: 'disabled' | 'busy' | 'free';
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onViewSchedule: () => void;
}) {
  const meta = TYPE_META[room.type];
  const Icon = meta.Icon;
  const utilPct = room.sessionsToday ? Math.min(100, (room.sessionsToday / 6) * 100) : 0;
  const utilColor = utilPct >= 70 ? '#ef4444' : utilPct >= 40 ? '#f59e0b' : '#10b981';

  const statusConfig = {
    free:     { label: 'Free Now',     dot: 'bg-emerald-500 animate-pulse', pill: 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20' },
    busy:     { label: 'In Use',       dot: 'bg-amber-500 animate-pulse',   pill: 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20' },
    disabled: { label: 'Unavailable',  dot: 'bg-red-500',                   pill: 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20' },
  }[liveStatus];

  return (
    <div className="group rounded-2xl border border-border p-5 flex flex-col gap-4 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 overflow-hidden">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight truncate" title={room.name}>{room.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-tighter opacity-70 truncate" title={room.roomId}>{room.roomId}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${statusConfig.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </span>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl p-3 flex flex-col items-center justify-center bg-muted/20 border border-border/50 group-hover:bg-muted/30 transition-colors">
          <p className="text-base font-bold leading-none">{room.capacity}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">Seats</p>
        </div>
        <div className="rounded-xl p-3 flex flex-col items-center justify-center bg-muted/20 border border-border/50 group-hover:bg-muted/30 transition-colors overflow-hidden">
          <p className="text-[11px] font-bold leading-none truncate w-full text-center" style={{ color: meta.color }}>{meta.label}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">Type</p>
        </div>
        <div className="rounded-xl p-3 flex flex-col items-center justify-center bg-muted/20 border border-border/50 group-hover:bg-muted/30 transition-colors">
          <p className="text-base font-bold leading-none">{room.sessionsToday ?? 0}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">Today</p>
        </div>
      </div>

      {/* Equipment & Meta */}
      <div className="space-y-3 pt-1">
        {room.equipment.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {room.equipment.slice(0, 3).map(eq => (
              <span key={eq} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-muted-foreground bg-muted/30 border border-border/40 whitespace-nowrap">
                <Cpu className="w-2.5 h-2.5 opacity-60" />{eq}
              </span>
            ))}
            {room.equipment.length > 3 && (
              <span className="px-2 py-1 rounded-lg text-[10px] font-medium text-muted-foreground bg-muted/30 border border-border/40">
                +{room.equipment.length - 3}
              </span>
            )}
          </div>
        ) : (
          <div className="h-[21px] flex items-center italic text-[10px] text-muted-foreground/60 px-1">No equipment listed</div>
        )}

        {(room.building || room.floor) && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/80 px-1 overflow-hidden">
            <MapPin className="w-3.5 h-3.5 text-blue-500/60 shrink-0" />
            <span className="truncate" title={`${room.building}${room.floor ? ` • Floor ${room.floor}` : ''}`}>
              {room.building}{room.floor && ` • Floor ${room.floor}`}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {(room.sessionsToday ?? 0) > 0 && (
        <div className="pt-1">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter mb-1.5 px-0.5">
            <span className="text-muted-foreground">Daily Utilisation</span>
            <span style={{ color: utilColor }}>{Math.round(utilPct)}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${utilPct}%` }}
              className="h-full rounded-full transition-all duration-1000"
              style={{ background: utilColor }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border/60">
        <button onClick={onViewSchedule}
          className="flex-1 flex items-center justify-center gap-2 h-[36px] px-3 rounded-xl text-[11px] font-bold transition-all border border-blue-500/30 text-blue-500 bg-blue-500/5 hover:bg-blue-500/15">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>View Schedule</span>
          <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" />
        </button>
        <button onClick={onToggle}
          title={room.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
          className="w-[36px] h-[36px] flex shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/40 transition-all border border-border shadow-sm">
          {room.isAvailable ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        </button>
        <button onClick={onEdit}
          className="w-[36px] h-[36px] flex shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 transition-all border border-border shadow-sm">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete}
          className="w-[36px] h-[36px] flex shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all border border-border shadow-sm">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

export function RoomManagement() {
  const { rooms: workspaceRooms, slots } = useWorkspaceStore();
  const [localEdits, setLocalEdits] = useState<Map<string, Room>>(new Map());
  const [localAdded, setLocalAdded] = useState<Room[]>([]);
  const [localDeleted, setLocalDeleted] = useState<Set<string>>(new Set());

  // Real-time clock (ticks every minute)
  const clock = useRealTimeClock();

  // Merge workspace rooms with in-session user edits
  const rooms: Room[] = [
    ...workspaceRooms
      .filter(r => !localDeleted.has(r.id))
      .map(r => localEdits.get(r.id) ?? r),
    ...localAdded.filter(r => !localDeleted.has(r.id)),
  ];
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Room['type'] | 'all'>('all');
  const [buildingFilter, setBuildingFilter] = useState('All Buildings');
  const [availFilter, setAvailFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [addOpen, setAddOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [drawerRoom, setDrawerRoom] = useState<Room | null>(null);

  /* ── live occupancy ─────────────────────────────────── */

  const liveStatuses = useMemo(() =>
    new Map(rooms.map(r => [r.id, getRoomLiveStatus(r, slots, clock.dayName, clock.timeLabel)])),
    [rooms, slots, clock.dayName, clock.timeLabel],
  );

  const drawerSchedule = useMemo(() =>
    drawerRoom ? getRoomSchedule(drawerRoom, slots) : [],
    [drawerRoom, slots],
  );

  /* ── stats ──────────────────────────────────────────── */

  const total      = rooms.length;
  const available  = rooms.filter(r => r.isAvailable).length;
  const freeNow    = [...liveStatuses.values()].filter(s => s === 'free').length;
  const busyNow    = [...liveStatuses.values()].filter(s => s === 'busy').length;
  const byType     = (Object.keys(TYPE_META) as Room['type'][]).map(t => ({
    ...TYPE_META[t], type: t, count: rooms.filter(r => r.type === t).length,
  }));

  /* ── filter ─────────────────────────────────────────── */

  const filtered = rooms.filter(r => {
    const q = search.toLowerCase();
    if (q && !r.name.toLowerCase().includes(q) && !r.roomId.toLowerCase().includes(q)
          && !r.equipment.some(e => e.toLowerCase().includes(q))) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (buildingFilter !== 'All Buildings' && r.building !== buildingFilter) return false;
    if (availFilter === 'available'   && !r.isAvailable) return false;
    if (availFilter === 'unavailable' &&  r.isAvailable) return false;
    return true;
  });


  /* ── actions ─────────────────────────────────────────── */

  const addRoom = (data: Omit<Room, 'id'>) => {
    const newRoom = { ...data, id: String(Date.now()) };
    setLocalAdded(prev => [...prev, newRoom]);
    toast.success(`Room "${data.name}" added`, { description: `${data.roomId} · ${TYPE_META[data.type].label}` });
    setAddOpen(false);
  };

  const saveRoom = (data: Omit<Room, 'id'>) => {
    if (!editRoom) return;
    setLocalEdits(prev => new Map(prev).set(editRoom.id, { ...data, id: editRoom.id }));
    setLocalAdded(prev => prev.map(r => r.id === editRoom.id ? { ...data, id: editRoom.id } : r));
    toast.success(`Room "${data.name}" updated`);
    setEditRoom(null);
  };

  const deleteRoom = (id: string) => {
    const r = rooms.find(x => x.id === id);
    setLocalDeleted(prev => new Set([...prev, id]));
    setLocalAdded(prev => prev.filter(x => x.id !== id));
    toast.success(`"${r?.name}" removed`);
  };

  const toggleAvail = (id: string) => {
    const r = rooms.find(x => x.id === id);
    if (!r) return;
    const updated = { ...r, isAvailable: !r.isAvailable };
    setLocalEdits(prev => new Map(prev).set(id, updated));
    setLocalAdded(prev => prev.map(x => x.id === id ? updated : x));
    toast.success(`${r.name} marked ${r.isAvailable ? 'unavailable' : 'available'}`);
  };

  return (
    <div className="min-h-full bg-background/50 flex flex-col">
      {(addOpen || editRoom) && (
        <RoomDialog
          room={editRoom ?? undefined}
          onClose={() => { setAddOpen(false); setEditRoom(null); }}
          onSave={editRoom ? saveRoom : addRoom}
        />
      )}

      <AnimatePresence>
        {drawerRoom && (
          <RoomScheduleDrawer
            room={drawerRoom}
            schedule={drawerSchedule}
            clock={clock}
            onClose={() => setDrawerRoom(null)}
          />
        )}
      </AnimatePresence>

      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Room Management</h1>
                <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-2 font-medium">
                  <span className="flex w-2 h-2 rounded-full bg-blue-500" />
                  {total} physical spaces configured in repository
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const rows = [['RoomID','Name','Capacity','Type','Equipment','Building','Floor','Available'],
                  ...rooms.map(r => [r.roomId,r.name,r.capacity,r.type,r.equipment.join('; '),r.building??'',r.floor??'',r.isAvailable?'Yes':'No'])];
                import('xlsx').then(XLSX => {
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.aoa_to_sheet(rows);
                  XLSX.utils.book_append_sheet(wb, ws, 'Rooms');
                  XLSX.writeFile(wb, 'ChronoLink-Rooms.xlsx');
                });
                toast.success('Rooms exported as Excel');
              }}
              className="flex items-center gap-2.5 px-6 py-3 border border-border rounded-2xl text-sm font-bold text-muted-foreground hover:bg-muted/40 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" /> Export Data
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2.5 px-8 py-3 text-white rounded-2xl text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}
            >
              <Plus className="w-5 h-5" /> Add New Room
            </button>
          </div>
        </div>

        {/* Stats Grid - Integrated into Header */}
        <div className="px-10 pb-8 grid grid-cols-2 md:grid-cols-6 gap-5">
          <div className="bg-muted/20 border border-border/60 rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-muted/30">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-black leading-none">{total}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Total Spaces</p>
            </div>
          </div>

          <div className="bg-muted/20 border border-border/60 rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-muted/30">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-black leading-none">{freeNow}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Free Now</p>
            </div>
          </div>

          <div className="bg-muted/20 border border-border/60 rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-muted/30">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-black leading-none">{busyNow}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5">In Use</p>
            </div>
          </div>

          {byType.map(t => (
            <div key={t.type} className="bg-muted/20 border border-border/60 rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-muted/30">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: t.bg, border: `1px solid ${t.border}` }}>
                <t.Icon className="w-5 h-5" style={{ color: t.color }} />
              </div>
              <div>
                <p className="text-xl font-black leading-none">{t.count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5">{t.label}s</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-10 py-10 space-y-8 flex-1 overflow-auto">
        {/* Toolbar Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-6 bg-card border border-border rounded-[2rem] shadow-sm">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID, or equipment…"
                className="w-full pl-12 pr-6 py-3.5 bg-background border border-border rounded-2xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/40"
              />
            </div>

            {/* Filters Group */}
            <div className="flex items-center gap-2 p-1.5 bg-muted/30 rounded-2xl border border-border/60">
              <div className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 border-r border-border mr-1">
                <Filter className="w-3 h-3" /> Type
              </div>
              <div className="flex items-center gap-1">
                {TYPES.map(t => {
                  const meta = t !== 'all' ? TYPE_META[t] : null;
                  const active = typeFilter === t;
                  return (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className="px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap"
                      style={{
                        background: active ? (meta?.color ?? '#3b82f6') : 'transparent',
                        color:      active ? '#fff' : 'var(--muted-foreground)',
                        boxShadow:  active ? `0 4px 12px ${(meta?.color ?? '#3b82f6')}44` : 'none',
                      }}>
                      {t === 'all' ? 'All' : meta?.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5 bg-muted/30 rounded-2xl border border-border/60">
              <div className="px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 border-r border-border mr-1">
                <Check className="w-3 h-3" /> Status
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'available', 'unavailable'] as const).map(a => (
                  <button key={a} onClick={() => setAvailFilter(a)}
                    className="px-4 py-2 rounded-xl text-[11px] font-bold transition-all capitalize whitespace-nowrap"
                    style={{
                      background: availFilter === a ? '#3b82f6' : 'transparent',
                      color:      availFilter === a ? '#fff' : 'var(--muted-foreground)',
                      boxShadow:  availFilter === a ? '0 4px 12px rgba(59,130,246,0.2)' : 'none',
                    }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Building dropdown */}
            <div className="relative">
              <button onClick={() => setBuildingOpen(o => !o)}
                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl text-sm font-bold border border-border bg-background hover:bg-muted/40 transition-all shadow-sm">
                <MapPin className="w-4 h-4 text-blue-500" />
                {buildingFilter}
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${buildingOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {buildingOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full mt-3 right-0 z-50 rounded-2xl border border-border shadow-2xl overflow-hidden bg-card min-w-[200px] p-2"
                  >
                    {BUILDINGS.map(b => (
                      <button key={b} onClick={() => { setBuildingFilter(b); setBuildingOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left hover:bg-blue-500/10 hover:text-blue-500 transition-all">
                        {buildingFilter === b ? <Check className="w-4 h-4 text-blue-500" /> : <div className="w-4" />}
                        {b}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 p-1.5 rounded-2xl border border-border bg-muted/30 shadow-inner">
              {([['grid', LayoutGrid], ['list', List]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)}
                  className="p-2.5 rounded-xl transition-all shadow-sm"
                  style={{ 
                    background: view === v ? '#3b82f6' : 'transparent', 
                    color: view === v ? '#fff' : 'var(--muted-foreground)',
                    boxShadow: view === v ? '0 4px 8px rgba(59,130,246,0.2)' : 'none'
                  }}>
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between px-2">
          <p className="text-sm font-medium text-muted-foreground">
            Displaying <span className="text-foreground font-bold">{filtered.length}</span> results 
            {search && <span> for "<span className="text-blue-500">{search}</span>"</span>}
            {(typeFilter !== 'all' || buildingFilter !== 'All Buildings' || availFilter !== 'all') && <span className="text-xs ml-2 opacity-60">(filters active)</span>}
          </p>
          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {available} Online</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> {total - available} Offline</span>
          </div>
        </div>

        {/* Grid view */}
        {view === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
            {filtered.length === 0 ? (
              <div className="col-span-full py-32 flex flex-col items-center justify-center bg-card border border-dashed border-border rounded-[2.5rem] text-muted-foreground">
                <Search className="w-16 h-16 opacity-10 mb-4" />
                <p className="text-lg font-bold">No matches found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : filtered.map(room => (
              <RoomCard
                key={room.id} room={room}
                liveStatus={liveStatuses.get(room.id) ?? 'free'}
                onEdit={() => setEditRoom(room)}
                onDelete={() => deleteRoom(room.id)}
                onToggle={() => toggleAvail(room.id)}
                onViewSchedule={() => setDrawerRoom(room)}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-xl shadow-black/5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {['Room Profile', 'Category', 'Capacity', 'Location', 'Features', 'Status', 'Load', ''].map(h => (
                      <th key={h} className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-8 py-20 text-center text-sm font-medium text-muted-foreground italic">No physical spaces matched your current query.</td></tr>
                  ) : filtered.map((room) => {
                    const meta = TYPE_META[room.type];
                    const Icon = meta.Icon;
                    return (
                      <tr key={room.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                              style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
                              <Icon className="w-5 h-5" style={{ color: meta.color }} />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-foreground">{room.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono opacity-70 tracking-tighter uppercase">{room.roomId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-bold text-foreground">{room.capacity}</span>
                          <span className="text-xs text-muted-foreground ml-1.5 font-medium">Seats</span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="text-sm font-medium text-foreground">{room.building ?? '—'}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{room.floor ? `Floor ${room.floor}` : 'Base Floor'}</div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                            {room.equipment.slice(0, 2).map(eq => (
                              <span key={eq} className="px-2 py-0.5 rounded-md text-[10px] font-bold text-muted-foreground bg-muted/40 border border-border/60">{eq}</span>
                            ))}
                            {room.equipment.length > 2 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-muted-foreground bg-muted/40 border border-border/60">+{room.equipment.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          {room.isAvailable
                            ? <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Online</span>
                            : <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20"><span className="w-2 h-2 rounded-full bg-red-500" />Offline</span>}
                        </td>
                        <td className="px-8 py-5 text-sm font-black text-center tabular-nums">{room.sessionsToday ?? 0}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setEditRoom(room)}
                              className="w-[36px] h-[36px] flex shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 transition-all border border-border shadow-sm">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => toggleAvail(room.id)}
                              className="w-[36px] h-[36px] flex shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-all border border-border shadow-sm">
                              {room.isAvailable ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                            </button>
                            <button onClick={() => deleteRoom(room.id)}
                              className="w-[36px] h-[36px] flex shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all border border-border shadow-sm">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-8 py-5 bg-muted/20 border-t border-border flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{filtered.length} spaces currently visible in index</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



