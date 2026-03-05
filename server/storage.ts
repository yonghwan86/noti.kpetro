import { db } from "../db";
import { 
  type User, 
  type InsertUser, 
  type Team, 
  type InsertTeam,
  type Category,
  type InsertCategory,
  type Asset,
  type InsertAsset,
  type InspectionLog,
  type InsertInspectionLog,
  type AssetHistory,
  type InsertAssetHistory,
  users,
  teams,
  categories,
  assets,
  inspectionLogs,
  assetHistory
} from "@shared/schema";
import { eq, or, desc } from "drizzle-orm";
import { addDays, parseISO, differenceInDays, isWeekend, nextMonday } from "date-fns";
import { encrypt, decrypt } from "./encryption";

function decryptUser(user: User): User {
  return {
    ...user,
    username: decrypt(user.username),
  };
}

function encryptUsername(username: string): string {
  return encrypt(username);
}

const skipWeekends = (date: Date): Date => {
  return isWeekend(date) ? nextMonday(date) : date;
};

const calculateNextDueDate = (lastDate: string, cycleDays: number): string => {
  const base = parseISO(lastDate);
  const raw = addDays(base, cycleDays - 1);
  const adjusted = skipWeekends(raw);
  return adjusted.toISOString().split('T')[0];
};

const calculateStatus = (nextDueDate: string, suspendedReason?: string | null): 'ok' | 'upcoming' | 'overdue' | 'suspended' => {
  if (suspendedReason) return 'suspended';
  const today = new Date();
  const due = parseISO(nextDueDate);
  const diff = differenceInDays(due, today);

  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'upcoming';
  return 'ok';
};

export interface IStorage {
  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, updates: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<void>;

  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;

  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  demoteManager(id: string): Promise<User | undefined>;

  getAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, updates: Partial<Asset>): Promise<Asset | undefined>;
  updateAssetInspection(id: string, newDate: string): Promise<Asset | undefined>;
  suspendAsset(id: string, reason: string): Promise<Asset | undefined>;
  resumeAsset(id: string): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<void>;

  getLogs(): Promise<InspectionLog[]>;
  getLog(id: string): Promise<InspectionLog | undefined>;
  createLog(log: InsertInspectionLog): Promise<InspectionLog>;

  getAssetHistoryByAsset(assetId: string): Promise<AssetHistory[]>;
  getAssetHistoryByCategory(categoryId: string): Promise<AssetHistory[]>;
  getAllAssetHistory(): Promise<AssetHistory[]>;
  createAssetHistory(entry: InsertAssetHistory): Promise<AssetHistory>;
  getOrCreateTeam(department: string, name: string): Promise<Team>;
}

