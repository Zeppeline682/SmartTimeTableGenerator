import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, X, FileSpreadsheet, FileJson, ChevronRight,
  CheckCircle2, AlertTriangle, XCircle, ArrowLeft,
  Info, Sparkles, Users, Calendar, DoorOpen,
  Link2, UserX, Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

/* ─────────────────────────────── Types ────────────────────────────────── */

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
}

interface ParsedFile {
  fileName: string;
  fileSize: string;
  fileType: 'xlsx' | 'json';
  sheets: ParsedSheet[];
  isSingleSheet: boolean;
}

interface SchemaResult {
  sheet: string;
  status: 'ok' | 'warn' | 'error';
  found: string[];
  missing: string[];
  extra: string[];
}

interface UnavailWindow { day: string; from: string; to: string }

interface CrossValidation {
  hasAllThree:           boolean;
  facultyRefs:           { found: string[]; missing: string[] };
  roomRefs:              { found: string[]; missing: string[] };
  unavailConflicts: {
    row:     number;
    session: string;
    faculty: string;
    room:    string;
    day:     string;
    time:    string;
    window:  string;
  }[];
}

/* ───────────────────────────── Constants ───────────────────────────────── */

/** Map from the uppercase cell value in col-A to the canonical section name */
const SECTION_NAME_MAP: Record<string, string> = {
  FACULTY:   'Faculty',
  ROOMS:     'Rooms',
  TIMETABLE: 'Timetable',
};

const SCHEMA: Record<string, { required: string[]; optional: string[] }> = {
  Faculty: {
    required: ['Faculty Name', 'Email', 'Department'],
    optional: ['Phone', 'Max Classes / Day', 'Max Consecutive Hours', 'Weekly Hours'],
  },
  Rooms: {
    required: ['Room Name', 'Capacity', 'Type'],
    optional: ['Building', 'Floor', 'Equipment', 'Unavailable Windows'],
  },
  Timetable: {
    required: ['Day', 'Start', 'End', 'Subject', 'Faculty Name', 'Room'],
    optional: ['Session Type', 'Group', 'Notes'],
  },
  /* legacy multi-sheet backward-compat */
  Subjects:  { required: ['SubjectCode', 'SubjectName', 'Department'], optional: [] },
  TimeSlots: { required: ['Day', 'StartTime', 'EndTime', 'SubjectCode', 'FacultyID', 'RoomID'], optional: [] },
  /* new multi-sheet template — Classes sheet */
  Classes: { required: ['Name'], optional: ['Code', 'Size', 'Course', 'Semester'] },
};

type SectionMeta = {
  bg: string; text: string; border: string;
  icon: LucideIcon;
};

const SECTION_META: Record<string, SectionMeta> = {
  Faculty:   { bg: 'rgba(139,92,246,0.08)',  text: '#8b5cf6', border: 'rgba(139,92,246,0.25)', icon: Users      },
  Rooms:     { bg: 'rgba(16,185,129,0.08)',  text: '#10b981', border: 'rgba(16,185,129,0.25)', icon: DoorOpen   },
  Timetable: { bg: 'rgba(59,130,246,0.08)',  text: '#3b82f6', border: 'rgba(59,130,246,0.25)', icon: Calendar   },
  Subjects:  { bg: 'rgba(59,130,246,0.08)',  text: '#3b82f6', border: 'rgba(59,130,246,0.25)', icon: Calendar   },
  TimeSlots: { bg: 'rgba(239,68,68,0.08)',   text: '#ef4444', border: 'rgba(239,68,68,0.2)',   icon: Calendar   },
  Groups:    { bg: 'rgba(245,158,11,0.08)',  text: '#f59e0b', border: 'rgba(245,158,11,0.2)',   icon: Calendar   },
  Classes:   { bg: 'rgba(245,158,11,0.08)',  text: '#f59e0b', border: 'rgba(245,158,11,0.2)',   icon: Calendar   },
};

function fallbackMeta(): SectionMeta {
  return { bg: 'rgba(100,100,100,0.08)', text: 'var(--muted-foreground)', border: 'rgba(100,100,100,0.2)', icon: Calendar };
}

/* ──────────────────── Two/three-section parser ─────────────────────────── */

/**
 * Scans a flat 2-D raw sheet for the marker strings FACULTY / ROOMS / TIMETABLE
 * in column A and splits into ParsedSheet objects.
 * Row after marker = headers. Row after headers = hints → skipped.
 * Remaining rows until next marker = data.
 */
function parseSections(raw: string[][]): ParsedSheet[] {
  type Marker = { label: string; row: number };
  const markers: Marker[] = [];

  raw.forEach((row, i) => {
    const cell = String(row[0] ?? '')
      .trim()
      .replace(/^=+\s*/, '').replace(/\s*=+$/, '')
      .toUpperCase();
    if (SECTION_NAME_MAP[cell]) {
      markers.push({ label: SECTION_NAME_MAP[cell], row: i });
    }
  });

  return markers.map((m, mi) => {
    const headerRow = m.row + 1;
    const dataStart = m.row + 3; // +1 header, +1 hints, +1 start
    const dataEnd   = mi < markers.length - 1 ? markers[mi + 1].row : raw.length;

    const headers = (raw[headerRow] ?? [])
      .map(s => String(s ?? '').trim())
      .filter(Boolean);

    const rows = raw
      .slice(dataStart, dataEnd)
      .filter(r => r.some(c => String(c ?? '').trim() !== ''))
      .map(r => headers.map((_, ci) => String(r[ci] ?? '')));

    return { name: m.label, headers, rows, rowCount: rows.length };
  });
}

/* ────────────────────── Schema validator ───────────────────────────────── */

function validateSchema(sheets: ParsedSheet[]): SchemaResult[] {
  return sheets.map(s => {
    const schema = SCHEMA[s.name];
    if (!schema) {
      return { sheet: s.name, status: 'warn', found: s.headers, missing: [], extra: s.headers };
    }
    const hSet   = new Set(s.headers.map(h => h.trim()));
    const missing = schema.required.filter(r => !hSet.has(r));
    const extra   = s.headers.filter(h => !schema.required.includes(h) && !schema.optional.includes(h));
    const found   = [
      ...schema.required.filter(r => hSet.has(r)),
      ...schema.optional.filter(o => hSet.has(o)),
    ];
    const status: SchemaResult['status'] =
      missing.length > 0 ? 'error' : extra.length > 0 ? 'warn' : 'ok';
    return { sheet: s.name, status, found, missing, extra };
  });
}

/* ─────────────────── Cross-section validator ───────────────────────────── */

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function parseWindows(raw: string): UnavailWindow[] {
  const s = (raw ?? '').trim();
  if (!s || s === '(none)' || s === '-' || s.toLowerCase() === 'none') return [];
  return s.split(',').flatMap(part => {
    const m = part.trim().match(/^(\w+)\s+(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})$/);
    if (!m) return [];
    return [{ day: normDay(m[1]), from: m[2], to: m[3] }];
  });
}

const DAY_MAP: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function normDay(d: string): string {
  return DAY_MAP[d.toLowerCase()] ?? d;
}

