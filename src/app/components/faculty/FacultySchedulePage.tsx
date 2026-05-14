import { useMemo } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { TYPE_META, typePill } from '../FacultyDashboard';
import { useWorkspaceStore } from '../../hooks/useWorkspaceStore';
import { useSession } from '../../auth/SessionContext';
import { TimetableGrid } from '../TimetableGrid';
import { TimeSlot } from '../../types';

function minutesFromTimeLabel(value: string): number {
    const [h, m] = value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + m;
}

export function FacultySchedulePage() {
  const workspace = useWorkspaceStore();
  const { user } = useSession();

  const realTeacherIndex = workspace.teachers.findIndex(t => (t.email && t.email.toLowerCase() === user.email.toLowerCase()) || t.name.toLowerCase().includes(user.name.toLowerCase())) >= 0
    ? workspace.teachers.findIndex(t => (t.email && t.email.toLowerCase() === user.email.toLowerCase()) || t.name.toLowerCase().includes(user.name.toLowerCase()))
    : 0;

  const me = workspace.teachers[realTeacherIndex];

  const sessions = useMemo(() => {
    if (!me) return [];
    // Only show slots from live published groups
    const liveGroupIds = new Set(workspace.groups.filter(g => g.isLive).map(g => g.id));
    return workspace.slots
      .filter(s => s.faculty === me.name && liveGroupIds.has(s.groupId))
      .map(s => ({
        ...s,
        type: s.type ?? 'lecture',
      }));
  }, [workspace.slots, me, workspace.groups]);

  // Settings for TimetableGrid
  const periodDurationMinutes = workspace.periodDurationMinutes ?? 30;
  const dayStartTime = workspace.dayStartTime ?? '09:00';
  const schoolEndTime = workspace.schoolEndTime ?? '18:00';

  const breakWindows = useMemo(() => {
      return Array.isArray(workspace.breakWindows) && workspace.breakWindows.length > 0
          ? workspace.breakWindows
          : [];
  }, [workspace.breakWindows]);

  const { timeline, totalSlotsPerDay, breakSlotIndexes, breakNamesBySlot } = useMemo(() => {
      const blocks: { isBreak: boolean, name: string, startMins: number, endMins: number }[] = [];
      const startMins = minutesFromTimeLabel(dayStartTime);
      let endMins = minutesFromTimeLabel(schoolEndTime);
      if (endMins <= startMins) endMins = minutesFromTimeLabel('18:00');

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
  }, [dayStartTime, schoolEndTime, periodDurationMinutes, breakWindows]);

  return (
    <div className="min-h-full bg-background flex flex-col">
      <div className="border-b border-border px-8 py-5 bg-background">
        <h1 className="text-xl font-semibold">My Schedule</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your published weekly timetable</p>
      </div>

      <div className="px-8 py-6 flex-1 flex flex-col space-y-6">
        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(TYPE_META).map(([key, m]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded" style={{ background: m.bg, border: `1px solid ${m.border}` }} />
              <span className="text-muted-foreground">{m.label}</span>
            </div>
          ))}
          <div className="ml-auto text-xs text-muted-foreground">{sessions.length} sessions this week</div>
        </div>

        {/* Grid using TimetableGrid */}
        <div className="h-[500px] border border-border shadow-sm rounded-xl overflow-hidden bg-card">
          <TimetableGrid
              slots={sessions as TimeSlot[]}
              isReadOnly={true}
              totalDays={5}
              totalSlotsPerDay={totalSlotsPerDay}
              dayStartTime={dayStartTime}
              intervalMinutes={periodDurationMinutes}
              breakSlotIndexes={breakSlotIndexes}
              breakNames={breakNamesBySlot}
              breakWindows={breakWindows}
              timeline={timeline}
              zoomScale={1.05}
          />
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-card">
            <h2 className="text-sm font-medium">All Sessions</h2>
          </div>
          <div className="divide-y divide-border">
            {sessions.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No published sessions found. Ask your admin to publish the schedule.
              </div>
            ) : sessions.map(slot => (
              <div key={slot.id} className="flex items-center justify-between px-5 py-4 hover:bg-accent/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-xs text-muted-foreground w-20 shrink-0">{slot.day}</div>
                  <div>
                    <div className="text-sm font-medium">{slot.subject}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{slot.startTime}–{slot.endTime}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.room}</span>
                    </div>
                  </div>
                </div>
                {typePill(slot.type)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
