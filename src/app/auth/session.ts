export type AppRole = "developer" | "admin" | "faculty" | "student" | "guest";
export type AppChannel = "admin" | "faculty" | "student";

export const APP_ROLES: AppRole[] = ["developer", "admin", "faculty", "student"];

export const ROLE_DEFAULT_USER_NAME: Record<AppRole, string> = {
  developer: "Developer",
  admin: "Admin",
  faculty: "Faculty",
  student: "Student",
  guest: "Guest",
};

export interface SessionUser {
  id: string;
  name: string;
  email: string; // <-- Added email
  role: AppRole;
  tags?: string[];
}

// ... keep ROLE_DEFAULT_USER_NAME as is ...

export const DEFAULT_SESSION_USER: SessionUser = {
  id: "guest-001",
  name: "Guest User",
  email: "guest@institution.edu",
  role: "guest",
  tags: [],
};

const ROLE_CHANNEL_ACCESS: Record<AppRole, AppChannel[]> = {
  developer: ["admin", "faculty", "student"],
  admin: ["admin"],
  faculty: ["faculty"],
  student: ["student"],
  guest: [],
};

const ROLE_HOME_PATH: Record<AppRole, string> = {
  developer: "/dashboard",
  admin: "/dashboard",
  faculty: "/faculty",
  student: "/student",
  guest: "/",
};

const ROLE_LABELS: Record<AppRole, string> = {
  developer: "Developer",
  admin: "Admin",
  faculty: "Faculty",
  student: "Student",
  guest: "Guest",
};

export function canAccessChannel(role: AppRole, channel: AppChannel): boolean {
  return ROLE_CHANNEL_ACCESS[role].includes(channel);
}

export function getRoleHomePath(role: AppRole): string {
  return ROLE_HOME_PATH[role];
}

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role];
}