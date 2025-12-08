import { Asset, AssetStatus, Category, Team, User, InspectionLog } from './types';
import { addMonths, differenceInDays, parseISO, subDays, subHours } from 'date-fns';

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
    status: 'overdue', 
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

const initialLogs: InspectionLog[] = [
  {
    id: 'l1',
    assetId: 'a1',
    inspectorId: 'u2',
    date: subDays(new Date(), 2).toISOString(),
    notes: '정기 점검 완료. 상태 양호.',
  },
  {
    id: 'l2',
    assetId: 'a3',
    inspectorId: 'u1',
    date: subHours(new Date(), 5).toISOString(),
    notes: '긴급 점검 요청으로 인한 확인.',
  }
];

type Listener = () => void;

// Simple in-memory store with subscription
class Store {
  assets: Asset[];
  categories: Category[];
  teams: Team[];
  users: User[];
  logs: InspectionLog[];
  currentUser: User;
  listeners: Listener[] = [];

  constructor() {
    this.assets = initialAssets.map(a => ({
      ...a,
      status: calculateStatus(a.nextDueDate)
    }));
    this.categories = [...CATEGORIES];
    this.teams = [...TEAMS];
    this.users = [...USERS];
    this.logs = [...initialLogs];
    this.currentUser = USERS[0];
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  // --- Assets ---
  getAssets() { return this.assets; }
  getAssetsByTeam(teamId: string) { return this.assets.filter(a => a.teamId === teamId); }

  addAsset(asset: Omit<Asset, 'id' | 'status' | 'nextDueDate'>) {
    const nextDueDate = addMonths(parseISO(asset.lastInspectedDate), asset.inspectionCycleMonths).toISOString().split('T')[0];
    const newAsset: Asset = {
      ...asset,
      id: Math.random().toString(36).substr(2, 9),
      nextDueDate,
      status: calculateStatus(nextDueDate)
    };
    this.assets.push(newAsset);
    this.addLog({
      assetId: newAsset.id,
      inspectorId: this.currentUser.id,
      date: new Date().toISOString(),
      notes: '장비 신규 등록'
    });
    this.notify();
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
      
      this.addLog({
        assetId: asset.id,
        inspectorId: this.currentUser.id,
        date: new Date().toISOString(),
        notes: `정기 점검 수행 (다음 예정일: ${nextDueDate})`
      });

      this.notify();
      return this.assets[index];
    }
    return null;
  }
  
  updateAsset(id: string, updates: Partial<Asset>) {
    const index = this.assets.findIndex(a => a.id === id);
    if (index !== -1) {
      this.assets[index] = { ...this.assets[index], ...updates };
      if (updates.inspectionCycleMonths || updates.lastInspectedDate) {
         const asset = this.assets[index];
         const nextDueDate = addMonths(parseISO(asset.lastInspectedDate), asset.inspectionCycleMonths).toISOString().split('T')[0];
         this.assets[index].nextDueDate = nextDueDate;
         this.assets[index].status = calculateStatus(nextDueDate);
      }
      this.notify();
      return this.assets[index];
    }
    return null;
  }

  deleteAsset(id: string) {
    this.assets = this.assets.filter(a => a.id !== id);
    this.notify();
  }

  // --- Categories ---
  getCategories() { return this.categories; }
  addCategory(name: string) {
    const newCategory: Category = { id: Math.random().toString(36).substr(2, 9), name };
    this.categories.push(newCategory);
    this.notify();
    return newCategory;
  }
  updateCategory(id: string, name: string) {
    const index = this.categories.findIndex(c => c.id === id);
    if (index !== -1) {
      this.categories[index] = { ...this.categories[index], name };
      this.notify();
      return this.categories[index];
    }
    return null;
  }
  deleteCategory(id: string) { 
    this.categories = this.categories.filter(c => c.id !== id);
    this.notify();
  }

  // --- Teams & Users ---
  getTeams() { return this.teams; }
  
  addTeam(team: Omit<Team, 'id'>) {
    const newTeam = { ...team, id: Math.random().toString(36).substr(2, 9) };
    this.teams.push(newTeam);
    this.notify();
    return newTeam;
  }

  updateTeam(id: string, updates: Partial<Team>) {
    const index = this.teams.findIndex(t => t.id === id);
    if (index !== -1) {
      this.teams[index] = { ...this.teams[index], ...updates };
      this.notify();
      return this.teams[index];
    }
    return null;
  }

  deleteTeam(id: string) {
    this.teams = this.teams.filter(t => t.id !== id);
    // Optionally handle users/assets associated with this team
    this.notify();
  }

  getUsers() { return this.users; }
  
  addUser(user: Omit<User, 'id'>) {
    const newUser = { ...user, id: Math.random().toString(36).substr(2, 9) };
    this.users.push(newUser);
    this.notify();
    return newUser;
  }

  updateUser(id: string, updates: Partial<User>) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...updates };
      this.notify();
      return this.users[index];
    }
    return null;
  }

  deleteUser(id: string) {
    this.users = this.users.filter(u => u.id !== id);
    this.notify();
  }

  // --- Logs ---
  getLogs() {
    // Sort by date desc
    return this.logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  addLog(log: Omit<InspectionLog, 'id'>) {
    const newLog = { ...log, id: Math.random().toString(36).substr(2, 9) };
    this.logs.push(newLog);
    // Logs are usually added internally, but we might want to notify if we have a log viewer
    // this.notify(); 
    return newLog;
  }

  // --- Auth ---
  setCurrentUser(userId: string) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      this.currentUser = user;
      this.notify();
    }
  }
}

export const store = new Store();
