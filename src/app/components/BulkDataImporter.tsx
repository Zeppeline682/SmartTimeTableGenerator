import { useRef, useState, type DragEvent } from 'react';
import { motion } from 'motion/react';
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Loader2, DoorOpen, GraduationCap, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { Faculty, Room } from '../types';

/* ── Backend API URL ── */
function getApiBaseUrl(): string {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return envBase ? envBase.replace(/\/$/, '') : 'http://localhost:8000';
}

/* ── Types ── */
type CsvKind = 'rooms' | 'student_groups' | 'faculty';

interface StudentGroupRow { name: string; code?: string; size?: number; course?: string; semester?: number; }

type BulkImportPayload = {
  faculty: Faculty[];
  rooms: Room[];
  studentGroups: StudentGroupRow[];
};

interface BulkDataImporterProps {
  open: boolean;
  onClose: () => void;
  /** Called AFTER backend persistence succeeds — passes the parsed + persisted data for local state merge. */
  onApply: (payload: BulkImportPayload) => void;
}

/* ── CSV parsing utilities ── */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 1; }
      else { inQuotes = !inQuotes; }
      continue;
    }
    if (char === ',' && !inQuotes) { out.push(current.trim()); current = ''; continue; }
    current += char;
  }
  out.push(current.trim());
  return out;
}

function toSafeCode(name: string, prefix: string, index: number): string {
  const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 12);
  return `${prefix}-${slug || 'AUTO'}-${index + 1}`;
}

function detectCsvKind(headers: string[]): CsvKind | null {
  const has = (h: string) => headers.includes(h);
  if (has('name') && (has('email') || has('department'))) return 'faculty';
  if (has('name') && (has('building_tag') || has('capacity'))) return 'rooms';
  if (has('name') && (has('size') || has('code') || has('course') || has('semester'))) return 'student_groups';
  return null;
}

function parseCsvToPayload(text: string): BulkImportPayload {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) throw new Error('CSV must include a header row and at least one data row.');

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const kind = detectCsvKind(headers);
  if (!kind) throw new Error('Unsupported CSV schema. Expected Rooms (name, building_tag, capacity) or Student Groups (name, size).');

  const rows = lines.slice(1).map(parseCsvLine);



  if (kind === 'faculty') {
    const nameIdx = headers.indexOf('name');
    const emailIdx = headers.indexOf('email');
    const deptIdx = headers.indexOf('department');
    const codeIdx = headers.indexOf('code');
    const faculty: Faculty[] = rows.map((cols, i) => {
      const name = (cols[nameIdx] ?? '').trim();
      return {
        id: codeIdx >= 0 && cols[codeIdx]?.trim() ? cols[codeIdx].trim() : toSafeCode(name, 'FAC', i),
        name,
        email: emailIdx >= 0 ? (cols[emailIdx] ?? '').trim() : '',
        department: deptIdx >= 0 ? (cols[deptIdx] ?? '').trim() : 'General',
        subjects: [],
        tags: [],
        isAbsent: false,
      };
    }).filter(r => r.name.length > 0);
    if (faculty.length === 0) throw new Error('No valid faculty rows found.');
    return { faculty, rooms: [], studentGroups: [] };
  }

  if (kind === 'student_groups') {
    const nameIdx = headers.indexOf('name');
    const sizeIdx = headers.indexOf('size');
    const codeIdx = headers.indexOf('code');
    const courseIdx = headers.indexOf('course');
    const semIdx = headers.indexOf('semester');
    const studentGroups: StudentGroupRow[] = rows
      .map((cols, i) => ({
        name: (cols[nameIdx] ?? '').trim(),
        code: codeIdx >= 0 ? (cols[codeIdx] ?? '').trim() || toSafeCode(cols[nameIdx] ?? '', 'GRP', i) : toSafeCode(cols[nameIdx] ?? '', 'GRP', i),
        size: sizeIdx >= 0 ? (Number(cols[sizeIdx]) || 30) : 30,
        course: courseIdx >= 0 ? (cols[courseIdx] ?? '').trim() : undefined,
        semester: semIdx >= 0 ? Number(cols[semIdx]) || 1 : undefined,
      }))
      .filter(r => r.name.length > 0);
    if (studentGroups.length === 0) throw new Error('No valid student group rows found.');
    return { faculty: [], rooms: [], studentGroups };
  }

  // rooms
  const nameIdx = headers.indexOf('name');
  const tagIdx = headers.indexOf('building_tag');
  const capIdx = headers.indexOf('capacity');
  const codeIdx = headers.indexOf('code');
  const rooms: Room[] = rows
    .map((cols, i) => {
      const name = (cols[nameIdx] ?? '').trim();
      const buildingTag = tagIdx >= 0 ? (cols[tagIdx] ?? '').trim() : '';
      const parsedCap = Number(cols[capIdx]);
      return {
        id: uuidv4(),
        roomId: codeIdx >= 0 && cols[codeIdx]?.trim() ? cols[codeIdx].trim() : toSafeCode(name, 'RM', i),
        name,
        capacity: Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 30,
        type: 'classroom' as const, equipment: [],
        building: buildingTag || undefined,
        building_tag: buildingTag || undefined,
        isAvailable: true,
        _code: codeIdx >= 0 ? cols[codeIdx]?.trim() : undefined,
        _building_tag: buildingTag || undefined,
      };
    })
    .filter(r => r.name.length > 0);
  if (rooms.length === 0) throw new Error('No valid room rows found.');
  return { faculty: [], rooms, studentGroups: [] };
}

