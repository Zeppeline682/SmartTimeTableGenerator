import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { APP_ROLES, DEFAULT_SESSION_USER, ROLE_DEFAULT_USER_NAME, type AppRole, type SessionUser } from "./session";

const SESSION_STORAGE_KEY = "chronolink.current-session";

interface SessionContextValue {
  user: SessionUser;
  setUser: (user: SessionUser) => void;
  setRole: (role: AppRole) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

function readStoredSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed.id || !parsed.name || !isAppRole(parsed.role)) return null;

    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email || "",
      role: parsed.role,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>(() => {
    return readStoredSession() ?? DEFAULT_SESSION_USER;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    }
  }, [user]);

  const value = useMemo<SessionContextValue>(() => ({
    user,
    setUser,
    setRole: (role: AppRole) => {
      setUser((previous) => {
        if (previous.role === role) return previous;
        return {
          ...previous,
          id: `${role}-001`,
          name: (role === 'developer' || role === 'faculty') && previous.email === '12345@gmail.com' ? 'Jash Parekh' : ROLE_DEFAULT_USER_NAME[role],
          email: previous.email || (role === 'developer' ? '12345@gmail.com' : `${role}@institution.edu`),
          role,
        };
      });
    },
  }), [user]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}