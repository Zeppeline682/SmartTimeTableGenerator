import { useMemo, useRef, useCallback } from 'react';
import { TimeSlot } from '../types';
import { GripVertical, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Constants ─────────────────────────────────────────────────── */

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const GRID_TOTAL_DAYS = DAYS.length;
export const GRID_TOTAL_SLOTS_PER_DAY = 21;


export function slotToTime(
  index: number,
  intervalMinutes: number = 30,
  dayStartTime: string = "09:00",
  breakWindows: { startTime: string; durationMinutes: number; enabled: boolean }[] = [],
  timeline: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = []
): string {
  if (timeline && timeline.length > 0) {
    const block = timeline[index] || timeline[timeline.length - 1];
    if (!block) return dayStartTime;
    // For end time of last slot, use block.endMins
    const mins = index < timeline.length ? block.startMins : block.endMins;
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const [startHour, startMin] = dayStartTime.split(':').map(Number);
  let totalMinutes = startHour * 60 + startMin;

  const activeBreaks = breakWindows
    .filter(b => b.enabled)
    .map(b => {
      const [bh, bm] = b.startTime.split(':').map(Number);
      return { startMins: bh * 60 + bm, duration: b.durationMinutes };
    })
    .sort((a, b) => a.startMins - b.startMins);

  for (let i = 0; i < index; i++) {
    const slotStart = totalMinutes;
    totalMinutes += intervalMinutes;

    for (const b of activeBreaks) {
      if (b.startMins >= slotStart && b.startMins < totalMinutes) {
        totalMinutes += b.duration;
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const b of activeBreaks) {
      if (b.startMins === totalMinutes) {
        totalMinutes += b.duration;
        changed = true;
      }
    }
  }

  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function timeLabelToSlotIndex(
  timeLabel: string,
  intervalMinutes: number = 30,
  dayStartTime: string = "09:00",
  breakWindows: { startTime: string; durationMinutes: number; enabled: boolean }[] = [],
  timeline: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = []
): number {
  if (!timeLabel) return -1;
  const [lh, lm] = timeLabel.split(':').map(Number);
  const targetMins = lh * 60 + lm;

  for (let i = 0; i < 60; i++) {
    const time = slotToTime(i, intervalMinutes, dayStartTime, breakWindows, timeline);
    if (time === timeLabel) return i;

    const [th, tm] = time.split(':').map(Number);
    const currentMins = th * 60 + tm;
    if (currentMins > targetMins) {
      return -1;
    }
  }
  return -1;
}

export function slotIndexToTimeLabel(
  index: number,
  interval: number = 30,
  start: string = "09:00",
  breakWindows: { startTime: string; durationMinutes: number; enabled: boolean }[] = [],
  timeline: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = []
): string {
  return slotToTime(index, interval, start, breakWindows, timeline);
}

export function slotIndexToEndTimeLabel(
  index: number,
  duration: number = 1,
  interval: number = 30,
  start: string = "09:00",
  breakWindows: { startTime: string; durationMinutes: number; enabled: boolean }[] = [],
  timeline: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = []
): string {
  return slotToTime(index + Math.max(1, duration), interval, start, breakWindows, timeline);
}

/* ─── Visual config ─────────────────────────────────────────────── */

export const TYPE_META: Record<string, {
  bg: string; border: string; text: string; label: string;
}> = {
  lecture: { bg: 'rgba(37,99,235,0.08)', border: '#2563eb', text: '#2563eb', label: 'LEC' },
  practical: { bg: 'rgba(124,58,237,0.08)', border: '#7c3aed', text: '#7c3aed', label: 'PRC' },
  tutorial: { bg: 'rgba(5,150,105,0.08)', border: '#059669', text: '#059669', label: 'TUT' },
};

/* ─── Props ─────────────────────────────────────────────────────── */

export interface DndState {
  dragSlotId?: string | null;
  dropTarget?: { day: string; time: string } | null;
  dropConflict?: boolean;
  dropOutOfBounds?: boolean;
}

export interface DndHandlers {
  onDragStart?: (e: React.DragEvent, slotId: string) => void;
  onDragEnd?: () => void;
  onCellDragOver?: (e: React.DragEvent, day: string, time: string) => void;
  onCellDragLeave?: () => void;
  onCellDrop?: (e: React.DragEvent, day: string, time: string) => void;
  onDeleteSlot?: (slotId: string) => void;
}

interface TimetableGridProps extends DndState, DndHandlers {
  slots: TimeSlot[];
  isReadOnly?: boolean;
  totalDays?: number;
  totalSlotsPerDay?: number;
  dayStartTime?: string;
  intervalMinutes?: number;
  breakSlotIndexes?: number[];
  breakNames?: Map<number, string>;
  breakWindows?: { startTime: string; durationMinutes: number; enabled: boolean }[];
  timeline?: { isBreak: boolean, name: string, startMins: number, endMins: number }[];
  zoomScale?: number;
}

/* ─── Component ─────────────────────────────────────────────────── */

export function TimetableGrid({
  slots,
  isReadOnly = false,
  dragSlotId = null,
  dropTarget = null,
  dropConflict = false,
  dropOutOfBounds = false,
  onDragStart,
  onDragEnd,
  onCellDragOver,
  onCellDragLeave,
  onCellDrop,
  onDeleteSlot,
  totalDays = 5,
  totalSlotsPerDay = 20,
  dayStartTime = "09:00",
  intervalMinutes = 30,
  breakSlotIndexes = [],
  breakNames = new Map(),
  breakWindows = [],
  timeline = [],
  zoomScale = 1,
}: TimetableGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const validDays = DAYS.slice(0, totalDays);
  const validSlots = Array.from({ length: totalSlotsPerDay }, (_, i) => slotToTime(i, intervalMinutes, dayStartTime, breakWindows, timeline));
  const validSlotsExt = Array.from({ length: totalSlotsPerDay + 1 }, (_, i) => slotToTime(i, intervalMinutes, dayStartTime, breakWindows, timeline));
  const rowHeight = intervalMinutes <= 30 ? 60 : intervalMinutes <= 45 ? 70 : intervalMinutes <= 60 ? 80 : 96;
  const RAIL_WIDTH = 80;
  const HEADER_HEIGHT = 40;

  const isDragging = dragSlotId !== null;

  /* ── Coordinate-based cell detection ── */
  const getCellFromEvent = useCallback((e: React.DragEvent): { day: string; time: string } | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const scale = zoomScale || 1;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    // Subtract rail/header
    const cellX = x - RAIL_WIDTH;
    const cellY = y - HEADER_HEIGHT;
    if (cellX < 0 || cellY < 0) return null;
    const colWidth = (grid.scrollWidth / scale - RAIL_WIDTH) / totalDays;
    const dayIdx = Math.min(Math.floor(cellX / colWidth), totalDays - 1);
    const slotIdx = Math.min(Math.floor(cellY / rowHeight), totalSlotsPerDay - 1);
    if (dayIdx < 0 || slotIdx < 0) return null;
    return { day: validDays[dayIdx], time: validSlots[slotIdx] };
  }, [validDays, validSlots, totalDays, totalSlotsPerDay, rowHeight, zoomScale]);

  function getSpan(slot: TimeSlot): number {
    const si = validSlots.indexOf(slot.startTime);
    let ei = validSlotsExt.indexOf(slot.endTime);
    if (si === -1) return 1;
    if (ei === -1) ei = si + 1;
    return Math.max(1, ei - si);
  }

  function isTarget(day: string, time: string) {
    return dropTarget?.day === day && dropTarget?.time === time;
  }

  function cellBg(day: string, time: string, slotIdx: number) {
    if (!isTarget(day, time)) {
      if (breakSlotIndexes.includes(slotIdx)) return 'rgba(245,158,11,0.04)';
      return isDragging ? 'rgba(255,255,255,0.02)' : 'transparent';
    }
    if (dropOutOfBounds) return 'rgba(239,68,68,0.15)';
    if (dropConflict) return 'rgba(245,158,11,0.15)';
    return 'rgba(59,130,246,0.15)';
  }

  function cellOutline(day: string, time: string): string {
    if (!isTarget(day, time)) return 'none';
    if (dropOutOfBounds) return '2px solid #ef4444';
    if (dropConflict) return '2px solid #f59e0b';
    return '2px solid #3b82f6';
  }

  function dropLabel(day: string, time: string): React.ReactNode {
    if (!isTarget(day, time)) return null;
    if (dropOutOfBounds) return <span className="text-[10px] uppercase font-bold text-red-500">Blocked</span>;
    if (dropConflict) return <span className="text-[10px] uppercase font-bold text-amber-500">Conflict</span>;
    return <span className="text-[10px] uppercase font-bold text-blue-500">Drop</span>;
  }

  /* ─── Grid Render ────────────────────────────── */

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden border border-border rounded-md shadow-inner-xl group/grid">

      {/* ── Drag Mode Indicator ── */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 40, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 px-4 bg-muted/40 border-b border-border text-[11px] font-medium text-muted-foreground overflow-hidden"
          >
            <GripVertical className="w-3.5 h-3.5 text-blue-500" />
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500/20 border border-blue-500" /> Available</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500/20 border border-amber-500" /> Conflict</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500" /> Blocked</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <div
          ref={gridRef}
          className="grid w-full relative"
          onDragOver={!isReadOnly ? (e) => { e.preventDefault(); } : undefined}
          onDrop={!isReadOnly ? (e) => { e.preventDefault(); } : undefined}
          style={{
            minWidth: 800,
            gridTemplateColumns: `80px repeat(${totalDays}, 1fr)`,
            gridTemplateRows: `40px repeat(${totalSlotsPerDay}, ${rowHeight}px)`,
            transformOrigin: 'top left',
            transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
            width: zoomScale !== 1 ? `${(100 / zoomScale).toFixed(2)}%` : undefined,
          }}
        >
          {/* Header Corner */}
          <div className="sticky top-0 left-0 z-50 bg-card border-b border-r border-border p-2 flex items-end justify-end text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Slot
          </div>

          {/* Day Headers */}
          {validDays.map((day, i) => (
            <div key={day} className="sticky top-0 z-40 bg-card border-b border-r border-border p-2 flex items-center justify-center text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              <span className="hidden lg:inline">{day}</span>
              <span className="lg:hidden">{DAYS_SHORT[i]}</span>
            </div>
          ))}

          {/* Time Rail */}
          {validSlots.map((time, slotIdx) => (
            <div
              key={`time-${time}`}
              className="sticky left-0 z-30 bg-muted/30 border-b border-r border-border p-1 text-[11px] font-mono text-muted-foreground text-right pr-2 leading-none flex items-start justify-end pt-2"
              style={{ gridRow: slotIdx + 2, gridColumn: 1 }}
            >
              {time}
            </div>
          ))}
          {/* Final end-time label */}
          <div
            className="sticky left-0 z-30 bg-muted/30 border-r border-border p-1 text-[11px] font-mono text-muted-foreground text-right pr-2 leading-none flex items-end justify-end pb-2"
            style={{ gridRow: totalSlotsPerDay + 2, gridColumn: 1 }}
          >
            {validSlotsExt[validSlotsExt.length - 1]}
          </div>

          {/* Spreadsheet Background Cells */}
          {validSlots.map((time, slotIdx) => (
            validDays.map((day, dayIdx) => {
              const target = isTarget(day, time);
              return (
                <div
                  key={`bg-${day}-${time}`}
                  className={`border-b border-r border-border/40 transition-colors duration-150 ${target ? 'z-20' : ''} hover:bg-accent/5`}
                  style={{
                    gridRow: slotIdx + 2,
                    gridColumn: dayIdx + 2,
                    background: cellBg(day, time, slotIdx),
                    outline: cellOutline(day, time),
                    outlineOffset: '-2px'
                  }}
                  onDragOver={!isReadOnly ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = isDragging ? 'move' : 'copy';
                    if (onCellDragOver) onCellDragOver(e, day, time);
                  } : undefined}
                  onDrop={!isReadOnly ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onCellDrop) onCellDrop(e, day, time);
                  } : undefined}
                >
                  {!isReadOnly && target && (
                    <div className="w-full h-full flex items-center justify-center">
                      {dropLabel(day, time)}
                    </div>
                  )}
                </div>
              );
            })
          ))}

          {/* Break Bars Layer */}
          {breakSlotIndexes.map((slotIdx) => {
            const name = breakNames.get(slotIdx);
            // Only show name on the first slot of a multi-slot break if they are consecutive? 
            // Or just show it once if it's the start of a block.
            const isStartOfBreak = !breakSlotIndexes.includes(slotIdx - 1) || breakNames.get(slotIdx - 1) !== name;
            const startTime = slotIndexToTimeLabel(slotIdx, intervalMinutes, dayStartTime, breakWindows, timeline);
            const endTime = slotIndexToEndTimeLabel(slotIdx, 1, intervalMinutes, dayStartTime, breakWindows, timeline);

            return (
              <div
                key={`break-bar-${slotIdx}`}
                title={name ? `${name}: ${startTime} – ${endTime}` : `Unavailable: ${startTime} – ${endTime}`}
                className={`z-10 border-b border-r border-orange-500/20 flex items-center justify-center overflow-hidden transition-colors hover:bg-orange-500/5 ${isDragging ? 'pointer-events-none' : 'pointer-events-auto cursor-help'}`}
                style={{
                  gridRow: slotIdx + 2,
                  gridColumn: `2 / span ${totalDays}`,
                  background: 'repeating-linear-gradient(45deg, rgba(245,158,11,0.03), rgba(245,158,11,0.03) 10px, rgba(245,158,11,0.06) 10px, rgba(245,158,11,0.06) 20px)',
                }}
              >
                {isStartOfBreak && name && (
                  <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/60 whitespace-nowrap">
                      {name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Session Cards Layer */}
          {slots.map(slot => {
            const dayIdx = dayNameToIndex(slot.day);
            const slotIdx = timeLabelToSlotIndex(slot.startTime, intervalMinutes, dayStartTime, breakWindows, timeline);

            if (dayIdx === -1 || slotIdx === -1 || dayIdx >= totalDays || slotIdx >= totalSlotsPerDay) return null;

            const span = getSpan(slot);

            // Defense-in-depth: skip slots that overlap any break window
            if (breakSlotIndexes.length > 0) {
              const slotRange = Array.from({ length: span }, (_, i) => slotIdx + i);
              if (slotRange.some(si => breakSlotIndexes.includes(si))) return null;
            }

            const beingDragged = dragSlotId === slot.id;
            const meta = TYPE_META[slot.type ?? 'lecture'] ?? TYPE_META.lecture;

            return (
              <div
                key={slot.id}
                draggable={!isReadOnly}
                onDragStart={(!isReadOnly && onDragStart) ? e => onDragStart!(e, slot.id) : undefined}
                onDragEnd={(!isReadOnly && onDragEnd) ? onDragEnd : undefined}
                className={`z-10 group/card m-[1px] rounded-[3px] p-2 flex flex-col gap-1 shadow-sm border-l-[3px] overflow-hidden select-none ${isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${beingDragged ? 'opacity-40' : 'hover:shadow-md hover:z-20'}`}
                title={`${slot.subject} | ${slot.faculty} | ${slot.room}\n${slot.startTime} – ${slot.endTime} (${slot.type})`}
                style={{
                  gridRow: `${slotIdx + 2} / span ${span}`,
                  gridColumn: dayIdx + 2,
                  background: meta.bg,
                  borderColor: meta.border,
                  WebkitUserDrag: isReadOnly ? 'none' : 'element',
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                } as React.CSSProperties}
              >
                {/* Row 1: Subject name + type badge */}
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[10px] font-bold leading-tight break-words whitespace-normal tracking-tight flex-1 min-w-0" style={{ color: meta.text }}>
                    {slot.subject}
                  </span>
                  <div className="shrink-0 flex items-center gap-0.5 ml-0.5">
                    {!isReadOnly && onDeleteSlot && (
                      <button
                        type="button"
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onDeleteSlot(slot.id); }}
                        className="opacity-0 group-hover/card:opacity-100 p-0.5 rounded hover:bg-red-500/15 text-red-500/80 hover:text-red-500 transition"
                        title="Remove from timetable"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <span className="text-[7px] font-black px-1 py-px rounded bg-white/60 border border-white/30 leading-none whitespace-nowrap" style={{ color: meta.text }}>
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Row 2: Faculty, then Room below */}
                <div className="flex flex-col gap-0.5">
                  {slot.faculty && (
                    <span className="text-[9px] text-muted-foreground/75 leading-tight truncate">
                      {slot.faculty}
                    </span>
                  )}
                  {slot.room && (
                    <span className="text-[8px] font-mono font-bold text-muted-foreground/60 truncate bg-black/5 pr-1 py-px rounded-[2px] leading-tight self-start">
                      {slot.room}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Transparent Drag Overlay ──
              During an active internal drag, this overlay covers the entire grid
              content area above all session cards (z-60). It intercepts ALL drag
              events and routes them via coordinate-based cell detection.
              stopPropagation prevents the workspace container from treating
              grid drops as "drag-out-to-remove" actions. */}
          {isDragging && !isReadOnly && (
            <div
              style={{
                gridRow: `2 / span ${totalSlotsPerDay}`,
                gridColumn: `2 / span ${totalDays}`,
                zIndex: 60,
              }}
              className="cursor-grabbing"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                const cell = getCellFromEvent(e);
                if (cell && onCellDragOver) onCellDragOver(e, cell.day, cell.time);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const cell = getCellFromEvent(e);
                if (cell && onCellDrop) onCellDrop(e, cell.day, cell.time);
              }}
              onDragLeave={(e) => {
                // Only trigger leave if actually leaving the grid area
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right ||
                    e.clientY < rect.top || e.clientY > rect.bottom) {
                  if (onCellDragLeave) onCellDragLeave();
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Helpers ─────────────────────────────────────────── */

export function slotDuration(
  slot: TimeSlot,
  interval: number = 30,
  start: string = "09:00",
  breakWindows: { startTime: string; durationMinutes: number; enabled: boolean }[] = [],
  timeline: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = []
): number {
  const si = timeLabelToSlotIndex(slot.startTime, interval, start, breakWindows, timeline);
  const ei = timeLabelToSlotIndex(slot.endTime, interval, start, breakWindows, timeline);
  return Math.max(1, ei - si);
}

export function canDropAt(
  slot: TimeSlot,
  newStart: string,
  totalSlots: number = 20,
  interval: number = 30,
  start: string = "09:00",
  breakWindows: { startTime: string; durationMinutes: number; enabled: boolean }[] = [],
  timeline: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = []
): boolean {
  const si = timeLabelToSlotIndex(newStart, interval, start, breakWindows, timeline);
  if (si < 0 || si >= totalSlots) return false;
  return si + slotDuration(slot, interval, start, breakWindows, timeline) <= totalSlots;
}

export function newEndTime(
  slot: TimeSlot,
  newStart: string,
  totalSlots: number = 20,
  interval: number = 30,
  start: string = "09:00",
  breakWindows: { startTime: string; durationMinutes: number; enabled: boolean }[] = [],
  timeline: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = []
): string {
  const si = timeLabelToSlotIndex(newStart, interval, start, breakWindows, timeline);
  const dur = slotDuration(slot, interval, start, breakWindows, timeline);
  const ei = Math.min(si + dur, totalSlots);
  return slotToTime(ei, interval, start, breakWindows, timeline);
}

export function dayNameToIndex(day: string): number {
  const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return DAY_LABELS.indexOf(day);
}

export function dayIndexToName(dayIndex: number): string | null {
  const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return DAY_LABELS[dayIndex] ?? null;
}



