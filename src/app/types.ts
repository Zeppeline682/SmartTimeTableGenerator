export interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject?: string;
  faculty?: string;
  room?: string;
  type?: 'lecture' | 'practical' | 'tutorial';
  groupId?: string;
}

export interface Group {
  id: string;
  name: string;
  course: string;
  semester: number;
  studentsCount: number;
  isLive: boolean;
  liveLink?: string;
}

/** Per-day availability window for a faculty member. */
export interface DayAvailability {
  available: boolean;
  from: string;           // "09:00"
  to: string;             // "17:00"
  /** Admin has hard-locked this day — faculty cannot edit it */
  lockedByAdmin: boolean;
  /** Admin override note explaining the lock */
  adminNote?: string;
}

export interface Faculty {
  id: string;
  name: string;
  email: string;
  tags?: string[];
  department: string;
  subjects: string[];
  isAbsent: boolean;
  absentDates?: Date[];
  preferences?: {
    /** Keyed by day name e.g. "Monday" */
    availability: Record<string, DayAvailability>;
    maxClassesPerDay: number;
    maxConsecutiveHours: number;
    notes?: string;
  };
  totalWeeklyHours?: number;
  workloadIntensity?: 'low' | 'medium' | 'high';
  joinedDate?: string;
  phone?: string;
}

export interface Constraint {
  id: string;
  type: 'no-back-to-back' | 'practicals-after-lectures' | 'max-hours-per-day' | 'faculty-preference' | 'custom';
  priority: 'high' | 'medium' | 'low';
  description: string;
  rule: string;
  enabled: boolean;
}

export type ConstraintTargetType = 'Teacher' | 'Room' | 'StudentGroup' | 'Subject';
export type ConstraintRuleType = 'Availability' | 'Capacity' | 'Affinity' | 'LocationPreference';

export interface ConstraintCreateDTO {
  id?: string;
  target_type: ConstraintTargetType;
  target_id?: string;
  rule_type: ConstraintRuleType;
  value: any;
}

export interface Conflict {
  id: string;
  timestamp: Date;
  type: 'constraint-violation' | 'room-conflict' | 'faculty-conflict' | 'time-conflict';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedSlots: string[];
  suggestion?: string;
}

export interface OptimizationScore {
  overall: number;
  constraintSatisfaction: number;
  workloadBalance: number;
  studentSatisfaction: number;
  facultySatisfaction: number;
}

export interface WorkloadData {
  id: string;
  name: string;
  role: 'student' | 'faculty';
  groupId?: string;
  hoursPerDay: { [day: string]: number };
  totalHours: number;
  intensity: 'low' | 'medium' | 'high';
}

export interface Room {
  id: string;
  roomId: string;
  name: string;
  capacity: number;
  type: 'classroom' | 'lab' | 'seminar' | 'lecture-hall';
  equipment: string[];
  building?: string;
  building_tag?: string;
  floor?: string;
  isAvailable: boolean;
  /** Utilization: number of sessions scheduled today */
  sessionsToday?: number;
}

export interface Subject {
  id: string;
  name: string;
}

/** A single row in a class configuration: maps subject → teacher → room with weekly counts. */
export interface ClassSubjectRow {
  id: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  lecturesPerWeek: number;
  practicalsPerWeek: number;
}

/** Per-group class configuration containing all subject/teacher/room assignments. */
export interface ClassConfig {
  groupId: string;
  rows: ClassSubjectRow[];
}

/** Which teachers are assigned to a student group. */
export interface GroupFacultyAssignment {
  groupId: string;
  teacherIds: string[];
}

/** DTO sent to the backend /solve endpoint as a session blueprint. */
export interface SessionBlueprintDTO {
  id?: string;
  teacher_id: string;
  room_id: string;
  student_group_id: string;
  subject_id: string;
  duration?: number;
}

/** Response shape from POST /solve. */
export interface SolveApiResponse {
  schedule_id: string;
  verification_hash: string;
  scheduled_sessions: Array<{
    id: string;
    day_of_week: number;
    start_slot: number;
    teacher_id: string;
    room_id: string;
    student_group_id: string;
    subject_id: string;
    duration?: number;
    schedule_id?: string;
  }>;
  persisted: boolean;
}