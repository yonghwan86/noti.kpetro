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
  users,
  teams,
  categories,
  assets,
  inspectionLogs
} from "@shared/schema";
import { eq, or, desc } from "drizzle-orm";
import { addMonths, parseISO, differenceInDays } from "date-fns";

const calculateStatus = (nextDueDate: string): 'ok' | 'upcoming' | 'overdue' => {
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
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  getAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, updates: Partial<Asset>): Promise<Asset | undefined>;
  updateAssetInspection(id: string, newDate: string): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<void>;

  getLogs(): Promise<InspectionLog[]>;
  getLog(id: string): Promise<InspectionLog | undefined>;
  createLog(log: InsertInspectionLog): Promise<InspectionLog>;
}

export class PostgresStorage implements IStorage {
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
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
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
    const nextDueDate = addMonths(parseISO(asset.lastInspectedDate), asset.inspectionCycleMonths).toISOString().split('T')[0];
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

    let nextDueDate = asset.nextDueDate;
    if (updates.inspectionCycleMonths || updates.lastInspectedDate) {
      const cycleMonths = updates.inspectionCycleMonths ?? asset.inspectionCycleMonths;
      const lastDate = updates.lastInspectedDate ?? asset.lastInspectedDate;
      nextDueDate = addMonths(parseISO(lastDate), cycleMonths).toISOString().split('T')[0];
    }

    const status = calculateStatus(nextDueDate);
    
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

    const nextDueDate = addMonths(parseISO(newDate), asset.inspectionCycleMonths).toISOString().split('T')[0];
    const status = calculateStatus(nextDueDate);

    const result = await db.update(assets).set({
      lastInspectedDate: newDate,
      nextDueDate,
      status
    }).where(eq(assets.id, id)).returning();
    
    return result[0];
  }

  async deleteAsset(id: string): Promise<void> {
    await db.delete(inspectionLogs).where(eq(inspectionLogs.assetId, id));
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
}

export const storage = new PostgresStorage();
