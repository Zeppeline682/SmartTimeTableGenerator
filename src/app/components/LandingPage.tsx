import { useState, useEffect, useRef, Fragment } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  ArrowRight, Calendar, Users, Layout,
  Globe, Clock, CheckCircle2, Download,
  Share2, Flame, Activity,
  GitBranch, Star, TrendingUp, Command, FileSpreadsheet
} from "lucide-react";
import { Link } from "react-router";
import { AuthModal } from "./AuthModal";

/* ─────────────────────────────── DATA ─────────────────────────────── */

const features = [
  {
    icon: Clock,
    title: "Changes show up everywhere, instantly",
    description: "Move a class. Everyone sees it — admin portal, faculty view, the student link — before you lift your finger off the mouse.",
    color: "#0070f3",
  },
  {
    icon: Layout,
    title: "Rules that actually hold",
    description: "Room at capacity? Faculty unavailable Tuesday mornings? Set it once. ChronoLink enforces it on every subsequent edit.",
    color: "#8b5cf6",
  },
  {
    icon: Flame,
    title: "See who's getting crushed",
    description: "The burnout heatmap shows faculty workload by day, in green / amber / red. Redistributing load goes from gut-feel to obvious.",
    color: "#f59e0b",
  },
  {
    icon: FileSpreadsheet,
    title: "Bring your existing mess",
    description: "Drop in the Excel file you've been using for five years. ChronoLink maps the columns and imports it. No reformatting.",
    color: "#10b981",
  },
  {
    icon: Share2,
    title: "A link students can actually bookmark",
    description: "One URL. No login. Always the current timetable. When you make a change, the link updates — not the printout in the hallway.",
    color: "#0070f3",
  },
  {
    icon: TrendingUp,
    title: "A score for how good your schedule is",
    description: "Not just 'no conflicts'. ChronoLink scores gap time, room utilisation, and faculty load balance. Room to improve is always visible.",
    color: "#8b5cf6",
  },
  {
    icon: GitBranch,
    title: "Conflicts logged the second they happen",
    description: "A live stream of every clash — time, room, people involved. Scroll back through the week. Nothing gets quietly buried.",
    color: "#ef4444",
  },
  {
    icon: Globe,
    title: "Backs up to Google Drive automatically",
    description: "Every published version lands in Drive. Your IT department will appreciate it. Your registrar's panic at 11pm will end.",
    color: "#10b981",
  },
  {
    icon: Users,
    title: "Everyone sees what they need to",
    description: "Admins edit. Faculty check their load and flag preferences. Students read their timetable. Nobody gets more access than that.",
    color: "#f59e0b",
  },
];

const steps = [
  {
    number: "01",
    title: "Drop in what you have",
    description: "Upload your existing Excel file — the one with the colour-coded tabs and the note that says 'don't delete row 3'. ChronoLink figures it out.",
    icon: Download,
    color: "#0070f3",
  },
  {
    number: "02",
    title: "Tell it what can't move",
    description: "Dr. Patel can't teach before 10am. Lab B holds 24 students max. Room 12 is booked Thursday afternoons. Set it once, enforced forever.",
    icon: Layout,
    color: "#8b5cf6",
  },
  {
    number: "03",
    title: "Send a link, you're done",
    description: "Hit publish. Share one URL with your students. When something changes next Tuesday, the link updates. No reprinting. No email chain.",
    icon: Share2,
    color: "#10b981",
  },
];

const testimonials = [
  {
    quote: "We cut our scheduling committee meetings from three weeks to a single afternoon. The constraint engine caught conflicts we'd been living with for years.",
    name: "Dr. Priya Nair",
    role: "Deputy Registrar",
    institution: "Meridian University",
    stars: 5,
  },
  {
    quote: "Faculty actually like using it. The burnout heatmap helped us redistribute load fairly for the first time — and our union loved that it was data-driven.",
    name: "Prof. James Osei",
    role: "Head of Academic Affairs",
    institution: "Westgate College",
    stars: 5,
  },
  {
    quote: "Students stopped emailing reception about room changes. The live link just… works. That alone was worth it.",
    name: "Amara Khoury",
    role: "Student Services Director",
    institution: "Nova Institute of Technology",
    stars: 5,
  },
];

