import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useSession } from '../../auth/SessionContext';
import { useWorkspaceStore, WORKSPACE_STORAGE_KEY } from '../../hooks/useWorkspaceStore';
import { toast } from 'sonner';

export function FacultyPreferencesPage() {
  const { user } = useSession();
  const workspace = useWorkspaceStore();
  
  // Find the real teacher from the workspace matching the user's email/name
  const realTeacherIndex = workspace.teachers.findIndex(t => (t.email && t.email.toLowerCase() === user.email.toLowerCase()) || t.name.toLowerCase().includes(user.name.toLowerCase())) >= 0
    ? workspace.teachers.findIndex(t => (t.email && t.email.toLowerCase() === user.email.toLowerCase()) || t.name.toLowerCase().includes(user.name.toLowerCase()))
    : 0;

  const me = workspace.teachers[realTeacherIndex];

  const [dateStr, setDateStr] = useState('');

  function markAbsent() {
    if (!dateStr) return;
    const ws = { ...workspace };
    const absences = ws.facultyAbsences ? [...ws.facultyAbsences] : [];
    
    // Check if already applied
    if (absences.some(a => a.facultyName === (me?.name || user.name) && a.date === dateStr)) {
      toast.error('You have already applied for this date');
      return;
    }

    absences.push({
      id: Math.random().toString(36).substring(2, 9),
      facultyName: me?.name || user.name,
      date: dateStr,
      status: 'pending'
    });

    ws.facultyAbsences = absences;
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(ws));
    // Trigger cross-tab/same-tab sync if needed
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('chronolink:import'));
    
    toast.success('Absence recorded', { description: 'Notification sent to admin' });
    setDateStr('');
  }

  // Get my existing absences
  const myAbsences = (workspace.facultyAbsences || []).filter(a => a.facultyName === me?.name || a.facultyName === user.name);

  return (
    <div className="min-h-full bg-background flex flex-col">
      <div className="border-b border-border px-8 py-5 bg-background">
        <h1 className="text-xl font-semibold">Absence & Leave</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Mark dates you will be unavailable. Notifications will be sent to the admin.
        </p>
      </div>
      <div className="px-8 py-6 max-w-2xl space-y-6">
        
        {/*
          TODO: Temporarily commented out Professor Time Preferences.
          We will add that back later.
        */}

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-medium flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-muted-foreground" /> Report Absence
          </h2>
          <div className="flex gap-3">
            <input 
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="px-3 py-2 bg-input border border-border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/50" 
            />
            <button
              onClick={markAbsent}
              disabled={!dateStr}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              Mark Absent
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Your reported absences</h3>
          {myAbsences.length === 0 && (
            <div className="text-sm text-muted-foreground px-4 py-8 text-center border border-dashed border-border rounded-lg">
              No absences reported
            </div>
          )}
          {myAbsences.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg shadow-sm">
              <div className="text-sm font-medium text-foreground">{new Date(a.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${a.status === 'applied' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                {a.status === 'applied' ? 'Constraint Applied' : 'Pending Admin Action'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
