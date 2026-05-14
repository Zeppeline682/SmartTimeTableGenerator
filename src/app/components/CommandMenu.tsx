import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { canAccessChannel, type AppChannel, type AppRole } from '../auth/session';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Zap, 
  Database,
  Search,
  X,
  DoorOpen,
  Settings,
  GraduationCap,
  Radio,
} from 'lucide-react';

interface CommandMenuProps {
  role: AppRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const commands = [
  { id: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard',           path: '/dashboard',    keywords: 'home overview admin', channel: 'admin'   as AppChannel },
  { id: 'workspace',    icon: Calendar,        label: 'Timetable Workspace', path: '/workspace',    keywords: 'edit create schedule', channel: 'admin'   as AppChannel },
  { id: 'optimize',     icon: Zap,             label: 'Optimization',        path: '/optimize',     keywords: 'score burnout heatmap analysis', channel: 'admin'   as AppChannel },
  { id: 'integrations', icon: Database,        label: 'Integrations',        path: '/integrations', keywords: 'import export drive excel json', channel: 'admin'   as AppChannel },
  { id: 'rooms',        icon: DoorOpen,        label: 'Room Management',     path: '/rooms',        keywords: 'classroom lab lecture hall capacity', channel: 'admin'   as AppChannel },
  { id: 'settings',     icon: Settings,        label: 'Settings',            path: '/settings',     keywords: 'config institution semester notifications', channel: 'admin'   as AppChannel },
  { id: 'faculty',      icon: Users,           label: 'Faculty Portal',      path: '/faculty',      keywords: 'teachers professors preferences', channel: 'faculty' as AppChannel },
  { id: 'student',      icon: GraduationCap,   label: 'Student Portal',      path: '/student',      keywords: 'students timetable announcements', channel: 'student' as AppChannel },
  { id: 'live',         icon: Radio,           label: 'Live View (cs-a)',    path: '/live/cs-a-2024', keywords: 'live public share link', channel: 'admin' as AppChannel },
];

export function CommandMenu({ role, open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const visibleCommands = commands.filter((cmd) => canAccessChannel(role, cmd.channel));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const handleSelect = (path: string) => {
    navigate(path);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
          <Command className="bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search commands..."
                className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => onOpenChange(false)}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <Command.List className="max-h-[300px] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
              <Command.Group heading="Navigation">
                {visibleCommands.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords}`}
                    onSelect={() => handleSelect(cmd.path)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-accent transition-colors"
                  >
                    <cmd.icon className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1">{cmd.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
              <kbd className="px-2 py-1 bg-background rounded border border-border">⌘K</kbd> to open
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