const roles = [
  {
    label: "Admin",
    color: "#0070f3",
    description: "You're running the show. ChronoLink gives you the levers — and gets out of the way.",
    perks: [
      "Drag-and-drop timetable editor",
      "Conflict detection on every save",
      "Import from Excel, export to Excel",
      "Schedule score with improvement hints",
    ],
  },
  {
    label: "Faculty",
    color: "#8b5cf6",
    description: "Block off your prep time. Flag your preferences. See if someone accidentally double-booked you.",
    perks: [
      "Set your own availability windows",
      "Burnout heatmap of your weekly load",
      "Notifications when your class moves",
      "Submit room or time preferences",
    ],
  },
  {
    label: "Student",
    color: "#10b981",
    description: "Open the link. That's it. No account, no app, no wondering if it's up to date.",
    perks: [
      "One URL, always current",
      "Works on phone, tablet, desktop",
      "Print or export when you need to",
      "Notified when something changes",
    ],
  },
];

/* ─────────────────────────── DASHBOARD MOCK ──────────────────────── */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

const mockBlocks = [
  { day: 0, start: 0, span: 2, label: "CS101", room: "Lab A", color: "#0070f3" },
  { day: 0, start: 3, span: 1, label: "MATH201", room: "Hall 3", color: "#8b5cf6" },
  { day: 0, start: 5, span: 2, label: "ENG102", room: "Rm 14", color: "#10b981" },
  { day: 1, start: 1, span: 3, label: "PHY301", room: "Lab B", color: "#f59e0b" },
  { day: 1, start: 6, span: 1, label: "CS101", room: "Lab A", color: "#0070f3" },
  { day: 2, start: 0, span: 1, label: "MATH201", room: "Hall 3", color: "#8b5cf6" },
  { day: 2, start: 2, span: 2, label: "CS301", room: "Lab C", color: "#0070f3" },
  { day: 2, start: 5, span: 1, label: "ENG102", room: "Rm 14", color: "#10b981" },
  { day: 2, start: 7, span: 2, label: "PHY301", room: "Lab B", color: "#f59e0b" },
  { day: 3, start: 0, span: 3, label: "CS401", room: "Hall 1", color: "#8b5cf6" },
  { day: 3, start: 4, span: 2, label: "MATH301", room: "Hall 3", color: "#8b5cf6" },
  { day: 4, start: 1, span: 2, label: "CS101", room: "Lab A", color: "#0070f3" },
  { day: 4, start: 4, span: 3, label: "CS301", room: "Lab C", color: "#0070f3" },
];

/* ─────────────────────────── HEATMAP MOCK ────────────────────────── */

const FACULTY = ["Dr. Amara", "Prof. Chen", "Ms. Taylor", "Dr. Patel", "Dr. Kim", "Mr. Osei", "Dr. Reyes"];
const HEAT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const heatData: number[][] = [
  [2, 4, 3, 5, 1],
  [5, 5, 4, 6, 3],
  [1, 2, 3, 2, 1],
  [3, 4, 6, 5, 4],
  [4, 3, 2, 3, 5],
  [2, 1, 4, 3, 2],
  [6, 5, 4, 6, 5],
];

function heatColor(val: number) {
  // Smooth per-channel interpolation across green → amber → orange → red
  const stops = [
    { h: 0, r: 16,  g: 185, b: 129 },
    { h: 2, r: 16,  g: 185, b: 129 },
    { h: 3, r: 245, g: 158, b: 11  },
    { h: 5, r: 249, g: 115, b: 22  },
    { h: 6, r: 239, g: 68,  b: 68  },
  ];
  if (val <= 0) return { bg: "rgba(255,255,255,0.03)", text: "var(--muted-foreground)", border: "transparent" };
  const clamped = Math.min(val, 6);
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].h && clamped <= stops[i + 1].h) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const t = hi.h === lo.h ? 0 : (clamped - lo.h) / (hi.h - lo.h);
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  const alpha = 0.16 + t * 0.3;
  return {
    bg:     `rgba(${r},${g},${b},${alpha})`,
    text:   `rgb(${r},${g},${b})`,
    border: `rgba(${r},${g},${b},0.3)`,
  };
}

function heatLabel(val: number) {
  if (val <= 1) return "1";
  if (val <= 2) return "2";
  if (val <= 3) return "3";
  if (val <= 4) return "4";
  if (val <= 5) return "5";
  return "6";
}

