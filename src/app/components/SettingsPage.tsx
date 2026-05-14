import { useState } from 'react';
import {
  Building2, Calendar, Clock, Bell, Shield, Trash2,
  Save, Globe, Mail, Users, GraduationCap, Lock,
  CheckCircle2, AlertTriangle, Info, ChevronRight,
  RotateCcw, Database,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

/* ─── Section Types ───────────────────────────────────── */

type SectionId = 'general' | 'calendar' | 'timetable' | 'notifications' | 'access' | 'data';

const SECTIONS: { id: SectionId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'general',       label: 'General',        icon: Building2    },
  { id: 'calendar',      label: 'Academic Calendar', icon: Calendar  },
  { id: 'timetable',     label: 'Timetable Config', icon: Clock      },
  { id: 'notifications', label: 'Notifications',   icon: Bell        },
  { id: 'access',        label: 'Portal Access',   icon: Shield      },
  { id: 'data',          label: 'Data Management', icon: Database    },
];

/* ─── Toggle component ────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-10 rounded-full relative transition-colors shrink-0"
      style={{ height: 22, background: checked ? '#3b82f6' : 'var(--surface-border)', padding: 2 }}
    >
      <div className="w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }} />
    </button>
  );
}

/* ─── Section header ──────────────────────────────────── */

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

