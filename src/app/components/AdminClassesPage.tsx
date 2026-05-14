import { useState, useMemo, useEffect } from 'react';
import { Search, GraduationCap, Edit, Plus, Radio, Trash2, Pencil, X, Save } from 'lucide-react';
import { useWorkspaceStore, WORKSPACE_STORAGE_KEY } from '../hooks/useWorkspaceStore';
import { useNavigate } from 'react-router';
import { Group } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface GroupDialogProps {
  group?: Group;
  onClose: () => void;
  onSave: (g: Omit<Group, 'id' | 'isLive'>) => void;
}

function GroupDialog({ group, onClose, onSave }: GroupDialogProps) {
  const [form, setForm] = useState({
    name: group?.name ?? '',
    course: group?.course ?? '',
    semester: group?.semester ?? 1,
    studentsCount: group?.studentsCount ?? 30,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.course.trim()) {
      toast.error('Name and Course are required.');
      return;
    }
    onSave({
      name: form.name.trim(),
      course: form.course.trim(),
      semester: Number(form.semester),
      studentsCount: Number(form.studentsCount),
    });
  };

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{label}</label>
      {node}
    </div>
  );

  const input = (key: keyof typeof form, type = 'text', min?: string) => (
    <input
      type={type}
      min={min}
      value={String(form[key])}
      onChange={e => setForm(p => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
    />
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border overflow-hidden bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <GraduationCap className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">{group ? 'Edit Class' : 'Add New Class'}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {field('Class Name (e.g. CS-A)', input('name'))}
          {field('Course (e.g. Computer Science)', input('course'))}
          <div className="grid grid-cols-2 gap-5">
            {field('Semester', input('semester', 'number', '1'))}
            {field('Student Count', input('studentsCount', 'number', '1'))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted/50 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="px-6 py-2.5 text-sm font-bold text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
              <Save className="w-4 h-4" />
              {group ? 'Save Changes' : 'Create Class'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function AdminClassesPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { groups: workspaceGroups } = useWorkspaceStore();

  const [localAdded, setLocalAdded] = useState<Group[]>([]);
  const [localEdits, setLocalEdits] = useState<Map<string, Group>>(new Map());
  const [localDeleted, setLocalDeleted] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);

  // Sync edits to localStorage so they persist across tabs immediately for demo purposes
  useEffect(() => {
    if (localAdded.length === 0 && localEdits.size === 0 && localDeleted.size === 0) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      let parsed = raw ? JSON.parse(raw) : {};
      
      const existingGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
      
      const combined = [
        ...existingGroups.filter((g: Group) => !localDeleted.has(g.id)).map((g: Group) => localEdits.get(g.id) ?? g),
        ...localAdded.filter(g => !localDeleted.has(g.id))
      ];
      
      const updated = { ...parsed, groups: combined };
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(updated));
      
      // Fire custom event
      window.dispatchEvent(new Event('chronolink:import'));
      
      // Clear local overrides now that they are in the source of truth
      setLocalAdded([]);
      setLocalEdits(new Map());
      setLocalDeleted(new Set());
    } catch (e) {
      console.error("Failed to save class to workspace:", e);
    }
  }, [localAdded, localEdits, localDeleted]);

  const groups = [
    ...workspaceGroups
      .filter(g => !localDeleted.has(g.id))
      .map(g => localEdits.get(g.id) ?? g),
    ...localAdded.filter(g => !localDeleted.has(g.id)),
  ];

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const lower = search.toLowerCase();
    return groups.filter(g => 
      g.name.toLowerCase().includes(lower) || 
      g.course.toLowerCase().includes(lower) ||
      `sem ${g.semester}`.includes(lower)
    );
  }, [groups, search]);

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-blue-500" />
            Classes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all student groups, courses, and timetables.
          </p>
        </div>
        <button 
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          <Plus className="h-4 w-4" /> Add Class
        </button>
      </header>

      <AnimatePresence>
        {(addOpen || editGroup) && (
          <GroupDialog
            group={editGroup ?? undefined}
            onClose={() => { setAddOpen(false); setEditGroup(null); }}
            onSave={(data) => {
              if (editGroup) {
                setLocalEdits(prev => new Map(prev).set(editGroup.id, { ...data, id: editGroup.id, isLive: editGroup.isLive }));
                toast.success(`Class updated`);
                setEditGroup(null);
              } else {
                const id = `g-${Date.now()}`;
                setLocalAdded(prev => [...prev, { ...data, id, isLive: false }]);
                toast.success(`Class created`);
                setAddOpen(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 p-6 overflow-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search classes or courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Total Classes: <span className="font-medium text-foreground">{filteredGroups.length}</span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Class Name</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Full Course Name</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Semester</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Students</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide">Status</th>
                    <th className="px-4 py-3.5 font-semibold tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No classes found matching "{search}".
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map(group => (
                      <tr key={group.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3 font-medium text-foreground">{group.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{group.course}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-accent/50 text-xs font-medium text-muted-foreground border border-border">
                            Sem {group.semester}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {group.studentsCount} <span className="text-[10px] uppercase tracking-wider">stds</span>
                        </td>
                        <td className="px-4 py-3">
                          {group.isLive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20 shadow-sm">
                              <Radio className="w-3 h-3 animate-pulse" /> Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium border border-border">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditGroup(group)}
                              className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                              title="Edit Class Details"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setLocalDeleted(prev => new Set(prev).add(group.id));
                                toast.success(`Class removed`);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete Class"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <div className="w-px h-4 bg-border mx-1"></div>
                            <button
                              onClick={() => navigate(`/workspace/${group.id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-500 bg-blue-500/5 hover:bg-blue-500 hover:text-white border border-blue-500/20 rounded transition-all"
                            >
                              <Edit className="h-3.5 w-3.5" /> Edit Timetable
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
