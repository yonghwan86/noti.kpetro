import { addMonths, differenceInDays, parseISO } from 'date-fns';

export type Role = 'admin' | 'manager' | 'staff';

export interface Team {
  id: string;
  name: string;
  type: 'management' | 'usage';
  contactEmail: string;
  phone?: string | null;
  staffEmail?: string | null;
  staffPhone?: string | null;
}

export interface User {
  id: string;
  username: string;
  fullName?: string | null;
  role: Role;
  teamId: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string;
}

export interface Category {
  id: string;
  name: string;
  managerId?: string | null;
}

export type AssetStatus = 'ok' | 'upcoming' | 'overdue';

export interface Asset {
  id: string;
  name: string;
  serialNumber: string;
  categoryId: string;
  teamId: string; // Managing Team (관리 팀)
  managerId: string; // Equipment Manager (장비 관리자)
  usageTeamId: string; // Usage Team (사용 팀)
  staffId: string; // Staff/Person in Charge (담당자)
  inspectionCycleMonths: number;
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
