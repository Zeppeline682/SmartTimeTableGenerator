import * as XLSX from 'xlsx';
import { getWorkspaceData } from '../hooks/useWorkspaceStore';

/**
 * Exports the current timetable to an Excel file with separate sheets
 * for Faculty, Rooms, and Timetable.
 */
export function exportTimetableAsXlsx() {
  const wb = XLSX.utils.book_new();
  const { teachers, rooms, slots } = getWorkspaceData();

  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  type Row = (string | number)[];

  /* ── FACULTY SHEET ──────────────────────────────────────────────────────── */
  const facultyRows: Row[] = [
    ['Faculty Name', 'Email', 'Department', 'Phone', 'Max Classes / Day', 'Max Consecutive Hours', 'Weekly Hours'],
    ...teachers.map(f => [
      f.name,
      f.email,
      f.department,
      f.phone ?? '',
      f.preferences?.maxClassesPerDay    ?? '',
      f.preferences?.maxConsecutiveHours ?? '',
      f.totalWeeklyHours ?? '',
    ]),
  ];

  const wsFaculty = XLSX.utils.aoa_to_sheet(facultyRows);
  wsFaculty['!cols'] = [26, 34, 20, 16, 20, 22, 16].map(w => ({ wch: w }));
  wsFaculty['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, wsFaculty, 'Faculty');

  /* ── ROOMS SHEET ────────────────────────────────────────────────────────── */
  const roomRows: Row[] = [
    ['Room Name', 'Capacity', 'Type', 'Building', 'Floor', 'Equipment', 'Unavailable Windows'],
    ...rooms.map(r => [
      r.name,
      r.capacity,
      r.type,
      r.building ?? '',
      r.floor    ?? '',
      r.equipment.join(', '),
      '',
    ]),
  ];

  const wsRooms = XLSX.utils.aoa_to_sheet(roomRows);
  wsRooms['!cols'] = [26, 12, 16, 16, 10, 38, 30].map(w => ({ wch: w }));
  wsRooms['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, wsRooms, 'Rooms');

  /* ── TIMETABLE SHEET ────────────────────────────────────────────────────── */
  const ttRows: Row[] = [
    ['Day', 'Start', 'End', 'Subject', 'Faculty Name', 'Room', 'Session Type', 'Group', 'Notes'],
    ...slots.map(s => [
      s.day,
      s.startTime,
      s.endTime,
      s.subject  ?? '',
      s.faculty  ?? '',
      s.room     ?? '',
      s.type     ?? '',
      s.groupId  ?? '',
      '',
    ]),
  ];

  const wsTT = XLSX.utils.aoa_to_sheet(ttRows);
  wsTT['!cols'] = [16, 10, 10, 26, 26, 22, 16, 16, 20].map(w => ({ wch: w }));
  wsTT['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, wsTT, 'Timetable');

  const fileStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `ChronoLink-Timetable-${fileStamp}.xlsx`);
}

/**
 * Exports a full configuration snapshot as JSON.
 * The v2 schema includes faculty, rooms, and timetable arrays.
 */
export function exportTimetableAsJson() {
  const { teachers, rooms, slots } = getWorkspaceData();
  const payload = {
    exported:    new Date().toISOString(),
    version:     '2.0',
    faculty: teachers.map(f => ({
      name:             f.name,
      email:            f.email,
      department:       f.department,
      phone:            f.phone,
      maxClassesPerDay: f.preferences?.maxClassesPerDay,
      maxConsecutive:   f.preferences?.maxConsecutiveHours,
      weeklyHours:      f.totalWeeklyHours,
    })),
    rooms: rooms.map(r => ({
      name:               r.name,
      capacity:           r.capacity,
      type:               r.type,
      building:           r.building,
      floor:              r.floor,
      equipment:          r.equipment,
      unavailableWindows: '',
    })),
    timetable: slots.map(s => ({
      day:         s.day,
      start:       s.startTime,
      end:         s.endTime,
      subject:     s.subject,
      facultyName: s.faculty,
      room:        s.room,
      sessionType: s.type,
      group:       s.groupId ?? '',
    })),
  };

  const fileName = `ChronoLink-Config-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  // Delay cleanup slightly so Chromium-based browsers finalize the download name.
  window.setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 800);
}