function colIdx(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.toLowerCase() === c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function crossValidate(sheets: ParsedSheet[]): CrossValidation {
  const fac = sheets.find(s => s.name === 'Faculty');
  const rms = sheets.find(s => s.name === 'Rooms');
  const tt  = sheets.find(s => s.name === 'Timetable');

  const empty: CrossValidation = {
    hasAllThree: !!(fac && rms && tt),
    facultyRefs: { found: [], missing: [] },
    roomRefs:    { found: [], missing: [] },
    unavailConflicts: [],
  };

  if (!tt) return empty;

  const th = tt.headers;
  const dayCol  = colIdx(th, 'day');
  const startCol = colIdx(th, 'start');
  const endCol   = colIdx(th, 'end');
  const subCol   = colIdx(th, 'subject');
  const facCol   = colIdx(th, 'faculty name', 'faculty');
  const roomCol  = colIdx(th, 'room');

  /* ── Faculty references ─────────────────────────────── */
  if (fac) {
    const fh       = fac.headers;
    const nameIdx  = colIdx(fh, 'faculty name');
    const declared = new Set(
      fac.rows.map(r => String(r[nameIdx >= 0 ? nameIdx : 0] ?? '').trim()).filter(Boolean)
    );
    const seen = new Set<string>();
    tt.rows.forEach(row => {
      const name = facCol >= 0 ? String(row[facCol] ?? '').trim() : '';
      if (!name || seen.has(name)) return;
      seen.add(name);
      (declared.has(name) ? empty.facultyRefs.found : empty.facultyRefs.missing).push(name);
    });
  }

  /* ── Room references + unavailability ──────────────── */
  if (rms) {
    const rh        = rms.headers;
    const rNameIdx  = colIdx(rh, 'room name');
    const rUnavIdx  = colIdx(rh, 'unavailable windows');

    /* build room map: name → windows */
    const roomMap = new Map<string, UnavailWindow[]>();
    rms.rows.forEach(r => {
      const name = String(r[rNameIdx >= 0 ? rNameIdx : 0] ?? '').trim();
      if (!name) return;
      const windows = rUnavIdx >= 0 ? parseWindows(String(r[rUnavIdx] ?? '')) : [];
      roomMap.set(name, windows);
    });

    const seen = new Set<string>();
    tt.rows.forEach((row, ri) => {
      const roomName = roomCol >= 0 ? String(row[roomCol] ?? '').trim() : '';
      if (!roomName) return;

      /* reference check */
      if (!seen.has(roomName)) {
        seen.add(roomName);
        (roomMap.has(roomName) ? empty.roomRefs.found : empty.roomRefs.missing).push(roomName);
      }

      /* unavailability overlap check */
      if (roomMap.has(roomName)) {
        const windows = roomMap.get(roomName)!;
        const day    = dayCol   >= 0 ? normDay(String(row[dayCol]   ?? '')) : '';
        const start  = startCol >= 0 ? String(row[startCol] ?? '').trim() : '';
        const end    = endCol   >= 0 ? String(row[endCol]   ?? '').trim() : '';
        const subject = subCol  >= 0 ? String(row[subCol]   ?? '').trim() : `Row ${ri + 1}`;
        const faculty = facCol  >= 0 ? String(row[facCol]   ?? '').trim() : '';

        windows.forEach(w => {
          if (normDay(w.day) !== day) return;
          /* overlap: session [start,end) overlaps window [w.from,w.to) */
          if (toMins(start) < toMins(w.to) && toMins(end) > toMins(w.from)) {
            empty.unavailConflicts.push({
              row: ri + 1,
              session: subject,
              faculty,
              room: roomName,
              day,
              time: `${start}–${end}`,
              window: `${w.from}–${w.to}`,
            });
          }
        });
      }
    });
  }

  return empty;
}

/* ─────────────────────────── Helpers ──────────────────────────────────── */

function fmtSize(b: number) {
  if (b < 1024)        return `${b} B`;
  if (b < 1048576)     return `${(b / 1024).toFixed(1)} KB`;
  return                      `${(b / 1048576).toFixed(1)} MB`;
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="rounded-full transition-all"
          style={{ width: i === current ? 20 : 6, height: 6,
            background: i <= current ? '#3b82f6' : 'var(--surface-border)' }} />
      ))}
    </div>
  );
}

/* ─────────────────────── Cross-validation summary ─────────────────────── */

