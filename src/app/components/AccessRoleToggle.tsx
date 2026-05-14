import { useState, useEffect } from "react";
import { APP_ROLES, getRoleLabel } from "../auth/session";
import { useSession } from "../auth/SessionContext";
import { motion, AnimatePresence } from "motion/react";
import { GripHorizontal, X } from "lucide-react";

export function AccessRoleToggle() {
  const { user, setRole } = useSession();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with Cmd+Shift+D (Mac) or Ctrl+Shift+D (Windows)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!user.tags?.includes("developer")) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed top-4 left-[280px] z-50 p-1.5 rounded-md shadow-2xl flex flex-col gap-1 cursor-grab active:cursor-grabbing"
          style={{ background: "var(--surface-3)", border: "1px solid var(--surface-border)", backdropFilter: "blur(6px)" }}
        >
          <div className="flex items-center justify-between px-1.5 pb-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <GripHorizontal className="w-3 h-3" />
              Dev Access
            </div>
            <button 
              onClick={() => setIsVisible(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Hide toggle (Cmd+Shift+D)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            {APP_ROLES.map((role) => {
              const active = user.role === role;
              return (
                <button
                  key={role}
                  onPointerDownCapture={(e) => e.stopPropagation()} // Prevent drag when clicking buttons
                  onClick={() => setRole(role)}
                  className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: active ? "rgba(59,130,246,0.15)" : "transparent",
                    color: active ? "#3b82f6" : "var(--muted-foreground)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.28)" : "transparent"}`,
                  }}
                  title={`Switch access to ${getRoleLabel(role)}`}
                >
                  {getRoleLabel(role)}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


