/**
 * Access Store — persists the admin's list of granted portal accounts.
 * Faculty accounts are created by admins. Student accounts are self-registered.
 * This is a localStorage-backed store; in production it would be a backend API.
 */

export type PortalRole = 'faculty' | 'student';
export type AccessStatus = 'active' | 'suspended';

export interface PortalAccount {
  id: string;
  role: PortalRole;
  name: string;
  email: string;
  department?: string;        // faculty only
  group?: string;             // student only — student group name
  tempPassword?: string;      // faculty only — shown once on creation
  status: AccessStatus;
  grantedAt: string;          // ISO string
  lastSeen?: string;          // ISO string, optional
}

const STORE_KEY = 'chronolink.access-registry.v1';

const DEFAULT_ACCOUNTS: PortalAccount[] = [
  {
    id: 'fac-demo-001',
    role: 'faculty',
    name: 'Dr. Priya Nair',
    email: 'priya.nair@institution.edu',
    department: 'Computer Science',
    status: 'active',
    grantedAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
    lastSeen: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'fac-demo-002',
    role: 'faculty',
    name: 'Prof. Rahul Desai',
    email: 'r.desai@institution.edu',
    department: 'Mathematics',
    status: 'active',
    grantedAt: new Date(Date.now() - 14 * 86400_000).toISOString(),
  },
  {
    id: 'stu-demo-001',
    role: 'student',
    name: 'Aisha Khan',
    email: 'aisha.khan@students.edu',
    group: 'CS-A (Sem 3)',
    status: 'active',
    grantedAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    lastSeen: new Date(Date.now() - 1800_000).toISOString(),
  },
  {
    id: 'stu-demo-002',
    role: 'student',
    name: 'Rohan Mehta',
    email: 'rohan.m@students.edu',
    group: 'CS-B (Sem 3)',
    status: 'active',
    grantedAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
  },
  {
    id: 'stu-demo-003',
    role: 'student',
    name: 'Sneha Patel',
    email: 'sneha.p@students.edu',
    group: 'CS-A (Sem 3)',
    status: 'suspended',
    grantedAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
  },
];

function read(): PortalAccount[] {
  if (typeof window === 'undefined') return DEFAULT_ACCOUNTS;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      write(DEFAULT_ACCOUNTS);
      return DEFAULT_ACCOUNTS;
    }
    const parsed = JSON.parse(raw) as PortalAccount[];
    return Array.isArray(parsed) ? parsed : DEFAULT_ACCOUNTS;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

function write(accounts: PortalAccount[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(accounts));
}

export const accessStore = {
  getAll(): PortalAccount[] { return read(); },

  add(account: PortalAccount): void {
    const list = read();
    list.push(account);
    write(list);
  },

  update(id: string, patch: Partial<PortalAccount>): void {
    const list = read().map(a => a.id === id ? { ...a, ...patch } : a);
    write(list);
  },

  remove(id: string): void {
    write(read().filter(a => a.id !== id));
  },

  toggleStatus(id: string): void {
    const list = read().map(a =>
      a.id === id ? { ...a, status: (a.status === 'active' ? 'suspended' : 'active') as AccessStatus } : a
    );
    write(list);
  },
};

export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Never';
  const delta = Date.now() - new Date(isoString).getTime();
  if (delta < 60_000) return 'Just now';
  if (delta < 3600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86400_000) return `${Math.floor(delta / 3600_000)}h ago`;
  return `${Math.floor(delta / 86400_000)}d ago`;
}
