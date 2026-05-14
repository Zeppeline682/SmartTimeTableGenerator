import { useSession } from "../auth/SessionContext";
import { useWorkspaceStore } from "./useWorkspaceStore";

export function useStudentProfile() {
  const { user } = useSession();
  const workspace = useWorkspaceStore();

  // Find the live group, or fallback to the first available group
  const liveGroup =
    workspace.groups.find((g) => g.isLive) ||
    workspace.groups[0] || {
      name: "Unassigned Group",
      course: "N/A",
      semester: 1,
      isLive: false,
      studentsCount: 0,
    };

  const studentProfile = {
    name: user.name,
    studentId: `STU-${new Date().getFullYear()}-001`,
    group: liveGroup,
    email: user.email,
    gpa: 4.0,
    phone: "+91 98765-43210", // Mock default
    joinedDate: "2023-08-15", // Mock default
  };

  return studentProfile;
}
