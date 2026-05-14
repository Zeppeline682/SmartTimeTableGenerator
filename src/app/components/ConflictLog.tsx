import { useEffect, useRef } from 'react';
import { AlertTriangle, Info, XCircle, Lightbulb } from 'lucide-react';
import { Conflict } from '../types';

interface ConflictLogProps {
  conflicts: Conflict[];
}

export function ConflictLog({ conflicts }: ConflictLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [conflicts]);

  const getIcon = (severity: Conflict['severity']) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'info':
        return <Info className="w-4 h-4" />;
    }
  };

  const getColor = (severity: Conflict['severity']) => {
    switch (severity) {
      case 'error':
        return 'var(--status-red)';
      case 'warning':
        return 'var(--status-orange)';
      case 'info':
        return 'var(--accent-blue)';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Conflict Log</h3>
          <button className="text-xs text-muted-foreground hover:text-foreground">
            Clear All
          </button>
        </div>
      </div>

      <div
        ref={logRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs"
        style={{ backgroundColor: 'var(--background)' }}
      >
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="border border-border rounded p-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div style={{ color: getColor(conflict.severity) }}>
                {getIcon(conflict.severity)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-medium"
                    style={{ color: getColor(conflict.severity) }}
                  >
                    [{conflict.severity.toUpperCase()}]
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {conflict.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-foreground break-words">{conflict.message}</p>
                {conflict.suggestion && (
                  <div className="mt-2 flex items-start gap-2 p-2 rounded bg-accent/50">
                    <Lightbulb className="w-3 h-3 mt-0.5" style={{ color: 'var(--status-green)' }} />
                    <p className="text-xs text-muted-foreground">{conflict.suggestion}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {conflicts.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No conflicts detected</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <button className="w-full px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm">
          Auto-Resolve Conflicts
        </button>
      </div>
    </div>
  );
}


