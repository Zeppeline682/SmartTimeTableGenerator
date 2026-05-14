/**
 * useWorkspaceStore — reads the live workspace state from localStorage.
 *
 * TimetableWorkspace is the canonical writer. Every other page uses this
 * hook to read the same data so nothing is ever hardcoded or duplicated.
 *
 * The hook re-renders automatically when the ImportWizard fires
 * 'chronolink:import' (same-tab) or a storage event (cross-tab).
 */

import { useState, useEffect } from 'react';
import type { Faculty, Room, Group, Subject, TimeSlot, ClassConfig, GroupFacultyAssignment } from '../types';

export const WORKSPACE_STORAGE_KEY = 'realtime-timetable.workspace.v2';

export interface TimeBlockWindow {
  id: string;
  name: string;
  enabled: boolean;
  startTime: string;
  durationMinutes: number;
  reason?: string;
}

export interface FacultyAbsence {
  id: string;
  facultyName: string;
  date: string; // ISO date string or 'tomorrow' etc
  status: 'pending' | 'applied';
}

export interface WorkspaceSnapshot {
  teachers: Faculty[];
  rooms: Room[];
  groups: Group[];
  subjects: Subject[];
  slots: TimeSlot[];
  classConfigs: ClassConfig[];
  groupFaculty: GroupFacultyAssignment[];
  facultyAbsences?: FacultyAbsence[];
  solverConstraints?: any[];
  activeGroupId?: string;
  liveGroupId?: string | null;
  workspaceMode?: 'workbench' | 'live';
  rightPanelTab?: 'constraints' | 'customization' | 'classes' | 'errors' | 'notifications';
  periodDurationMinutes?: number;
  dayStartTime?: string;
  schoolEndTime?: string;
  breakWindows?: TimeBlockWindow[];
}

function readWorkspace(): WorkspaceSnapshot {
  try {
    const raw = typeof window !== 'undefined'
      ? window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
      : null;
    if (!raw) return { teachers: [], rooms: [], groups: [], subjects: [], slots: [], classConfigs: [], groupFaculty: [], facultyAbsences: [], solverConstraints: [] };
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    return {
      teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      slots: Array.isArray(parsed.slots) ? parsed.slots : [],
      classConfigs: Array.isArray(parsed.classConfigs) ? parsed.classConfigs : [],
      groupFaculty: Array.isArray(parsed.groupFaculty) ? parsed.groupFaculty : [],
      facultyAbsences: Array.isArray(parsed.facultyAbsences) ? parsed.facultyAbsences : [],
      solverConstraints: Array.isArray(parsed.solverConstraints) ? parsed.solverConstraints : [],
      activeGroupId: parsed.activeGroupId,
      liveGroupId: parsed.liveGroupId,
      workspaceMode: parsed.workspaceMode,
      rightPanelTab: parsed.rightPanelTab as any,
      periodDurationMinutes: parsed.periodDurationMinutes,
      dayStartTime: parsed.dayStartTime,
      schoolEndTime: parsed.schoolEndTime,
      breakWindows: Array.isArray(parsed.breakWindows) ? parsed.breakWindows : [],
    };
  } catch {
    return { teachers: [], rooms: [], groups: [], subjects: [], slots: [], classConfigs: [], groupFaculty: [], facultyAbsences: [], solverConstraints: [] };
  }
}

/**
 * React hook — returns live workspace data and re-renders on import events.
 */
export function useWorkspaceStore(): WorkspaceSnapshot {
  const [data, setData] = useState<WorkspaceSnapshot>(readWorkspace);

  useEffect(() => {
    function refresh() {
      setData(readWorkspace());
    }

    // Cross-tab: standard storage event
    function onStorage(e: StorageEvent) {
      if (e.key === WORKSPACE_STORAGE_KEY) refresh();
    }

    // Same-tab: custom event fired by ImportWizard
    window.addEventListener('storage', onStorage);
    window.addEventListener('chronolink:import', refresh);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('chronolink:import', refresh);
    };
  }, []);

  return data;
}

/** One-time synchronous read (no hook) for non-component contexts. */
export function getWorkspaceData(): WorkspaceSnapshot {
  return readWorkspace();
}