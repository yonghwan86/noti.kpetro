import { differenceInDays, parseISO } from 'date-fns';

export type Role = 'admin' | 'manager' | 'staff';

export interface Team {
  id: string;
  name: string;
  department?: string | null;
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
  managerId?: string | null;
  assignedCategoryIds?: string[] | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string;
  hasPassword?: boolean;
}

export interface Category {
  id: string;
  name: string;
  managerIds?: string[] | null;
  defaultCycleDays?: number | null;
}

export type AssetStatus = 'ok' | 'upcoming' | 'overdue' | 'suspended';

export interface Asset {
  id: string;
  name: string;
  serialNumber: string;
  categoryId?: string | null;
  teamId: string;
  managerId: string;
  usageTeamId: string;
  staffId: string;
  inspectionCycleDays: number;
  lastInspectedDate: string;
  nextDueDate: string;
  status: AssetStatus;
  suspendedReason?: string | null;
  notes?: string;
}

export interface InspectionLog {
  id: string;
  assetId: string;
  inspectorId: string;
  date: string;
  notes: string;
}

export interface AssetHistory {
  id: string;
  assetId: string;
  userId?: string | null;
  changeType: string;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  date: string;
  notes?: string | null;
}

export type ShareScope = 'private' | 'selected';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface PersonalTask {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  scheduledEndAt: string | null;
  repeatType: RepeatType;
  completed: boolean;
  shareScope: ShareScope;
  shareTeamIds?: string[] | null;
  shareUserIds?: string[] | null;
  lastMorningNotifiedDate: string | null;
  label: string | null;
  priority: number;
  createdAt: string;
}