export class PostgresStorage implements IStorage {
  async getOrCreateTeam(department: string, name: string): Promise<Team> {
    const existing = await db.select().from(teams).where(
      or(
        eq(teams.department, department),
        eq(teams.department, null)
      )
    );
    // filter manually because or logic above is a bit loose
    const exactMatch = existing.find(t => t.department === department && t.name === name);
    if (exactMatch) return exactMatch;

    const [created] = await db.insert(teams).values({
      department,
      name,
      type: 'usage', // Default type
      contactEmail: 'pending@example.com', // Placeholder
    }).returning();
    return created;
  }

  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const result = await db.select().from(teams).where(eq(teams.id, id));
    return result[0];
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const result = await db.insert(teams).values(team).returning();
    return result[0];
  }

  async updateTeam(id: string, updates: Partial<InsertTeam>): Promise<Team | undefined> {
    const result = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return result[0];
  }

  async deleteTeam(id: string): Promise<void> {
    const referencedUsers = await db.select({ id: users.id }).from(users)
      .where(eq(users.teamId, id));
    if (referencedUsers.length > 0) {
      throw new Error(`REFERENCED:${referencedUsers.length}:users`);
    }
    const referencedAssets = await db.select({ id: assets.id }).from(assets)
      .where(or(eq(assets.teamId, id), eq(assets.usageTeamId, id)));
    if (referencedAssets.length > 0) {
      throw new Error(`REFERENCED:${referencedAssets.length}:assets`);
    }
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    return result[0];
  }

  async deleteCategory(id: string): Promise<void> {
    const referencedAssets = await db.select({ id: assets.id }).from(assets)
      .where(eq(assets.categoryId, id));
    if (referencedAssets.length > 0) {
      throw new Error(`REFERENCED:${referencedAssets.length}`);
    }
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result.map(decryptUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] ? decryptUser(result[0]) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const allUsers = await db.select().from(users);
    const found = allUsers.find(u => decrypt(u.username) === username);
    return found ? decryptUser(found) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] ? decryptUser(result[0]) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const encryptedUser = {
      ...user,
      username: encryptUsername(user.username),
    };
    const result = await db.insert(users).values(encryptedUser).returning();
    return decryptUser(result[0]);
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const encryptedUpdates = { ...updates };
    if (encryptedUpdates.username) {
      encryptedUpdates.username = encryptUsername(encryptedUpdates.username);
    }
    const result = await db.update(users).set(encryptedUpdates).where(eq(users.id, id)).returning();
    return result[0] ? decryptUser(result[0]) : undefined;
  }

  async demoteManager(id: string): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user || user.role !== 'manager') return undefined;
    
    return await db.transaction(async (tx) => {
      const allCategories = await tx.select().from(categories);
      for (const cat of allCategories) {
        if (cat.managerIds && cat.managerIds.includes(id)) {
          const newIds = cat.managerIds.filter(mid => mid !== id);
          await tx.update(categories).set({ managerIds: newIds }).where(eq(categories.id, cat.id));
        }
      }
      const result = await tx.update(users).set({ role: 'staff' }).where(eq(users.id, id)).returning();
      return result[0] ? decryptUser(result[0]) : undefined;
    });
  }

  async deleteUser(id: string): Promise<void> {
    const referencedAssets = await db.select({ id: assets.id }).from(assets)
      .where(or(eq(assets.managerId, id), eq(assets.staffId, id)));
    if (referencedAssets.length > 0) {
      throw new Error(`REFERENCED:${referencedAssets.length}`);
    }
    const referencedLogs = await db.select({ id: inspectionLogs.id }).from(inspectionLogs)
      .where(eq(inspectionLogs.inspectorId, id));
    if (referencedLogs.length > 0) {
      await db.delete(inspectionLogs).where(eq(inspectionLogs.inspectorId, id));
    }
    await db.delete(users).where(eq(users.id, id));
  }

  async getAssets(): Promise<Asset[]> {
    return await db.select().from(assets);
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const result = await db.select().from(assets).where(eq(assets.id, id));
    return result[0];
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const nextDueDate = calculateNextDueDate(asset.lastInspectedDate, asset.inspectionCycleDays);
    const status = calculateStatus(nextDueDate);
    
    const result = await db.insert(assets).values({
      ...asset,
      nextDueDate,
      status
    }).returning();
    return result[0];
  }

  async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset | undefined> {
    const asset = await this.getAsset(id);
    if (!asset) return undefined;

    if (asset.status === 'suspended' && !updates.suspendedReason && updates.suspendedReason !== null) {
      updates.status = 'suspended';
      const result = await db.update(assets).set(updates).where(eq(assets.id, id)).returning();
      return result[0];
    }

    let nextDueDate = asset.nextDueDate;
    if (updates.inspectionCycleDays || updates.lastInspectedDate) {
      const cycleDays = updates.inspectionCycleDays ?? asset.inspectionCycleDays;
      const lastDate = updates.lastInspectedDate ?? asset.lastInspectedDate;
      nextDueDate = calculateNextDueDate(lastDate, cycleDays);
    }

    const suspendedReason = updates.suspendedReason !== undefined ? updates.suspendedReason : asset.suspendedReason;
    const status = calculateStatus(nextDueDate, suspendedReason);
    
    const result = await db.update(assets).set({
      ...updates,
      nextDueDate,
      status
    }).where(eq(assets.id, id)).returning();
    return result[0];
  }

  async updateAssetInspection(id: string, newDate: string): Promise<Asset | undefined> {
    const asset = await this.getAsset(id);
    if (!asset) return undefined;

    const nextDueDate = calculateNextDueDate(newDate, asset.inspectionCycleDays);
    const status = calculateStatus(nextDueDate, asset.suspendedReason);

    const result = await db.update(assets).set({
      lastInspectedDate: newDate,
      nextDueDate,
      status
    }).where(eq(assets.id, id)).returning();
    
    return result[0];
  }

  async suspendAsset(id: string, reason: string): Promise<Asset | undefined> {
    const result = await db.update(assets).set({
      suspendedReason: reason,
      status: 'suspended'
    }).where(eq(assets.id, id)).returning();
    return result[0];
  }

  async resumeAsset(id: string): Promise<Asset | undefined> {
    const asset = await this.getAsset(id);
    if (!asset) return undefined;

    const status = calculateStatus(asset.nextDueDate);
    const result = await db.update(assets).set({
      suspendedReason: null,
      status
    }).where(eq(assets.id, id)).returning();
    return result[0];
  }

  async deleteAsset(id: string): Promise<void> {
    await db.delete(inspectionLogs).where(eq(inspectionLogs.assetId, id));
    await db.delete(assetHistory).where(eq(assetHistory.assetId, id));
    await db.delete(assets).where(eq(assets.id, id));
  }

  async getLogs(): Promise<InspectionLog[]> {
    return await db.select().from(inspectionLogs).orderBy(desc(inspectionLogs.date));
  }

  async getLog(id: string): Promise<InspectionLog | undefined> {
    const result = await db.select().from(inspectionLogs).where(eq(inspectionLogs.id, id));
    return result[0];
  }

  async createLog(log: InsertInspectionLog): Promise<InspectionLog> {
    const result = await db.insert(inspectionLogs).values(log).returning();
    return result[0];
  }

  async getAssetHistoryByAsset(assetId: string): Promise<AssetHistory[]> {
    return await db.select().from(assetHistory)
      .where(eq(assetHistory.assetId, assetId))
      .orderBy(desc(assetHistory.date));
  }

  async getAssetHistoryByCategory(categoryId: string): Promise<AssetHistory[]> {
    const categoryAssets = await db.select({ id: assets.id }).from(assets)
      .where(eq(assets.categoryId, categoryId));
    const assetIds = categoryAssets.map(a => a.id);
    if (assetIds.length === 0) return [];
    
    const allHistory = await db.select().from(assetHistory).orderBy(desc(assetHistory.date));
    return allHistory.filter(h => assetIds.includes(h.assetId));
  }

  async getAllAssetHistory(): Promise<AssetHistory[]> {
    return await db.select().from(assetHistory).orderBy(desc(assetHistory.date));
  }

  async createAssetHistory(entry: InsertAssetHistory): Promise<AssetHistory> {
    const result = await db.insert(assetHistory).values(entry).returning();
    return result[0];
  }
}

export const storage = new PostgresStorage();
