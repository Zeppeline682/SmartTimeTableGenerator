import { Group, Faculty, TimeSlot, Constraint, Conflict, OptimizationScore, WorkloadData, Room, Subject, ClassConfig, GroupFacultyAssignment } from './types';

// Helper to generate a consistent UUID from a short string
// This is just for mock data to ensure we have valid UUIDs
function mockUuid(id: string): string {
  // Deterministic 128-bit hash (4x32-bit) rendered as RFC4122-compatible UUID.
  const seed = id || 'seed';
  const hash32 = (input: string): number => {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const a = hash32(`a:${seed}`);
  const b = hash32(`b:${seed}`);
  const c = hash32(`c:${seed}`);
  const d = hash32(`d:${seed}`);
  const hex = [a, b, c, d].map((n) => n.toString(16).padStart(8, '0')).join('');

  const p1 = hex.slice(0, 8);
  const p2 = hex.slice(8, 12);
  const p3 = `4${hex.slice(13, 16)}`; // UUID version 4
  const p4 = `8${hex.slice(17, 20)}`; // RFC4122 variant
  const p5 = hex.slice(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export const mockGroups: Group[] = [
  {
    id: mockUuid('g1'),
    name: 'CS-A-2024',
    course: 'Computer Science',
    semester: 3,
    studentsCount: 45,
    isLive: true,
    liveLink: 'cs-a-2024',
  },
  {
    id: mockUuid('g2'),
    name: 'CS-B-2024',
    course: 'Computer Science',
    semester: 3,
    studentsCount: 42,
    isLive: false,
  },
  {
    id: mockUuid('g3'),
    name: 'EE-A-2024',
    course: 'Electrical Engineering',
    semester: 5,
    studentsCount: 38,
    isLive: true,
    liveLink: 'ee-a-2024',
  },
];

export const mockFaculty: Faculty[] = [
  {
    id: mockUuid('f1'),
    name: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@university.edu',
    department: 'Computer Science',
    subjects: ['Data Structures', 'Algorithms', 'Database Systems'],
    isAbsent: false,
    totalWeeklyHours: 20,
    workloadIntensity: 'high',
    joinedDate: '2019-08-01',
    phone: '+1 (555) 101-0001',
    preferences: {
      availability: {
        Monday:    { available: true,  from: '09:00', to: '14:00', lockedByAdmin: true,  adminNote: 'Dept meeting ends at 09:00' },
        Tuesday:   { available: false, from: '09:00', to: '17:00', lockedByAdmin: false },
        Wednesday: { available: true,  from: '10:00', to: '16:00', lockedByAdmin: false },
        Thursday:  { available: true,  from: '09:00', to: '13:00', lockedByAdmin: false },
        Friday:    { available: true,  from: '09:00', to: '12:00', lockedByAdmin: true,  adminNote: 'Half-day Fridays approved' },
      },
      maxClassesPerDay: 4,
      maxConsecutiveHours: 3,
      notes: 'Prefers lab sessions in the afternoon.',
    },
  },
  {
    id: mockUuid('f2'),
    name: 'Prof. Michael Chen',
    email: 'michael.chen@university.edu',
    department: 'Computer Science',
    subjects: ['Operating Systems', 'Computer Networks'],
    isAbsent: false,
    totalWeeklyHours: 15,
    workloadIntensity: 'medium',
    joinedDate: '2021-01-15',
    phone: '+1 (555) 101-0002',
    preferences: {
      availability: {
        Monday:    { available: false, from: '09:00', to: '17:00', lockedByAdmin: false },
        Tuesday:   { available: true,  from: '11:00', to: '17:00', lockedByAdmin: false },
        Wednesday: { available: false, from: '09:00', to: '17:00', lockedByAdmin: true,  adminNote: 'Research allocation day' },
        Thursday:  { available: true,  from: '10:00', to: '16:00', lockedByAdmin: false },
        Friday:    { available: true,  from: '09:00', to: '15:00', lockedByAdmin: false },
      },
      maxClassesPerDay: 3,
      maxConsecutiveHours: 2,
    },
  },
  {
    id: mockUuid('f3'),
    name: 'Dr. Emily Rodriguez',
    email: 'emily.rodriguez@university.edu',
    department: 'Mathematics',
    subjects: ['Calculus', 'Linear Algebra', 'Discrete Mathematics'],
    isAbsent: true,
    absentDates: [new Date('2026-04-17')],
    totalWeeklyHours: 9,
    workloadIntensity: 'low',
    joinedDate: '2020-06-10',
    phone: '+1 (555) 101-0003',
    preferences: {
      availability: {
        Monday:    { available: true,  from: '08:00', to: '11:00', lockedByAdmin: false },
        Tuesday:   { available: true,  from: '08:00', to: '11:00', lockedByAdmin: false },
        Wednesday: { available: true,  from: '08:00', to: '11:00', lockedByAdmin: false },
        Thursday:  { available: true,  from: '08:00', to: '11:00', lockedByAdmin: false },
        Friday:    { available: false, from: '09:00', to: '17:00', lockedByAdmin: true,  adminNote: 'Faculty council on Fridays' },
      },
      maxClassesPerDay: 2,
      maxConsecutiveHours: 2,
    },
  },
  {
    id: mockUuid('f4'),
    name: 'Prof. James Wilson',
    email: 'james.wilson@university.edu',
    department: 'Computer Science',
    subjects: ['Software Engineering', 'System Design'],
    isAbsent: false,
    totalWeeklyHours: 12,
    workloadIntensity: 'low',
    joinedDate: '2018-09-12',
    phone: '+1 (555) 101-0004',
  },
  {
    id: mockUuid('f5'),
    name: 'Dr. Priya Sharma',
    email: 'priya.sharma@university.edu',
    department: 'Electrical Engineering',
    subjects: ['Signals and Systems', 'Digital Electronics'],
    isAbsent: false,
    totalWeeklyHours: 18,
    workloadIntensity: 'medium',
    joinedDate: '2022-03-20',
    phone: '+1 (555) 101-0005',
  },
  {
    id: mockUuid('f6'),
    name: 'Prof. Lisa Wang',
    email: 'lisa.wang@university.edu',
    department: 'Computer Science',
    subjects: ['Computer Graphics', 'Game Development'],
    isAbsent: false,
    totalWeeklyHours: 14,
    workloadIntensity: 'medium',
    joinedDate: '2017-11-05',
    phone: '+1 (555) 101-0006',
  },
  {
    id: mockUuid('f7'),
    name: 'Dr. Marcus Kim',
    email: 'marcus.kim@university.edu',
    department: 'Artificial Intelligence',
    subjects: ['Machine Learning', 'AI Fundamentals'],
    isAbsent: false,
    totalWeeklyHours: 16,
    workloadIntensity: 'medium',
    joinedDate: '2023-01-10',
    phone: '+1 (555) 101-0007',
  },
  {
    id: mockUuid('f8'),
    name: 'Prof. Elena Petrova',
    email: 'elena.petrova@university.edu',
    department: 'Electrical Engineering',
    subjects: ['Control Systems', 'Embedded Systems'],
    isAbsent: false,
    totalWeeklyHours: 15,
    workloadIntensity: 'medium',
    joinedDate: '2019-04-22',
    phone: '+1 (555) 101-0008',
  },
];

export const mockRooms: Room[] = [
  {
    id: mockUuid('r1'),
    roomId: '101',
    name: 'Room 101',
    capacity: 50,
    type: 'classroom',
    equipment: ['Projector', 'Whiteboard'],
    building: 'Main Block', floor: '1', isAvailable: true, sessionsToday: 2,
  },
  {
    id: mockUuid('r2'),
    roomId: '102',
    name: 'Room 102',
    capacity: 40,
    type: 'classroom',
    equipment: ['Projector', 'Smart Board'],
    building: 'Main Block', floor: '1', isAvailable: true, sessionsToday: 1,
  },
  {
    id: mockUuid('r3'),
    roomId: '103',
    name: 'Room 103',
    capacity: 60,
    type: 'lecture-hall',
    equipment: ['Projector', 'Audio System', 'Podium'],
    building: 'West Wing', floor: 'G', isAvailable: true, sessionsToday: 4,
  },
  {
    id: mockUuid('r4'),
    roomId: '201',
    name: 'Lab 201',
    capacity: 30,
    type: 'lab',
    equipment: ['Workstations', 'Servers', 'Projector'],
    building: 'Main Block', floor: '2', isAvailable: true, sessionsToday: 0,
  },
];

export const mockTimeSlots: TimeSlot[] = [
  {
    id: 's1',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Data Structures',
    faculty: 'Dr. Sarah Johnson',
    room: 'Room 101',
    type: 'lecture',
  },
  {
    id: 's2',
    day: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Algorithms',
    faculty: 'Dr. Sarah Johnson',
    room: 'Room 101',
    type: 'lecture',
  },
];

export const mockSubjects: Subject[] = [
  { id: mockUuid('sub-ds'),   name: 'Data Structures' },
  { id: mockUuid('sub-algo'), name: 'Algorithms' },
  { id: mockUuid('sub-os'),   name: 'Operating Systems' },
  { id: mockUuid('sub-cn'),   name: 'Computer Networks' },
  { id: mockUuid('sub-db'),   name: 'Database Systems' },
  { id: mockUuid('sub-ml'),   name: 'Machine Learning' },
  { id: mockUuid('sub-ai'),   name: 'AI Fundamentals' },
  { id: mockUuid('sub-dm'),   name: 'Discrete Mathematics' },
];

export const mockGroupFaculty: GroupFacultyAssignment[] = [
  { groupId: mockUuid('g1'), teacherIds: [mockUuid('f1'), mockUuid('f2'), mockUuid('f3')] },
  { groupId: mockUuid('g2'), teacherIds: [mockUuid('f2'), mockUuid('f4'), mockUuid('f6')] },
  { groupId: mockUuid('g3'), teacherIds: [mockUuid('f5'), mockUuid('f7'), mockUuid('f8')] },
];

export const mockClassConfigs: ClassConfig[] = [
  {
    groupId: mockUuid('g1'),
    rows: [
      { id: mockUuid('cfg-1a'), subjectId: mockUuid('sub-ds'),   teacherId: mockUuid('f1'), roomId: mockUuid('r1'),   lecturesPerWeek: 3, practicalsPerWeek: 1 },
      { id: mockUuid('cfg-1b'), subjectId: mockUuid('sub-algo'), teacherId: mockUuid('f1'), roomId: mockUuid('r1'),   lecturesPerWeek: 3, practicalsPerWeek: 0 },
      { id: mockUuid('cfg-1c'), subjectId: mockUuid('sub-os'),   teacherId: mockUuid('f2'), roomId: mockUuid('r2'),   lecturesPerWeek: 3, practicalsPerWeek: 1 },
      { id: mockUuid('cfg-1d'), subjectId: mockUuid('sub-dm'),   teacherId: mockUuid('f3'), roomId: mockUuid('r3'),   lecturesPerWeek: 2, practicalsPerWeek: 0 },
    ],
  },
  {
    groupId: mockUuid('g2'),
    rows: [
      { id: mockUuid('cfg-2a'), subjectId: mockUuid('sub-cn'),   teacherId: mockUuid('f2'), roomId: mockUuid('r2'),   lecturesPerWeek: 3, practicalsPerWeek: 1 },
      { id: mockUuid('cfg-2b'), subjectId: mockUuid('sub-db'),   teacherId: mockUuid('f6'), roomId: mockUuid('r4'),   lecturesPerWeek: 2, practicalsPerWeek: 2 },
    ],
  },
  {
    groupId: mockUuid('g3'),
    rows: [
      { id: mockUuid('cfg-3a'), subjectId: mockUuid('sub-ml'),   teacherId: mockUuid('f7'), roomId: mockUuid('r3'),   lecturesPerWeek: 3, practicalsPerWeek: 0 },
      { id: mockUuid('cfg-3b'), subjectId: mockUuid('sub-ai'),   teacherId: mockUuid('f7'), roomId: mockUuid('r3'),   lecturesPerWeek: 2, practicalsPerWeek: 1 },
    ],
  },
];

export const mockOptimizationScore: OptimizationScore = {
  overall: 82,
  constraintSatisfaction: 91,
  workloadBalance: 78,
  studentSatisfaction: 84,
  facultySatisfaction: 75,
};