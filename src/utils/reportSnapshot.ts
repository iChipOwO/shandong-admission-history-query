import type { AdmissionReport } from '../types/report';

export interface ReportSnapshot {
  id: string;
  createdAt: string;
  reason: string;
  reports: AdmissionReport[];
}

export function loadSnapshots(): ReportSnapshot[] {
  return [];
}

export function saveSnapshot(_reports: AdmissionReport[], _reason: string): ReportSnapshot {
  return {
    id: '',
    createdAt: '',
    reason: '',
    reports: []
  };
}

export function getLatestSnapshot(): ReportSnapshot | null {
  return null;
}

export function deleteSnapshotById(_id: string): void {
  return;
}

