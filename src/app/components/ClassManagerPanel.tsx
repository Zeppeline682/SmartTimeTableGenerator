import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Plus, Save, X, Calendar, Clock, MapPin, User, Tag, BookOpen, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Data Model specified by the user
export interface ClassData {
  id: string;
  semesterId: string;
  name: string;
  subjectCode: string;
  faculty: string;
  room: string;
  days: string[];
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxStudents: number;
  status: "draft" | "live";
}

// Mock initial data
const mockClasses: ClassData[] = [
  { id: 'c1', semesterId: 'sem-1', name: 'Intro to Computer Science', subjectCode: 'CS101', faculty: 'Dr. Alan Turing', room: 'Lab A', days: ['Mon', 'Wed'], startTime: '10:00', endTime: '11:00', slotDuration: 60, maxStudents: 40, status: 'live' },
  { id: 'c2', semesterId: 'sem-1', name: 'Calculus I', subjectCode: 'MATH101', faculty: 'Prof. Isaac Newton', room: 'Lecture Hall 1', days: ['Tue', 'Thu'], startTime: '09:00', endTime: '10:30', slotDuration: 90, maxStudents: 150, status: 'draft' },
  { id: 'c3', semesterId: 'sem-2', name: 'Data Structures', subjectCode: 'CS201', faculty: 'Dr. Ada Lovelace', room: 'Lab B', days: ['Mon', 'Wed', 'Fri'], startTime: '11:00', endTime: '12:00', slotDuration: 60, maxStudents: 35, status: 'live' },
  { id: 'c4', semesterId: 'sem-2', name: 'Linear Algebra', subjectCode: 'MATH201', faculty: 'Prof. Carl Gauss', room: 'Room 204', days: ['Tue', 'Thu'], startTime: '14:00', endTime: '15:30', slotDuration: 90, maxStudents: 60, status: 'draft' },
];

const SEMESTERS = [
  { id: 'sem-1', name: 'Semester 1' },
  { id: 'sem-2', name: 'Semester 2' },
  { id: 'sem-3', name: 'Semester 3' },
];

