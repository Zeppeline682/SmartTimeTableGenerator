import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { FacultyLayout } from "./components/FacultyLayout";
import { StudentLayout } from "./components/StudentLayout";
import { ChannelGate } from "./components/ChannelGate";
import { Dashboard } from "./components/Dashboard";
import { TimetableWorkspace } from "./components/TimetableWorkspace";
import { FacultyDashboard } from "./components/FacultyDashboard";
import { FacultySchedulePage } from "./components/faculty/FacultySchedulePage";
import { FacultyPreferencesPage } from "./components/faculty/FacultyPreferencesPage";
import { FacultyProfilePage } from "./components/faculty/FacultyProfilePage";
import { StudentDashboard } from "./components/student/StudentDashboard";
import { StudentTimetablePage } from "./components/student/StudentTimetablePage";
import { StudentAnnouncementsPage } from "./components/student/StudentAnnouncementsPage";
import { StudentProfilePage } from "./components/student/StudentProfilePage";
import { OptimizationView } from "./components/OptimizationView";
import { IntegrationHub } from "./components/IntegrationHub";
import { RoomManagement } from "./components/RoomManagement";
import { SettingsPage } from "./components/SettingsPage";
import { LiveView } from "./components/LiveView";
import { LandingPage } from "./components/LandingPage";
import { NotFound } from "./components/NotFound";
import { AdminDirectory } from "./components/AdminDirectory";
import { AccessManagementPage } from "./components/AccessManagementPage";
import { AdminClassesPage } from "./components/AdminClassesPage";
import { AdminNotificationsPage } from "./components/AdminNotificationsPage";

function AdminChannelLayout() {
  return (
    <ChannelGate channel="admin">
      <RootLayout />
    </ChannelGate>
  );
}

function FacultyChannelLayout() {
  return (
    <ChannelGate channel="faculty">
      <FacultyLayout />
    </ChannelGate>
  );
}

function StudentChannelLayout() {
  return (
    <ChannelGate channel="student">
      <StudentLayout />
    </ChannelGate>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
  },

  // ── Admin shell (full sidebar with all screens) ──────────
  {
    Component: AdminChannelLayout,
    children: [
      { path: "/dashboard",    Component: Dashboard },
      { path: "/classes",      Component: AdminClassesPage },
      { path: "/workspace",    Component: TimetableWorkspace },
      { path: "/workspace/:groupId", Component: TimetableWorkspace },
      // { path: "/optimize",     Component: OptimizationView },
      { path: "/integrations", Component: IntegrationHub },
      { path: "/rooms",        Component: RoomManagement },
      { path: "/directory",    Component: AdminDirectory },
      { path: "/access",       Component: AccessManagementPage },
      { path: "/settings",     Component: SettingsPage },
      { path: "/notifications", Component: AdminNotificationsPage },
      // legacy aliases
      { path: "/app",              Component: Dashboard },
      { path: "/app/workspace",    Component: TimetableWorkspace },
      // { path: "/app/optimize",     Component: OptimizationView },
      { path: "/app/integrations", Component: IntegrationHub },
    ],
  },

  // ── Faculty portal (own layout, own navigation) ──────────
  {
    path: "/faculty",
    Component: FacultyChannelLayout,
    children: [
      { index: true,              Component: FacultyDashboard     },
      { path: "schedule",         Component: FacultySchedulePage  },
      { path: "preferences",      Component: FacultyPreferencesPage },
      { path: "profile",          Component: FacultyProfilePage   },
    ],
  },

  // ── Student portal ───────────────────────────────────────
  {
    path: "/student",
    Component: StudentChannelLayout,
    children: [
      { index: true,               Component: StudentDashboard       },
      { path: "timetable",         Component: StudentTimetablePage   },
      { path: "announcements",     Component: StudentAnnouncementsPage },
      { path: "profile",           Component: StudentProfilePage     },
    ],
  },

  // ── Public live view ─────────────────────────────────────
  {
    path: "/live/:schedule_id",
    Component: LiveView,
  },
  {
    path: "/live/:linkId",
    Component: LiveView,
  },

  // ── 404 catch-all ────────────────────────────────────────
  {
    path: "*",
    Component: NotFound,
  },
]);

