import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Users, GraduationCap, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";

/* ─────────────────────────── DATA ─────────────────────────── */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const DAY_KEYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

export interface HeatPerson {
  id: string;
  name: string;
  role: string;
  hoursPerDay: Record<string, number>;
  totalHours: number;
  intensity: "low" | "medium" | "high";
  trend?: "up" | "down" | "stable";
}

const FACULTY_DATA: HeatPerson[] = [
  { id: "f1", name: "Dr. Sarah Johnson",   role: "CS Dept",      hoursPerDay: { Monday: 6, Tuesday: 2, Wednesday: 5, Thursday: 4, Friday: 3 }, totalHours: 20, intensity: "high",   trend: "up" },
  { id: "f2", name: "Prof. James Osei",    role: "Math Dept",    hoursPerDay: { Monday: 3, Tuesday: 4, Wednesday: 2, Thursday: 4, Friday: 2 }, totalHours: 15, intensity: "medium", trend: "stable" },
  { id: "f3", name: "Dr. Priya Nair",      role: "Physics",      hoursPerDay: { Monday: 2, Tuesday: 1, Wednesday: 3, Thursday: 2, Friday: 1 }, totalHours: 9,  intensity: "low",    trend: "down" },
  { id: "f4", name: "Ms. Lisa Taylor",     role: "English",      hoursPerDay: { Monday: 4, Tuesday: 5, Wednesday: 4, Thursday: 5, Friday: 4 }, totalHours: 22, intensity: "high",   trend: "up" },
  { id: "f5", name: "Dr. Marcus Kim",      role: "CS Dept",      hoursPerDay: { Monday: 2, Tuesday: 3, Wednesday: 2, Thursday: 1, Friday: 2 }, totalHours: 10, intensity: "low",    trend: "stable" },
  { id: "f6", name: "Mr. Kwame Asante",    role: "Economics",    hoursPerDay: { Monday: 3, Tuesday: 4, Wednesday: 5, Thursday: 4, Friday: 3 }, totalHours: 19, intensity: "medium", trend: "up" },
  { id: "f7", name: "Dr. Elena Reyes",     role: "Biology",      hoursPerDay: { Monday: 5, Tuesday: 6, Wednesday: 5, Thursday: 6, Friday: 5 }, totalHours: 27, intensity: "high",   trend: "up" },
  { id: "f8", name: "Prof. Amir Hassan",   role: "Engineering",  hoursPerDay: { Monday: 1, Tuesday: 2, Wednesday: 1, Thursday: 2, Friday: 1 }, totalHours: 7,  intensity: "low",    trend: "down" },
];

const STUDENT_DATA: HeatPerson[] = [
  { id: "s1", name: "CS-A-2024",     role: "Computer Science Sem 3",   hoursPerDay: { Monday: 5, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 3 }, totalHours: 20, intensity: "high",   trend: "up" },
  { id: "s2", name: "CS-B-2024",     role: "Computer Science Sem 3",   hoursPerDay: { Monday: 4, Tuesday: 4, Wednesday: 3, Thursday: 4, Friday: 4 }, totalHours: 19, intensity: "medium", trend: "stable" },
  { id: "s3", name: "EE-A-2024",     role: "Electrical Eng Sem 5",     hoursPerDay: { Monday: 2, Tuesday: 3, Wednesday: 2, Thursday: 2, Friday: 1 }, totalHours: 10, intensity: "low",    trend: "down" },
  { id: "s4", name: "EE-B-2024",     role: "Electrical Eng Sem 5",     hoursPerDay: { Monday: 6, Tuesday: 5, Wednesday: 6, Thursday: 5, Friday: 6 }, totalHours: 28, intensity: "high",   trend: "up" },
  { id: "s5", name: "MATH-A-2025",   role: "Mathematics Sem 1",        hoursPerDay: { Monday: 3, Tuesday: 2, Wednesday: 3, Thursday: 2, Friday: 2 }, totalHours: 12, intensity: "medium", trend: "stable" },
  { id: "s6", name: "BIO-A-2024",    role: "Biology Sem 4",            hoursPerDay: { Monday: 1, Tuesday: 2, Wednesday: 1, Thursday: 1, Friday: 2 }, totalHours: 7,  intensity: "low",    trend: "down" },
  { id: "s7", name: "MED-A-2024",    role: "Medicine Sem 2",           hoursPerDay: { Monday: 5, Tuesday: 6, Wednesday: 5, Thursday: 6, Friday: 5 }, totalHours: 27, intensity: "high",   trend: "up" },
];

/* ─────────────────────────── COLOR LOGIC ─────────────────────────── */

/**
 * Returns a smooth interpolated color string based on hours (0–8 scale).
 * Green → Amber → Orange → Red using per-channel lerp.
 */
