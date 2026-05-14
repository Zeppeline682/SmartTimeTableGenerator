import { useEffect, useState, useMemo } from 'react';
import { Search, Users, DoorOpen, BookOpen, GraduationCap, RefreshCw, Loader2, Tag, Building2 } from 'lucide-react';
import { mockFaculty, mockRooms, mockGroups as mockStudentGroups, mockSubjects } from '../mockData';
import { motion } from 'motion/react';

function getApiBaseUrl() {
  const env = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return env ? env.replace(/\/$/, '') : 'http://localhost:8000';
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

interface Teacher { id: string; name: string; code: string; department_tag?: string; tags?: string[]; created_at?: string; }
interface Room { id: string; name: string; code: string; capacity: number; building_tag?: string; tags?: string[]; }
interface StudentGroup { id: string; name: string; code: string; size: number; tags?: string[]; }
interface Subject { id: string; name: string; code: string; tags?: string[]; }

type TabKey = 'teachers' | 'rooms' | 'groups' | 'subjects';

const TAB_META: Record<TabKey, { label: string; Icon: typeof Users; color: string; countLabel: string }> = {
  teachers: { label: 'Teachers',       Icon: Users,         color: '#3b82f6', countLabel: 'teachers' },
  rooms:    { label: 'Rooms',          Icon: DoorOpen,      color: '#8b5cf6', countLabel: 'rooms' },
  groups:   { label: 'Student Groups', Icon: GraduationCap, color: '#10b981', countLabel: 'groups' },
  subjects: { label: 'Subjects',       Icon: BookOpen,      color: '#f59e0b', countLabel: 'subjects' },
};

function TagPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
      <Tag className="w-2.5 h-2.5" />{label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">No {label} found.</div>
  );
}

