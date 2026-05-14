import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../hooks/useWorkspaceStore';
import { Bell, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function AdminNotificationsPage() {
  const { teachers, facultyAbsences = [], solverConstraints = [] } = useWorkspaceStore();
  const [absences, setAbsences] = useState<any[]>([]);

  useEffect(() => {
    setAbsences(facultyAbsences);
  }, [facultyAbsences]);

  const handleApplyConstraint = (absence: any) => {
    const raw = window.localStorage.getItem('realtime-timetable.workspace.v2');
    if (!raw) return;

    const ws = JSON.parse(raw);
    const updatedAbsences = (ws.facultyAbsences || []).map((x: any) =>
      x.id === absence.id ? { ...x, status: 'applied' } : x
    );
    ws.facultyAbsences = updatedAbsences;

    const teacher = teachers.find((t: any) => t.name === absence.facultyName);
    if (!teacher) {
      toast.error('Teacher not found.');
      return;
    }

    const dateObj = new Date(absence.date);
    const jsDay = dateObj.getDay();
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // 0 is Monday

    const totalDays = 5;
    const unavailable: { day: number, slot: number }[] = [];
    if (dayIndex >= 0 && dayIndex < totalDays) {
      // Block up to 30 slots to be safe, out of bounds are ignored by backend now
      for (let i = 0; i < 30; i++) {
        unavailable.push({ day: dayIndex, slot: i });
      }
    }

    const newConstraint = {
      id: Math.random().toString(36).substring(2, 9),
      target_type: 'Teacher',
      target_id: teacher.id,
      rule_type: 'Availability',
      value: { unavailable }
    };

    ws.solverConstraints = [...(ws.solverConstraints || []), newConstraint];

    window.localStorage.setItem('realtime-timetable.workspace.v2', JSON.stringify(ws));
    window.dispatchEvent(new CustomEvent('chronolink:import', { detail: ws }));

    toast.success('Constraint Applied', { description: `Availability constraint created for ${absence.facultyName}.` });
  };

  return (
    <div className="flex-1 h-full p-8 overflow-auto bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">Manage faculty leave requests and system alerts.</p>
          </div>
        </div>

        {absences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-card border border-dashed rounded-xl border-border/50">
            <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-1">All Caught Up</h3>
            <p className="text-sm text-muted-foreground/70">There are no pending notifications or leave requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {absences.map(a => (
              <div key={a.id} className="p-5 border border-border rounded-xl bg-card shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:border-amber-500/30">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-base font-semibold">{a.facultyName}</p>
                      {a.status === 'pending' ? (
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Leave Request</span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Processed</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Requested a leave of absence for <span className="font-medium text-foreground">{new Date(a.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>.
                    </p>
                  </div>
                </div>
                
                {a.status === 'pending' && (
                  <button
                    onClick={() => handleApplyConstraint(a)}
                    className="w-full md:w-auto px-5 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium whitespace-nowrap shadow-sm shadow-blue-500/20"
                  >
                    Convert to Constraint
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
