import * as XLSX from 'xlsx';

/**
 * Downloads the ChronoLink timetable template.
 *
 * FORMAT — 4 separate sheets:
 *   Faculty:    one row per professor
 *   Rooms:      one row per room
 *   Classes:    one row per student group
 *   Timetable:  one row per session
 *
 * The Import Wizard recognises all four sheets by name.
 * The "Group" column in Timetable must match the "Code" column in Classes.
 */
export function downloadChronoLinkTemplate() {
  const wb = XLSX.utils.book_new();

  type Row = (string | number)[];

  /* ── FACULTY SHEET ─────────────────────────────────────────────────────── */
  const facultyRows: Row[] = [
    ['Faculty Name', 'Email', 'Department', 'Phone', 'Max Classes / Day', 'Max Consecutive Hours', 'Weekly Hours'],
    ['Dr. Jash Parekh',        'jash.parekh@college.edu',        'Computer Science', '+91 98765 00001', 4, 3, 20],
    ['Prof. Anjali Sharma',    'anjali.sharma@college.edu',       'Computer Science', '+91 98765 00002', 3, 2, 15],
    ['Dr. Rohan Mehta',        'rohan.mehta@college.edu',         'Mathematics',      '+91 98765 00003', 2, 2,  9],
    ['Prof. Priya Nair',       'priya.nair@college.edu',          'Electronics',      '+91 98765 00004', 3, 3, 15],
    ['Dr. Aditya Bose',        'aditya.bose@college.edu',         'Computer Science', '+91 98765 00005', 2, 2, 10],
    ['Ms. Sneha Pillai',       'sneha.pillai@college.edu',        'Languages',        '+91 98765 00006', 5, 4, 22],
  ];

  const wsFaculty = XLSX.utils.aoa_to_sheet(facultyRows);
  wsFaculty['!cols'] = [26, 34, 20, 18, 20, 22, 16].map(w => ({ wch: w }));
  wsFaculty['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, wsFaculty, 'Faculty');

  /* ── ROOMS SHEET ──────────────────────────────────────────────────────────── */
  const roomRows: Row[] = [
    ['Room Name', 'Capacity', 'Type', 'Building', 'Floor', 'Equipment', 'Unavailable Windows'],
    ['Room 101',          40,  'classroom',    'Main Block', '1', 'Projector, Whiteboard',                  '(none)'                ],
    ['Room 102',          40,  'classroom',    'Main Block', '1', 'Projector, Whiteboard',                  'Wednesday 14:00-17:00' ],
    ['Room 103',          35,  'seminar',      'Main Block', '1', 'Projector, Smart Board',                 '(none)'                ],
    ['Computer Lab 201',  25,  'lab',          'Tech Block', '2', 'Computers x25, AC, Projector',           'Friday 09:00-13:00'    ],
    ['Computer Lab 202',  25,  'lab',          'Tech Block', '2', 'Computers x25, AC, Smart Board',         '(none)'                ],
    ['Lecture Hall A',   120,  'lecture-hall', 'Main Block', 'G', 'Projector, PA System, Recording Studio', '(none)'                ],
  ];

  const wsRooms = XLSX.utils.aoa_to_sheet(roomRows);
  wsRooms['!cols'] = [26, 12, 16, 16, 10, 38, 30].map(w => ({ wch: w }));
  wsRooms['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, wsRooms, 'Rooms');

  /* ── CLASSES SHEET ──────────────────────────────────────────────────────── */
  // "Code" becomes the Group ID used in the Timetable sheet's "Group" column.
  const classRows: Row[] = [
    ['Name',                     'Code',        'Size', 'Course',                    'Semester'],
    ['CS Division A 2024',       'CS-A-2024',    60,    'B.Tech Computer Science',   5],
    ['CS Division B 2024',       'CS-B-2024',    60,    'B.Tech Computer Science',   5],
    ['IT Division A 2024',       'IT-A-2024',    55,    'B.Tech Information Tech.',  5],
    ['Mech Division A 2024',     'ME-A-2024',    50,    'B.Tech Mechanical',         5],
    ['Electronics Division 2024','EC-A-2024',    55,    'B.Tech Electronics',        5],
  ];

  const wsClasses = XLSX.utils.aoa_to_sheet(classRows);
  wsClasses['!cols'] = [30, 16, 10, 30, 12].map(w => ({ wch: w }));
  wsClasses['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, wsClasses, 'Classes');

  /* ── TIMETABLE SHEET ──────────────────────────────────────────────────────── */
  // "Group" must match one of the "Code" values in the Classes sheet.
  const ttRows: Row[] = [
    ['Day', 'Start', 'End', 'Subject', 'Faculty Name', 'Room', 'Session Type', 'Group', 'Notes'],
    ['Monday',    '09:00', '10:00', 'Data Structures',    'Dr. Jash Parekh',      'Room 101',         'lecture',   'CS-A-2024', ''],
    ['Monday',    '10:00', '11:00', 'Algorithms',         'Dr. Jash Parekh',      'Room 101',         'lecture',   'CS-A-2024', ''],
    ['Monday',    '11:00', '13:00', 'Database Practical', 'Dr. Jash Parekh',      'Computer Lab 201', 'practical', 'CS-A-2024', ''],
    ['Tuesday',   '09:00', '10:00', 'Operating Systems',  'Prof. Anjali Sharma',  'Room 102',         'lecture',   'CS-A-2024', ''],
    ['Tuesday',   '10:00', '11:00', 'Computer Networks',  'Prof. Anjali Sharma',  'Room 102',         'lecture',   'CS-A-2024', ''],
    ['Wednesday', '09:00', '10:00', 'Discrete Math',      'Dr. Rohan Mehta',      'Room 103',         'lecture',   'CS-A-2024', ''],
    ['Wednesday', '10:00', '11:00', 'Algorithms Tutorial','Dr. Jash Parekh',      'Room 101',         'tutorial',  'CS-A-2024', ''],
    ['Thursday',  '14:00', '15:00', 'Machine Learning',   'Dr. Aditya Bose',      'Room 103',         'lecture',   'CS-A-2024', ''],
    ['Thursday',  '15:00', '16:00', 'AI Fundamentals',    'Dr. Aditya Bose',      'Room 103',         'lecture',   'CS-A-2024', ''],
    ['Friday',    '10:00', '11:00', 'Technical Writing',  'Ms. Sneha Pillai',     'Room 101',         'lecture',   'CS-A-2024', ''],
    ['Friday',    '11:00', '12:00', 'Statistics',         'Prof. Priya Nair',     'Room 102',         'lecture',   'CS-A-2024', ''],
    ['Friday',    '14:00', '16:00', 'Database Lab',       'Dr. Jash Parekh',      'Computer Lab 201', 'practical', 'CS-A-2024', ''],
    // Second group sample row
    ['Monday',    '09:00', '10:00', 'Data Structures',    'Prof. Anjali Sharma',  'Room 102',         'lecture',   'CS-B-2024', ''],
    ['Tuesday',   '09:00', '10:00', 'Algorithms',         'Prof. Anjali Sharma',  'Room 102',         'lecture',   'CS-B-2024', ''],
  ];

  const wsTT = XLSX.utils.aoa_to_sheet(ttRows);
  wsTT['!cols'] = [16, 10, 10, 26, 26, 22, 16, 16, 20].map(w => ({ wch: w }));
  wsTT['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, wsTT, 'Timetable');

  XLSX.writeFile(wb, 'ChronoLink-Import-Template.xlsx');
}