export function AdminDirectory() {
  const [tab, setTab] = useState<TabKey>('teachers');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  async function loadAll() {
    setLoading(true); setError(null);
    const base = getApiBaseUrl();
    try {
      const [t, r, g, s] = await Promise.all([
        fetchJson<Teacher[]>(`${base}/teachers`),
        fetchJson<Room[]>(`${base}/rooms`),
        fetchJson<StudentGroup[]>(`${base}/student-groups`),
        fetchJson<Subject[]>(`${base}/subjects`),
      ]);
      setTeachers(t); setRooms(r); setGroups(g); setSubjects(s);
    } catch (e) {
      console.warn("API failed, falling back to mock data:", e);
      // Fallback to mock data
      setTeachers(mockFaculty.map(f => ({ 
        id: f.id, name: f.name, code: f.name.slice(0, 3).toUpperCase(), department_tag: f.department, tags: f.tags 
      })));
      setRooms(mockRooms.map(r => ({ 
        id: r.id, name: r.name, code: r.roomId, capacity: r.capacity, building_tag: r.building_tag, tags: r.equipment 
      })));
      setGroups(mockStudentGroups.map(g => ({ 
        id: g.id, name: g.name, code: g.id, size: g.studentsCount, tags: [g.course, `Sem ${g.semester}`] 
      })));
      setSubjects(mockSubjects.map(s => ({ 
        id: s.id, name: s.name, code: s.id.slice(0, 4).toUpperCase(), tags: [] 
      })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  // Derive all tags for current tab
  const allTags = useMemo(() => {
    const set = new Set<string>();
    if (tab === 'teachers') teachers.forEach(t => { if (t.department_tag) set.add(t.department_tag); t.tags?.forEach(x => set.add(x)); });
    if (tab === 'rooms') rooms.forEach(r => { if (r.building_tag) set.add(r.building_tag); r.tags?.forEach(x => set.add(x)); });
    if (tab === 'groups') groups.forEach(g => g.tags?.forEach(x => set.add(x)));
    if (tab === 'subjects') subjects.forEach(s => s.tags?.forEach(x => set.add(x)));
    return Array.from(set).sort();
  }, [tab, teachers, rooms, groups, subjects]);

  const q = search.toLowerCase();

  const filteredTeachers = useMemo(() => teachers.filter(t => {
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || (t.department_tag ?? '').toLowerCase().includes(q);
    const matchTag = !tagFilter || t.department_tag === tagFilter || t.tags?.includes(tagFilter);
    return matchSearch && matchTag;
  }), [teachers, q, tagFilter]);

  const filteredRooms = useMemo(() => rooms.filter(r => {
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || (r.building_tag ?? '').toLowerCase().includes(q);
    const matchTag = !tagFilter || r.building_tag === tagFilter || r.tags?.includes(tagFilter);
    return matchSearch && matchTag;
  }), [rooms, q, tagFilter]);

  const filteredGroups = useMemo(() => groups.filter(g => {
    const matchSearch = !q || g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
    const matchTag = !tagFilter || g.tags?.includes(tagFilter);
    return matchSearch && matchTag;
  }), [groups, q, tagFilter]);

  const filteredSubjects = useMemo(() => subjects.filter(s => {
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    const matchTag = !tagFilter || s.tags?.includes(tagFilter);
    return matchSearch && matchTag;
  }), [subjects, q, tagFilter]);

  const counts = { teachers: teachers.length, rooms: rooms.length, groups: groups.length, subjects: subjects.length };

  const thClass = 'px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground';
  const tdClass = 'px-5 py-3.5 text-sm';

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Admin Directory</h1>
            <p className="text-sm text-muted-foreground mt-1">Global view of all registered entities</p>
          </div>
          <button onClick={loadAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent/30 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(TAB_META) as [TabKey, typeof TAB_META[TabKey]][]).map(([key, meta]) => (
            <motion.button key={key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setTab(key); setSearch(''); setTagFilter(''); }}
              className={`rounded-lg border p-4 text-left transition-all ${tab === key ? 'ring-2' : 'hover:border-border'}`}
              style={tab === key ? { borderColor: meta.color, outline: `2px solid ${meta.color}40`, background: `${meta.color}10` } : { background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
                  <meta.Icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{counts[key]}</div>
                  <div className="text-xs text-muted-foreground">{meta.label}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code…"
              className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
              className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="">All tags</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          )}
          {(search || tagFilter) && (
            <button onClick={() => { setSearch(''); setTagFilter(''); }}
              className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-accent/30 transition-colors">
              Clear filters
            </button>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 rounded-lg border border-border bg-card w-fit">
          {(Object.entries(TAB_META) as [TabKey, typeof TAB_META[TabKey]][]).map(([key, meta]) => (
            <button key={key} onClick={() => { setTab(key); setTagFilter(''); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === key ? 'text-white' : 'text-muted-foreground hover:bg-accent/30'}`}
              style={tab === key ? { background: meta.color } : {}}>
              <meta.Icon className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {tab === 'teachers' && (
                <table className="w-full min-w-[600px]">
                  <thead><tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                    <th className={thClass}>Name</th><th className={thClass}>Code</th>
                    <th className={thClass}>Department Tag</th><th className={thClass}>Tags</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredTeachers.length === 0 ? <tr><td colSpan={4}><EmptyState label="teachers" /></td></tr>
                    : filteredTeachers.map(t => (
                      <tr key={t.id} className="hover:bg-accent/10 transition-colors">
                        <td className={tdClass}><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground font-mono">{t.id.slice(0,8)}</div></td>
                        <td className={`${tdClass} font-mono text-xs text-muted-foreground`}>{t.code}</td>
                        <td className={tdClass}>{t.department_tag ? <TagPill label={t.department_tag} /> : <span className="text-muted-foreground/40">—</span>}</td>
                        <td className={`${tdClass} flex flex-wrap gap-1`}>{t.tags?.map(tag => <TagPill key={tag} label={tag} />) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'rooms' && (
                <table className="w-full min-w-[600px]">
                  <thead><tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                    <th className={thClass}>Name</th><th className={thClass}>Code</th>
                    <th className={thClass}>Capacity</th><th className={thClass}>Building Tag</th><th className={thClass}>Tags</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredRooms.length === 0 ? <tr><td colSpan={5}><EmptyState label="rooms" /></td></tr>
                    : filteredRooms.map(r => (
                      <tr key={r.id} className="hover:bg-accent/10 transition-colors">
                        <td className={tdClass}><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.id.slice(0,8)}</div></td>
                        <td className={`${tdClass} font-mono text-xs text-muted-foreground`}>{r.code}</td>
                        <td className={tdClass}><div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-muted-foreground" />{r.capacity}</div></td>
                        <td className={tdClass}>{r.building_tag ? <span className="flex items-center gap-1 text-xs"><Building2 className="w-3 h-3 text-purple-400" /><TagPill label={r.building_tag} /></span> : <span className="text-muted-foreground/40">—</span>}</td>
                        <td className={`${tdClass} flex flex-wrap gap-1`}>{r.tags?.map(tag => <TagPill key={tag} label={tag} />) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'groups' && (
                <table className="w-full min-w-[500px]">
                  <thead><tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                    <th className={thClass}>Name</th><th className={thClass}>Code</th>
                    <th className={thClass}>Size</th><th className={thClass}>Tags</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredGroups.length === 0 ? <tr><td colSpan={4}><EmptyState label="student groups" /></td></tr>
                    : filteredGroups.map(g => (
                      <tr key={g.id} className="hover:bg-accent/10 transition-colors">
                        <td className={tdClass}><div className="font-medium">{g.name}</div><div className="text-xs text-muted-foreground font-mono">{g.id.slice(0,8)}</div></td>
                        <td className={`${tdClass} font-mono text-xs text-muted-foreground`}>{g.code}</td>
                        <td className={tdClass}><div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-500" />{g.size}</div></td>
                        <td className={`${tdClass} flex flex-wrap gap-1`}>{g.tags?.map(tag => <TagPill key={tag} label={tag} />) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'subjects' && (
                <table className="w-full min-w-[500px]">
                  <thead><tr style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                    <th className={thClass}>Name</th><th className={thClass}>Code</th><th className={thClass}>Tags</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredSubjects.length === 0 ? <tr><td colSpan={3}><EmptyState label="subjects" /></td></tr>
                    : filteredSubjects.map(s => (
                      <tr key={s.id} className="hover:bg-accent/10 transition-colors">
                        <td className={tdClass}><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground font-mono">{s.id.slice(0,8)}</div></td>
                        <td className={`${tdClass} font-mono text-xs text-muted-foreground`}>{s.code}</td>
                        <td className={`${tdClass} flex flex-wrap gap-1`}>{s.tags?.map(tag => <TagPill key={tag} label={tag} />) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {tab === 'teachers' && `${filteredTeachers.length} of ${teachers.length} teachers`}
              {tab === 'rooms' && `${filteredRooms.length} of ${rooms.length} rooms`}
              {tab === 'groups' && `${filteredGroups.length} of ${groups.length} groups`}
              {tab === 'subjects' && `${filteredSubjects.length} of ${subjects.length} subjects`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
