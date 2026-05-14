export interface ScheduleRuntimeConfig {
  totalDays: number;
  totalSlotsPerDay: number;
  startHour: number;
  startMinute: number;
  intervalMinutes: number;
}

const WORKSPACE_STORAGE_KEY = 'realtime-timetable.workspace.v2';

const DEFAULT_CONFIG: ScheduleRuntimeConfig = {
  totalDays: 5,
  totalSlotsPerDay: 20,
  startHour: 9,
  startMinute: 0,
  intervalMinutes: 30,
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function parseTimeLabel(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) {
    return null;
  }
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  return { hour, minute };
}

function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function getScheduleRuntimeConfig(): ScheduleRuntimeConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONFIG;
    }

    const parsed = JSON.parse(raw) as Partial<{
      dayStartTime: string;
      schoolEndTime: string;
      periodDurationMinutes: number;
    }>;

    const start = parseTimeLabel(parsed.dayStartTime);
    const end = parseTimeLabel(parsed.schoolEndTime);
    const interval = Number(parsed.periodDurationMinutes);

    if (!start || !end || !Number.isFinite(interval) || interval <= 0) {
      return DEFAULT_CONFIG;
    }

    const startTotal = toMinutes(start.hour, start.minute);
    const endTotal = toMinutes(end.hour, end.minute);
    const spanMinutes = Math.max(interval, endTotal - startTotal);
    const totalSlotsPerDay = Math.max(1, Math.floor(spanMinutes / interval));

    return {
      totalDays: DEFAULT_CONFIG.totalDays,
      totalSlotsPerDay,
      startHour: start.hour,
      startMinute: start.minute,
      intervalMinutes: interval,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function getDayLabels(totalDays: number): string[] {
  return DAY_LABELS.slice(0, Math.max(1, Math.min(totalDays, DAY_LABELS.length)));
}

export function slotIndexToTimeLabel(
  slotIndex: number,
  config: ScheduleRuntimeConfig,
): string {
  const totalMinutes =
    config.startHour * 60 + config.startMinute + slotIndex * config.intervalMinutes;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function slotIndexToDisplayLabel(slotIndex: number, config: ScheduleRuntimeConfig): string {
  const label = slotIndexToTimeLabel(slotIndex, config);
  const [h, m] = label.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function timeLabelToSlotIndex(timeLabel: string, config: ScheduleRuntimeConfig): number {
  const time = parseTimeLabel(timeLabel);
  if (!time) {
    return -1;
  }
  const startTotal = config.startHour * 60 + config.startMinute;
  const total = time.hour * 60 + time.minute;
  const delta = total - startTotal;
  if (delta < 0) {
    return -1;
  }
  return Math.floor(delta / config.intervalMinutes);
}
