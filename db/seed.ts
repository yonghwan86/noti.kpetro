import { db } from "./index";
import { teams, categories, users, assets } from "@shared/schema";

async function seed() {
  console.log("Starting database seed...");

  const insertedTeams = await db.insert(teams).values([
    { name: '검사팀', contactEmail: 'inspection@example.com' },
    { name: '관리팀', contactEmail: 'management@example.com' },
  ]).returning();

  console.log("Teams created:", insertedTeams.length);

  const insertedCategories = await db.insert(categories).values([
    { name: '계량기' },
    { name: '차량' },
    { name: '검사장비' },
  ]).returning();

  console.log("Categories created:", insertedCategories.length);

  const insertedUsers = await db.insert(users).values([
    { username: '시스템 마스터', role: 'admin', teamId: insertedTeams[1].id },
    { username: '검사 장비 관리자', role: 'manager', teamId: insertedTeams[0].id },
    { username: '검사 담당자 A', role: 'staff', teamId: insertedTeams[0].id },
    { username: '관리 팀장', role: 'manager', teamId: insertedTeams[1].id },
    { username: '생산 담당자 B', role: 'staff', teamId: insertedTeams[1].id },
  ]).returning();

  console.log("Users created:", insertedUsers.length);

  const insertedAssets = await db.insert(assets).values([
    {
      name: '정밀 저울 X200',
      serialNumber: 'SN-2023-001',
      categoryId: insertedCategories[0].id,
      teamId: insertedTeams[1].id,
      managerId: insertedUsers[3].id,
      usageTeamId: insertedTeams[0].id,
      staffId: insertedUsers[2].id,
      inspectionCycleMonths: 1,
      lastInspectedDate: '2025-05-01',
      nextDueDate: '2025-06-01',
      status: 'overdue',
    },
    {
      name: '지게차 F-500',
      serialNumber: 'VH-9982',
      categoryId: insertedCategories[1].id,
      teamId: insertedTeams[1].id,
      managerId: insertedUsers[3].id,
      usageTeamId: insertedTeams[1].id,
      staffId: insertedUsers[4].id,
      inspectionCycleMonths: 3,
      lastInspectedDate: '2025-06-15',
      nextDueDate: '2025-09-15',
      status: 'ok',
    },
    {
      name: '분광광도계 Pro',
      serialNumber: 'SP-112',
      categoryId: insertedCategories[2].id,
      teamId: insertedTeams[0].id,
      managerId: insertedUsers[1].id,
      usageTeamId: insertedTeams[0].id,
      staffId: insertedUsers[2].id,
      inspectionCycleMonths: 6,
      lastInspectedDate: '2025-01-10',
      nextDueDate: '2025-07-10',
      status: 'upcoming',
    },
  ]).returning();

  console.log("Assets created:", insertedAssets.length);
  console.log("Database seeded successfully!");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
