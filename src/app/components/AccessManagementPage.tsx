import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, UserPlus, GraduationCap, Search, MoreVertical,
  ShieldCheck, ShieldOff, Trash2, Copy, Check, X, Eye, EyeOff,
  RefreshCw, Clock, Mail, Building2, KeyRound,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import {
  accessStore, formatRelativeTime,
  type PortalAccount, type AccessStatus,
} from '../lib/accessStore';

/* ── helpers ── */
function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function StatusBadge({ status }: { status: AccessStatus }) {
  return status === 'active'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>Suspended</span>;
}

/* ── Add Faculty Modal ── */
interface AddFacultyModalProps { onClose: () => void; onAdd: (account: PortalAccount) => void; }

function AddFacultyModal({ onClose, onAdd }: AddFacultyModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');
  const [pwd, setPwd] = useState(() => genPassword());
  const [showPwd, setShowPwd] = useState(false);
  const [pwdCopied, setPwdCopied] = useState(false);

  function copyPwd() {
    navigator.clipboard.writeText(pwd);
    setPwdCopied(true);
    setTimeout(() => setPwdCopied(false), 2000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const account: PortalAccount = {
      id: uuidv4(),
      role: 'faculty',
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: dept.trim() || undefined,
      tempPassword: pwd,
      status: 'active',
      grantedAt: new Date().toISOString(),
    };
    onAdd(account);
    onClose();
  }

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg text-sm bg-input border border-border focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-md rounded-xl border border-border bg-card overflow-hidden">
        {/* top accent */}
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">Add Faculty Member</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Creates a portal account with temporary credentials</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Priya Nair" required className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email Address *</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="faculty@institution.edu" required className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Department (optional)</label>
              <input value={dept} onChange={e => setDept(e.target.value)} placeholder="e.g. Computer Science" className={inputCls} />
            </div>

            {/* Temporary password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><KeyRound className="w-3 h-3" />Temporary Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input readOnly value={pwd} type={showPwd ? 'text' : 'password'}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm bg-muted border border-border font-mono focus:outline-none" />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button type="button" onClick={() => setPwd(genPassword())} className="p-2.5 rounded-lg border border-border hover:bg-accent transition-colors" title="Regenerate"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
                <button type="button" onClick={copyPwd} className="p-2.5 rounded-lg border border-border hover:bg-accent transition-colors" title="Copy">
                  {pwdCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-[10px] text-amber-500/80 flex items-center gap-1">⚠ Share this password securely. It won't be shown again.</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button type="submit"
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                <UserPlus className="w-4 h-4" /> Grant Access
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Row action menu ── */
function RowMenu({ account, onToggle, onRemove }: { account: PortalAccount; onToggle: () => void; onRemove: () => void; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
            <button onClick={() => { onToggle(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-accent/30 transition-colors text-left">
              {account.status === 'active'
                ? <><ShieldOff className="w-3.5 h-3.5 text-amber-400" /><span>Suspend access</span></>
                : <><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /><span>Restore access</span></>}
            </button>
            <button onClick={() => { onRemove(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-accent/30 transition-colors text-left text-red-400">
              <Trash2 className="w-3.5 h-3.5" /><span>Revoke &amp; delete</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main page ── */
export function AccessManagementPage() {
  const [tab, setTab] = useState<'faculty' | 'students'>('faculty');
  const [search, setSearch] = useState('');
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [accounts, setAccounts] = useState<PortalAccount[]>(() => accessStore.getAll());

  const reload = useCallback(() => setAccounts(accessStore.getAll()), []);

  function handleAdd(account: PortalAccount) {
    accessStore.add(account);
    reload();
    toast.success(`${account.name} has been granted faculty access.`, {
      description: `Temporary password created. Share securely.`,
    });
  }

  function handleToggle(id: string) {
    accessStore.toggleStatus(id);
    reload();
    const a = accounts.find(x => x.id === id);
    if (a) toast.success(a.status === 'active' ? `${a.name} suspended.` : `${a.name} restored.`);
  }

  function handleRemove(id: string) {
    const a = accounts.find(x => x.id === id);
    accessStore.remove(id);
    reload();
    if (a) toast.error(`${a.name}'s access has been revoked.`);
  }

  const q = search.toLowerCase();
  const faculty = accounts.filter(a => a.role === 'faculty' && (!q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.department ?? '').toLowerCase().includes(q)));
  const students = accounts.filter(a => a.role === 'student' && (!q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.group ?? '').toLowerCase().includes(q)));

  const activeList = tab === 'faculty' ? faculty : students;
  const activeCount = accounts.filter(a => a.role === tab.replace('students', 'student') as 'faculty' | 'student' && a.status === 'active').length;
  const suspendedCount = accounts.filter(a => a.role === tab.replace('students', 'student') as 'faculty' | 'student' && a.status === 'suspended').length;

  const thCls = 'px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground';
  const tdCls = 'px-5 py-4 text-sm';

  return (
    <div className="min-h-full bg-background">
      <AnimatePresence>
        {showAddFaculty && <AddFacultyModal onClose={() => setShowAddFaculty(false)} onAdd={handleAdd} />}
      </AnimatePresence>

      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Access Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Control who can access the Faculty and Student portals</p>
          </div>
          {tab === 'faculty' && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddFaculty(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <UserPlus className="w-4 h-4" /> Add Faculty
            </motion.button>
          )}
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Faculty Accounts', value: accounts.filter(a => a.role === 'faculty').length, color: '#3b82f6', Icon: Users },
            { label: 'Student Accounts', value: accounts.filter(a => a.role === 'student').length, color: '#10b981', Icon: GraduationCap },
            { label: 'Active',    value: accounts.filter(a => a.status === 'active').length,    color: '#10b981', Icon: ShieldCheck },
            { label: 'Suspended', value: accounts.filter(a => a.status === 'suspended').length, color: '#f87171', Icon: ShieldOff },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                <s.Icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 p-1 rounded-lg border border-border bg-card w-fit">
            <button onClick={() => setTab('faculty')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'faculty' ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:bg-accent/30'}`}>
              <Users className="w-3.5 h-3.5" /> Faculty
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: tab === 'faculty' ? 'rgba(255,255,255,0.2)' : 'var(--muted)' }}>{accounts.filter(a=>a.role==='faculty').length}</span>
            </button>
            <button onClick={() => setTab('students')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'students' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-accent/30'}`}>
              <GraduationCap className="w-3.5 h-3.5" /> Students
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: tab === 'students' ? 'rgba(255,255,255,0.2)' : 'var(--muted)' }}>{accounts.filter(a=>a.role==='student').length}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email…"
                className="pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-emerald-400 font-semibold">{activeCount}</span> active · <span className="text-red-400 font-semibold">{suspendedCount}</span> suspended
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'faculty' ? (
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                    <th className={thCls}>Member</th>
                    <th className={thCls}>Department</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Granted</th>
                    <th className={thCls}>Last Seen</th>
                    <th className={thCls} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {faculty.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="py-16 text-center text-sm text-muted-foreground">
                        {search ? 'No matching faculty accounts.' : 'No faculty accounts yet. Click "Add Faculty" to grant access.'}
                      </div>
                    </td></tr>
                  ) : faculty.map(a => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`transition-colors hover:bg-accent/10 ${a.status === 'suspended' ? 'opacity-60' : ''}`}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' }}>
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{a.name}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Mail className="w-3 h-3" />{a.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={tdCls}>
                        {a.department
                          ? <span className="flex items-center gap-1.5 text-xs"><Building2 className="w-3 h-3 text-blue-400" />{a.department}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className={tdCls}><StatusBadge status={a.status} /></td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />{formatRelativeTime(a.grantedAt)}
                        </div>
                      </td>
                      <td className={tdCls}>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(a.lastSeen)}</span>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <RowMenu account={a} onToggle={() => handleToggle(a.id)} onRemove={() => handleRemove(a.id)} />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                    <th className={thCls}>Student</th>
                    <th className={thCls}>Group</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Registered</th>
                    <th className={thCls}>Last Seen</th>
                    <th className={thCls} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="py-16 text-center text-sm text-muted-foreground">
                        {search ? 'No matching student accounts.' : 'No students have self-registered yet.'}
                      </div>
                    </td></tr>
                  ) : students.map(a => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`transition-colors hover:bg-accent/10 ${a.status === 'suspended' ? 'opacity-60' : ''}`}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{a.name}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Mail className="w-3 h-3" />{a.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={tdCls}>
                        {a.group
                          ? <span className="flex items-center gap-1.5 text-xs"><GraduationCap className="w-3 h-3 text-emerald-400" />{a.group}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className={tdCls}><StatusBadge status={a.status} /></td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />{formatRelativeTime(a.grantedAt)}
                        </div>
                      </td>
                      <td className={tdCls}>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(a.lastSeen)}</span>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <RowMenu account={a} onToggle={() => handleToggle(a.id)} onRemove={() => handleRemove(a.id)} />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {activeList.length} of {accounts.filter(a => a.role === (tab === 'faculty' ? 'faculty' : 'student')).length} accounts
            </span>
            {tab === 'students' && (
              <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" /> Students self-register via the Student portal
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