const FACULTY_LIST = ['Dr. Alan Turing', 'Prof. Isaac Newton', 'Dr. Ada Lovelace', 'Prof. Carl Gauss', 'Dr. Grace Hopper'];
const ROOM_LIST = ['Lab A', 'Lab B', 'Lecture Hall 1', 'Room 204', 'Room 305', 'Workshop 1'];
const DAYS_LIST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ClassManagerPanel() {
  const [classes, setClasses] = useState<ClassData[]>(mockClasses);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for collapsible semesters
  const [collapsedSemesters, setCollapsedSemesters] = useState<Set<string>>(new Set());
  
  // State for accordion: only one row expanded at a time.
  // Can be a class id, or "new-{semesterId}" for the add form.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // State for the currently edited class (or new class)
  const [editForm, setEditForm] = useState<Partial<ClassData> | null>(null);

  const toggleSemester = (semId: string) => {
    setCollapsedSemesters(prev => {
      const next = new Set(prev);
      if (next.has(semId)) next.delete(semId);
      else next.add(semId);
      return next;
    });
  };

  const handleExpandRow = (cls: ClassData) => {
    if (expandedId === cls.id) {
      setExpandedId(null);
      setEditForm(null);
    } else {
      setExpandedId(cls.id);
      setEditForm({ ...cls });
    }
  };

  const handleExpandNew = (semesterId: string) => {
    const newId = `new-${semesterId}`;
    if (expandedId === newId) {
      setExpandedId(null);
      setEditForm(null);
    } else {
      setExpandedId(newId);
      setEditForm({
        semesterId,
        name: '',
        subjectCode: '',
        faculty: '',
        room: '',
        days: [],
        startTime: '09:00',
        endTime: '10:00',
        slotDuration: 60,
        maxStudents: 30,
        status: 'draft',
      });
    }
  };

  const handleSave = () => {
    if (!editForm) return;
    
    // Basic validation
    if (!editForm.name || !editForm.subjectCode) {
      alert("Name and Subject Code are required.");
      return;
    }

    if (expandedId?.startsWith('new-')) {
      const newClass: ClassData = {
        ...(editForm as ClassData),
        id: `c-${Date.now()}`
      };
      setClasses(prev => [...prev, newClass]);
    } else {
      setClasses(prev => prev.map(c => c.id === editForm.id ? { ...c, ...editForm } as ClassData : c));
    }
    setExpandedId(null);
    setEditForm(null);
  };

  // Filter classes based on search query
  const filteredClasses = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return classes.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.subjectCode.toLowerCase().includes(q) ||
      c.faculty.toLowerCase().includes(q) ||
      c.room.toLowerCase().includes(q)
    );
  }, [classes, searchQuery]);

  // Group classes by semester
  const groupedClasses = useMemo(() => {
    const groups: Record<string, ClassData[]> = {};
    SEMESTERS.forEach(s => groups[s.id] = []);
    filteredClasses.forEach(c => {
      if (groups[c.semesterId]) {
        groups[c.semesterId].push(c);
      }
    });
    return groups;
  }, [filteredClasses]);

  const handleFormChange = (field: keyof ClassData, value: any) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleDayToggle = (day: string) => {
    setEditForm(prev => {
      if (!prev) return null;
      const days = prev.days || [];
      const nextDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
      return { ...prev, days: nextDays };
    });
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden">
      {/* Header & Search */}
      <div className="px-5 py-4 border-b border-border bg-card z-10 flex flex-col gap-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Class Manager</h2>
            <p className="text-xs text-muted-foreground mt-1">Manage all classes, faculties, and room assignments</p>
          </div>
          <button 
            onClick={() => {
              setCollapsedSemesters(prev => {
                const next = new Set(prev);
                next.delete(SEMESTERS[0].id);
                return next;
              });
              handleExpandNew(SEMESTERS[0].id);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Class
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by class name, subject code, faculty, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
          />
        </div>
      </div>

      {/* Class List by Semester */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {SEMESTERS.map(semester => {
          const semesterClasses = groupedClasses[semester.id] || [];
          const isCollapsed = collapsedSemesters.has(semester.id);
          const hasNewFormOpen = expandedId === `new-${semester.id}`;

          // Hide semester if searching and it has no matches (and we aren't adding a new one)
          if (searchQuery && semesterClasses.length === 0 && !hasNewFormOpen) {
            return null;
          }

          return (
            <div key={semester.id} className="space-y-2">
              {/* Semester Header */}
              <button 
                onClick={() => toggleSemester(semester.id)}
                className="w-full flex items-center justify-between py-2 px-3 bg-muted/40 hover:bg-muted/60 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm">{semester.name}</span>
                </div>
                <div className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-background rounded-full border border-border">
                  {semesterClasses.length} {semesterClasses.length === 1 ? 'class' : 'classes'}
                </div>
              </button>

              {/* Semester Content */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2 pl-3 border-l-2 border-border/50 ml-3"
                  >
                    {semesterClasses.map(cls => {
                      const isExpanded = expandedId === cls.id;

                      return (
                        <div key={cls.id} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm transition-all">
                          {/* Row Summary */}
                          <button 
                            onClick={() => handleExpandRow(cls)}
                            className="w-full flex items-center px-4 py-3 hover:bg-accent/30 transition-colors text-left"
                          >
                            <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                              {/* Title & Subject */}
                              <div className="col-span-4 flex flex-col">
                                <span className="font-semibold text-sm truncate flex items-center gap-2">
                                  {cls.status === 'live' ? <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> : <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                                  {cls.name}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><BookOpen className="h-3 w-3" /> {cls.subjectCode}</span>
                              </div>
                              
                              {/* Faculty & Room */}
                              <div className="col-span-4 flex flex-col gap-1">
                                <span className="text-xs flex items-center gap-1.5 truncate"><User className="h-3 w-3 text-muted-foreground" /> {cls.faculty || 'Unassigned'}</span>
                                <span className="text-xs flex items-center gap-1.5 truncate text-muted-foreground"><MapPin className="h-3 w-3" /> {cls.room || 'TBD'}</span>
                              </div>

                              {/* Schedule Summary */}
                              <div className="col-span-4 flex flex-col items-end text-right">
                                <span className="text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> {cls.days.length > 0 ? cls.days.join(', ') : 'No days'}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" /> {cls.startTime}–{cls.endTime}
                                </span>
                              </div>
                            </div>
                          </button>

                          {/* Expanded Detail Panel */}
                          <AnimatePresence>
                            {isExpanded && editForm && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden border-t border-border bg-muted/10"
                              >
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Class Name</label>
                                      <input type="text" value={editForm.name} onChange={e => handleFormChange('name', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Subject Code</label>
                                      <input type="text" value={editForm.subjectCode} onChange={e => handleFormChange('subjectCode', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm font-mono focus:outline-none focus:border-blue-500" />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Faculty</label>
                                      <select value={editForm.faculty} onChange={e => handleFormChange('faculty', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500">
                                        <option value="">Select Faculty...</option>
                                        {FACULTY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                                      </select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Room</label>
                                      <select value={editForm.room} onChange={e => handleFormChange('room', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500">
                                        <option value="">Select Room...</option>
                                        {ROOM_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Operating Days</label>
                                    <div className="flex gap-2">
                                      {DAYS_LIST.map(day => {
                                        const isSelected = editForm.days?.includes(day);
                                        return (
                                          <button
                                            key={day}
                                            onClick={() => handleDayToggle(day)}
                                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border ${isSelected ? 'bg-blue-500 border-blue-500 text-white shadow-sm' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                                          >
                                            {day}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Start Time</label>
                                      <input type="time" value={editForm.startTime} onChange={e => handleFormChange('startTime', e.target.value)} className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">End Time</label>
                                      <input type="time" value={editForm.endTime} onChange={e => handleFormChange('endTime', e.target.value)} className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Duration (m)</label>
                                      <input type="number" step="15" value={editForm.slotDuration} onChange={e => handleFormChange('slotDuration', parseInt(e.target.value))} className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Max Students</label>
                                      <div className="relative">
                                        <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <input type="number" value={editForm.maxStudents} onChange={e => handleFormChange('maxStudents', parseInt(e.target.value))} className="w-full pl-8 pr-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-3 border-t border-border flex justify-end gap-3">
                                    <div className="flex items-center gap-2 mr-auto">
                                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Status</label>
                                      <select value={editForm.status} onChange={e => handleFormChange('status', e.target.value)} className="px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none">
                                        <option value="draft">Draft</option>
                                        <option value="live">Live</option>
                                      </select>
                                    </div>
                                    <button onClick={() => setExpandedId(null)} className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted border border-transparent hover:border-border transition-colors">
                                      Cancel
                                    </button>
                                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-sm">
                                      <Save className="h-4 w-4" /> Save changes
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}

                    {/* Add Class Button or Form */}
                    {!hasNewFormOpen ? (
                      <button 
                        onClick={() => handleExpandNew(semester.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 border border-dashed border-border/70 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 hover:border-border transition-all"
                      >
                        <Plus className="h-4 w-4" /> Add class to {semester.name}
                      </button>
                    ) : (
                      <div className="bg-card border-2 border-blue-500/50 rounded-lg overflow-hidden shadow-md mt-2">
                        <div className="bg-blue-500/10 px-4 py-2 border-b border-blue-500/20">
                          <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">Add New Class</h3>
                        </div>
                        {editForm && (
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Class Name</label>
                                <input type="text" placeholder="e.g. Intro to CS" value={editForm.name} onChange={e => handleFormChange('name', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Subject Code</label>
                                <input type="text" placeholder="e.g. CS101" value={editForm.subjectCode} onChange={e => handleFormChange('subjectCode', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm font-mono focus:outline-none focus:border-blue-500" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Faculty</label>
                                <select value={editForm.faculty} onChange={e => handleFormChange('faculty', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500">
                                  <option value="">Select Faculty...</option>
                                  {FACULTY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Room</label>
                                <select value={editForm.room} onChange={e => handleFormChange('room', e.target.value)} className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500">
                                  <option value="">Select Room...</option>
                                  {ROOM_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Operating Days</label>
                              <div className="flex gap-2">
                                {DAYS_LIST.map(day => {
                                  const isSelected = editForm.days?.includes(day);
                                  return (
                                    <button
                                      key={day}
                                      onClick={() => handleDayToggle(day)}
                                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border ${isSelected ? 'bg-blue-500 border-blue-500 text-white shadow-sm' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Start Time</label>
                                <input type="time" value={editForm.startTime} onChange={e => handleFormChange('startTime', e.target.value)} className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">End Time</label>
                                <input type="time" value={editForm.endTime} onChange={e => handleFormChange('endTime', e.target.value)} className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Duration (m)</label>
                                <input type="number" step="15" value={editForm.slotDuration} onChange={e => handleFormChange('slotDuration', parseInt(e.target.value))} className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Max Students</label>
                                <div className="relative">
                                  <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                  <input type="number" value={editForm.maxStudents} onChange={e => handleFormChange('maxStudents', parseInt(e.target.value))} className="w-full pl-8 pr-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-blue-500" />
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                              <div className="flex items-center gap-2 mr-auto">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Status</label>
                                <select value={editForm.status} onChange={e => handleFormChange('status', e.target.value)} className="px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none">
                                  <option value="draft">Draft</option>
                                  <option value="live">Live</option>
                                </select>
                              </div>
                              <button onClick={() => setExpandedId(null)} className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted border border-transparent hover:border-border transition-colors">
                                Cancel
                              </button>
                              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-sm">
                                <Save className="h-4 w-4" /> Save Class
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
