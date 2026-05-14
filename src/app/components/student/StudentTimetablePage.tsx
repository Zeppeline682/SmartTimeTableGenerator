import { useMemo } from 'react';
import { useWorkspaceStore } from '../../hooks/useWorkspaceStore';
import { TimetableGrid } from '../TimetableGrid';
import { Calendar, Radio } from 'lucide-react';

function minutesFromTimeLabel(value: string): number {
    const [h, m] = value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + m;
}

export function StudentTimetablePage() {
    const workspace = useWorkspaceStore();

    // Find the group that the admin marked as 'isLive: true'
    const liveGroup = workspace.groups.find(g => g.isLive);
    const liveSlots = workspace.slots.filter(s => s.groupId === liveGroup?.id);

    // We MUST pull the exact same workspace settings to render the grid accurately!
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

    if (!liveGroup) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background text-muted-foreground p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 opacity-50" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">No Schedule Available</h2>
                <p className="max-w-md">
                    The administration has not published a live timetable for your cohort yet.
                    Check back later or watch for announcements.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="px-8 py-6 border-b border-border bg-card flex items-center justify-between shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        Class Schedule
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs tracking-wide uppercase">
                            <Radio className="w-3 h-3 animate-pulse" /> Live Updates
                        </span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Viewing official timetable for <strong className="text-foreground">{liveGroup.name}</strong> · Sem {liveGroup.semester}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6 bg-muted/10">
                <div className="h-full rounded-xl overflow-hidden border border-border shadow-sm bg-card overflow-auto">
                    {/* We MUST pass the timeline props, otherwise the Grid will crash or misalign slots */}
                    <TimetableGrid
                        slots={liveSlots}
                        isReadOnly={true}
                        totalDays={5}
                        totalSlotsPerDay={totalSlotsPerDay}
                        dayStartTime={dayStartTime}
                        intervalMinutes={periodDurationMinutes}
                        breakSlotIndexes={breakSlotIndexes}
                        breakNames={breakNamesBySlot}
                        breakWindows={breakWindows}
                        timeline={timeline}
                        zoomScale={1.05} // Slightly larger for readability
                    />
                </div>
            </div>
        </div>
    );
}