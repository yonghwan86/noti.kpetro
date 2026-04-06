import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, index, jsonb, boolean } from "drizzle-orm/pg-core";
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

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  department: text("department"),
  type: text("type").notNull().default("management"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  staffEmail: text("staff_email"),
  staffPhone: text("staff_phone"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true }).extend({
  type: z.enum(["management", "usage"]).default("management"),
  contactEmail: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  managerIds: text("manager_ids").array().default(sql`'{}'::text[]`),
  defaultCycleDays: integer("default_cycle_days"),
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
  assignedCategoryIds: text("assigned_category_ids").array().default(sql`'{}'::text[]`),
  position: text("position"),
  email: text("email"),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  privacyConsentAt: text("privacy_consent_at"),
  optionalConsentAt: text("optional_consent_at"),
  optionalConsentGiven: boolean("optional_consent_given").default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, passwordHash: true, privacyConsentAt: true, optionalConsentAt: true, optionalConsentGiven: true });
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
  suspendedReason: text("suspended_reason"),
  notes: text("notes"),
});

export const insertAssetSchema = createInsertSchema(assets).omit({ 
  id: true,
  nextDueDate: true,
  status: true,
  suspendedReason: true
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

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const assetHistory = pgTable("asset_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull(),
  userId: varchar("user_id"),
  changeType: text("change_type").notNull(),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  date: timestamp("date").notNull().defaultNow(),
  notes: text("notes"),
});

export const insertAssetHistorySchema = createInsertSchema(assetHistory).omit({ id: true });
export type InsertAssetHistory = z.infer<typeof insertAssetHistorySchema>;
export type AssetHistory = typeof assetHistory.$inferSelect;

export const personalTasks = pgTable("personal_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: text("scheduled_at").notNull(),
  repeatType: text("repeat_type").notNull().default("none"),
  completed: boolean("completed").notNull().default(false),
  shareScope: text("share_scope").notNull().default("private"),
  shareTeamIds: text("share_team_ids").array().default(sql`'{}'::text[]`),
  shareUserIds: text("share_user_ids").array().default(sql`'{}'::text[]`),
  scheduledEndAt: text("scheduled_end_at"),
  lastMorningNotifiedDate: text("last_morning_notified_date"),
  label: text("label"),
  priority: integer("priority").notNull().default(0),
  reminderNotified: boolean("reminder_notified").notNull().default(false),
  emailDigestSent: boolean("email_digest_sent").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertPersonalTaskSchema = createInsertSchema(personalTasks)
  .omit({ id: true, lastMorningNotifiedDate: true, reminderNotified: true, emailDigestSent: true })
  .extend({
    scheduledEndAt: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    priority: z.number().int().min(0).max(3).optional(),
  });
export type InsertPersonalTask = z.infer<typeof insertPersonalTaskSchema>;
export type PersonalTask = typeof personalTasks.$inferSelect;
