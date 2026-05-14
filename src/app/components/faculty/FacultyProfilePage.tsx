import { mockFaculty, mockTimeSlots } from '../../mockData';
import { Mail, Phone, Calendar, BookOpen, TrendingUp, Clock, Award, AlertCircle } from 'lucide-react';
import { DAYS_FULL, barColor, typePill } from '../FacultyDashboard';
import { motion } from 'motion/react';

const me = mockFaculty[0];

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function FacultyProfilePage() {
  const mySlots   = mockTimeSlots.filter(s => s.faculty === me.name);
  const weeklyHrs = me.totalWeeklyHours ?? 0;

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-5 bg-background">
        <h1 className="text-xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your public faculty record as seen by administrators.</p>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-6 flex flex-col sm:flex-row items-start gap-6"
        >
          {/* Avatar */}
          <div className="w-20 h-20 rounded-lg flex items-center justify-center text-2xl text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {initials(me.name)}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold">{me.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20">
                Faculty
              </span>
              {me.isAbsent && (
                <span className="px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1 bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
                  <AlertCircle className="h-3 w-3" />Absent
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mb-4">{me.department}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />{me.email}
              </div>
              {me.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />{me.phone}
                </div>
              )}
              {me.joinedDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />Joined {me.joinedDate}
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />{weeklyHrs}h / week
              </div>
            </div>
          </div>

          {/* Workload badge */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="text-xs text-muted-foreground">Workload</div>
            <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center"
              style={{
                borderColor: me.workloadIntensity === 'high' ? '#ef4444' : me.workloadIntensity === 'medium' ? '#f59e0b' : '#10b981',
                color:        me.workloadIntensity === 'high' ? '#ef4444' : me.workloadIntensity === 'medium' ? '#f59e0b' : '#10b981',
              }}>
              <span className="text-sm font-semibold capitalize">{me.workloadIntensity}</span>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Classes/week', value: mySlots.length,   icon: <BookOpen   className="h-4 w-4" />, color: '#3b82f6' },
            { label: 'Teaching hrs', value: `${weeklyHrs}h`,  icon: <Clock      className="h-4 w-4" />, color: weeklyHrs >= 20 ? '#ef4444' : '#10b981' },
            { label: 'Subjects',     value: me.subjects.length, icon: <Award    className="h-4 w-4" />, color: '#8b5cf6' },
            { label: 'Score',        value: '80%',             icon: <TrendingUp className="h-4 w-4" />, color: '#10b981' },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-md p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.color}18`, color: s.color }}>
                {s.icon}
              </div>
              <div>
                <div className="text-xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Subjects + daily load */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Subjects */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />Subjects
            </h3>
            <div className="space-y-2">
              {me.subjects.map(s => {
                const sessionCount = mySlots.filter(sl => sl.subject.toLowerCase().includes(s.split(' ')[0].toLowerCase())).length;
                return (
                  <div key={s} className="flex items-center justify-between px-4 py-3 rounded-md bg-card border border-border">
                    <span className="text-sm">{s}</span>
                    <span className="text-xs text-muted-foreground">{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily workload */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />Daily Load
            </h3>
            <div className="space-y-3">
              {DAYS_FULL.map(day => {
                const count = mySlots.filter(s => s.day === day).length;
                const pct   = (count / 5) * 100;
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{day.slice(0, 3)}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-card">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: count === 0 ? 'var(--surface-border)' : barColor(count) }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {count === 0 ? 'Free' : `${count} class${count > 1 ? 'es' : ''}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs text-muted-foreground">
              <span>Weekly total</span>
              <span className="font-medium text-foreground">{weeklyHrs}h</span>
            </div>
          </div>
        </div>

        {/* All sessions list */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-card">
            <h2 className="text-sm font-medium">Session Log</h2>
          </div>
          <div className="divide-y divide-border">
            {mySlots.map(slot => (
              <div key={slot.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/10 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{slot.day}</span>
                  <div>
                    <div className="text-sm font-medium">{slot.subject}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {slot.startTime}–{slot.endTime} · {slot.room}
                    </div>
                  </div>
                </div>
                {typePill(slot.type)}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}