/* ─────────────────────────── COUNTER ───────────────────────────────── */

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1500;
    const step = (timestamp: number, startTime: number) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame((ts) => step(ts, startTime));
      else setVal(target);
    };
    requestAnimationFrame((ts) => step(ts, ts));
  }, [isInView, target]);

  return <span ref={ref}>{val}{suffix}</span>;
}

/* ─────────────────────────── DASHBOARD PREVIEW ─────────────────────── */

function DashboardPreview() {
  return (
    <div className="rounded-md overflow-hidden bg-card border border-border">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--surface-border-strong)" }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]/70" />
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]/70" />
          <div className="w-3 h-3 rounded-full bg-[#10b981]/70" />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-card border border-border">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>Semester 1 · 2026</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded text-[10px]" style={{ background: "#0070f320", color: "#0070f3", border: "1px solid #0070f330" }}>Import</div>
          <div className="px-2 py-0.5 rounded text-[10px]" style={{ background: "#8b5cf620", color: "#8b5cf6", border: "1px solid #8b5cf630" }}>Export</div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-3">
        <div className="grid" style={{ gridTemplateColumns: "48px repeat(5, 1fr)", gap: "3px" }}>
          {/* Corner */}
          <div />
          {DAYS.map((d) => (
            <div key={d} className="text-center py-1 rounded text-[10px]" style={{ color: "var(--muted-foreground)", background: "var(--surface-4)" }}>{d}</div>
          ))}

          {TIMES.map((time, ti) => (
            <Fragment key={`row-${ti}`}>
              <div className="flex items-center justify-end pr-2 text-[9px]" style={{ color: "var(--muted-foreground)" }}>{time}</div>
              {DAYS.map((_, di) => {
                const block = mockBlocks.find(b => b.day === di && b.start === ti);
                const occupied = mockBlocks.find(b => b.day === di && b.start < ti && b.start + b.span > ti);
                if (occupied) return null;
                if (block) {
                  return (
                    <motion.div
                      key={`b-${di}-${ti}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: ti * 0.04 + di * 0.02, duration: 0.3 }}
                      className="rounded flex flex-col justify-center px-1.5 py-1 cursor-pointer hover:brightness-110 transition-all"
                      style={{
                        gridRow: `span ${block.span}`,
                        background: `${block.color}22`,
                        borderLeft: `2px solid ${block.color}`,
                        minHeight: `${block.span * 28}px`,
                      }}
                    >
                      <div className="text-[9px] truncate" style={{ color: block.color }}>{block.label}</div>
                      {block.span > 1 && <div className="text-[8px] truncate" style={{ color: "var(--muted-foreground)" }}>{block.room}</div>}
                    </motion.div>
                  );
                }
                return (
                  <div
                    key={`e-${di}-${ti}`}
                    className="rounded hover:bg-white/[0.02] transition-colors cursor-pointer"
                    style={{ minHeight: "28px", background: "var(--surface-4)" }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: "1px solid var(--surface-border-strong)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            <span className="w-2 h-2 rounded-sm" style={{ background: "#0070f330", border: "1px solid #0070f3" }} />CS
          </div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            <span className="w-2 h-2 rounded-sm" style={{ background: "#8b5cf630", border: "1px solid #8b5cf6" }} />Math
          </div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            <span className="w-2 h-2 rounded-sm" style={{ background: "#10b98130", border: "1px solid #10b981" }} />Eng
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: "#10b981" }}>
          <Activity className="h-3 w-3" />
          Score: 87/100
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── HEATMAP PREVIEW ─────────────────────── */

function HeatmapPreview() {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="rounded-md overflow-hidden bg-card border border-border">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--surface-border-strong)" }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]/70" />
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]/70" />
          <div className="w-3 h-3 rounded-full bg-[#10b981]/70" />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-card border border-border">
          <Flame className="w-3 h-3 text-[#f59e0b]" />
          <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>Faculty Burnout Heatmap</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ef4444" }} />
          <span className="text-[10px]" style={{ color: "#ef4444" }}>3 overloaded</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="p-3 space-y-1.5">
        {/* Day headers */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "72px repeat(5, 1fr)" }}>
          <div />
          {HEAT_DAYS.map(d => (
            <div key={d} className="text-center py-1 text-[10px] rounded-lg" style={{ color: "var(--muted-foreground)", background: "var(--surface-4)", border: "1px solid var(--surface-border)" }}>{d}</div>
          ))}
        </div>

        {/* Faculty rows */}
        {FACULTY.map((name, fi) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: fi * 0.06, duration: 0.4 }}
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "72px repeat(5, 1fr)" }}
          >
            <div className="flex items-center text-[9px] truncate pr-1" style={{ color: "#666" }}>{name}</div>
            {HEAT_DAYS.map((_, di) => {
              const val = heatData[fi][di];
              const { bg, text, border } = heatColor(val);
              const key = `${fi}-${di}`;
              const isHovered = hovered === key;
              return (
                <motion.div
                  key={di}
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: fi * 0.04 + di * 0.025, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  className="flex items-center justify-center rounded-lg text-[9px] cursor-pointer"
                  style={{
                    height: "28px",
                    background: bg,
                    color: text,
                    border: `1px solid ${border}`,
                    boxShadow: isHovered && val > 0 ? `0 0 10px ${text}55` : "none",
                    transform: isHovered ? "scale(1.1)" : "scale(1)",
                    transition: "background 0.5s ease, color 0.5s ease, border-color 0.5s ease, box-shadow 0.2s ease, transform 0.15s ease",
                    fontWeight: 600,
                  }}
                  title={`${name} · ${HEAT_DAYS[di]} · ${val} classes`}
                >
                  {val > 0 ? val : "·"}
                </motion.div>
              );
            })}
          </motion.div>
        ))}
      </div>

      {/* Gradient legend */}
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: "1px solid var(--surface-border-strong)" }}>
        <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>Load:</span>
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-[9px]" style={{ color: "#10b981" }}>Low</span>
          <div
            className="flex-1 h-1.5 rounded-full"
            style={{ background: "linear-gradient(90deg, rgba(16,185,129,0.7), rgba(245,158,11,0.7), rgba(239,68,68,0.8))" }}
          />
          <span className="text-[9px]" style={{ color: "#ef4444" }}>High</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── MAIN COMPONENT ─────────────────────── */

export function LandingPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "heatmap">("dashboard");
  const [scrollY, setScrollY] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  const openAuth = (tab: "login" | "register" = "login") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--surface-2)] text-[var(--foreground)] overflow-x-hidden">

      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full"
          style={{
            width: "800px", height: "800px",
            top: "-200px", left: "50%", transform: `translateX(-50%) translateY(${scrollY * 0.15}px)`,
            background: "radial-gradient(circle, #0070f315 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "600px", height: "600px",
            top: "30%", right: "-100px",
            background: "radial-gradient(circle, #8b5cf610 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: "500px", height: "500px",
            bottom: "20%", left: "-80px",
            background: "radial-gradient(circle, #10b98108 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Navigation ── */}
      <nav
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={{
          background: scrollY > 40 ? "rgba(8,8,15,0.85)" : "transparent",
          backdropFilter: scrollY > 40 ? "blur(20px)" : "none",
          borderBottom: scrollY > 40 ? "1px solid var(--surface-border-strong)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2.5"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0070f3, #8b5cf6)" }}>
              <Calendar className="h-4.5 w-4.5 text-white" />
            </div>
            <span style={{ color: "var(--foreground)", fontWeight: 600, fontSize: "17px", letterSpacing: "-0.02em" }}>ChronoLink</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="hidden md:flex items-center gap-6"
          >
            {["How it works", "Features", "Roles"].map((item) => (
              <button
                key={item}
                className="text-sm transition-colors bg-transparent border-none cursor-pointer"
                style={{ color: "#666" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={e => (e.currentTarget.style.color = "#666")}
                onClick={() => {
                  const id = item.toLowerCase().replace(/ /g, "-");
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >{item}</button>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <button
              className="text-sm px-4 py-2 rounded-lg transition-colors bg-transparent border-none cursor-pointer"
              style={{ color: "var(--muted-foreground)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--foreground)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
              onClick={() => openAuth("login")}
            >Sign in</button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer border-none"
              style={{ background: "linear-gradient(135deg, #0070f3, #5b8ef7)", color: "#fff", fontWeight: 500 }}
              onClick={() => openAuth("register")}
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </motion.button>
          </motion.div>
        </div>
      </nav>

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ── Hero ── */}
        <section className="relative pt-36 pb-16 px-6">
          <div className="max-w-6xl mx-auto text-center">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8"
              style={{ background: "#0070f310", border: "1px solid #0070f325", color: "#5a90cc", fontSize: "13px" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse" />
              Timetabling that doesn't go stale
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              style={{ fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.04em", color: "#f0f0f0" }}
            >
              Your timetable shouldn't{" "}
              <br />
              <span style={{ background: "linear-gradient(95deg, #3b82f6, #8b5cf6)", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
                need a meeting to update
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 max-w-xl mx-auto"
              style={{ color: "var(--muted-foreground)", fontSize: "17px", lineHeight: 1.75 }}
            >
              We built ChronoLink after watching a registrar spend three days
              untangling a room conflict in a spreadsheet. There's a better way.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center justify-center gap-4 mt-10"
            >
              <Link to="/workspace">
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 0 30px #0070f340" }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-6 py-3 rounded-md"
                  style={{ background: "linear-gradient(135deg, #0070f3, #5b8ef7)", color: "#fff", fontWeight: 500, fontSize: "15px" }}
                >
                  Try it with your data <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
              <Link to="/live/demo">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-6 py-3 rounded-md"
                  style={{ background: "#ffffff0a", color: "var(--muted-foreground)", border: "1px solid #222230", fontSize: "15px" }}
                >
                  See how it works
                </motion.button>
              </Link>
            </motion.div>

            {/* Keyboard hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="flex items-center justify-center gap-2 mt-6"
              style={{ color: "var(--muted-foreground)", fontSize: "12px" }}
            >
              <Command className="h-3 w-3" />
              <span>⌘K opens the command menu from anywhere in the app</span>
            </motion.div>

          </div>

          {/* ── Preview with tabs ── */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="max-w-6xl mx-auto mt-16"
          >
            {/* Tab switcher */}
            <div className="flex items-center justify-center mb-4 gap-1">
              {[
                { id: "dashboard", label: "Timetable", icon: Layout },
                { id: "heatmap", label: "Burnout Heatmap", icon: Flame },
              ].map(({ id, label, icon: Icon }) => (
                <motion.button
                  key={id}
                  onClick={() => setActiveTab(id as "dashboard" | "heatmap")}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
                  style={{
                    background: activeTab === id ? "var(--surface-4)" : "transparent",
                    color: activeTab === id ? "var(--foreground)" : "var(--muted-foreground)",
                    border: activeTab === id ? "1px solid var(--surface-border-accent)" : "1px solid transparent",
                    fontSize: "13px",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: activeTab === id ? (id === "heatmap" ? "#f59e0b" : "#0070f3") : "var(--muted-foreground)" }} />
                  {label}
                </motion.button>
              ))}
            </div>

            {/* Preview frame */}
            <div className="relative">
              <div className="absolute -inset-px rounded-lg" style={{ background: "linear-gradient(135deg, #0070f320, #8b5cf215)", zIndex: 0 }} />
              <div className="absolute -inset-4 rounded-3xl" style={{ background: "radial-gradient(ellipse at 50% 0%, #0070f312 0%, transparent 70%)", filter: "blur(20px)" }} />
              <div className="relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--surface-border-strong)", zIndex: 1 }}>
                <AnimatePresence mode="wait">
                  {activeTab === "dashboard" ? (
                    <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                      <DashboardPreview />
                    </motion.div>
                  ) : (
                    <motion.div key="heatmap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                      <HeatmapPreview />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Marquee logos ── TEMPORARILY DISABLED
        <section className="py-12 px-6 overflow-hidden" style={{ borderTop: "1px solid var(--surface-border)" }}>
          <p className="text-center text-sm mb-8" style={{ color: "#3a3a4a" }}>Trusted by scheduling teams at</p>
          <div className="flex items-center gap-12 animate-marquee whitespace-nowrap">
            {["Meridian University", "Westgate College", "Nova Institute", "Arcadia Academy", "Summit Polytechnic", "Crescent Medical School", "Lakeside University", "Meridian University", "Westgate College", "Nova Institute", "Arcadia Academy"].map((name, i) => (
              <span key={i} className="text-sm shrink-0" style={{ color: "#3a3a4a", fontWeight: 500 }}>{name}</span>
            ))}
          </div>
        </section>
        ── END DISABLED ── */}

        {/* ── How it works ── */}
        <section id="how-it-works" className="py-28 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <p className="text-sm mb-3" style={{ color: "#0070f3", fontWeight: 500 }}>Three steps. No onboarding call.</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", color: "#e8e8e8" }}>
                It really is this simple
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--surface-border-strong), transparent)" }} />

              {steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="relative group"
                >
                  <div
                    className="h-full p-8 rounded-lg transition-all duration-300 bg-card border border-border"
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.border = `1px solid ${step.color}30`;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${step.color}10`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.border = "1px solid var(--surface-border)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className="w-10 h-10 rounded-md flex items-center justify-center"
                        style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}
                      >
                        <step.icon className="h-5 w-5" style={{ color: step.color }} />
                      </div>
                      <span style={{ color: step.color, fontWeight: 700, fontSize: "13px", letterSpacing: "0.05em" }}>{step.number}</span>
                    </div>
                    <h3 style={{ color: "#e0e0e0", fontWeight: 600, marginBottom: "10px", fontSize: "18px" }}>{step.title}</h3>
                    <p style={{ color: "var(--muted-foreground)", fontSize: "14px", lineHeight: 1.7 }}>{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ── TEMPORARILY DISABLED
        <section className="py-20 px-6" style={{ borderTop: "1px solid var(--surface-4)", borderBottom: "1px solid var(--surface-4)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { target: 40, suffix: "+", label: "Universities live" },
                { target: 94, suffix: "%", label: "Fewer scheduling conflicts" },
                { target: 12, suffix: "k+", label: "Timetables generated" },
                { target: 8, suffix: " min", label: "Avg. full schedule creation" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="text-center"
                >
                  <div style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.04em", background: "linear-gradient(135deg, #e8e8e8, var(--muted-foreground))", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>
                    <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                  </div>
                  <div className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        ── END DISABLED ── */}

        {/* ── Features ── */}
        <section id="features" className="py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <p className="text-sm mb-3" style={{ color: "#8b5cf6", fontWeight: 500 }}>The full picture</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", color: "#e8e8e8" }}>
                We didn't staple scheduling onto a calendar app
              </h2>
              <p className="mt-4 max-w-xl mx-auto" style={{ color: "var(--muted-foreground)", fontSize: "16px", lineHeight: 1.7 }}>
                Every feature below exists because someone in a registrar's office needed it.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                >
                  <div
                    className="h-full p-6 rounded-lg cursor-default transition-all duration-300 group bg-card border border-border"
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.border = `1px solid ${f.color}25`;
                      (e.currentTarget as HTMLElement).style.background = `var(--surface-3)`;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${f.color}08`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.border = "1px solid var(--surface-border)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `${f.color}15`, border: `1px solid ${f.color}25` }}
                    >
                      <f.icon className="h-5 w-5" style={{ color: f.color }} />
                    </div>
                    <h3 style={{ color: "#d8d8d8", fontWeight: 600, marginBottom: "8px", fontSize: "15px" }}>{f.title}</h3>
                    <p style={{ color: "#4a4a5a", fontSize: "13px", lineHeight: 1.7 }}>{f.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Roles ── */}
        <section id="roles" className="py-28 px-6" style={{ borderTop: "1px solid var(--surface-4)" }}>
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <p className="text-sm mb-3" style={{ color: "#10b981", fontWeight: 500 }}>Who it's for</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", color: "#e8e8e8" }}>
                Pick your view
              </h2>
              <p className="mt-4 max-w-xl mx-auto" style={{ color: "var(--muted-foreground)", fontSize: "16px", lineHeight: 1.7 }}>
                Nobody sees more than they need. Nobody gets less.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {roles.map((role, i) => (
                <motion.div
                  key={role.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                  className="relative group"
                >
                  <div
                    className="h-full p-8 rounded-lg"
                    style={{ background: "var(--surface-3)", border: `1px solid ${role.color}20` }}
                  >
                    <div
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs mb-6"
                      style={{ background: `${role.color}15`, color: role.color, border: `1px solid ${role.color}25`, fontWeight: 600 }}
                    >
                      {role.label}
                    </div>
                    <p className="mb-6" style={{ color: "var(--muted-foreground)", fontSize: "14px", lineHeight: 1.7 }}>{role.description}</p>
                    <ul className="space-y-3">
                      {role.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: role.color }} />
                          <span style={{ color: "#777", fontSize: "13px" }}>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── TEMPORARILY DISABLED
        <section className="py-28 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <p className="text-sm mb-3" style={{ color: "#f59e0b", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>What people say</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, letterSpacing: "-0.03em", color: "#e8e8e8" }}>
                Real feedback from real institutions
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.12 }}
                  className="p-8 rounded-lg flex flex-col gap-6 bg-card border border-border"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star key={si} className="h-3.5 w-3.5" style={{ color: "#f59e0b", fill: "#f59e0b" }} />
                    ))}
                  </div>
                  <p style={{ color: "#666", fontSize: "14px", lineHeight: 1.8, flexGrow: 1 }}>"{t.quote}"</p>
                  <div>
                    <div style={{ color: "#c8c8c8", fontWeight: 600, fontSize: "13px" }}>{t.name}</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: "12px", marginTop: "2px" }}>{t.role} · {t.institution}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        ── END DISABLED ── */}

        {/* ── CTA ── */}
        <section className="py-28 px-6" style={{ borderTop: "1px solid var(--surface-4)" }}>
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative p-16 rounded-3xl text-center overflow-hidden bg-card border border-border"
            >
              <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(ellipse at 50% 0%, #0070f310 0%, transparent 60%)" }} />
              <div className="relative">
                <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 600, letterSpacing: "-0.03em", color: "#e8e8e8", marginBottom: "16px" }}>
                  Give it an afternoon.
                </h2>
                <p className="max-w-xl mx-auto mb-10" style={{ color: "var(--muted-foreground)", fontSize: "16px", lineHeight: 1.7 }}>
                  Bring the spreadsheet you've been using. Set your rules. Hit publish.
                  Students get a link. The scheduling committee loses a standing meeting.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <Link to="/workspace">
                    <motion.button
                      whileHover={{ scale: 1.03, boxShadow: "0 0 40px #0070f340" }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-2 px-8 py-3.5 rounded-md"
                      style={{ background: "linear-gradient(135deg, #0070f3, #5b8ef7)", color: "#fff", fontWeight: 500, fontSize: "15px" }}
                    >
                      Open the app <ArrowRight className="h-4 w-4" />
                    </motion.button>
                  </Link>
                  <Link to="/live/demo">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-2 px-8 py-3.5 rounded-md"
                      style={{ background: "#ffffff08", color: "#999", border: "1px solid var(--surface-border-accent)", fontSize: "15px" }}
                    >
                      Take a tour first
                    </motion.button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="py-16 px-6" style={{ borderTop: "1px solid var(--surface-4)" }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
              {/* Brand */}
              <div className="col-span-2">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0070f3, #8b5cf6)" }}>
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <span style={{ color: "var(--foreground)", fontWeight: 600, fontSize: "16px" }}>ChronoLink</span>
                </div>
                <p style={{ color: "#3a3a4a", fontSize: "13px", lineHeight: 1.8, maxWidth: "280px" }}>
                  Scheduling software for institutions that are tired of spreadsheets and last-minute room-change emails.
                </p>
              </div>

              {/* Links */}
              {[
                { heading: "Product", links: ["Features", "Optimization", "Integrations", "Changelog"] },
                { heading: "Roles", links: ["For Admins", "For Faculty", "For Students", "Live View"] },
                { heading: "Company", links: ["About", "Blog", "Privacy", "Terms"] },
              ].map(({ heading, links }) => (
                <div key={heading}>
                  <div className="mb-4 text-xs" style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>{heading}</div>
                  <ul className="space-y-2.5">
                    {links.map(link => (
                      <li key={link}>
                        <a href="#" className="text-sm transition-colors" style={{ color: "#3a3a4a" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#3a3a4a")}
                        >{link}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1px solid var(--surface-4)" }}>
              <p style={{ color: "#2a2a3a", fontSize: "12px" }}>© 2026 ChronoLink. Made by people who've sat through too many scheduling meetings.</p>
              <div className="flex items-center gap-4">
                {["Twitter", "GitHub", "LinkedIn"].map(s => (
                  <a key={s} href="#" className="text-xs transition-colors" style={{ color: "#2a2a3a" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#2a2a3a")}
                  >{s}</a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
      `}</style>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
    </div>
  );
}


