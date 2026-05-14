import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, Eye, EyeOff, Calendar, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { useSession } from "../auth/SessionContext";
interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

interface MockAuthUser {
  name: string;
  email: string;
  password: string;
  role: "admin" | "faculty" | "student" | "developer";
}

const DEFAULT_MOCK_USERS: MockAuthUser[] = [
  {
    name: "Jash",
    email: "12345@gmail.com",
    password: "12345",
    role: "developer",
  },
  {
    name: "Faculty User",
    email: "faculty@example.com",
    password: "password",
    role: "faculty",
  },
  {
    name: "Student User",
    email: "student@example.com",
    password: "password",
    role: "student",
  }
];

export function AuthModal({ open, onClose, defaultTab = "login" }: AuthModalProps) {
  const { setUser, setRole } = useSession();
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mockUsers, setMockUsers] = useState<MockAuthUser[]>(DEFAULT_MOCK_USERS);
  const [loggedInRole, setLoggedInRole] = useState<"admin" | "faculty" | "student" | "developer">("admin");
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setDone(false);
      setLoading(false);
      setFormError(null);
    }
  }, [open, defaultTab]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (tab === "login") {
      const match = mockUsers.find((user) => user.email === email && user.password === password);
      if (!match) {
        setFormError("Invalid email or password.");
        return;
      }
      setLoggedInRole(match.role);
    }

    if (tab === "register") {
      if (!fullName) {
        setFormError("Full name is required.");
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }
      const emailExists = mockUsers.some((user) => user.email === email);
      if (emailExists) {
        setFormError("An account with this email already exists.");
        return;
      }
      const newRole = String(formData.get("role") ?? "admin") as "admin" | "faculty" | "student";
      setMockUsers((previous) => [...previous, { name: fullName, email, password, role: newRole }]);
      setLoggedInRole(newRole);
    }

    setFormError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      
      const emailVal = String(formData.get("email") ?? "").trim().toLowerCase();
      const match = mockUsers.find(u => u.email === emailVal);
      
      if (match) {
        setUser({
          id: `${match.role}-${Math.random().toString(36).slice(2, 5)}`,
          name: match.name,
          email: match.email,
          role: match.role,
          tags: match.role === 'developer' ? ['developer'] : [],
        });
      } else if (tab === "register") {
        const fullName = String(formData.get("fullName") ?? "").trim();
        const newRole = String(formData.get("role") ?? "admin") as any;
        setUser({
          id: `${newRole}-reg-${Math.random().toString(36).slice(2, 5)}`,
          name: fullName,
          email: emailVal,
          role: newRole,
        });
      }
      setDone(true);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={overlayRef}
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          >
            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md rounded-lg overflow-hidden bg-card border border-border"
            >
              {/* Ambient top glow */}
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, #0070f340, #8b5cf630, transparent)" }}
              />
              <div
                className="absolute inset-x-0 top-0 h-32 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 50% 0%, #0070f310 0%, transparent 70%)" }}
              />

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative px-8 pt-8 pb-8">

                {/* Logo + brand */}
                <div className="flex items-center gap-2.5 mb-7">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #0070f3, #8b5cf6)" }}>
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <span style={{ color: "var(--foreground)", fontWeight: 600, fontSize: "17px", letterSpacing: "-0.02em" }}>ChronoLink</span>
                </div>

                <AnimatePresence mode="wait">
                  {done ? (
                    // ── Success state ──
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-center py-6"
                    >
                      <div
                        className="w-14 h-14 rounded-lg flex items-center justify-center mx-auto mb-5"
                        style={{ background: "#10b98115", border: "1px solid #10b98130" }}
                      >
                        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <h2 style={{ color: "#e8e8e8", fontWeight: 600, fontSize: "20px", letterSpacing: "-0.02em", marginBottom: "8px" }}>
                        {tab === "login" ? "Welcome back!" : "Account created"}
                      </h2>
                      <p style={{ color: "var(--muted-foreground)", fontSize: "14px", lineHeight: 1.7, marginBottom: "24px" }}>
                        {tab === "login"
                          ? "Taking you to your workspace..."
                          : "Your account is ready. Taking you in now..."}
                      </p>
                      <Link to={loggedInRole === "student" ? "/student" : loggedInRole === "faculty" ? "/faculty" : "/workspace"} onClick={onClose}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-md"
                          style={{ background: "linear-gradient(135deg, #0070f3, #5b8ef7)", color: "#fff", fontWeight: 500, fontSize: "15px" }}
                        >
                          Open {loggedInRole} portal <ArrowRight className="h-4 w-4" />
                        </motion.button>
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Heading */}
                      <div className="mb-6">
                        <h2 style={{ color: "#e8e8e8", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.03em", marginBottom: "4px" }}>
                          {tab === "login" ? "Sign in" : "Create your account"}
                        </h2>
                        <p style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>
                          {tab === "login"
                            ? "No meeting required."
                            : "Get your first timetable live in under an hour."}
                        </p>
                      </div>

                      {/* Tabs */}
                      <div className="flex rounded-md p-1 mb-6 bg-card border border-border">
                        {(["login", "register"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTab(t)}
                            className="flex-1 py-2 rounded-lg text-sm transition-all duration-200"
                            style={{
                              background: tab === t ? "#1e1e2e" : "transparent",
                              color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
                              border: tab === t ? "1px solid var(--surface-border-accent)" : "1px solid transparent",
                              fontWeight: tab === t ? 500 : 400,
                              fontSize: "13px",
                            }}
                          >
                            {t === "login" ? "Sign in" : "Register"}
                          </button>
                        ))}
                      </div>

                      {/* Form */}
                      <form onSubmit={handleSubmit} className="space-y-4">
                        {tab === "register" && (
                          <>
                            <Field
                              name="fullName"
                              label="Full name"
                              type="text"
                              placeholder="Dr. Priya Nair"
                              required
                            />
                            <div className="space-y-1.5">
                              <label style={{ color: "#666", fontSize: "12px", fontWeight: 500 }}>Role</label>
                              <select
                                name="role"
                                className="w-full px-3.5 py-2.5 rounded-md outline-none transition-all text-sm"
                                style={{
                                  background: "var(--surface-4)",
                                  border: "1px solid var(--surface-border-strong)",
                                  color: "#ddd",
                                  fontSize: "14px",
                                }}
                              >
                                <option value="admin">Admin</option>
                                <option value="faculty">Faculty</option>
                                <option value="student">Student</option>
                              </select>
                            </div>
                          </>
                        )}
                        <Field
                          name="email"
                          label="Email"
                          type="email"
                          placeholder="you@institution.edu"
                          required
                        />
                        <PasswordField
                          name="password"
                          label="Password"
                          placeholder={tab === "login" ? "Your password" : "Min. 8 characters"}
                          show={showPassword}
                          onToggle={() => setShowPassword(v => !v)}
                          required
                        />
                        {tab === "register" && (
                          <PasswordField
                            name="confirmPassword"
                            label="Confirm password"
                            placeholder="Repeat password"
                            show={showConfirm}
                            onToggle={() => setShowConfirm(v => !v)}
                            required
                          />
                        )}

                        {formError && (
                          <p className="text-xs" style={{ color: "#f87171" }}>
                            {formError}
                          </p>
                        )}

                        {tab === "login" && (
                          <div className="flex justify-end">
                            <button type="button" className="text-xs transition-colors" style={{ color: "var(--muted-foreground)" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
                              onMouseLeave={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
                            >Forgot password?</button>
                          </div>
                        )}

                        {tab === "register" && (
                          <div className="flex items-start gap-2.5 pt-1">
                            <input type="checkbox" id="terms" required className="mt-0.5 accent-blue-500 shrink-0" />
                            <label htmlFor="terms" style={{ color: "var(--muted-foreground)", fontSize: "12px", lineHeight: 1.6 }}>
                              I agree to the{" "}
                              <span className="underline cursor-pointer" style={{ color: "#666" }}>Terms of Service</span>
                              {" "}and{" "}
                              <span className="underline cursor-pointer" style={{ color: "#666" }}>Privacy Policy</span>
                            </label>
                          </div>
                        )}

                        <motion.button
                          type="submit"
                          disabled={loading}
                          whileHover={loading ? {} : { scale: 1.01, boxShadow: "0 0 28px #0070f335" }}
                          whileTap={loading ? {} : { scale: 0.98 }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-md mt-2 transition-opacity"
                          style={{
                            background: "linear-gradient(135deg, #0070f3, #5b8ef7)",
                            color: "#fff",
                            fontWeight: 500,
                            fontSize: "15px",
                            opacity: loading ? 0.75 : 1,
                          }}
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {tab === "login" ? "Sign in" : "Create account"}
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </motion.button>
                      </form>

                      {/* Divider */}
                      <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px" style={{ background: "var(--surface-border)" }} />
                        <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>or continue with</span>
                        <div className="flex-1 h-px" style={{ background: "var(--surface-border)" }} />
                      </div>

                      {/* SSO buttons */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Google", icon: GoogleIcon },
                          { label: "Microsoft", icon: MicrosoftIcon },
                        ].map(({ label, icon: Icon }) => (
                          <motion.button
                            key={label}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-md text-sm transition-colors"
                            style={{ background: "var(--surface-4)", border: "1px solid var(--surface-border-strong)", color: "var(--muted-foreground)" }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = "var(--surface-border-accent)";
                              (e.currentTarget as HTMLElement).style.color = "#ccc";
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = "var(--surface-border-strong)";
                              (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                            }}
                          >
                            <Icon />
                            <span style={{ fontSize: "13px" }}>{label}</span>
                          </motion.button>
                        ))}
                      </div>

                      {/* Switch tab */}
                      <p className="text-center mt-5" style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>
                        {tab === "login" ? "Don't have an account? " : "Already have an account? "}
                        <button
                          type="button"
                          onClick={() => setTab(tab === "login" ? "register" : "login")}
                          style={{ color: "#0070f3" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#5b8ef7")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#0070f3")}
                        >
                          {tab === "login" ? "Register" : "Sign in"}
                        </button>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({
  name,
  label,
  type,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label style={{ color: "#666", fontSize: "12px", fontWeight: 500 }}>{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full px-3.5 py-2.5 rounded-md outline-none transition-all text-sm"
        style={{
          background: "var(--surface-4)",
          border: "1px solid var(--surface-border-strong)",
          color: "#ddd",
          fontSize: "14px",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "#0070f350")}
        onBlur={e => (e.currentTarget.style.borderColor = "var(--surface-border-strong)")}
      />
    </div>
  );
}

function PasswordField({ name, label, placeholder, show, onToggle, required }: {
  name: string; label: string; placeholder: string; show: boolean; onToggle: () => void; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label style={{ color: "#666", fontSize: "12px", fontWeight: 500 }}>{label}</label>
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          className="w-full px-3.5 py-2.5 pr-10 rounded-md outline-none transition-all"
          style={{
            background: "var(--surface-4)",
            border: "1px solid var(--surface-border-strong)",
            color: "#ddd",
            fontSize: "14px",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#0070f350")}
          onBlur={e => (e.currentTarget.style.borderColor = "var(--surface-border-strong)")}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ── Brand icons ── */
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/>
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/>
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
    </svg>
  );
}