/* ─── Field helpers ───────────────────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-52 px-3 py-1.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30"
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-52 px-3 py-1.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ─── Main Page ───────────────────────────────────────── */

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [saved, setSaved] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);

  /* General */
  const [institutionName, setInstitutionName] = useState('University of ChronoLink');
  const [institutionEmail, setInstitutionEmail] = useState('admin@chronolink.edu');
  const [website, setWebsite] = useState('https://chronolink.edu');
  const [timezone, setTimezone] = useState('UTC+0 London');
  const [language, setLanguage] = useState('English');

  /* Calendar */
  const [currentSemester, setCurrentSemester] = useState('Spring 2026');
  const [semesterStart, setSemesterStart] = useState('2026-01-13');
  const [semesterEnd, setSemesterEnd] = useState('2026-05-23');
  const [academicYear, setAcademicYear] = useState('2025–2026');
  const [weekStart, setWeekStart] = useState('Monday');

  /* Timetable */
  const [slotDuration, setSlotDuration] = useState('60');
  const [breakDuration, setBreakDuration] = useState('10');
  const [dayStart, setDayStart] = useState('08:00');
  const [dayEnd, setDayEnd] = useState('19:00');
  const [workingDays, setWorkingDays] = useState(['Monday','Tuesday','Wednesday','Thursday','Friday']);
  const [maxDailyHours, setMaxDailyHours] = useState('8');

  /* Notifications */
  const [notifyConflict, setNotifyConflict]     = useState(true);
  const [notifyAbsence, setNotifyAbsence]       = useState(true);
  const [notifyImport, setNotifyImport]         = useState(true);
  const [notifyOptimize, setNotifyOptimize]     = useState(false);
  const [emailDigest, setEmailDigest]           = useState(true);
  const [digestFreq, setDigestFreq]             = useState('Daily');

  /* Access */
  const [facultyPortal, setFacultyPortal]       = useState(true);
  const [studentPortal, setStudentPortal]       = useState(true);
  const [requireFacultyAuth, setFacultyAuth]    = useState(false);
  const [requireStudentAuth, setStudentAuth]    = useState(true);
  const [adminSSOOnly, setAdminSSOOnly]         = useState(false);
  const [liveLinksPublic, setLiveLinksPublic]   = useState(true);

  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  const toggleDay = (d: string) =>
    setWorkingDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );

  const handleSave = () => {
    setSaved(true);
    toast.success('Settings saved', { description: 'All changes have been applied.' });
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = (what: string) => {
    if (resetConfirm !== what) { setResetConfirm(what); return; }
    setResetConfirm(null);
    toast.success(`${what} reset`, { description: 'Operation completed. Refreshing data…' });
  };

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure ChronoLink for your institution
            </p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity"
            style={{ background: saved ? '#10b981' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}
          >
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-120px)]">
        {/* Left nav */}
        <aside className="w-56 shrink-0 border-r border-border p-4 space-y-1" style={{ background: 'var(--surface-0)' }}>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all"
                style={{
                  background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color:      active ? '#3b82f6' : 'var(--muted-foreground)',
                  border:     `1px solid ${active ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                }}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{s.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <main className="flex-1 px-8 py-6 max-w-2xl">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >

            {/* ── General ── */}
            {activeSection === 'general' && (
              <div>
                <SectionHeader title="General" description="Institution details and regional settings" />
                <div className="bg-card border border-border rounded-md px-5">
                  <Field label="Institution Name" hint="Appears on all portals and exported files">
                    <TextInput value={institutionName} onChange={setInstitutionName} />
                  </Field>
                  <Field label="Admin Email" hint="Used for system notifications">
                    <TextInput value={institutionEmail} onChange={setInstitutionEmail} />
                  </Field>
                  <Field label="Website" hint="Linked from student-facing pages">
                    <TextInput value={website} onChange={setWebsite} />
                  </Field>
                  <Field label="Timezone" hint="All timetable times are displayed in this timezone">
                    <SelectInput value={timezone} onChange={setTimezone} options={[
                      'UTC-8 Los Angeles','UTC-5 New York','UTC+0 London',
                      'UTC+1 Berlin','UTC+5:30 Mumbai','UTC+8 Singapore','UTC+9 Tokyo',
                    ]} />
                  </Field>
                  <Field label="Language" hint="UI language for all portals">
                    <SelectInput value={language} onChange={setLanguage} options={['English','Spanish','French','Arabic','Hindi']} />
                  </Field>
                </div>
              </div>
            )}

            {/* ── Calendar ── */}
            {activeSection === 'calendar' && (
              <div>
                <SectionHeader title="Academic Calendar" description="Define the current semester and academic year" />
                <div className="bg-card border border-border rounded-md px-5">
                  <Field label="Current Semester" hint="Shown in dashboards and live views">
                    <SelectInput value={currentSemester} onChange={setCurrentSemester} options={[
                      'Fall 2025','Spring 2026','Summer 2026','Fall 2026',
                    ]} />
                  </Field>
                  <Field label="Academic Year" hint="e.g. 2025–2026">
                    <TextInput value={academicYear} onChange={setAcademicYear} />
                  </Field>
                  <Field label="Semester Start Date">
                    <input type="date" value={semesterStart} onChange={e => setSemesterStart(e.target.value)}
                      className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30" />
                  </Field>
                  <Field label="Semester End Date">
                    <input type="date" value={semesterEnd} onChange={e => setSemesterEnd(e.target.value)}
                      className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30" />
                  </Field>
                  <Field label="Week starts on">
                    <SelectInput value={weekStart} onChange={setWeekStart} options={['Monday','Sunday','Saturday']} />
                  </Field>
                </div>
              </div>
            )}

            {/* ── Timetable ── */}
            {activeSection === 'timetable' && (
              <div>
                <SectionHeader title="Timetable Configuration" description="Global defaults applied to all new timetable generations" />
                <div className="bg-card border border-border rounded-md px-5">
                  <Field label="Default Slot Duration (mins)" hint="Each time slot's default length">
                    <SelectInput value={slotDuration} onChange={setSlotDuration} options={['30','45','60','90','120']} />
                  </Field>
                  <Field label="Break Between Slots (mins)" hint="Minimum gap between consecutive classes">
                    <SelectInput value={breakDuration} onChange={setBreakDuration} options={['0','5','10','15','20']} />
                  </Field>
                  <Field label="Day Start Time">
                    <input type="time" value={dayStart} onChange={e => setDayStart(e.target.value)}
                      className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30" />
                  </Field>
                  <Field label="Day End Time">
                    <input type="time" value={dayEnd} onChange={e => setDayEnd(e.target.value)}
                      className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30" />
                  </Field>
                  <Field label="Max Daily Hours per Student" hint="Constraint engine uses this as a soft limit">
                    <SelectInput value={maxDailyHours} onChange={setMaxDailyHours} options={['4','5','6','7','8','9','10']} />
                  </Field>
                  <Field label="Working Days" hint="Days available for scheduling">
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {DAYS.map(d => {
                        const on = workingDays.includes(d);
                        return (
                          <button key={d} type="button" onClick={() => toggleDay(d)}
                            className="w-8 h-8 rounded-lg text-[10px] font-medium transition-all"
                            style={{
                              background: on ? 'rgba(59,130,246,0.15)' : 'var(--surface-3)',
                              color:      on ? '#3b82f6' : 'var(--muted-foreground)',
                              border:     `1px solid ${on ? 'rgba(59,130,246,0.3)' : 'var(--surface-border)'}`,
                            }}>
                            {d.slice(0,2)}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {/* ── Notifications ── */}
            {activeSection === 'notifications' && (
              <div>
                <SectionHeader title="Notifications" description="Control what ChronoLink notifies you about" />
                <div className="bg-card border border-border rounded-md px-5">
                  <Field label="Conflict alerts" hint="Notify when a scheduling conflict is detected">
                    <Toggle checked={notifyConflict} onChange={setNotifyConflict} />
                  </Field>
                  <Field label="Faculty absence alerts" hint="Notify when faculty is marked absent">
                    <Toggle checked={notifyAbsence} onChange={setNotifyAbsence} />
                  </Field>
                  <Field label="Import / export results" hint="Toast notifications after import/export">
                    <Toggle checked={notifyImport} onChange={setNotifyImport} />
                  </Field>
                  <Field label="Optimization complete" hint="Notify when a re-optimization run finishes">
                    <Toggle checked={notifyOptimize} onChange={setNotifyOptimize} />
                  </Field>
                </div>

                <div className="mt-5 bg-card border border-border rounded-md px-5">
                  <div className="py-4 border-b border-border">
                    <p className="text-sm font-medium mb-0.5">Email digest</p>
                    <p className="text-xs text-muted-foreground">Receive a summary of activity by email</p>
                  </div>
                  <Field label="Send email digest" hint="Requires admin email to be configured">
                    <Toggle checked={emailDigest} onChange={setEmailDigest} />
                  </Field>
                  {emailDigest && (
                    <Field label="Digest frequency">
                      <SelectInput value={digestFreq} onChange={setDigestFreq} options={['Hourly','Daily','Weekly']} />
                    </Field>
                  )}
                </div>
              </div>
            )}

            {/* ── Access ── */}
            {activeSection === 'access' && (
              <div>
                <SectionHeader title="Portal Access" description="Control who can access each portal and how they authenticate" />
                <div className="bg-card border border-border rounded-md px-5">
                  <div className="py-4 border-b border-border flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#8b5cf6]" />
                    <span className="font-medium text-sm">Faculty Portal</span>
                  </div>
                  <Field label="Enable Faculty Portal" hint="Allows faculty to log in at /faculty">
                    <Toggle checked={facultyPortal} onChange={setFacultyPortal} />
                  </Field>
                  <Field label="Require Authentication" hint="Faculty must sign in before viewing their portal">
                    <Toggle checked={requireFacultyAuth} onChange={setFacultyAuth} />
                  </Field>
                </div>

                <div className="mt-5 bg-card border border-border rounded-md px-5">
                  <div className="py-4 border-b border-border flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#3b82f6]" />
                    <span className="font-medium text-sm">Student Portal</span>
                  </div>
                  <Field label="Enable Student Portal" hint="Allows students to log in at /student">
                    <Toggle checked={studentPortal} onChange={setStudentPortal} />
                  </Field>
                  <Field label="Require Authentication" hint="Students must sign in before viewing timetables">
                    <Toggle checked={requireStudentAuth} onChange={setStudentAuth} />
                  </Field>
                  <Field label="Public Live Links" hint="Live timetable links (/live/:id) are accessible without login">
                    <Toggle checked={liveLinksPublic} onChange={setLiveLinksPublic} />
                  </Field>
                </div>

                <div className="mt-5 bg-card border border-border rounded-md px-5">
                  <div className="py-4 border-b border-border flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#f59e0b]" />
                    <span className="font-medium text-sm">Admin Access</span>
                  </div>
                  <Field label="SSO Only for Admins" hint="Disable password login — require SSO (Google / SAML)">
                    <Toggle checked={adminSSOOnly} onChange={setAdminSSOOnly} />
                  </Field>
                </div>

                <div className="mt-4 flex items-start gap-3 p-4 rounded-md border bg-blue-500/5 border-blue-500/20">
                  <Info className="w-4 h-4 text-[#3b82f6] mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Authentication is currently simulated. Connect to Supabase or your identity provider to enable real login flows.
                  </p>
                </div>
              </div>
            )}

            {/* ── Data ── */}
            {activeSection === 'data' && (
              <div>
                <SectionHeader title="Data Management" description="Export, reset, or clear institution data" />

                {/* Backup */}
                <div className="bg-card border border-border rounded-md px-5 mb-5">
                  <div className="py-4 border-b border-border">
                    <p className="text-sm font-medium">Backups & Exports</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Download a full snapshot of all ChronoLink data</p>
                  </div>
                  {[
                    { label: 'Full backup (.json)',    desc: 'All data as a restorable JSON file', action: 'Export JSON' },
                    { label: 'Timetable spreadsheet', desc: 'Current timetable in Excel format',  action: 'Export Excel' },
                  ].map(item => (
                    <div key={item.label} className="py-4 border-b border-border last:border-0 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (item.action === 'Export JSON') {
                            import('../utils/excelExport').then(m => m.exportTimetableAsJson());
                          } else {
                            import('../utils/excelExport').then(m => m.exportTimetableAsXlsx());
                          }
                          toast.success(`${item.action} started`, { description: 'Your file will download shortly.' });
                        }}
                        className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent/30 transition-colors whitespace-nowrap"
                      >
                        {item.action}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Danger zone */}
                <div className="rounded-md border px-5" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                  <div className="py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
                    <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                    <span className="font-medium text-sm text-[#ef4444]">Danger Zone</span>
                  </div>

                  {[
                    { id: 'timetable', label: 'Clear all time slots', desc: 'Removes all scheduled sessions. Faculty and rooms are preserved.', icon: RotateCcw },
                    { id: 'faculty',   label: 'Reset faculty data',   desc: 'Deletes all faculty records and preferences.',                   icon: Users },
                    { id: 'all',       label: 'Reset entire database', desc: 'Wipes all data. This cannot be undone.',                        icon: Trash2 },
                  ].map(item => {
                    const confirming = resetConfirm === item.id;
                    return (
                      <div key={item.id} className="py-4 border-b last:border-0 flex items-center justify-between gap-4"
                        style={{ borderColor: 'rgba(239,68,68,0.1)' }}>
                        <div className="flex items-start gap-3">
                          <item.icon className="w-4 h-4 text-[#ef4444] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleReset(item.id)}
                          className="px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
                          style={{
                            background: confirming ? '#ef4444' : 'rgba(239,68,68,0.08)',
                            color:      confirming ? '#fff' : '#ef4444',
                            border:     '1px solid rgba(239,68,68,0.3)',
                          }}>
                          {confirming ? 'Click again to confirm' : 'Reset'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </motion.div>
        </main>
      </div>
    </div>
  );
}



