import { X, Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

export function WelcomeBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white p-6 rounded-lg mb-6 relative overflow-hidden">
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-2">Welcome to ChronoLink</h3>
          <p className="text-white/90 mb-4">
            Your real-time educational timetable orchestrator. Transform static schedules into dynamic, 
            live timetables with automated conflict resolution and optimization.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/workspace"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[var(--accent-blue)] rounded-lg hover:bg-white/90 transition-colors text-sm font-medium"
            >
              Create Timetable
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-sm font-medium"
            >
              Import Data
            </Link>
            <button
              onClick={() => setIsVisible(false)}
              className="px-4 py-2 text-sm font-medium hover:bg-white/10 rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


