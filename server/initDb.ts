import { db } from "../db";
import { users, teams } from "@shared/schema";

const ADMIN_EMAIL = "yonghwan86@gmail.com";

export async function initializeDatabase() {
  try {
    console.log("[INIT] Checking if database needs initialization...");
    
    const existingTeams = await db.select().from(teams);
    const existingUsers = await db.select().from(users);
    
    if (existingTeams.length > 0 && existingUsers.length > 0) {
      console.log("[INIT] Database already has data. Skipping initialization.");
      return;
    }
    
    console.log("[INIT] Database is empty. Creating initial data...");
    
    let teamId: string;
    
    if (existingTeams.length === 0) {
      console.log("[INIT] Creating default team...");
      const newTeam = await db.insert(teams).values({
        name: "시스템관리팀",
        contactEmail: ADMIN_EMAIL,
        phone: ""
      }).returning();
      teamId = newTeam[0].id;
      console.log(`[INIT] Created team: ${newTeam[0].name} (${teamId})`);
    } else {
      teamId = existingTeams[0].id;
      console.log(`[INIT] Using existing team: ${existingTeams[0].name}`);
    }
    
    if (existingUsers.length === 0) {
      console.log("[INIT] Creating admin user...");
      const newUser = await db.insert(users).values({
        username: "시스템 관리자",
        fullName: "관리자",
        role: "admin",
        teamId: teamId,
        email: ADMIN_EMAIL,
        phone: "",
        passwordHash: null
      }).returning();
      console.log(`[INIT] Created admin user: ${newUser[0].username} (${newUser[0].email})`);
      console.log("[INIT] Admin user can set password on first login.");
    }
    
    console.log("[INIT] Database initialization complete!");
    
  } catch (error) {
    console.error("[INIT] Failed to initialize database:", error);
  }
}
