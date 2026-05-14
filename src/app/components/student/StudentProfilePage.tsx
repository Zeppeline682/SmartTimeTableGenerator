import { useState } from 'react';
import {
  UserCircle, Mail, Phone, Calendar, BookOpen,
  GraduationCap, Award, TrendingUp, Edit2, Check, X,
  FlaskConical, Clock,
} from 'lucide-react';
import { motion } from 'motion/react';
import { mockTimeSlots, mockGroups } from '../../mockData';
import { useStudentProfile } from '../../hooks/useStudentProfile';

/* ── helpers ──────────────────────────────────────────── */

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const PALETTE = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899'];
function subjectColor(idx: number) { return PALETTE[idx % PALETTE.length]; }

/* ── stats from timetable ─────────────────────────────── */

const totalHrs      = mockTimeSlots.reduce((acc, s) => acc + (toMins(s.endTime) - toMins(s.startTime)) / 60, 0);
const subjects      = [...new Set(mockTimeSlots.map(s => s.subject).filter(Boolean))];
const lectureHrs    = mockTimeSlots.filter(s => s.type === 'lecture').reduce((acc, s) => acc + (toMins(s.endTime) - toMins(s.startTime)) / 60, 0);
const practicalHrs  = mockTimeSlots.filter(s => s.type === 'practical').reduce((acc, s) => acc + (toMins(s.endTime) - toMins(s.startTime)) / 60, 0);

/* ── mock attendance per subject ─────────────────────── */
const ATTENDANCE: Record<string, number> = {
  'Data Structures': 91,
  'Algorithms': 88,
  'Database Practical': 95,
  'Operating Systems': 84,
  'Computer Networks': 90,
  'Discrete Mathematics': 76,
  'Algorithms Tutorial': 100,
  'Machine Learning': 92,
  'AI Fundamentals': 89,
  'Technical Writing': 96,
  'Statistics': 85,
  'Database Lab': 100,
};

/* ── component ────────────────────────────────────────── */

export function StudentProfilePage() {
  const ME_STUDENT = useStudentProfile();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone]     = useState(ME_STUDENT.phone);
  const [phoneDraft, setPhoneDraft] = useState(ME_STUDENT.phone);

  function savePhone() { setPhone(phoneDraft); setEditing(false); }
  function cancelEdit() { setPhoneDraft(phone); setEditing(false); }

  const overallAttendance = Math.round(
    Object.values(ATTENDANCE).reduce((a, b) => a + b, 0) / Object.values(ATTENDANCE).length
  );

  return (
    <div className="min-h-full bg-background">

      {/* Header */}
      <div className="border-b border-border px-8 py-5 bg-background">
        <h1 className="text-xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your academic details and schedule overview</p>
      </div>

      <div className="px-8 py-6 space-y-5">

        {/* Profile card */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-xl text-white font-semibold shrink-0"
              style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}
            >
              {initials(ME_STUDENT.name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold">{ME_STUDENT.name}</h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
                >
                  Active
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{ME_STUDENT.studentId}</div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">{ME_STUDENT.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {editing ? (
                    <>
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input
                        value={phoneDraft}
                        onChange={e => setPhoneDraft(e.target.value)}
                        className="flex-1 bg-transparent border-b border-border text-sm focus:outline-none focus:border-[#10b981]"
                        autoFocus
                      />
                      <button onClick={savePhone}  className="p-1 rounded hover:bg-accent"><Check className="w-3.5 h-3.5 text-[#10b981]" /></button>
                      <button onClick={cancelEdit} className="p-1 rounded hover:bg-accent"><X     className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{phone}</span>
                      <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-accent opacity-50 hover:opacity-100 transition-opacity">
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{ME_STUDENT.group.course}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    Enrolled {new Date(ME_STUDENT.joinedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                  </span>
                </div>
              </div>
            </div>

            {/* GPA badge */}
            {/*
            <div className="shrink-0 text-center">
              <div className="w-16 h-16 rounded-lg flex flex-col items-center justify-center bg-emerald-500/10 ring-2 ring-emerald-500/30">
                <span className="text-xl font-bold text-emerald-500">{ME_STUDENT.gpa}</span>
                <span className="text-[9px] text-muted-foreground">GPA</span>
              </div>
            </div>
            */}
          </div>
        </div>

        {/* Stats row */}
        {/*
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: BookOpen,      label: 'Subjects',         value: subjects.length,                  color: '#3b82f6' },
            { icon: Clock,         label: 'Weekly Hours',     value: `${totalHrs}h`,                   color: '#f59e0b' },
            { icon: FlaskConical,  label: 'Lab Hours/wk',     value: `${practicalHrs}h`,               color: '#10b981' },
            { icon: TrendingUp,    label: 'Avg Attendance',   value: `${overallAttendance}%`,          color: overallAttendance >= 85 ? '#10b981' : overallAttendance >= 75 ? '#f59e0b' : '#ef4444' },
          ].map(s => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-md p-4"
            >
              <s.icon className="w-5 h-5 mb-2" style={{ color: s.color }} />
              <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </div>
        */}

        {/* Enrolled subjects + attendance */}
        {/*
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-violet-500" />
            Subject Attendance
          </h3>
          <div className="space-y-3">
            {subjects.map((subj, idx) => {
              const pct   = ATTENDANCE[subj!] ?? 80;
              const color = pct >= 85 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';
              return (
                <div key={subj} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: subjectColor(idx) }}
                      />
                      <span>{subj}</span>
                    </div>
                    <span className="font-medium" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 }}
                      className="h-full rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Min required: 75%</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10b981]" /> ≥85%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> 75–84%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ef4444]" /> &lt;75%</span>
            </div>
          </div>
        </div>
        */}

        {/* Group info */}
        {/*
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-blue-500" />
            Group Information
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Group',        value: ME_STUDENT.group.name },
              { label: 'Course',       value: ME_STUDENT.group.course },
              { label: 'Semester',     value: `Semester ${ME_STUDENT.group.semester}` },
              { label: 'Students',     value: `${ME_STUDENT.group.studentsCount} enrolled` },
              { label: 'Live Status',  value: ME_STUDENT.group.isLive ? 'Live' : 'Not published',
                                       color: ME_STUDENT.group.isLive ? '#10b981' : undefined },
              { label: 'Student ID',   value: ME_STUDENT.studentId },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs text-muted-foreground mb-0.5">{item.label}</div>
                <div className="font-medium" style={{ color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        */}
      </div>
    </div>
  );
}



