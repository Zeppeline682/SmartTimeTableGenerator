import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Braces, Plus, Trash2, Search, Calendar, Users, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

import type {
  ConstraintCreateDTO,
  ConstraintRuleType,
  ConstraintTargetType,
  Faculty, Room, Group, Subject,
} from '../types';

interface ConstraintBuilderProps {
  initialConstraints?: ConstraintCreateDTO[];
  onConstraintsChange?: (constraints: ConstraintCreateDTO[]) => void;
  conflictingIds?: string[];
  conflictMessages?: string[];
  teachers: Faculty[];
  rooms: Room[];
  groups: Group[];
  subjects: Subject[];
  periodDurationMinutes?: number;
  onPeriodDurationChange?: (minutes: number) => void;
  dayStartTime?: string;
  onDayStartTimeChange?: (value: string) => void;
  schoolEndTime?: string;
  onSchoolEndTimeChange?: (value: string) => void;
  breakWindows?: Array<{ id: string; name: string; enabled: boolean; startTime: string; durationMinutes: number; reason?: string }>;
  onBreakWindowChange?: (id: string, next: { name?: string; enabled?: boolean; startTime?: string; durationMinutes?: number; reason?: string }) => void;
  onAddBreakWindow?: () => void;
  onRemoveBreakWindow?: (id: string) => void;
  totalSlotsPerDay?: number;
  intervalMinutes?: number;
}

interface ConstraintDraft extends ConstraintCreateDTO { id: string; }

const TARGET_TYPES: ConstraintTargetType[] = ['Teacher', 'Room', 'StudentGroup', 'Subject'];

const RULES_BY_TARGET: Record<ConstraintTargetType, ConstraintRuleType[]> = {
  Teacher: ['Availability'],
  Room: ['Availability'],
  StudentGroup: ['Availability', 'Capacity', 'LocationPreference'],
  Subject: ['Affinity', 'LocationPreference'],
};

/* ─── Sub-Components ─── */

