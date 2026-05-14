import * as Dialog from '@radix-ui/react-dialog';
import { Keyboard, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const shortcuts = [
  { keys: ['⌘', 'K'], description: 'Open command menu' },
  { keys: ['⌘', 'S'], description: 'Save current timetable' },
  { keys: ['⌘', 'E'], description: 'Export timetable' },
  { keys: ['⌘', 'I'], description: 'Import data' },
  { keys: ['⌘', '/'], description: 'Show keyboard shortcuts' },
  { keys: ['ESC'], description: 'Close dialog/menu' },
  { keys: ['→', '←'], description: 'Navigate between days' },
  { keys: ['↑', '↓'], description: 'Navigate between time slots' },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="fixed bottom-6 right-6 p-4 bg-card border border-border rounded-full shadow-lg hover:bg-accent transition-all z-40 group">
          <Keyboard className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border border-border rounded-lg shadow-2xl z-50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
                <Keyboard className="w-5 h-5" style={{ color: 'var(--accent-blue)' }} />
              </div>
              <Dialog.Title className="text-xl font-semibold">
                Keyboard Shortcuts
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-accent/30 transition-colors"
              >
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <kbd
                      key={i}
                      className="px-2 py-1 text-xs bg-background border border-border rounded font-mono min-w-[28px] text-center"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Press <kbd className="px-2 py-1 text-xs bg-background border border-border rounded">⌘ /</kbd> to
              toggle this dialog at any time.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


