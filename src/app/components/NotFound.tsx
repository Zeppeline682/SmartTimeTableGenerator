import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Home, LayoutDashboard } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6" style={{ background: 'var(--surface-0)' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {/* Glowing 404 */}
        <div className="relative mb-8 select-none">
          <div
            className="text-[120px] font-black leading-none tracking-tighter"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 20%, #8b5cf6 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 40px rgba(139,92,246,0.35))',
            }}
          >
            404
          </div>
          {/* subtle grid behind */}
          <div
            className="absolute inset-0 -z-10 rounded-3xl opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          The route you're looking for doesn't exist in ChronoLink.<br />
          It may have moved, or the URL might be incorrect.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-border hover:bg-accent/30 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-border hover:bg-accent/30 transition-colors text-sm"
          >
            <Home className="w-4 h-4" />
            Landing page
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2.5 rounded-md text-white text-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        {/* Brand mark */}
        <div className="mt-12 flex items-center justify-center gap-2 opacity-30">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            CL
          </div>
          <span className="text-xs text-muted-foreground">ChronoLink</span>
        </div>
      </motion.div>
    </div>
  );
}



