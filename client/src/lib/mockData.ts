import { Asset, AssetStatus, Category, Team, User } from './types';
import { addMonths, differenceInDays, parseISO } from 'date-fns';

// Initial Mock Data

export const TEAMS: Team[] = [
  { id: 't1', name: '엔지니어링 A팀', contactEmail: 'eng-a@example.com' },
  { id: 't2', name: '물류팀', contactEmail: 'logistics@example.com' },
  { id: 't3', name: '품질관리팀', contactEmail: 'qc@example.com' },
];

export const CATEGORIES: Category[] = [
  { id: 'c1', name: '계측기' },
  { id: 'c2', name: '차량' },
  { id: 'c3', name: '중장비' },
];

export const USERS: User[] = [
  { id: 'u1', username: '슈퍼 관리자', role: 'admin', teamId: 't1' }, // Admin has access to all
  { id: 'u2', username: '엔지니어링 팀장', role: 'manager', teamId: 't1' },
  { id: 'u3', username: '엔지니어링 담당자', role: 'staff', teamId: 't1' },
  { id: 'u4', username: '물류 팀장', role: 'manager', teamId: 't2' },
];

// Helper to calculate status
const calculateStatus = (nextDueDate: string): AssetStatus => {
  const today = new Date();
  const due = parseISO(nextDueDate);
  const diff = differenceInDays(due, today);

  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'upcoming'; // Alert 7 days before
  return 'ok';
};

const initialAssets: Asset[] = [
  {
    id: 'a1',
    name: '정밀 저울 X200',
    serialNumber: 'SN-2023-001',
    categoryId: 'c1',
    teamId: 't1',
    inspectionCycleMonths: 1, // 1 month
    lastInspectedDate: '2025-05-01',
    nextDueDate: '2025-06-01',
    status: 'overdue', // Example: manually set or calculated to be overdue for demo
  },
  {
    id: 'a2',
    name: '지게차 F-500',
    serialNumber: 'VH-9982',
    categoryId: 'c2',
    teamId: 't2',
    inspectionCycleMonths: 3, // 3 months
    lastInspectedDate: '2025-06-15',
    nextDueDate: '2025-09-15',
    status: 'ok',
  },
  {
    id: 'a3',
    name: '분광광도계 Pro',
    serialNumber: 'SP-112',
    categoryId: 'c1',
    teamId: 't3',
    inspectionCycleMonths: 6, // 6 months
    lastInspectedDate: '2025-01-10',
    nextDueDate: '2025-07-10',
    status: 'upcoming',
  },
];

// Simple in-memory store
class Store {
  assets: Asset[];
  categories: Category[];
  currentUser: User;

  constructor() {
    this.assets = initialAssets.map(a => ({
      ...a,
      status: calculateStatus(a.nextDueDate) // Recalculate on load for demo
    }));
    this.categories = [...CATEGORIES];
    this.currentUser = USERS[0]; // Default to Admin
  }

  getAssets() {
    return this.assets;
  }

  getCategories() {
    return this.categories;
  }

  addCategory(name: string) {
    const newCategory: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name
    };
    this.categories.push(newCategory);
    return newCategory;
  }

  deleteCategory(id: string) {
    this.categories = this.categories.filter(c => c.id !== id);
  }

  getAssetsByTeam(teamId: string) {
    return this.assets.filter(a => a.teamId === teamId);
  }

  addAsset(asset: Omit<Asset, 'id' | 'status' | 'nextDueDate'>) {
    const nextDueDate = addMonths(parseISO(asset.lastInspectedDate), asset.inspectionCycleMonths).toISOString().split('T')[0];
    const newAsset: Asset = {
      ...asset,
      id: Math.random().toString(36).substr(2, 9),
      nextDueDate,
      status: calculateStatus(nextDueDate)
    };
    this.assets.push(newAsset);
    return newAsset;
  }

  updateAssetInspection(id: string, newDate: string) {
    const index = this.assets.findIndex(a => a.id === id);
    if (index !== -1) {
      const asset = this.assets[index];
      const nextDueDate = addMonths(parseISO(newDate), asset.inspectionCycleMonths).toISOString().split('T')[0];
      this.assets[index] = {
        ...asset,
        lastInspectedDate: newDate,
        nextDueDate,
        status: calculateStatus(nextDueDate)
      };
      return this.assets[index];
    }
    return null;
  }
  
  updateAsset(id: string, updates: Partial<Asset>) {
    const index = this.assets.findIndex(a => a.id === id);
    if (index !== -1) {
      this.assets[index] = { ...this.assets[index], ...updates };
      // Recalculate logic if cycle changed
      if (updates.inspectionCycleMonths || updates.lastInspectedDate) {
         const asset = this.assets[index];
         const nextDueDate = addMonths(parseISO(asset.lastInspectedDate), asset.inspectionCycleMonths).toISOString().split('T')[0];
         this.assets[index].nextDueDate = nextDueDate;
         this.assets[index].status = calculateStatus(nextDueDate);
      }
      return this.assets[index];
    }
    return null;
  }

  deleteAsset(id: string) {
    this.assets = this.assets.filter(a => a.id !== id);
  }

  setCurrentUser(userId: string) {
    const user = USERS.find(u => u.id === userId);
    if (user) this.currentUser = user;
  }
}

export const store = new Store();
