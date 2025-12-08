import { Asset, AssetStatus, Category, Team, User } from './types';
import { addDays, differenceInDays, isBefore, isPast, parseISO } from 'date-fns';

// Initial Mock Data

export const TEAMS: Team[] = [
  { id: 't1', name: 'Engineering A', contactEmail: 'eng-a@example.com' },
  { id: 't2', name: 'Logistics', contactEmail: 'logistics@example.com' },
  { id: 't3', name: 'Quality Control', contactEmail: 'qc@example.com' },
];

export const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Measuring Instruments' },
  { id: 'c2', name: 'Vehicles' },
  { id: 'c3', name: 'Heavy Machinery' },
];

export const USERS: User[] = [
  { id: 'u1', username: 'Super Admin', role: 'admin', teamId: 't1' }, // Admin has access to all
  { id: 'u2', username: 'Eng Manager', role: 'manager', teamId: 't1' },
  { id: 'u3', username: 'Eng Staff', role: 'staff', teamId: 't1' },
  { id: 'u4', username: 'Log Manager', role: 'manager', teamId: 't2' },
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
    name: 'Precision Scale X200',
    serialNumber: 'SN-2023-001',
    categoryId: 'c1',
    teamId: 't1',
    inspectionCycleDays: 30,
    lastInspectedDate: '2025-05-01',
    nextDueDate: '2025-05-31',
    status: 'overdue', // Example: manually set or calculated to be overdue for demo
  },
  {
    id: 'a2',
    name: 'Forklift F-500',
    serialNumber: 'VH-9982',
    categoryId: 'c2',
    teamId: 't2',
    inspectionCycleDays: 90,
    lastInspectedDate: '2025-06-15',
    nextDueDate: '2025-09-13',
    status: 'ok',
  },
  {
    id: 'a3',
    name: 'Spectrometer Pro',
    serialNumber: 'SP-112',
    categoryId: 'c1',
    teamId: 't3',
    inspectionCycleDays: 180,
    lastInspectedDate: '2025-01-10',
    nextDueDate: '2025-07-09',
    status: 'upcoming',
  },
];

// Simple in-memory store
class Store {
  assets: Asset[];
  currentUser: User;

  constructor() {
    this.assets = initialAssets.map(a => ({
      ...a,
      status: calculateStatus(a.nextDueDate) // Recalculate on load for demo
    }));
    this.currentUser = USERS[0]; // Default to Admin
  }

  getAssets() {
    return this.assets;
  }

  getAssetsByTeam(teamId: string) {
    return this.assets.filter(a => a.teamId === teamId);
  }

  addAsset(asset: Omit<Asset, 'id' | 'status' | 'nextDueDate'>) {
    const nextDueDate = addDays(parseISO(asset.lastInspectedDate), asset.inspectionCycleDays).toISOString().split('T')[0];
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
      const nextDueDate = addDays(parseISO(newDate), asset.inspectionCycleDays).toISOString().split('T')[0];
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
      if (updates.inspectionCycleDays || updates.lastInspectedDate) {
         const asset = this.assets[index];
         const nextDueDate = addDays(parseISO(asset.lastInspectedDate), asset.inspectionCycleDays).toISOString().split('T')[0];
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
