import { motion } from 'motion/react';
import { ShieldAlert, RefreshCw, X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export interface SecurityFailureDetails {
  reason: string;
  verificationHash?: string;
}

interface SecurityFailureModalProps {
  details: SecurityFailureDetails;
  onClose: () => void;
  onRetry: () => void;
}

export function SecurityFailureModal({ details, onClose, onRetry }: SecurityFailureModalProps) {
  const [hashCopied, setHashCopied] = useState(false);

  function copyHash() {
    if (!details.verificationHash) return;
    navigator.clipboard.writeText(details.verificationHash);
    setHashCopied(true);
    setTimeout(() => setHashCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        className="w-full max-w-md rounded-xl border overflow-hidden"
        style={{ background: 'var(--card)', borderColor: 'rgba(239,68,68,0.5)' }}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-red-400">Schedule Integrity Check Failed</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Zero-Trust Audit · Critical</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            The ZeroTrust audit middleware detected a constraint violation or physical overlap.
            The schedule has been <span className="text-red-400 font-semibold">rejected and not persisted</span>.
          </p>

          <div className="rounded-lg p-3 text-xs font-mono leading-relaxed overflow-x-auto"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="text-[10px] font-bold uppercase text-red-400/70 mb-1.5 tracking-wider">Violation Reason</div>
            <span className="text-red-300">{details.reason || 'Unknown verification failure.'}</span>
          </div>

          {details.verificationHash && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider">Audit Hash (X-Verification-Secured)</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg text-[10px] font-mono text-muted-foreground truncate"
                  style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                  {details.verificationHash}
                </div>
                <button onClick={copyHash} className="p-2 rounded-lg border border-border hover:bg-accent transition-colors shrink-0" title="Copy hash">
                  {hashCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg p-3 text-xs space-y-1"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-[10px] font-bold uppercase text-amber-400/80 tracking-wider mb-1">What to do</div>
            <p className="text-muted-foreground">1. Review constraints for contradictions (unavailability + required sessions).</p>
            <p className="text-muted-foreground">2. Reduce simultaneous groups to lower solver complexity.</p>
            <p className="text-muted-foreground">3. Click <span className="text-foreground font-semibold">Retry Solve</span> — CP-SAT uses randomised search and may succeed next attempt.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
              Dismiss
            </button>
            <button onClick={() => { onClose(); onRetry(); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
              <RefreshCw className="w-4 h-4" />
              Retry Solve
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
