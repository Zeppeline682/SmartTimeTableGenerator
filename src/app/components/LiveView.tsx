import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AlertTriangle, LoaderCircle, Radio } from 'lucide-react';
import { useRealTimeClock } from '../hooks/useRealTime';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const WORKSPACE_STORAGE_KEY = 'realtime-timetable.workspace.v2';


interface BackendScheduledSession {
  id: string;
  day_of_week: number;
  start_slot: number;
  teacher_id: string;
  room_id: string;
  student_group_id: string;
  subject_id: string;
  schedule_id?: string;
}

interface WorkspaceSnapshot {
  groups?: Array<{ id: string; liveLink?: string }>;
  slots?: Array<{ id: string; day: string; startTime: string; groupId?: string; subject?: string; faculty?: string; room?: string }>;
}

function dayNameToIndex(day: string): number {
  return DAYS.findIndex((item) => item === day);
}

function timeToSlotIndex(timeLabel: string, intervalMinutes: number = 30, dayStartTime: string = '09:00'): number {
  const [startHour, startMinute] = dayStartTime.split(':').map(Number);
  const [hour, minute] = timeLabel.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const total = hour * 60 + minute;
  return Math.max(0, Math.floor((total - startTotal) / intervalMinutes));
}

function getLocalSessions(scheduleId: string): BackendScheduledSession[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceSnapshot;
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.slots)) {
      return [];
    }

    const group = parsed.groups.find((item) => item.liveLink === scheduleId);
    if (!group) {
      return [];
    }

    return parsed.slots
      .filter((slot) => slot.groupId === group.id)
      .map((slot) => ({
        id: slot.id,
        day_of_week: dayNameToIndex(slot.day),
        start_slot: timeToSlotIndex(slot.startTime),
        teacher_id: slot.faculty || 'local-teacher',
        room_id: slot.room || 'local-room',
        student_group_id: group.id,
        subject_id: slot.subject || 'local-subject',
        schedule_id: scheduleId,
      }))
      .filter((slot) => slot.day_of_week >= 0);
  } catch {
    return [];
  }
}

function getApiBaseUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) {
    return 'http://localhost:8000';
  }
  return base.replace(/\/$/, '');
}