// ── Helpers ────────────────────────────────────────────────────────────────
function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minsToTime(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function timeToSlot(time: string, dayStart: string, interval: number) {
  return Math.floor((timeToMins(time) - timeToMins(dayStart)) / interval);
}


interface DayRange { from: string; to: string; }
interface AvailabilityValue { blockedDays: number[]; ranges: { day: number; from: string; to: string }[]; }

// Converts our AvailabilityValue to flat {day, slot} pairs for the backend
function availToSlotPairs(val: AvailabilityValue, dayStart: string, interval: number, slotsPerDay: number) {
  const pairs: {day: number; slot: number}[] = [];
  val.blockedDays.forEach(d => {
    for (let s = 0; s < slotsPerDay; s++) pairs.push({ day: d, slot: s });
  });
  val.ranges.forEach(r => {
    const fromSlot = Math.max(0, timeToSlot(r.from, dayStart, interval));
    const toSlot   = Math.min(slotsPerDay, timeToSlot(r.to, dayStart, interval));
    for (let s = fromSlot; s < toSlot; s++) pairs.push({ day: r.day, slot: s });
  });
  // Deduplicate
  const seen = new Set<string>();
  return pairs.filter(p => { const k = `${p.day}-${p.slot}`; if (seen.has(k)) return false; seen.add(k); return true; });
}



function AvailabilityPicker({
  value, onChange, dayStartTime = '09:00', schoolEndTime = '18:00', intervalMinutes = 30, slotsPerDay = 20, totalDays = 5,
}: {
  value: AvailabilityValue;
  onChange: (val: AvailabilityValue) => void;
  dayStartTime?: string;
  schoolEndTime?: string;
  intervalMinutes?: number;
  slotsPerDay?: number;
  totalDays?: number;
}) {
  const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAYS = ALL_DAYS.slice(0, Math.max(1, Math.min(totalDays, 7)));

  const toggleDay = (dIdx: number) => {
    const blocked = value.blockedDays.includes(dIdx)
      ? value.blockedDays.filter(d => d !== dIdx)
      : [...value.blockedDays, dIdx];
    onChange({ ...value, blockedDays: blocked });
  };

  const addRange = (dIdx: number) => {
    onChange({ ...value, ranges: [...value.ranges, { day: dIdx, from: dayStartTime, to: schoolEndTime }] });
  };

  const updateRange = (idx: number, patch: Partial<DayRange>) => {
    onChange({ ...value, ranges: value.ranges.map((r, i) => i === idx ? { ...r, ...patch } : r) });
  };

  const removeRange = (idx: number) => {
    onChange({ ...value, ranges: value.ranges.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase text-muted-foreground/70 flex items-center gap-1.5">
          <Calendar className="h-3 w-3" /> Block Unavailable Times
        </label>
        <button onClick={() => onChange({ blockedDays: [], ranges: [] })} className="text-[9px] font-bold text-blue-500 uppercase hover:underline">Clear All</button>
      </div>
      <div className="space-y-1.5">
        {DAYS.map((day, dIdx) => {
          const isFullDay = value.blockedDays.includes(dIdx);
          const dayRanges = value.ranges.map((r, i) => ({ ...r, _i: i })).filter(r => r.day === dIdx);
          return (
            <div key={day} className={`rounded-lg border transition-colors ${ isFullDay ? 'border-red-500/40 bg-red-500/5' : 'border-border/50 bg-muted/10' }`}>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[11px] font-semibold">{day}</span>
                <div className="flex items-center gap-2">
                  {!isFullDay && (
                    <button onClick={() => addRange(dIdx)} className="text-[9px] font-bold text-blue-500 hover:underline">+ Add Range</button>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={isFullDay} onChange={() => toggleDay(dIdx)} className="accent-red-500 w-3.5 h-3.5" />
                    <span className={`text-[10px] font-bold ${ isFullDay ? 'text-red-500' : 'text-muted-foreground/60' }`}>
                      {isFullDay ? 'BLOCKED' : 'Block Day'}
                    </span>
                  </label>
                </div>
              </div>
              {!isFullDay && dayRanges.map(r => (
                <div key={r._i} className="flex items-center gap-2 px-3 pb-2">
                  <span className="text-[9px] text-muted-foreground/50 w-10">From</span>
                  <input type="time" value={r.from} min={dayStartTime} max={r.to}
                    onChange={e => updateRange(r._i, { from: e.target.value })}
                    className="px-2 py-1 bg-background border border-border rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-red-500/50" />
                  <span className="text-[9px] text-muted-foreground/50">→</span>
                  <input type="time" value={r.to} min={r.from} max={schoolEndTime}
                    onChange={e => updateRange(r._i, { to: e.target.value })}
                    className="px-2 py-1 bg-background border border-border rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-red-500/50" />
                  <button onClick={() => removeRange(r._i)} className="ml-auto text-muted-foreground/40 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CapacityInput({ value, onChange }: { value: number, onChange: (val: number) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase text-muted-foreground/70 flex items-center gap-1.5">
        <BarChart3 className="h-3 w-3" /> Max Sessions Per Day
      </label>
      <div className="flex items-center gap-3">
        <input type="range" min="1" max="10" step="1" value={value || 4} onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-500" />
        <span className="w-8 text-center font-mono text-xs font-bold bg-muted p-1 rounded border border-border">{value ?? 4}</span>
      </div>
    </div>
  );
}

function AffinityInput({
  value, onChange, teachers, rooms, groups, subjects, sourceTargetType
}: {
  value: { with_target_type: ConstraintTargetType, with_target_id: string, same_day: boolean },
  onChange: (val: any) => void,
  teachers: Faculty[], rooms: Room[], groups: Group[], subjects: Subject[], sourceTargetType: ConstraintTargetType
}) {

  // Synergy logic: If source is Teacher, only show other Teachers to avoid (or pair with).
  const validTypes = sourceTargetType === 'Teacher' ? ['Teacher'] : sourceTargetType === 'Subject' ? ['Subject'] : TARGET_TYPES;

  const targetOptions = useMemo(() => {
    switch (value.with_target_type) {
      case 'Teacher': return teachers.map(f => ({ id: f.id, label: f.name }));
      case 'Room': return rooms.map(r => ({ id: r.id, label: r.name }));
      case 'StudentGroup': return groups.map(g => ({ id: g.id, label: g.name }));
      case 'Subject': return subjects.map(s => ({ id: s.id, label: s.name }));
      default: return [];
    }
  }, [value.with_target_type, teachers, rooms, groups, subjects]);

  return (
    <div className="space-y-3 p-3 rounded-md border border-border bg-muted/10">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase text-muted-foreground/70">Synergy / Conflict With</label>
        <select value={value.with_target_type} onChange={(e) => onChange({ ...value, with_target_type: e.target.value, with_target_id: '' })}
          className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold focus:outline-none">
          {validTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase text-muted-foreground/70">Specific Entity</label>
        <select value={value.with_target_id} onChange={(e) => onChange({ ...value, with_target_id: e.target.value })}
          className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold focus:outline-none">
          <option value="">Select entity...</option>
          {targetOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="same-day-toggle" checked={value.same_day} onChange={(e) => onChange({ ...value, same_day: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-border text-blue-500 focus:ring-0" />
        <label htmlFor="same-day-toggle" className="text-[10px] font-bold uppercase text-muted-foreground/70 cursor-pointer">
          Must be on Same Day
        </label>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export function ConstraintBuilder({
  initialConstraints, onConstraintsChange, conflictingIds = [], conflictMessages = [],
  teachers, rooms, groups, subjects,
  periodDurationMinutes = 30, onPeriodDurationChange,
  dayStartTime = '09:00', onDayStartTimeChange,
  schoolEndTime = '18:00', onSchoolEndTimeChange,
  breakWindows = [], onBreakWindowChange, onAddBreakWindow, onRemoveBreakWindow,
  totalSlotsPerDay = 20, intervalMinutes = 30,
}: ConstraintBuilderProps) {

  const [activeConstraints, setActiveConstraints] = useState<ConstraintDraft[]>(
    () => (initialConstraints || []).map(c => ({ ...c, id: c.id || uuidv4() }))
  );

  // Sync initialConstraints from outside when it changes drastically (like when injecting an absence constraint)
  useEffect(() => {
    if (initialConstraints) {
      const draftMap = new Map(activeConstraints.map(c => [c.id, c]));
      let changed = false;
      
      const newActive = initialConstraints.map(c => {
        if (c.id && draftMap.has(c.id)) {
          return draftMap.get(c.id)!;
        }
        changed = true;
        return { ...c, id: c.id || uuidv4() };
      });
      
      if (changed || newActive.length !== activeConstraints.length) {
        setActiveConstraints(newActive);
      }
    }
  }, [initialConstraints]);

  /* Form State */
  const [targetType, setTargetType] = useState<ConstraintTargetType>('Teacher');
  const [targetId, setTargetId] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [ruleType, setRuleType] = useState<ConstraintRuleType>('Availability');

  const [unavailability, setUnavailability] = useState<AvailabilityValue>({ blockedDays: [], ranges: [] });
  const [maxSessions, setMaxSessions] = useState<number>(4);
  const [affinity, setAffinity] = useState({ with_target_type: 'Teacher' as ConstraintTargetType, with_target_id: '', same_day: true });
  const [preferredBuilding, setPreferredBuilding] = useState<string>('');

  /* Smart Resets when type changes */
  useEffect(() => {
    const validRules = RULES_BY_TARGET[targetType];
    if (!validRules.includes(ruleType)) setRuleType(validRules[0]);
    if (targetType === 'Subject') setAffinity(prev => ({ ...prev, with_target_type: 'Subject', with_target_id: '' }));
  }, [targetType, ruleType]);

  const allTargetOptions = useMemo(() => {
    if (ruleType === 'LocationPreference') return groups.map(g => ({ id: g.id, label: `${g.name} - Sem ${g.semester}`, tags: [] as string[] }));
    switch (targetType) {
      case 'Teacher': return teachers.map(f => ({ id: f.id, label: f.name, tags: f.tags ?? [] }));
      case 'Room': return rooms.map(r => ({ id: r.id, label: `${r.name} (${r.type})`, tags: r.building_tag ? [r.building_tag] : [] }));
      case 'StudentGroup': return groups.map(g => ({ id: g.id, label: `${g.name} - Sem ${g.semester}`, tags: [] as string[] }));
      case 'Subject': return subjects.map(s => ({ id: s.id, label: s.name, tags: [] as string[] }));
      default: return [];
    }
  }, [ruleType, targetType, teachers, rooms, groups, subjects]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allTargetOptions.forEach(o => o.tags.forEach(t => t && tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [allTargetOptions]);

  const targetOptions = useMemo(() => {
    if (!tagFilter) return allTargetOptions;
    return allTargetOptions.filter(o => o.tags.includes(tagFilter));
  }, [allTargetOptions, tagFilter]);

  useEffect(() => {
    setTagFilter('');
  }, [targetType]);

  useEffect(() => {
    if (targetOptions.length > 0 && !targetOptions.find(o => o.id === targetId)) {
      setTargetId(targetOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOptions]);

  useEffect(() => {
    onConstraintsChange?.(activeConstraints);
  }, [activeConstraints, onConstraintsChange]);

  function handleAddConstraint() {
    const normalizedTargetId = targetId.trim();
    if (!normalizedTargetId) return toast.error('Target entity is required');

    let finalValue: any = {};
    const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (ruleType === 'Availability') {
      const pairs = availToSlotPairs(unavailability, dayStartTime, intervalMinutes, totalSlotsPerDay);
      if (pairs.length === 0) return toast.error('Validation Error', { description: 'Block at least one time range or day.' });
      finalValue = { unavailable: pairs };
    } else if (ruleType === 'Capacity') {
      if (maxSessions < 1) return toast.error('Validation Error', { description: 'Capacity must be at least 1.' });
      finalValue = { max_sessions_per_day: maxSessions };
    } else if (ruleType === 'Affinity') {
      if (!affinity.with_target_id) return toast.error('Validation Error', { description: 'Select a valid entity for the affinity rule.' });
      finalValue = affinity;
    } else if (ruleType === 'LocationPreference') {
      if (!preferredBuilding.trim()) return toast.error('Validation Error', { description: 'Preferred building tag is required.' });
      finalValue = { preferred_building: preferredBuilding.trim() };
    }

    const newDraft: ConstraintDraft = {
      id: uuidv4(),
      target_type: ruleType === 'LocationPreference' ? 'StudentGroup' : targetType,
      target_id: normalizedTargetId,
      rule_type: ruleType,
      value: finalValue,
    };

    setActiveConstraints(prev => [...prev, newDraft]);
    toast.success('Constraint added to solver logic');
    setUnavailability({ blockedDays: [], ranges: [] });
    setPreferredBuilding('');
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Braces className="h-3.5 w-3.5" /> Solver Logic
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent border border-border text-muted-foreground font-mono">
            {activeConstraints.length} ACTIVE
          </span>
        </div>

        {/* Global Grid Settings */}
        <div className="space-y-3 p-3 bg-card border border-border rounded-lg mb-4">
          <div className="text-[10px] font-bold uppercase text-muted-foreground/70 mb-1">Global Grid Configuration</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground/50">Start Time</label>
              <input type="time" value={dayStartTime} onChange={e => onDayStartTimeChange?.(e.target.value)} className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-muted-foreground/50">End Time</label>
              <input type="time" value={schoolEndTime} onChange={e => onSchoolEndTimeChange?.(e.target.value)} className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
            <label className="text-[10px] font-bold uppercase text-muted-foreground/70">Period Size</label>
            <select value={periodDurationMinutes} onChange={e => onPeriodDurationChange?.(parseInt(e.target.value, 10))} className="px-2 py-1 bg-muted/50 border border-border rounded text-xs focus:outline-none">
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
          <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-muted-foreground/70">Break Blocks</label>
              <button onClick={onAddBreakWindow} className="text-[9px] font-bold text-blue-500 uppercase hover:underline">+ Add Break</button>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {breakWindows.map(bw => {
                const endTimeMins = timeToMins(bw.startTime) + bw.durationMinutes;
                const endTime = minsToTime(endTimeMins);
                return (
                  <div key={bw.id} className="flex flex-col gap-1.5 p-2 bg-muted/30 border border-border/50 rounded-md">
                    <div className="flex items-center justify-between">
                      <input value={bw.name} onChange={e => onBreakWindowChange?.(bw.id, { name: e.target.value })}
                        className="bg-transparent text-xs font-semibold focus:outline-none w-2/3" placeholder="Break Name" />
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] font-medium cursor-pointer">
                          <input type="checkbox" checked={bw.enabled} onChange={e => onBreakWindowChange?.(bw.id, { enabled: e.target.checked })} className="accent-blue-500" />
                          Active
                        </label>
                        <button onClick={() => onRemoveBreakWindow?.(bw.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground/50 w-8">From</span>
                      <input type="time" value={bw.startTime}
                        onChange={e => onBreakWindowChange?.(bw.id, { startTime: e.target.value })}
                        className="px-2 py-1 bg-background border border-border rounded text-[11px] focus:outline-none" />
                      <span className="text-[9px] text-muted-foreground/50">→</span>
                      <input type="time" value={endTime}
                        onChange={e => {
                          const newEnd = timeToMins(e.target.value);
                          const start = timeToMins(bw.startTime);
                          if (newEnd > start) onBreakWindowChange?.(bw.id, { durationMinutes: newEnd - start });
                        }}
                        className="px-2 py-1 bg-background border border-border rounded text-[11px] focus:outline-none" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Builder Form */}
        <div className="p-4 space-y-4 border border-border bg-card rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground/70">Rule Applies To</label>
              <select value={targetType} onChange={e => setTargetType(e.target.value as ConstraintTargetType)} disabled={ruleType === 'LocationPreference'} className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-xs font-semibold focus:outline-none">
                {TARGET_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground/70">Rule Type</label>
              <select value={ruleType} onChange={e => setRuleType(e.target.value as ConstraintRuleType)} className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-xs font-semibold focus:outline-none">
                {RULES_BY_TARGET[targetType].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground/70 flex items-center justify-between">Specific Target</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500/50">
              <option value="">-- Select {targetType} --</option>
              {targetOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
          </div>

          <div className="pt-3 border-t border-border/50">
            {ruleType === 'Availability' && (
              <AvailabilityPicker
                value={unavailability}
                onChange={setUnavailability}
                dayStartTime={dayStartTime}
                schoolEndTime={schoolEndTime}
                intervalMinutes={intervalMinutes}
                slotsPerDay={totalSlotsPerDay}
              />
            )}
            {ruleType === 'Capacity' && <CapacityInput value={maxSessions} onChange={setMaxSessions} />}
            {ruleType === 'Affinity' && <AffinityInput value={affinity} onChange={setAffinity} teachers={teachers} rooms={rooms} groups={groups} subjects={subjects} sourceTargetType={targetType} />}
            {ruleType === 'LocationPreference' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground/70 flex items-center gap-1.5"><Users className="h-3 w-3" /> Preferred Building Tag</label>
                <input value={preferredBuilding} onChange={e => setPreferredBuilding(e.target.value)} placeholder="e.g. Science_Block" className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
              </div>
            )}
          </div>
        </div>

        <button onClick={handleAddConstraint} className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: 'var(--accent-blue)' }}>
          <Plus className="h-3.5 w-3.5" /> Add Rule to Solver
        </button>
      </div>

      {/* Active Rules List */}
      <div className="p-4 space-y-3 bg-muted/10">
        {activeConstraints.length === 0 ? (
          <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-md opacity-30">
            <span className="text-[10px] font-bold uppercase tracking-wider">No custom rules active</span>
          </div>
        ) : (
          activeConstraints.map(c => {
            const isConflicting = conflictingIds.includes(c.id);
            const getTargetName = (type: string, id: string) => {
              if (!id) return 'Global/All';
              if (type === 'Teacher') return teachers.find(t => t.id === id)?.name || id;
              if (type === 'Room') return rooms.find(r => r.id === id)?.name || id;
              if (type === 'Group') return groups.find(g => g.id === id)?.name || id;
              if (type === 'Subject') return subjects.find(s => s.id === id)?.name || id;
              return id;
            };
            const targetName = getTargetName(c.target_type, c.target_id || '');

            return (
              <div key={c.id} className={`rounded-md border p-3 shadow-sm relative overflow-hidden ${isConflicting ? 'ring-2 ring-red-500 animate-pulse' : ''}`} style={{ background: isConflicting ? 'rgba(239,68,68,0.08)' : 'var(--surface-3)', borderColor: isConflicting ? '#ef4444' : 'var(--surface-border)' }}>
                {isConflicting && <div className="absolute top-0 right-0 p-1 bg-red-500 rounded-bl-lg"><AlertCircle className="h-3 w-3 text-white" /></div>}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">{c.target_type}</div>
                    <div className="text-[11px] font-bold">{c.rule_type}</div>
                  </div>
                  <button onClick={() => setActiveConstraints(p => p.filter(x => x.id !== c.id))} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground/40"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="text-[10px] text-muted-foreground mb-2 truncate bg-muted/30 px-2 py-1 rounded">
                  Target: <span className="font-semibold text-foreground">{targetName}</span>
                </div>
                <div className="text-[10px] p-2 rounded border border-border/50 bg-background/50 overflow-x-auto">
                  {c.rule_type === 'Availability'
                    ? (() => {
                        const val = c.value as any;
                        const pairs: {day: number; slot: number}[] = val.unavailable || [];
                        const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                        const daySlots: Record<number, number[]> = {};
                        pairs.forEach(p => { (daySlots[p.day] ||= []).push(p.slot); });
                        const desc = Object.entries(daySlots).map(([d, slots]) => {
                          const day = ALL_DAYS[Number(d)] ?? `Day ${d}`;
                          const sorted = [...slots].sort((a, b) => a - b);
                          const allDay = sorted.length >= (totalSlotsPerDay ?? 20);
                          if (allDay) return `${day}: All day`;
                          return `${day}: ${sorted.length} slot(s)`;
                        }).join(' · ');
                        return <span className="text-amber-500/90 font-medium">{desc || 'No blocks'}</span>;
                      })()
                    : <span className="font-mono">{JSON.stringify(c.value)}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}