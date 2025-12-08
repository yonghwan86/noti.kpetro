export type Role = 'admin' | 'manager' | 'staff';

export interface Team {
  id: string;
  name: string;
  contactEmail: string;
}

export interface User {
  id: string;
  username: string;
  role: Role;
  teamId: string;
  avatar?: string;
}

export interface Category {
  id: string;
  name: string;
}

export type AssetStatus = 'ok' | 'upcoming' | 'overdue';

export interface Asset {
  id: string;
  name: string;
  serialNumber: string;
  categoryId: string;
  teamId: string;
  inspectionCycleDays: number;
  lastInspectedDate: string; // ISO date string
  nextDueDate: string; // ISO date string
  status: AssetStatus;
  notes?: string;
}

export interface InspectionLog {
  id: string;
  assetId: string;
  inspectorId: string;
  date: string;
  notes: string;
}