function shortId(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 8)}...`;
}

function riskLabel(count: number, maxCount: number): 'Low' | 'Medium' | 'High' | 'None' {
  if (count <= 0) {
    return 'None';
  }

  const ratio = count / Math.max(maxCount, 1);
  if (ratio >= 0.8 || count >= 8) {
    return 'High';
  }
  if (ratio >= 0.45 || count >= 5) {
    return 'Medium';
  }
  return 'Low';
}

function dayHeatColor(count: number, maxCount: number): string {
  if (count <= 0) {
    return 'rgba(16,185,129,0.04)';
  }

  const ratio = count / Math.max(maxCount, 1);
  const alpha = 0.12 + ratio * 0.42;
  return `rgba(239,68,68,${alpha.toFixed(3)})`;
}

function dayCellColor(count: number, maxCount: number): string {
  if (count <= 0) {
    return 'rgba(255,255,255,0.01)';
  }

  const ratio = count / Math.max(maxCount, 1);
  const alpha = 0.02 + ratio * 0.1;
  return `rgba(239,68,68,${alpha.toFixed(3)})`;
}

export function LiveView() {
  const { schedule_id, linkId } = useParams();
  const clock = useRealTimeClock();
  const scheduleId = schedule_id ?? linkId ?? '';

  const [sessions, setSessions] = useState<BackendScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      setError('Missing schedule_id in URL.');
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(
          `${baseUrl}/scheduled-sessions?schedule_id=${encodeURIComponent(scheduleId)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const payload: unknown = await response.json();

        const rawSessions = Array.isArray(payload)
          ? payload
          : payload && typeof payload === 'object' && Array.isArray((payload as { scheduled_sessions?: unknown[] }).scheduled_sessions)
            ? (payload as { scheduled_sessions: unknown[] }).scheduled_sessions
            : [];

        const normalized = rawSessions
          .filter((item): item is BackendScheduledSession => {
            if (!item || typeof item !== 'object') {
              return false;
            }

            const candidate = item as Partial<BackendScheduledSession>;
            return (
              typeof candidate.id === 'string' &&
              typeof candidate.day_of_week === 'number' &&
              typeof candidate.start_slot === 'number' &&
              typeof candidate.teacher_id === 'string' &&
              typeof candidate.room_id === 'string' &&
              typeof candidate.student_group_id === 'string' &&
              typeof candidate.subject_id === 'string'
            );
          })
          .filter((item) => item.day_of_week >= 0 && item.day_of_week <= 4)
          .filter((item) => item.start_slot >= 0);

        const hasScheduleField = normalized.some((item) => typeof item.schedule_id === 'string');
        const scopedSessions = hasScheduleField
          ? normalized.filter((item) => item.schedule_id === scheduleId)
          : normalized;

        const localFallback = scopedSessions.length === 0 ? getLocalSessions(scheduleId) : [];
        setSessions(scopedSessions.length > 0 ? scopedSessions : localFallback);
        setLastUpdated(new Date());
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }
        let message = caught instanceof Error ? caught.message : 'Unknown fetch error';
        if (message === 'Failed to fetch') {
          message = 'Could not connect to the solver API. Is the backend server running on http://localhost:8000?';
        }
        const localFallback = getLocalSessions(scheduleId);
        if (localFallback.length > 0) {
          setSessions(localFallback);
          setLastUpdated(new Date());
          setError(null);
        } else {
          setError(`Failed to load schedule: ${message}`);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [scheduleId]);

  const sessionsByCell = useMemo(() => {
    const map = new Map<string, BackendScheduledSession[]>();

    for (const session of sessions) {
      const key = `${session.day_of_week}-${session.start_slot}`;
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(session);
      } else {
        map.set(key, [session]);
      }
    }

    return map;
  }, [sessions]);

  const sessionsPerDay = useMemo(() => {
    const counts = Array.from({ length: 5 }, () => 0);
    for (const session of sessions) {
      counts[session.day_of_week] += 1;
    }
    return counts;
  }, [sessions]);

  const maxDailyLoad = useMemo(() => {
    return Math.max(1, ...sessionsPerDay);
  }, [sessionsPerDay]);

  const SLOT_INDEXES = useMemo(() => {
    let maxSlot = 20;
    for (const session of sessions) {
      if (session.start_slot > maxSlot) {
        maxSlot = session.start_slot;
      }
    }
    return Array.from({ length: maxSlot + 1 }, (_, index) => index);
  }, [sessions]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span>Loading live schedule...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-md border p-4 flex items-start gap-3" style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-400">Unable to render live view</p>
            <p className="text-sm text-red-200 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Live Timetable View</h1>
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
            >
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              Read-only
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            schedule_id: <span className="font-mono">{scheduleId}</span>
            {lastUpdated ? ` - Updated ${lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
          {DAYS.map((day, dayIndex) => {
            const count = sessionsPerDay[dayIndex];
            const risk = riskLabel(count, maxDailyLoad);
            const color = dayHeatColor(count, maxDailyLoad);

            return (
              <th
                key={day}
                className={`text-left text-xs font-medium px-3 py-2 border-b border-r transition-colors duration-500 ${day === clock.dayName ? 'ring-inset ring-2 ring-emerald-500/50 bg-emerald-500/10' : ''}`}
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: day === clock.dayName ? undefined : dayHeatColor(count, maxDailyLoad) }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    {day}
                    {day === clock.dayName && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Today" />
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{count} sessions</span>
                </div>
              </th>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium px-3 py-2 border-b border-r" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                Slot (30m)
              </th>
              {DAYS.map((day, dayIndex) => {
                const count = sessionsPerDay[dayIndex];
                return (
                  <th
                    key={day}
                    className="text-left text-xs font-medium px-3 py-2 border-b border-r"
                    style={{ borderColor: 'rgba(255,255,255,0.1)', background: dayHeatColor(count, maxDailyLoad) }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{day}</span>
                      <span className="text-[11px] text-muted-foreground">{count} sessions</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {SLOT_INDEXES.map((slotIndex) => (
              <tr key={slotIndex}>
                <td
                  className="px-3 py-2 text-xs text-muted-foreground border-b border-r align-top"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  Slot {String(slotIndex).padStart(2, '0')}
                </td>

                {DAYS.map((_, dayIndex) => {
                  const key = `${dayIndex}-${slotIndex}`;
                  const entries = sessionsByCell.get(key) ?? [];

                  return (
                    <td
                      key={key}
                      className="px-2 py-1.5 border-b border-r align-top"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', background: dayCellColor(sessionsPerDay[dayIndex], maxDailyLoad) }}
                    >
                      {entries.length === 0 ? (
                        <div className="h-8 rounded-md bg-white/5" />
                      ) : (
                        <div className="space-y-1">
                          {entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md border px-2 py-1.5"
                              style={{ borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(17,24,39,0.66)' }}
                            >
                              <p className="text-[11px] font-medium leading-tight">Subject {shortId(entry.subject_id)}</p>
                              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                Room {shortId(entry.room_id)} - Teacher {shortId(entry.teacher_id)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Burnout heatmap intensity increases with each day's session count. This view is read-only and does not allow edits.
      </p>
    </div>
  );
}