function CrossSummary({ cv }: { cv: CrossValidation }) {
  if (!cv.hasAllThree) return null;

  const checks = [
    {
      icon: Users,
      label: 'Faculty references',
      ok:    cv.facultyRefs.missing.length === 0,
      found: cv.facultyRefs.found.length,
      issues: cv.facultyRefs.missing,
      issueLabel: (n: string) => `"${n}" not in FACULTY`,
      color: '#8b5cf6',
    },
    {
      icon: DoorOpen,
      label: 'Room references',
      ok:    cv.roomRefs.missing.length === 0,
      found: cv.roomRefs.found.length,
      issues: cv.roomRefs.missing,
      issueLabel: (n: string) => `"${n}" not in ROOMS`,
      color: '#10b981',
    },
    {
      icon: Clock,
      label: 'Room availability',
      ok:    cv.unavailConflicts.length === 0,
      found: 0,
      issues: cv.unavailConflicts.map(c => c.session),
      issueLabel: (_: string, i: number) => {
        const c = cv.unavailConflicts[i];
        return `${c.session} (${c.day} ${c.time}) — ${c.room} blocked ${c.window}`;
      },
      color: '#ef4444',
    },
  ];

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Cross-section checks</span>
      </div>
      <div className="divide-y divide-border">
        {checks.map(ch => {
          const Icon = ch.icon;
          return (
            <div key={ch.label} className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: ch.color }} />
                <span className="text-xs font-medium flex-1">{ch.label}</span>
                {ch.ok
                  ? <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" /> OK
                      {ch.found > 0 && ` · ${ch.found} matched`}
                    </span>
                  : <span className="flex items-center gap-1 text-[11px]" style={{ color: ch.label === 'Room availability' ? '#ef4444' : '#f59e0b' }}>
                      {ch.label === 'Room availability'
                        ? <XCircle       className="w-3 h-3" />
                        : <AlertTriangle className="w-3 h-3" />}
                      {ch.issues.length} issue{ch.issues.length !== 1 ? 's' : ''}
                    </span>}
              </div>
              {!ch.ok && (
                <ul className="mt-2 space-y-1 pl-5">
                  {ch.issues.slice(0, 5).map((iss, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full shrink-0 mt-1.5"
                        style={{ background: ch.label === 'Room availability' ? '#ef4444' : '#f59e0b' }} />
                      {ch.issueLabel(iss, i)}
                    </li>
                  ))}
                  {ch.issues.length > 5 && (
                    <li className="text-[11px] text-muted-foreground pl-2.5">
                      + {ch.issues.length - 5} more…
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────── Step 3 conflict table ───────────────────────── */

function ConflictTable({ cv }: { cv: CrossValidation }) {
  const conflicts = cv.unavailConflicts;
  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-md border overflow-hidden"
      style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
      <div className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
        <XCircle className="w-4 h-4 text-[#ef4444]" />
        <span className="text-sm font-medium text-[#ef4444]">
          {conflicts.length} room availability conflict{conflicts.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'rgba(239,68,68,0.12)', background: 'rgba(239,68,68,0.06)' }}>
              {['Row', 'Session', 'Faculty', 'Room', 'Scheduled', 'Room blocked'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'rgba(239,68,68,0.1)' }}>
                <td className="px-3 py-2 text-muted-foreground">{c.row}</td>
                <td className="px-3 py-2 font-medium max-w-[140px] truncate">{c.session}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{c.faculty}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.room}</td>
                <td className="px-3 py-2">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
                    {c.day} {c.time}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
                    {c.window}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-muted-foreground border-t"
        style={{ borderColor: 'rgba(239,68,68,0.12)' }}>
        These sessions are scheduled when the room is marked unavailable.
        You can still import and fix them in ChronoLink, or correct the sheet first.
      </p>
    </div>
  );
}

/* ──────────────────────────── Props ────────────────────────────────────── */

interface ImportWizardProps { open: boolean; onClose: () => void }
const PREVIEW_ROWS  = 6;
const STEP_LABELS   = ['Upload', 'Preview', 'Confirm'];

/* ──────────────────────────── Component ───────────────────────────────── */

export function ImportWizard({ open, onClose }: ImportWizardProps) {
  const [step,      setStep]      = useState(0);
  const [dragging,  setDragging]  = useState(false);
  const [parsed,    setParsed]    = useState<ParsedFile | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── parsers ────────────────────────────────────────── */

  /** Recognized sheet names — any of these present = multi-sheet mode */
  const MULTI_SHEET_NAMES = new Set(['faculty', 'rooms', 'classes', 'groups', 'timetable', 'timeslots', 'subjects']);

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array' });

        const dataSheets = wb.SheetNames.filter(n => MULTI_SHEET_NAMES.has(n.toLowerCase()));

        let sheets: ParsedSheet[];
        let isSingleSheet = false;

        if (dataSheets.length > 1) {
          /* ── Multi-sheet workbook (Faculty + Rooms + Classes + Timetable …) ── */
          sheets = dataSheets.map(name => {
            const raw = XLSX.utils.sheet_to_json<string[]>(
              wb.Sheets[name], { header: 1, defval: '' }
            ) as string[][];
            const headers = (raw[0] ?? []).map(String).filter(Boolean);
            // Skip a "hints" row if cell[0] starts with "e.g"
            const firstData = raw[1] && String((raw[1] as string[])[0]).toLowerCase().startsWith('e.g') ? 2 : 1;
            const rows = (raw.slice(firstData) as string[][])
              .filter(r => r.some(c => String(c ?? '').trim() !== ''))
              .map(r => headers.map((_, ci) => String(r[ci] ?? '').trim()));
            // Normalize sheet name to canonical form for the importer
            const canonicalName =
              name.toLowerCase() === 'faculty'   ? 'Faculty'   :
              name.toLowerCase() === 'rooms'     ? 'Rooms'     :
              name.toLowerCase() === 'classes'   ? 'Classes'   :
              name.toLowerCase() === 'groups'    ? 'Classes'   :  // treat Groups as Classes
              name.toLowerCase() === 'timetable' ? 'Timetable' :
              name.toLowerCase() === 'subjects'  ? 'Subjects'  :
              name;
            return { name: canonicalName, headers, rows, rowCount: rows.length };
          });
        } else if (dataSheets.length === 1) {
          /* ── Single known sheet — check for embedded section markers ── */
          const sheetName = dataSheets[0];
          const raw = XLSX.utils.sheet_to_json<string[]>(
            wb.Sheets[sheetName], { header: 1, defval: '' }
          ) as string[][];
          const sections = parseSections(raw);
          if (sections.length > 0) {
            sheets = sections; isSingleSheet = true;
          } else {
            const headers = (raw[0] ?? []).map(String).filter(Boolean);
            const rows    = raw.slice(1).filter(r => r.some(c => String(c ?? '') !== ''));
            sheets = [{ name: sheetName, headers, rows, rowCount: rows.length }];
            isSingleSheet = true;
          }
        } else {
          /* ── No recognized sheets — try every sheet, look for section markers ── */
          const allSheets = wb.SheetNames.filter(n => n !== 'README');
          if (allSheets.length === 1) {
            const raw = XLSX.utils.sheet_to_json<string[]>(
              wb.Sheets[allSheets[0]], { header: 1, defval: '' }
            ) as string[][];
            const sections = parseSections(raw);
            sheets = sections.length > 0 ? sections : (() => {
              const headers = (raw[0] ?? []).map(String).filter(Boolean);
              const rows    = raw.slice(1).filter(r => r.some(c => String(c ?? '') !== ''));
              return [{ name: allSheets[0], headers, rows, rowCount: rows.length }];
            })();
            isSingleSheet = true;
          } else {
            sheets = allSheets.map(name => {
              const raw = XLSX.utils.sheet_to_json<string[]>(
                wb.Sheets[name], { header: 1, defval: '' }
              ) as string[][];
              const headers = (raw[0] ?? []).map(String).filter(Boolean);
              const rows = raw.slice(1).filter(r => r.some(c => String(c ?? '') !== ''));
              return { name, headers, rows, rowCount: rows.length };
            });
          }
        }

        setParsed({ fileName: file.name, fileSize: fmtSize(file.size), fileType: 'xlsx', sheets, isSingleSheet });
        setActiveTab(0); setStep(1);
      } catch (err) {
        console.error('[ImportWizard] parseExcel failed:', err);
        toast.error('Could not parse file', { description: 'Make sure it is a valid .xlsx workbook.' });
      }
    };
    reader.readAsArrayBuffer(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const parseJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const obj = JSON.parse(e.target!.result as string) as Record<string, unknown>;

        const asArray = (value: unknown): Record<string, unknown>[] =>
          Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

        const toCanonicalSheet = (
          name: string,
          arr: Record<string, unknown>[],
          columns: Array<{ header: string; keys: string[] }>,
        ): ParsedSheet => {
          const headers = columns.map((c) => c.header);
          const rows = arr.map((item) =>
            columns.map((column) => {
              for (const key of column.keys) {
                if (item[key] !== undefined && item[key] !== null) {
                  const value = item[key];
                  return Array.isArray(value) ? value.join(', ') : String(value);
                }
              }
              return '';
            }),
          );
          return { name, headers, rows, rowCount: rows.length };
        };

        /* Integration export JSON: { faculty, rooms, timetable } */
        if (Array.isArray(obj.faculty) || Array.isArray(obj.rooms) || Array.isArray(obj.timetable)) {
          const faculty = asArray(obj.faculty);
          const rooms = asArray(obj.rooms);
          const timetable = asArray(obj.timetable);

          const sheets: ParsedSheet[] = [];
          if (faculty.length > 0) {
            sheets.push(
              toCanonicalSheet('Faculty', faculty, [
                { header: 'Faculty Name', keys: ['name', 'facultyName'] },
                { header: 'Email', keys: ['email'] },
                { header: 'Department', keys: ['department'] },
                { header: 'Phone', keys: ['phone'] },
                { header: 'Max Classes / Day', keys: ['maxClassesPerDay'] },
                { header: 'Max Consecutive Hours', keys: ['maxConsecutive', 'maxConsecutiveHours'] },
                { header: 'Weekly Hours', keys: ['weeklyHours', 'totalWeeklyHours'] },
              ]),
            );
          }
          if (rooms.length > 0) {
            sheets.push(
              toCanonicalSheet('Rooms', rooms, [
                { header: 'Room Name', keys: ['name', 'roomName'] },
                { header: 'Capacity', keys: ['capacity'] },
                { header: 'Type', keys: ['type'] },
                { header: 'Building', keys: ['building'] },
                { header: 'Floor', keys: ['floor'] },
                { header: 'Equipment', keys: ['equipment'] },
                { header: 'Unavailable Windows', keys: ['unavailableWindows'] },
              ]),
            );
          }
          if (timetable.length > 0) {
            sheets.push(
              toCanonicalSheet('Timetable', timetable, [
                { header: 'Day', keys: ['day'] },
                { header: 'Start', keys: ['start', 'startTime'] },
                { header: 'End', keys: ['end', 'endTime'] },
                { header: 'Subject', keys: ['subject'] },
                { header: 'Faculty Name', keys: ['facultyName', 'faculty'] },
                { header: 'Room', keys: ['room', 'roomName'] },
                { header: 'Session Type', keys: ['sessionType', 'type'] },
                { header: 'Group', keys: ['group', 'groupId'] },
                { header: 'Notes', keys: ['notes'] },
              ]),
            );
          }

          if (sheets.length > 0) {
            setParsed({ fileName: file.name, fileSize: fmtSize(file.size), fileType: 'json', sheets, isSingleSheet: true });
            setActiveTab(0); setStep(1);
            return;
          }
        }

        /* Workspace snapshot JSON: { teachers, rooms, groups, slots, ... } */
        if (Array.isArray(obj.teachers) || Array.isArray(obj.groups) || Array.isArray(obj.slots)) {
          const teachers = asArray(obj.teachers);
          const rooms = asArray(obj.rooms);
          const groups = asArray(obj.groups);
          const slots = asArray(obj.slots);

          const sheets: ParsedSheet[] = [];
          if (teachers.length > 0) {
            sheets.push(
              toCanonicalSheet('Faculty', teachers, [
                { header: 'Faculty Name', keys: ['name'] },
                { header: 'Email', keys: ['email'] },
                { header: 'Department', keys: ['department'] },
                { header: 'Phone', keys: ['phone'] },
                { header: 'Max Classes / Day', keys: ['maxClassesPerDay'] },
                { header: 'Max Consecutive Hours', keys: ['maxConsecutiveHours'] },
                { header: 'Weekly Hours', keys: ['totalWeeklyHours'] },
              ]),
            );
          }
          if (rooms.length > 0) {
            sheets.push(
              toCanonicalSheet('Rooms', rooms, [
                { header: 'Room Name', keys: ['name'] },
                { header: 'Capacity', keys: ['capacity'] },
                { header: 'Type', keys: ['type'] },
                { header: 'Building', keys: ['building', 'building_tag'] },
                { header: 'Floor', keys: ['floor'] },
                { header: 'Equipment', keys: ['equipment'] },
                { header: 'Unavailable Windows', keys: ['unavailableWindows'] },
              ]),
            );
          }
          if (groups.length > 0) {
            sheets.push(
              toCanonicalSheet('Classes', groups, [
                { header: 'Name', keys: ['name'] },
                { header: 'Code', keys: ['code'] },
                { header: 'Size', keys: ['studentsCount', 'size'] },
                { header: 'Course', keys: ['course'] },
                { header: 'Semester', keys: ['semester'] },
              ]),
            );
          }
          if (slots.length > 0) {
            sheets.push(
              toCanonicalSheet('Timetable', slots, [
                { header: 'Day', keys: ['day'] },
                { header: 'Start', keys: ['start', 'startTime'] },
                { header: 'End', keys: ['end', 'endTime'] },
                { header: 'Subject', keys: ['subject'] },
                { header: 'Faculty Name', keys: ['facultyName', 'faculty'] },
                { header: 'Room', keys: ['room', 'roomName'] },
                { header: 'Session Type', keys: ['sessionType', 'type'] },
                { header: 'Group', keys: ['group', 'groupId'] },
                { header: 'Notes', keys: ['notes'] },
              ]),
            );
          }

          if (sheets.length > 0) {
            setParsed({ fileName: file.name, fileSize: fmtSize(file.size), fileType: 'json', sheets, isSingleSheet: false });
            setActiveTab(0); setStep(1);
            return;
          }
        }

        /* legacy flat JSON keys fallback */
        const legacyKeys = ['timeSlots', 'faculty', 'groups', 'rooms'];
        const sheets: ParsedSheet[] = legacyKeys
          .filter(k => Array.isArray(obj[k]) && (obj[k] as unknown[]).length > 0)
          .map(k => {
            const arr = obj[k] as Record<string, unknown>[];
            const headers = Object.keys(arr[0] ?? {});
            return {
              name:     k.charAt(0).toUpperCase() + k.slice(1),
              headers,
              rows:     arr.map(item => headers.map(h => String(item[h] ?? ''))),
              rowCount: arr.length,
            };
          });
        if (sheets.length === 0) {
          toast.error('Invalid JSON', { description: 'File does not match ChronoLink schema.' });
          return;
        }
        setParsed({ fileName: file.name, fileSize: fmtSize(file.size), fileType: 'json', sheets, isSingleSheet: false });
        setActiveTab(0); setStep(1);
      } catch {
        toast.error('Invalid JSON', { description: 'File does not match ChronoLink schema.' });
      }
    };
    reader.readAsText(file);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (file.name.endsWith('.json'))                                     parseJson(file);
    else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) parseExcel(file);
    else toast.error('Unsupported file type', { description: 'Upload .xlsx, .xls, or .json.' });
  }, [parseExcel, parseJson]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  /* ── confirm ──────────────────────────────────────── */

  const handleImport = () => {
    if (!parsed) return;
    setImporting(true);

    try {
      const STORAGE_KEY = 'realtime-timetable.workspace.v2';
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const workspace = raw ? JSON.parse(raw) as Record<string, unknown> : {};

      /* ── Parse Faculty sheet ── */
      const facSheet = parsed.sheets.find(s => s.name === 'Faculty');
      if (facSheet) {
        const h = facSheet.headers;
        const nameIdx = h.findIndex(c => c.toLowerCase() === 'faculty name');
        const emailIdx = h.findIndex(c => c.toLowerCase() === 'email');
        const deptIdx = h.findIndex(c => c.toLowerCase() === 'department');
        const phoneIdx = h.findIndex(c => c.toLowerCase() === 'phone');
        const maxDayIdx = h.findIndex(c => c.toLowerCase().includes('max classes'));
        const maxConIdx = h.findIndex(c => c.toLowerCase().includes('max consecutive'));
        const wkHrsIdx = h.findIndex(c => c.toLowerCase().includes('weekly'));

        // Always replace teacher list from file (don't try to merge/dedup)
        const importedTeachers = facSheet.rows
          .filter(r => r[nameIdx >= 0 ? nameIdx : 0]?.trim())
          .map((r, i) => ({
            id: crypto.randomUUID ? crypto.randomUUID() : `f-import-${i}`,
            name: nameIdx >= 0 ? r[nameIdx].trim() : r[0].trim(),
            email: emailIdx >= 0 ? r[emailIdx].trim() : '',
            department: deptIdx >= 0 ? r[deptIdx].trim() : 'General',
            phone: phoneIdx >= 0 ? r[phoneIdx].trim() : '',
            subjects: [],
            tags: [],
            isAbsent: false,
            totalWeeklyHours: wkHrsIdx >= 0 ? Number(r[wkHrsIdx]) || 0 : 0,
            workloadIntensity: 'medium' as const,
            preferences: {
              availability: {},
              maxClassesPerDay: maxDayIdx >= 0 ? Number(r[maxDayIdx]) || 4 : 4,
              maxConsecutiveHours: maxConIdx >= 0 ? Number(r[maxConIdx]) || 3 : 3,
            },
          }));

        workspace.teachers = importedTeachers;
      }

      /* ── Parse Rooms sheet ── */
      const roomSheet = parsed.sheets.find(s => s.name === 'Rooms');
      if (roomSheet) {
        const h = roomSheet.headers;
        const nameIdx = h.findIndex(c => c.toLowerCase() === 'room name');
        const capIdx = h.findIndex(c => c.toLowerCase() === 'capacity');
        const typeIdx = h.findIndex(c => c.toLowerCase() === 'type');
        const bldgIdx = h.findIndex(c => c.toLowerCase() === 'building');
        const floorIdx = h.findIndex(c => c.toLowerCase() === 'floor');
        const eqIdx = h.findIndex(c => c.toLowerCase() === 'equipment');

        // Always replace room list from file
        const importedRooms = roomSheet.rows
          .filter(r => r[nameIdx >= 0 ? nameIdx : 0]?.trim())
          .map((r, i) => {
            const name = nameIdx >= 0 ? r[nameIdx].trim() : r[0].trim();
            const rawType = typeIdx >= 0 ? r[typeIdx].trim().toLowerCase() : 'classroom';
            const validTypes = ['classroom', 'lab', 'seminar', 'lecture-hall'];
            const type = validTypes.includes(rawType) ? rawType : 'classroom';
            return {
              id: crypto.randomUUID ? crypto.randomUUID() : `r-import-${i}`,
              roomId: name.replace(/\s+/g, '-').toUpperCase().slice(0, 12),
              name,
              capacity: capIdx >= 0 ? Number(r[capIdx]) || 30 : 30,
              type,
              building: bldgIdx >= 0 ? r[bldgIdx].trim() : undefined,
              floor: floorIdx >= 0 ? r[floorIdx].trim() : undefined,
              equipment: eqIdx >= 0 ? r[eqIdx].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
              isAvailable: true,
              sessionsToday: 0,
            };
          });

        workspace.rooms = importedRooms;
      }

      /* ── Parse Classes sheet ── */
      const classSheet = parsed.sheets.find(s => s.name === 'Classes' || s.name === 'Groups');
      if (classSheet) {
        const h = classSheet.headers;
        const nameIdx = h.findIndex(c => c.toLowerCase() === 'name');
        const codeIdx = h.findIndex(c => c.toLowerCase() === 'code');
        const sizeIdx = h.findIndex(c => c.toLowerCase() === 'size');
        const courseIdx = h.findIndex(c => c.toLowerCase() === 'course');
        const semIdx = h.findIndex(c => c.toLowerCase() === 'semester');

        // Always replace group list from file
        const importedGroups = classSheet.rows
          .filter(r => r[nameIdx >= 0 ? nameIdx : 0]?.trim())
          .map((r, i) => {
            const rawName = nameIdx >= 0 ? r[nameIdx].trim() : r[0].trim();
            const code = codeIdx >= 0 ? r[codeIdx].trim() : '';
            return {
              id: crypto.randomUUID ? crypto.randomUUID() : `g-import-${i}`,
              name: code || rawName,
              course: courseIdx >= 0 ? r[courseIdx].trim() : 'General',
              semester: semIdx >= 0 ? Number(r[semIdx]) || 1 : 1,
              studentsCount: sizeIdx >= 0 ? Number(r[sizeIdx]) || 30 : 30,
              isLive: false,
            };
          });

        workspace.groups = importedGroups;
      }

      /* ── Parse Timetable sheet into slots ── */
      const ttSheet = parsed.sheets.find(s => s.name === 'Timetable');
      if (ttSheet) {
        const h = ttSheet.headers;
        const dayIdx = h.findIndex(c => c.toLowerCase() === 'day');
        const startIdx = h.findIndex(c => c.toLowerCase() === 'start');
        const endIdx = h.findIndex(c => c.toLowerCase() === 'end');
        const subIdx = h.findIndex(c => c.toLowerCase() === 'subject');
        const facIdx = h.findIndex(c => c.toLowerCase() === 'faculty name' || c.toLowerCase() === 'faculty');
        const roomIdx = h.findIndex(c => c.toLowerCase() === 'room');
        const typeIdx = h.findIndex(c => c.toLowerCase() === 'session type' || c.toLowerCase() === 'type');
        const grpIdx = h.findIndex(c => c.toLowerCase() === 'group');

        /* Build group name → id map from newly merged groups */
        const groupList = Array.isArray(workspace.groups) ? workspace.groups as { id: string; name: string }[] : [];
        const groupByName = new Map(groupList.map(g => [g.name.toLowerCase(), g.id]));

        const existing = Array.isArray(workspace.slots) ? workspace.slots as { id: string }[] : [];

        const newSlots = ttSheet.rows
          .filter(r => r[dayIdx >= 0 ? dayIdx : 0]?.trim())
          .map((r, i) => {
            const grpRaw = grpIdx >= 0 ? r[grpIdx].trim() : '';
            const groupId = groupByName.get(grpRaw.toLowerCase()) ?? groupList[0]?.id ?? '';
            const rawType = typeIdx >= 0 ? r[typeIdx].trim().toLowerCase() : 'lecture';
            const type = ['lecture', 'practical', 'tutorial'].includes(rawType)
              ? (rawType as 'lecture' | 'practical' | 'tutorial')
              : 'lecture';
            return {
              id: crypto.randomUUID ? crypto.randomUUID() : `s-import-${i}`,
              day: dayIdx >= 0 ? r[dayIdx].trim() : 'Monday',
              startTime: startIdx >= 0 ? r[startIdx].trim() : '09:00',
              endTime: endIdx >= 0 ? r[endIdx].trim() : '10:00',
              subject: subIdx >= 0 ? r[subIdx].trim() : '',
              faculty: facIdx >= 0 ? r[facIdx].trim() : '',
              room: roomIdx >= 0 ? r[roomIdx].trim() : '',
              type,
              groupId,
            };
          });

        /* ── Filter out slots that overlap configured break windows ── */
        const wsBreaks = Array.isArray(workspace.breakWindows)
          ? (workspace.breakWindows as { enabled: boolean; startTime: string; durationMinutes: number }[])
          : [
              { enabled: true, startTime: '11:00', durationMinutes: 30 },
              { enabled: true, startTime: '13:00', durationMinutes: 60 },
            ];
        const breakRanges = wsBreaks
          .filter(b => b.enabled)
          .map(b => {
            const breakStart = toMins(b.startTime);
            const breakEnd = breakStart + (b.durationMinutes || 30);
            return { start: breakStart, end: breakEnd };
          });

        const filteredSlots = newSlots.filter(slot => {
          const slotStart = toMins(slot.startTime);
          const slotEnd = toMins(slot.endTime);
          // Reject if the slot overlaps ANY break range
          return !breakRanges.some(br => slotStart < br.end && slotEnd > br.start);
        });

        const droppedCount = newSlots.length - filteredSlots.length;

        /* Replace any existing imported slots, keep manually placed ones */
        workspace.slots = [...existing.filter((s: any) => !s.importedFromFile), ...filteredSlots.map(s => ({ ...s, importedFromFile: true }))];

        /* ── Auto-synthesize subjects from Timetable ── */
        const uniqueSubjectNames = Array.from(
          new Set(newSlots.map(s => s.subject).filter(Boolean))
        );
        const subjectMap = new Map<string, string>(); // name → id
        const importedSubjects = uniqueSubjectNames.map(name => {
          const id = crypto.randomUUID ? crypto.randomUUID() : `sub-${name.replace(/\s+/g, '-').toLowerCase()}`;
          subjectMap.set(name, id);
          return { id, name };
        });
        workspace.subjects = importedSubjects;

        /* ── Build teacher name → id map ── */
        const teacherList = Array.isArray(workspace.teachers) ? workspace.teachers as { id: string; name: string }[] : [];
        const teacherByName = new Map(teacherList.map(t => [t.name.toLowerCase(), t.id]));

        /* ── Build room name → id map ── */
        const roomList = Array.isArray(workspace.rooms) ? workspace.rooms as { id: string; name: string }[] : [];
        const roomByName = new Map(roomList.map(r => [r.name.toLowerCase(), r.id]));

        /* ── Auto-synthesize classConfigs from Timetable ── */
        // Group slots by groupId, then aggregate unique (subject, teacher, type) sessions.
        // IMPORTANT: Count SESSIONS (unique day×subject×teacher×type combos), not slots.
        // A practical that spans 2 slots on Tuesday = 1 practical session, not 2.
        // Also split rows: lecture row gets classroom roomId, practical row gets lab roomId.
        const slotsByGroup = new Map<string, typeof filteredSlots>();
        for (const slot of filteredSlots) {
          if (!slot.groupId) continue;
          const arr = slotsByGroup.get(slot.groupId) ?? [];
          arr.push(slot);
          slotsByGroup.set(slot.groupId, arr);
        }

        const importedClassConfigs: { groupId: string; rows: { id: string; subjectId: string; teacherId: string; roomId: string; lecturesPerWeek: number; practicalsPerWeek: number }[] }[] = [];
        const importedGroupFaculty: { groupId: string; teacherIds: string[] }[] = [];

        for (const [groupId, groupSlots] of slotsByGroup) {
          const rowKey = (sub: string, fac: string) => `${sub}|||${fac}`;

          // Track per-(subject,teacher): lecture sessions, practical sessions, and their respective rooms.
          // A "session" = a unique (day, type) occurrence for that (subject, teacher) combo.
          const rowMap = new Map<string, {
            subjectId: string;
            teacherId: string;
            lectureRoomId: string;
            practicalRoomId: string;
            // Sets of "day-index" to count unique session days, not slots
            lectureDays: Set<string>;
            practicalDays: Set<string>;
          }>();
          const groupTeacherIds = new Set<string>();

          for (const slot of groupSlots) {
            const subjectId = subjectMap.get(slot.subject) ?? '';
            const teacherId = teacherByName.get((slot.faculty ?? '').toLowerCase()) ?? '';
            const roomId = roomByName.get((slot.room ?? '').toLowerCase()) ?? '';
            if (!subjectId) continue;

            if (teacherId) groupTeacherIds.add(teacherId);

            const key = rowKey(subjectId, teacherId);
            if (!rowMap.has(key)) {
              rowMap.set(key, {
                subjectId,
                teacherId,
                lectureRoomId: '',
                practicalRoomId: '',
                lectureDays: new Set(),
                practicalDays: new Set(),
              });
            }
            const entry = rowMap.get(key)!;

            // Use "day + startTime" as the unique session key to avoid counting multi-slot sessions twice
            const sessionKey = `${slot.day}-${slot.startTime}`;

            if (slot.type === 'practical') {
              entry.practicalDays.add(sessionKey);
              // Always prefer a lab room for practicals
              if (roomId && (!entry.practicalRoomId)) {
                entry.practicalRoomId = roomId;
              }
            } else {
              entry.lectureDays.add(sessionKey);
              // Keep the first classroom room seen for lectures
              if (roomId && (!entry.lectureRoomId)) {
                entry.lectureRoomId = roomId;
              }
            }
          }

          const configRows: { id: string; subjectId: string; teacherId: string; roomId: string; lecturesPerWeek: number; practicalsPerWeek: number }[] = [];

          for (const entry of rowMap.values()) {
            const lectureCount = entry.lectureDays.size;
            const practicalCount = entry.practicalDays.size;

            if (lectureCount > 0 && practicalCount > 0) {
              // Split into two rows: one for lectures (classroom room), one for practicals (lab room)
              configRows.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `ccr-lec-${Date.now()}-${Math.random()}`,
                subjectId: entry.subjectId,
                teacherId: entry.teacherId,
                roomId: entry.lectureRoomId,
                lecturesPerWeek: lectureCount,
                practicalsPerWeek: 0,
              });
              configRows.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `ccr-prac-${Date.now()}-${Math.random()}`,
                subjectId: entry.subjectId,
                teacherId: entry.teacherId,
                roomId: entry.practicalRoomId,
                lecturesPerWeek: 0,
                practicalsPerWeek: practicalCount,
              });
            } else if (lectureCount > 0) {
              configRows.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `ccr-${Date.now()}-${Math.random()}`,
                subjectId: entry.subjectId,
                teacherId: entry.teacherId,
                roomId: entry.lectureRoomId,
                lecturesPerWeek: lectureCount,
                practicalsPerWeek: 0,
              });
            } else if (practicalCount > 0) {
              configRows.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `ccr-${Date.now()}-${Math.random()}`,
                subjectId: entry.subjectId,
                teacherId: entry.teacherId,
                roomId: entry.practicalRoomId,
                lecturesPerWeek: 0,
                practicalsPerWeek: practicalCount,
              });
            }
          }

          if (configRows.length > 0) {
            importedClassConfigs.push({ groupId, rows: configRows });
          }

          if (groupTeacherIds.size > 0) {
            importedGroupFaculty.push({ groupId, teacherIds: Array.from(groupTeacherIds) });
          }
        }

        workspace.classConfigs = importedClassConfigs;
        workspace.groupFaculty = importedGroupFaculty;


        /* ── Auto-adjust school window to fit imported data ── */
        if (filteredSlots.length > 0) {
          let earliestMin = Infinity;
          let latestMin = -Infinity;
          for (const slot of filteredSlots) {
            const s = toMins(slot.startTime);
            const e = toMins(slot.endTime);
            if (s < earliestMin) earliestMin = s;
            if (e > latestMin) latestMin = e;
          }
          // Round down to nearest hour for start, round up for end
          const startHour = Math.floor(earliestMin / 60);
          const endHour = Math.ceil(latestMin / 60);
          const newStart = `${String(startHour).padStart(2, '0')}:00`;
          const newEnd = `${String(Math.min(endHour, 23)).padStart(2, '0')}:00`;
          workspace.dayStartTime = newStart;
          workspace.schoolEndTime = newEnd;
        }
      }

      /* ── Auto-select first group (always reset after import) ── */
      if (Array.isArray(workspace.groups) && (workspace.groups as { id: string }[]).length > 0) {
        workspace.activeGroupId = (workspace.groups as { id: string }[])[0].id;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      // Dispatch a custom event so the TimetableWorkspace on the same tab can
      // immediately sync its React state without requiring a manual reload.
      window.dispatchEvent(new CustomEvent('chronolink:import', { detail: workspace }));

      const total = parsed.sheets.reduce((s, sh) => s + sh.rowCount, 0);
      const slotsArr = Array.isArray(workspace.slots) ? workspace.slots as unknown[] : [];
      toast.success('Import successful!', {
        description: `${total} records applied · ${slotsArr.length} sessions placed on grid.`,
        duration: 4000,
      });
      handleClose();
    } catch (err) {
      toast.error('Import failed', { description: String(err) });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => { setStep(0); setParsed(null); setActiveTab(0); onClose(); };

  /* ── derived ────────────────────────────────────── */

  const schemaResults = parsed ? validateSchema(parsed.sheets) : [];
  const cv            = parsed ? crossValidate(parsed.sheets) : null;
  const errorCount    = schemaResults.filter(v => v.status === 'error').length;
  const currentSheet  = parsed?.sheets[activeTab];
  const currentSchema = schemaResults.find(r => r.sheet === currentSheet?.name);

  /* ── render ─────────────────────────────────────── */

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-lg border border-border overflow-hidden bg-background"
          >
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <Upload className="w-4 h-4 text-[#8b5cf6]" />
                </div>
                <div>
                  <h2 className="font-semibold">Import Wizard</h2>
                  <p className="text-xs text-muted-foreground">
                    Step {step + 1} of {STEP_LABELS.length} — {STEP_LABELS[step]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <StepDots current={step} total={STEP_LABELS.length} />
                <button onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Body ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">

                {/* ══ STEP 0: Drop zone ══════════════════════════ */}
                {step === 0 && (
                  <motion.div key="s0"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}
                    className="p-6 space-y-5"
                  >
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.json"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

                    {/* drop zone */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                      onClick={() => fileRef.current?.click()}
                      className="cursor-pointer rounded-lg border-2 border-dashed transition-all p-12 flex flex-col items-center gap-5"
                      style={{
                        borderColor: dragging ? '#3b82f6' : 'var(--surface-border)',
                        background:  dragging ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.01)',
                      }}
                    >
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(139,92,246,0.12))', border: '1px solid rgba(139,92,246,0.2)' }}>
                        <Upload className="w-8 h-8 text-[#8b5cf6]" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">Drop your file here, or click to browse</p>
                        <p className="text-sm text-muted-foreground mt-1">Accepts Excel (.xlsx) and JSON (.json)</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {[
                          { icon: FileSpreadsheet, label: '.xlsx', color: '#10b981' },
                          { icon: FileJson,        label: '.json', color: '#3b82f6' },
                        ].map(({ icon: Icon, label, color }) => (
                          <div key={label}
                            className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-muted-foreground bg-card">
                            <Icon className="w-4 h-4" style={{ color }} />{label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* format explainer */}
                    <div className="rounded-md border border-border overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-card">
                        <Info className="w-4 h-4 text-[#3b82f6] shrink-0" />
                        <p className="text-xs font-medium">Expected format — separate sheets for each topic (or sections on one sheet)</p>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-border">
                        {[
                          { title: 'FACULTY', color: '#8b5cf6', icon: Users,
                            lines: ['One row per professor', 'Name · Email · Dept', 'Max classes & hours'] },
                          { title: 'ROOMS',   color: '#10b981', icon: DoorOpen,
                            lines: ['One row per room', 'Capacity · Type · Building', 'Unavailable windows'] },
                          { title: 'TIMETABLE', color: '#3b82f6', icon: Calendar,
                            lines: ['One row per session', 'Refs Faculty & Room by name', 'Add rows to extend'] },
                        ].map(col => {
                          const Icon = col.icon;
                          return (
                            <div key={col.title} className="p-4 space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Icon className="w-3.5 h-3.5" style={{ color: col.color }} />
                                <p className="text-xs font-medium" style={{ color: col.color }}>{col.title}</p>
                              </div>
                              <ul className="space-y-1">
                                {col.lines.map(l => (
                                  <li key={l} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="w-1 h-1 rounded-full shrink-0" style={{ background: col.color }} />{l}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ══ STEP 1: Preview ════════════════════════════ */}
                {step === 1 && parsed && (
                  <motion.div key="s1"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}
                    className="p-6 space-y-4"
                  >
                    {/* file info */}
                    <div className="flex items-center gap-3 p-4 rounded-md border border-border bg-card">
                      {parsed.fileType === 'json'
                        ? <FileJson        className="w-5 h-5 text-[#3b82f6] shrink-0" />
                        : <FileSpreadsheet className="w-5 h-5 text-[#10b981] shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{parsed.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {parsed.fileSize} · {parsed.sheets.length} section{parsed.sheets.length !== 1 ? 's' : ''} detected
                          {parsed.isSingleSheet ? ' (single-sheet format)' : ' (legacy format)'}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: parsed.isSingleSheet ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          color:      parsed.isSingleSheet ? '#10b981' : '#f59e0b',
                          border:     `1px solid ${parsed.isSingleSheet ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                        }}>
                        {parsed.isSingleSheet ? '✓ New format' : 'Legacy'}
                      </span>
                    </div>

                    {/* section tabs */}
                    <div className="flex gap-1.5 flex-wrap">
                      {parsed.sheets.map((s, i) => {
                        const meta = SECTION_META[s.name] ?? fallbackMeta();
                        const sv   = schemaResults.find(r => r.sheet === s.name);
                        const Icon = meta.icon;
                        return (
                          <button key={s.name} onClick={() => setActiveTab(i)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
                            style={{
                              background: activeTab === i ? meta.bg  : 'hsl(var(--card))',
                              color:      activeTab === i ? meta.text : 'var(--muted-foreground)',
                              border:     `1px solid ${activeTab === i ? meta.border : 'var(--surface-border)'}`,
                            }}>
                            <Icon className="w-3.5 h-3.5" />
                            {s.name}
                            <span className="text-[10px] opacity-70">{s.rowCount}r</span>
                            {sv?.status === 'error' && <XCircle       className="w-3 h-3 text-[#ef4444]" />}
                            {sv?.status === 'warn'  && <AlertTriangle className="w-3 h-3 text-[#f59e0b]" />}
                            {sv?.status === 'ok'    && <CheckCircle2  className="w-3 h-3 text-[#10b981]" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* preview table */}
                    {currentSheet && (
                      <div className="rounded-md border border-border overflow-hidden">
                        <div className="overflow-x-auto max-h-52">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-card border-b border-border">
                                <th className="px-3 py-2 text-left text-muted-foreground w-8">#</th>
                                {currentSheet.headers.map((h, i) => (
                                  <th key={i} className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {currentSheet.rows.slice(0, PREVIEW_ROWS).map((row, ri) => (
                                <tr key={ri} className="border-t border-border hover:bg-accent/10">
                                  <td className="px-3 py-2 text-muted-foreground">{ri + 1}</td>
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate">{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-background">
                          <span className="text-xs text-muted-foreground">
                            Showing {Math.min(PREVIEW_ROWS, currentSheet.rowCount)} of {currentSheet.rowCount} rows
                          </span>
                          {currentSheet.rowCount > PREVIEW_ROWS && (
                            <span className="text-xs text-muted-foreground">
                              +{currentSheet.rowCount - PREVIEW_ROWS} hidden
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* column schema validation */}
                    {currentSchema && (
                      <div className="rounded-md border border-border p-4 space-y-2 bg-card">
                        <p className="text-xs font-medium">
                          Column check —{' '}
                          <span style={{ color: (SECTION_META[currentSheet?.name ?? ''] ?? fallbackMeta()).text }}>
                            {currentSheet?.name}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {currentSchema.found.map(col => (
                            <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                              <CheckCircle2 className="w-2.5 h-2.5" />{col}
                            </span>
                          ))}
                          {currentSchema.missing.map(col => (
                            <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
                              <XCircle className="w-2.5 h-2.5" />missing: {col}
                            </span>
                          ))}
                          {currentSchema.extra.map(col => (
                            <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
                              <AlertTriangle className="w-2.5 h-2.5" />extra: {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* cross-section checks */}
                    {cv && <CrossSummary cv={cv} />}
                  </motion.div>
                )}

                {/* ══ STEP 2: Confirm ════════════════════════════ */}
                {step === 2 && parsed && cv && (
                  <motion.div key="s2"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}
                    className="p-6 space-y-5"
                  >
                    <div className="flex items-start gap-4 p-5 rounded-md border bg-blue-500/5 border-blue-500/20">
                      <Sparkles className="w-5 h-5 text-[#3b82f6] mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Ready to import</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Review the summary and any conflicts below, then click <strong>Import All Data</strong>.
                        </p>
                      </div>
                    </div>

                    {/* per-section cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {parsed.sheets.map(s => {
                        const meta = SECTION_META[s.name] ?? fallbackMeta();
                        const sv   = schemaResults.find(r => r.sheet === s.name);
                        const Icon = meta.icon;
                        return (
                          <div key={s.name} className="flex items-center gap-3 p-4 rounded-md border"
                            style={{ background: meta.bg, borderColor: meta.border }}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${meta.text}18`, border: `1px solid ${meta.border}` }}>
                              <Icon className="w-4.5 h-4.5" style={{ color: meta.text }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm" style={{ color: meta.text }}>{s.name}</span>
                                {sv?.status === 'ok'    && <CheckCircle2  className="w-3.5 h-3.5 text-[#10b981]" />}
                                {sv?.status === 'warn'  && <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />}
                                {sv?.status === 'error' && <XCircle       className="w-3.5 h-3.5 text-[#ef4444]" />}
                              </div>
                              <p className="text-xs text-muted-foreground">{s.rowCount} records</p>
                            </div>
                            <span className="text-2xl font-semibold shrink-0" style={{ color: meta.text }}>
                              {s.rowCount}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* cross-validation summary */}
                    {cv.hasAllThree && (
                      <div className="rounded-md border border-border overflow-hidden bg-card">
                        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">Cross-section summary</span>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-border p-1">
                          {[
                            {
                              icon: Users,   color: '#8b5cf6',
                              label: 'Faculty refs',
                              ok: cv.facultyRefs.missing.length === 0,
                              detail: cv.facultyRefs.missing.length === 0
                                ? `${cv.facultyRefs.found.length} matched`
                                : `${cv.facultyRefs.missing.length} unmatched`,
                            },
                            {
                              icon: DoorOpen, color: '#10b981',
                              label: 'Room refs',
                              ok: cv.roomRefs.missing.length === 0,
                              detail: cv.roomRefs.missing.length === 0
                                ? `${cv.roomRefs.found.length} matched`
                                : `${cv.roomRefs.missing.length} unmatched`,
                            },
                            {
                              icon: Clock,    color: '#ef4444',
                              label: 'Availability',
                              ok: cv.unavailConflicts.length === 0,
                              detail: cv.unavailConflicts.length === 0
                                ? 'No conflicts'
                                : `${cv.unavailConflicts.length} conflict${cv.unavailConflicts.length !== 1 ? 's' : ''}`,
                            },
                          ].map(item => {
                            const Icon = item.icon;
                            return (
                              <div key={item.label} className="flex flex-col items-center gap-1.5 py-3 px-2">
                                <Icon className="w-4 h-4" style={{ color: item.ok ? item.color : (item.label === 'Availability' ? '#ef4444' : '#f59e0b') }} />
                                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                                <span className="text-[11px] font-medium"
                                  style={{ color: item.ok ? '#10b981' : (item.label === 'Availability' ? '#ef4444' : '#f59e0b') }}>
                                  {item.ok ? '✓ ' : '⚠ '}{item.detail}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* schema errors */}
                    {schemaResults.filter(v => v.status === 'error').map(v => (
                      <div key={v.sheet} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 ring-1 ring-red-500/20">
                        <XCircle className="w-4 h-4 text-[#ef4444] mt-0.5 shrink-0" />
                        <p className="text-sm">
                          <strong>{v.sheet}:</strong> Missing required columns:{' '}
                          <span className="text-[#ef4444]">{v.missing.join(', ')}</span>
                        </p>
                      </div>
                    ))}

                    {/* unavailability conflict table */}
                    <ConflictTable cv={cv} />

                    {/* unmatched faculty/room warnings */}
                    {cv.facultyRefs.missing.length > 0 && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                        <UserX className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                        <p className="text-sm">
                          <strong>Faculty not declared:</strong>{' '}
                          <span className="text-[#f59e0b]">{cv.facultyRefs.missing.join(', ')}</span>
                          <span className="text-muted-foreground"> — sessions will import but won't link to a faculty profile.</span>
                        </p>
                      </div>
                    )}
                    {cv.roomRefs.missing.length > 0 && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                        <DoorOpen className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                        <p className="text-sm">
                          <strong>Rooms not declared:</strong>{' '}
                          <span className="text-[#f59e0b]">{cv.roomRefs.missing.join(', ')}</span>
                          <span className="text-muted-foreground"> — sessions will import but room metadata will be missing.</span>
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* ── Footer ─────────────────────────────────────── */}
            {step > 0 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-card">
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent/30 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center gap-3">
                  {step === 1 && (
                    <button onClick={() => setStep(2)}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                      Continue <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  {step === 2 && (
                    <button
                      onClick={handleImport}
                      disabled={importing || errorCount > 0}
                      className="flex items-center gap-2 px-6 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ background: errorCount > 0 ? 'var(--muted-foreground)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                      {importing
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing…</>
                        : <><Sparkles className="w-4 h-4" /> Import All Data</>}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



