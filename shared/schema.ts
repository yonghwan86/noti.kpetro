import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactEmail: text("contact_email").notNull(),
  phone: text("phone"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  role: text("role").notNull(),
  teamId: varchar("team_id").notNull().references(() => teams.id),
  email: text("email"),
  phone: text("phone"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  serialNumber: text("serial_number").notNull().unique(),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  teamId: varchar("team_id").notNull().references(() => teams.id),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  usageTeamId: varchar("usage_team_id").notNull().references(() => teams.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  inspectionCycleMonths: integer("inspection_cycle_months").notNull(),
  lastInspectedDate: text("last_inspected_date").notNull(),
  nextDueDate: text("next_due_date").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
});

export const insertAssetSchema = createInsertSchema(assets).omit({ 
  id: true,
  nextDueDate: true,
  status: true
});
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

export const inspectionLogs = pgTable("inspection_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  inspectorId: varchar("inspector_id").notNull().references(() => users.id),
  date: timestamp("date").notNull().defaultNow(),
  notes: text("notes").notNull(),
});

export const insertInspectionLogSchema = createInsertSchema(inspectionLogs).omit({ 
  id: true
});
export type InsertInspectionLog = z.infer<typeof insertInspectionLogSchema>;
export type InspectionLog = typeof inspectionLogs.$inferSelect;