function cellColor(hours: number): { bg: string; glow: string; text: string } {
  const stops = [
    { h: 0, r: 16,  g: 185, b: 129 },  // #10b981 green
    { h: 2, r: 16,  g: 185, b: 129 },  // keep green until 2
    { h: 3, r: 245, g: 158, b: 11  },  // #f59e0b amber
    { h: 5, r: 249, g: 115, b: 22  },  // #f97316 orange
    { h: 7, r: 239, g: 68,  b: 68  },  // #ef4444 red
    { h: 8, r: 185, g: 28,  b: 28  },  // darker red
  ];

  if (hours <= 0) return { bg: "rgba(255,255,255,0.03)", glow: "transparent", text: "var(--muted-foreground)" };

  const clamped = Math.min(hours, 8);
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].h && clamped <= stops[i + 1].h) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const t = hi.h === lo.h ? 0 : (clamped - lo.h) / (hi.h - lo.h);
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);

  const alpha = 0.18 + t * 0.28;
  return {
    bg:   `rgba(${r},${g},${b},${alpha})`,
    glow: `rgba(${r},${g},${b},0.6)`,
    text: `rgb(${r},${g},${b})`,
  };
}

function intensityMeta(intensity: string) {
  if (intensity === "high")   return { label: "High",   color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" };
  if (intensity === "medium") return { label: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" };
  return                             { label: "Low",    color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" };
}

/* ─────────────────────────── TOOLTIP ─────────────────────────── */

interface TooltipState { x: number; y: number; name: string; day: string; hours: number }

/* ─────────────────────────── CELL ─────────────────────────── */

function HeatCell({ hours, delay, onEnter, onLeave }: {
  hours: number;
  delay: number;
  onEnter: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const { bg, glow, text } = cellColor(hours);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={(e) => { setHovered(true); onEnter(e); }}
      onMouseLeave={() => { setHovered(false); onLeave(); }}
      className="relative flex items-center justify-center rounded-lg cursor-default select-none"
      style={{
        height: "40px",
        background: bg,
        border: `1px solid ${hours > 0 ? text + "30" : "var(--surface-border)"}`,
        boxShadow: hovered && hours > 0 ? `0 0 14px ${glow}` : "none",
        transition: "background 0.5s ease, box-shadow 0.25s ease, border-color 0.5s ease, transform 0.15s ease",
        transform: hovered ? "scale(1.08)" : "scale(1)",
      }}
    >
      <span
        style={{
          color: hours > 0 ? text : "var(--muted-foreground)",
          fontSize: "12px",
          fontWeight: 600,
          transition: "color 0.5s ease",
        }}
      >
        {hours > 0 ? `${hours}h` : "—"}
      </span>
    </motion.div>
  );
}

/* ─────────────────────────── MAIN COMPONENT ─────────────────────── */

interface BurnoutHeatmapProps {
  compact?: boolean;
  defaultTab?: "faculty" | "student";
}

export function BurnoutHeatmap({ compact = false, defaultTab = "faculty" }: BurnoutHeatmapProps) {
  const [tab, setTab] = useState<"faculty" | "student">(defaultTab);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Reset animation when tab changes
  const [animKey, setAnimKey] = useState(0);
  const handleTab = (t: "faculty" | "student") => {
    setTab(t);
    setAnimKey(k => k + 1);
  };

  const data = tab === "faculty" ? FACULTY_DATA : STUDENT_DATA;
  const overloaded = data.filter(d => d.intensity === "high").length;
  const healthy   = data.filter(d => d.intensity === "low").length;

  const handleCellEnter = (e: React.MouseEvent, name: string, day: string, hours: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      name, day, hours,
    });
  };

  const trendIcon = (trend?: string) => {
    if (trend === "up")     return <TrendingUp   className="h-3 w-3" style={{ color: "#ef4444" }} />;
    if (trend === "down")   return <TrendingDown className="h-3 w-3" style={{ color: "#10b981" }} />;
    return                         <Minus        className="h-3 w-3" style={{ color: "var(--muted-foreground)"    }} />;
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg overflow-visible bg-card border border-border"
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none rounded-lg"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #f59e0b08 0%, transparent 70%)" }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6 pb-5" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <Flame className="w-5 h-5" style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <h2 style={{ color: "#e0e0e0", fontWeight: 600, fontSize: compact ? "15px" : "17px" }}>Burnout Heatmap</h2>
            <p style={{ color: "var(--muted-foreground)", fontSize: "12px", marginTop: "1px" }}>Weekly workload intensity · {tab === "faculty" ? "Teaching hours" : "Class hours"}</p>
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2">
          {overloaded > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ef4444" }} />
              <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 500 }}>{overloaded} overloaded</span>
            </div>
          )}
          {healthy > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 500 }}>{healthy} healthy</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 px-6 pt-4">
        {(["faculty", "student"] as const).map((t) => (
          <button
            key={t}
            onClick={() => handleTab(t)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all"
            style={{
              background: tab === t ? "#1e1e2e" : "transparent",
              color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
              border: tab === t ? "1px solid var(--surface-border-accent)" : "1px solid transparent",
              fontWeight: tab === t ? 500 : 400,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {t === "faculty" ? <Users className="h-3.5 w-3.5" /> : <GraduationCap className="h-3.5 w-3.5" />}
            {t === "faculty" ? "Faculty" : "Students"}
          </button>
        ))}
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${tab}-${animKey}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="px-6 py-5 overflow-x-auto"
        >
          <div style={{ minWidth: "540px" }}>
            {/* Column headers */}
            <div
              className="grid mb-2"
              style={{ gridTemplateColumns: compact ? "140px repeat(5, 1fr) 56px 88px" : "180px repeat(5, 1fr) 64px 100px", gap: "6px" }}
            >
              <div style={{ color: "var(--muted-foreground)", fontSize: "11px", fontWeight: 500, padding: "0 4px" }}>
                {tab === "faculty" ? "Faculty member" : "Student group"}
              </div>
              {DAYS.map((d) => (
                <div key={d} className="flex items-center justify-center rounded-lg py-1.5" style={{ background: "var(--surface-4)", color: "var(--muted-foreground)", fontSize: "11px", fontWeight: 600 }}>{d}</div>
              ))}
              <div className="flex items-center justify-center" style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>Total</div>
              <div className="flex items-center justify-center" style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>Load</div>
            </div>

            {/* Rows */}
            {data.map((person, ri) => {
              const meta = intensityMeta(person.intensity);
              return (
                <div
                  key={person.id}
                  className="grid mb-1.5 items-center"
                  style={{ gridTemplateColumns: compact ? "140px repeat(5, 1fr) 56px 88px" : "180px repeat(5, 1fr) 64px 100px", gap: "6px" }}
                >
                  {/* Name */}
                  <div className="flex items-center gap-2 pr-2 min-w-0">
                    {trendIcon(person.trend)}
                    <div className="min-w-0">
                      <div className="truncate" style={{ color: "#c8c8c8", fontSize: "13px", fontWeight: 500 }}>{person.name}</div>
                      {!compact && <div className="truncate" style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>{person.role}</div>}
                    </div>
                  </div>

                  {/* Cells */}
                  {DAY_KEYS.map((day, di) => {
                    const hours = person.hoursPerDay[day] ?? 0;
                    return (
                      <HeatCell
                        key={day}
                        hours={hours}
                        delay={mounted ? ri * 0.04 + di * 0.025 : 0}
                        onEnter={(e) => handleCellEnter(e, person.name, DAYS[di], hours)}
                        onLeave={() => setTooltip(null)}
                      />
                    );
                  })}

                  {/* Total */}
                  <div className="flex items-center justify-center">
                    <span style={{ color: meta.color, fontSize: "13px", fontWeight: 600 }}>{person.totalHours}h</span>
                  </div>

                  {/* Intensity badge */}
                  <div className="flex items-center justify-center">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs"
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontWeight: 500 }}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Gradient legend */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4" style={{ borderTop: "1px solid var(--surface-border)" }}>
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>Intensity scale:</span>
        </div>
        {/* Gradient bar */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <span style={{ color: "#10b981", fontSize: "11px", fontWeight: 500 }}>Low</span>
          <div
            className="flex-1 h-2.5 rounded-full"
            style={{
              background: "linear-gradient(90deg, rgba(16,185,129,0.7) 0%, rgba(245,158,11,0.7) 45%, rgba(249,115,22,0.7) 70%, rgba(239,68,68,0.8) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: 500 }}>High</span>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          {[
            { icon: <TrendingUp  className="h-3 w-3" style={{ color: "#ef4444" }} />, label: "Increasing" },
            { icon: <TrendingDown className="h-3 w-3" style={{ color: "#10b981" }} />, label: "Decreasing" },
            { icon: <Minus className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />, label: "Stable" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1">
              {icon}
              <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 pointer-events-none px-3 py-2 rounded-md"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translateX(-50%) translateY(-100%)",
              background: "#14141c",
              border: "1px solid var(--surface-border-accent)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ color: "#e0e0e0", fontSize: "12px", fontWeight: 500 }}>{tooltip.name}</div>
            <div style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>
              {tooltip.day} · {tooltip.hours > 0 ? `${tooltip.hours} hrs` : "No classes"}
            </div>
            {tooltip.hours > 0 && (
              <div
                className="mt-1 h-1 rounded-full"
                style={{ background: cellColor(tooltip.hours).glow, width: `${Math.min(tooltip.hours / 8 * 100, 100)}%`, minWidth: "12px", transition: "width 0.3s" }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



