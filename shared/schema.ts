import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("management"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  staffEmail: text("staff_email"),
  staffPhone: text("staff_phone"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true }).extend({
  type: z.enum(["management", "usage"]).default("management"),
  contactEmail: z.string().nullable().optional(),
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  managerIds: text("manager_ids").array().default(sql`'{}'::text[]`),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  fullName: text("full_name"),
  role: text("role").notNull(),
  teamId: varchar("team_id").notNull().references(() => teams.id),
  managerId: varchar("manager_id"),
  position: text("position"),
  email: text("email"),
  phone: text("phone"),
  passwordHash: text("password_hash"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, passwordHash: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  serialNumber: text("serial_number").notNull().unique(),
  categoryId: varchar("category_id"),
  teamId: varchar("team_id").notNull().references(() => teams.id),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  usageTeamId: varchar("usage_team_id").notNull().references(() => teams.id),
  staffId: varchar("staff_id").notNull().references(() => users.id),
  inspectionCycleDays: integer("inspection_cycle_days").notNull(),
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