/* ── Backend persistence ── */
async function persistToBackend(payload: BulkImportPayload): Promise<{ created: number; errors: string[] }> {
  const base = getApiBaseUrl();
  let created = 0;
  const errors: string[] = [];

  for (const room of payload.rooms) {
    const r = room as any;
    try {
      const res = await fetch(`${base}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: room.name,
          code: r._code ?? room.roomId,
          capacity: room.capacity,
          building_tag: r._building_tag ?? room.building_tag ?? undefined,
        }),
      });
      if (res.ok) created++;
      else if (res.status === 409) {
        // Duplicate — skip silently
      } else {
        errors.push(`Room "${room.name}": HTTP ${res.status}`);
      }
    } catch (e) {
      errors.push(`Room "${room.name}": Network error`);
    }
  }



  for (const f of payload.faculty) {
    try {
      const res = await fetch(`${base}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: f.name, email: f.email, department: f.department, code: f.id }),
      });
      if (res.ok) created++;
      else if (res.status !== 409) errors.push(`Faculty "${f.name}": HTTP ${res.status}`);
    } catch {
      errors.push(`Faculty "${f.name}": Network error`);
    }
  }

  for (const g of payload.studentGroups) {
    try {
      const res = await fetch(`${base}/student-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: g.name, code: g.code, size: g.size ?? 30, course: g.course, semester: g.semester }),
      });
      if (res.ok) created++;
      else if (res.status === 409) {
        // Duplicate — skip silently
      } else {
        errors.push(`Group "${g.name}": HTTP ${res.status}`);
      }
    } catch {
      errors.push(`Group "${g.name}": Network error`);
    }
  }

  return { created, errors };
}

/* ── Component ── */
export function BulkDataImporter({ open, onClose, onApply }: BulkDataImporterProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ kind: CsvKind; count: number; persisted: number } | null>(null);

  if (!open) return null;

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only .csv files are supported.');
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const payload = parseCsvToPayload(text);
      const kind: CsvKind = payload.studentGroups.length > 0 ? 'student_groups' : 'rooms';
      const count = payload.faculty.length + payload.rooms.length + payload.studentGroups.length;

      // Persist to backend
      const { created, errors } = await persistToBackend(payload);

      setSummary({ kind, count, persisted: created });
      onApply(payload);

      if (errors.length > 0) {
        toast.warning(`Imported ${created}/${count} entities. ${errors.length} failed.`, {
          description: errors.slice(0, 3).join(' | '),
        });
      } else {
        toast.success(`Bulk import complete — ${created} entities persisted to database.`);
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse CSV.';
      toast.error('Bulk import failed.', { description: message });
    } finally {
      setLoading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }


  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="w-full max-w-xl rounded-lg border border-border bg-card p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Bulk CSV Import</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Accepts Rooms or Student Groups CSV — auto-detected from headers.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={event => { const f = event.target.files?.[0]; if (f) void handleFile(f); event.target.value = ''; }} />

        <div
          onClick={() => !loading && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            loading ? 'opacity-60 cursor-wait' : 'cursor-pointer'
          } ${dragging ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:bg-accent/20'}`}
        >
          {loading
            ? <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
            : <Upload className="w-8 h-8 text-blue-500 mx-auto mb-3" />
          }
          <p className="font-medium">{loading ? 'Persisting to database…' : 'Drag and drop CSV here'}</p>
          {!loading && <p className="text-xs text-muted-foreground mt-1">or click to browse</p>}
        </div>

        {/* Schema reference Tabular */}
        <div className="rounded-md border border-border bg-background p-4 space-y-4">
          
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            <span>Accepted CSV Formats</span>
            <span className="flex items-center gap-1 text-amber-500/80 normal-case tracking-normal font-normal">
              <AlertTriangle className="h-3 w-3" /> Auto-detected. Headers are case-insensitive.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Rooms */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-purple-500" /> Rooms
              </div>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-left text-[10px] bg-card">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                    <tr><th className="px-2 py-1.5 font-medium">name*</th><th className="px-2 py-1.5 font-medium">capacity</th><th className="px-2 py-1.5 font-medium">building_tag</th></tr>
                  </thead>
                  <tbody className="text-muted-foreground divide-y divide-border font-mono">
                    <tr><td className="px-2 py-1.5">Lab 101</td><td className="px-2 py-1.5">30</td><td className="px-2 py-1.5">Science Block</td></tr>
                    <tr><td className="px-2 py-1.5">Room 12</td><td className="px-2 py-1.5">60</td><td className="px-2 py-1.5">Main</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Professors */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" /> Professors
              </div>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-left text-[10px] bg-card">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                    <tr><th className="px-2 py-1.5 font-medium">name*</th><th className="px-2 py-1.5 font-medium">email</th><th className="px-2 py-1.5 font-medium">department</th></tr>
                  </thead>
                  <tbody className="text-muted-foreground divide-y divide-border font-mono">
                    <tr><td className="px-2 py-1.5">Dr. Smith</td><td className="px-2 py-1.5">smith@edu</td><td className="px-2 py-1.5">CS</td></tr>
                    <tr><td className="px-2 py-1.5">Prof. Doe</td><td className="px-2 py-1.5">doe@edu</td><td className="px-2 py-1.5">Math</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Classes (Student Groups) - Spans both columns */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-500" /> Classes (Student Groups)
              </div>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-left text-[10px] bg-card">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">name*</th>
                      <th className="px-2 py-1.5 font-medium">course</th>
                      <th className="px-2 py-1.5 font-medium">semester</th>
                      <th className="px-2 py-1.5 font-medium">size</th>
                      <th className="px-2 py-1.5 font-medium">code</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground divide-y divide-border font-mono">
                    <tr>
                      <td className="px-2 py-1.5">CS-A</td>
                      <td className="px-2 py-1.5">Computer Science</td>
                      <td className="px-2 py-1.5">4</td>
                      <td className="px-2 py-1.5">60</td>
                      <td className="px-2 py-1.5">CSA4</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5">ME-B</td>
                      <td className="px-2 py-1.5">Mech Engineering</td>
                      <td className="px-2 py-1.5">2</td>
                      <td className="px-2 py-1.5">45</td>
                      <td className="px-2 py-1.5">MEB2</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {summary && (
            <div className="flex items-center gap-2 text-emerald-500 text-xs mt-2 pt-2 border-t border-border">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Last import: {summary.persisted}/{summary.count} {summary.kind.replace('_', ' ')} persisted.</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
