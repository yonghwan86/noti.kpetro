import cron from "node-cron";
import { storage } from "./storage";
import { sendDailyDigestEmail } from "./emailService";
import { sendPushToUser } from "./pushService";
import { toKSTDateStr, formatDateShort } from "./utils";
import { parseISO, subMinutes } from "date-fns";
import { sql } from "drizzle-orm";
import type {
  User,
  Asset,
  Team,
  Category,
  PersonalTask,
} from "../shared/schema";

interface TaskWithShare {
  userId: string;
  shareScope: string;
  shareTeamIds: string[] | null;
  shareUserIds: string[] | null;
}

function getSharedTargetUserIds(
  task: TaskWithShare,
  allUsers: Pick<User, "id" | "teamId">[],
): string[] {
  if (task.shareScope === "private") return [];
  const targetSet = new Set<string>();
  const teamIds = task.shareTeamIds || [];
  const userIds = task.shareUserIds || [];
  for (const u of allUsers) {
    if (u.id === task.userId) continue;
    if (teamIds.includes(u.teamId)) targetSet.add(u.id);
    if (userIds.includes(u.id)) targetSet.add(u.id);
  }
  return Array.from(targetSet);
}

function collectPushRecipientIds(asset: Asset, cats: Category[]): string[] {
  const ids = new Set<string>();
  if (asset.staffId) ids.add(asset.staffId);
  const category = cats.find((c) => c.id === asset.categoryId);
  for (const mid of category?.managerIds || []) ids.add(mid);
  if (asset.managerId) ids.add(asset.managerId);
  return Array.from(ids);
}

// Returns YYYY-MM-DD in KST regardless of server timezone
function getTodayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function getKSTDatePlusDays(n: number): string {
  const nowKST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  nowKST.setDate(nowKST.getDate() + n);
  return nowKST.toLocaleDateString("en-CA");
}

// Returns number of days from dateStr1 to dateStr2 using KST midnight boundaries
function daysDiffKST(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(`${dateStr1}T00:00:00+09:00`);
  const d2 = new Date(`${dateStr2}T00:00:00+09:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const { db } = await import("../db");
    const result = await db.execute(
      sql`SELECT value FROM system_settings WHERE key = ${key} LIMIT 1`,
    );
    const rows = result.rows as { value: string }[];
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function setSystemSetting(key: string, value: string): Promise<void> {
  try {
    const { db } = await import("../db");
    await db.execute(
      sql`INSERT INTO system_settings (key, value) VALUES (${key}, ${value})
          ON CONFLICT (key) DO UPDATE SET value = ${value}`,
    );
  } catch (error) {
    console.error(`[SCHEDULER] Failed to save system setting ${key}:`, error);
  }
}

interface PreloadedData {
  assets: Asset[];
  users: User[];
  teams: Team[];
  cats: Category[];
  personalTasks: PersonalTask[];
}

async function sendInspectionPushNotifications(preloaded: PreloadedData) {
  console.log("[SCHEDULER] Sending inspection push notifications...");
  const { assets, users, teams, cats } = preloaded;

  const todayStr = getTodayKST();
  const sevenDaysLaterStr = getKSTDatePlusDays(7);

  const activeAssets = assets.filter((a) => a.status !== "suspended");

  const upcomingAssets = activeAssets.filter((asset) => {
    if (!asset.nextDueDate) return false;
    return (
      asset.nextDueDate > todayStr && asset.nextDueDate <= sevenDaysLaterStr
    );
  });

  const overdueAssets = activeAssets.filter((asset) => {
    if (!asset.nextDueDate) return false;
    return asset.nextDueDate < todayStr;
  });

  console.log(
    `[SCHEDULER] Found ${upcomingAssets.length} upcoming, ${overdueAssets.length} overdue assets for push`,
  );

  for (const asset of upcomingAssets) {
    const staffName =
      users.find((u) => u.id === asset.staffId)?.username || "담당자";
    const teamName = teams.find((t) => t.id === asset.teamId)?.name || "미지정";
    const dueDate = asset.nextDueDate as string;
    const daysLeft = daysDiffKST(todayStr, dueDate);
    for (const uid of collectPushRecipientIds(asset, cats)) {
      await sendPushToUser(
        uid,
        `🔔 ${asset.name} 점검 예정`,
        `점검일: ${dueDate} (D-${daysLeft}일) | 담당: ${staffName} | 팀: ${teamName}`,
        "/",
      );
    }
  }

  for (const asset of overdueAssets) {
    const staffName =
      users.find((u) => u.id === asset.staffId)?.username || "담당자";
    const teamName = teams.find((t) => t.id === asset.teamId)?.name || "미지정";
    const dueDate = asset.nextDueDate as string;
    const overdueDays = daysDiffKST(dueDate, todayStr);
    for (const uid of collectPushRecipientIds(asset, cats)) {
      await sendPushToUser(
        uid,
        `🚨 ${asset.name} 점검 지연!`,
        `점검 예정일: ${dueDate} (${overdueDays}일 초과) | 담당: ${staffName} | 즉시 확인하세요`,
        "/",
      );
    }
  }

  console.log("[SCHEDULER] Inspection push notifications completed");
}

interface InspectionItem {
  assetName: string;
  dueDate: string;
  status: "upcoming" | "overdue";
  daysLeft?: number;
  daysOverdue?: number;
  staffName: string;
}

interface PersonalTaskItem {
  title: string;
  time: string;
  description?: string;
  isShared: boolean;
  ownerName?: string;
  dateRange?: string;
}

interface DigestData {
  inspectionItems: InspectionItem[];
  todayTasks: PersonalTaskItem[];
  tomorrowTasks: PersonalTaskItem[];
}

function toKSTTimeStr(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function collectDailyDigestForUser(
  userId: string,
  preloaded: PreloadedData,
): DigestData | null {
  const { assets, users, cats, personalTasks } = preloaded;
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  const today = getTodayKST();
  const tomorrow = getKSTDatePlusDays(1);
  const sevenDaysLaterStr = getKSTDatePlusDays(7);

  const isLeader = user.role === "staff" && user.position === "팀장";

  const inspectionItems: InspectionItem[] = [];

  for (const asset of assets) {
    if (asset.status === "suspended") continue;
    if (!asset.nextDueDate) continue;

    const category = cats.find((c) => c.id === asset.categoryId);
    const categoryManagerIds: string[] = category?.managerIds || [];

    const isStaff = asset.staffId === userId;
    const isDirectManager = asset.managerId === userId;
    const isCategoryManager = categoryManagerIds.includes(userId);
    const isTeamLeader = isLeader && asset.teamId === user.teamId;

    if (!isStaff && !isDirectManager && !isCategoryManager && !isTeamLeader)
      continue;

    const dueDateStr = asset.nextDueDate;
    const staffName =
      users.find((u) => u.id === asset.staffId)?.username || "담당자";

    if (dueDateStr > today && dueDateStr <= sevenDaysLaterStr) {
      const daysLeft = daysDiffKST(today, dueDateStr);
      inspectionItems.push({
        assetName: asset.name,
        dueDate: dueDateStr,
        status: "upcoming",
        daysLeft,
        staffName,
      });
    } else if (dueDateStr < today) {
      const daysOverdue = daysDiffKST(dueDateStr, today);
      inspectionItems.push({
        assetName: asset.name,
        dueDate: dueDateStr,
        status: "overdue",
        daysOverdue,
        staffName,
      });
    }
  }

  const todayMatchedTaskIds = new Set<string>(); // 2026-04-09 기간 일정 중복 표시 방지용 ID 수집

  const todayTasks: PersonalTaskItem[] = [];
  for (const task of personalTasks) {
    if (task.completed) continue;
    const startDate = toKSTDateStr(task.scheduledAt);
    const endDate = task.scheduledEndAt ?? startDate;
    if (startDate > today || today > endDate) continue;

    const isOwn = task.userId === userId;
    const isShared =
      task.shareScope === "selected" &&
      ((task.shareUserIds || []).includes(userId) ||
        (task.shareTeamIds || []).includes(user.teamId));
    if (!isOwn && !isShared) continue;

    todayMatchedTaskIds.add(task.id); // 2026-04-09 중복 방지용 ID 수집

    const ownerName =
      users.find((u) => u.id === task.userId)?.username || "알 수 없음";
    todayTasks.push({
      title: task.title,
      time: toKSTTimeStr(task.scheduledAt),
      description: task.description || undefined,
      isShared: !isOwn,
      ownerName: !isOwn ? ownerName : undefined,
      dateRange: task.scheduledEndAt
        ? `${formatDateShort(toKSTDateStr(task.scheduledAt))}~${formatDateShort(task.scheduledEndAt)}`
        : undefined,
    });
  }

  const tomorrowTasks: PersonalTaskItem[] = [];
  for (const task of personalTasks) {
    if (task.completed) continue;
    if (todayMatchedTaskIds.has(task.id)) continue; // 2026-04-09 오늘 일정에 이미 포함된 기간 일정 제외
    const startDate = toKSTDateStr(task.scheduledAt);
    const endDate = task.scheduledEndAt ?? startDate;
    if (startDate > tomorrow || tomorrow > endDate) continue;

    const isOwn = task.userId === userId;
    const isShared =
      task.shareScope === "selected" &&
      ((task.shareUserIds || []).includes(userId) ||
        (task.shareTeamIds || []).includes(user.teamId));
    if (!isOwn && !isShared) continue;

    const ownerName =
      users.find((u) => u.id === task.userId)?.username || "알 수 없음";
    tomorrowTasks.push({
      title: task.title,
      time: toKSTTimeStr(task.scheduledAt),
      description: task.description || undefined,
      isShared: !isOwn,
      ownerName: !isOwn ? ownerName : undefined,
      dateRange: task.scheduledEndAt
        ? `${formatDateShort(toKSTDateStr(task.scheduledAt))}~${formatDateShort(task.scheduledEndAt)}`
        : undefined,
    });
  }

  if (
    inspectionItems.length === 0 &&
    todayTasks.length === 0 &&
    tomorrowTasks.length === 0
  ) {
    return null;
  }

  return { inspectionItems, todayTasks, tomorrowTasks };
}

// 2026-04-09 동시 실행 방지 플래그
let isDailyDigestRunning = false;
let isMorningPushRunning = false;

// 2026-04-09 오전 6시 이메일 전용 함수
async function sendDailyDigest(sharedData?: PreloadedData) {
  // 2026-04-09 외부 데이터 공유 지원
  if (isDailyDigestRunning) {
    console.log(
      "[SCHEDULER] Daily digest is already running, skipping concurrent invocation",
    );
    return;
  }
  isDailyDigestRunning = true;

  console.log("[SCHEDULER] Starting daily digest email...");

  try {
    const today = getTodayKST();

    const lastDate = await getSystemSetting("last_daily_digest_date");
    if (lastDate === today) {
      console.log("[SCHEDULER] Daily digest already completed today, skipping");
      return;
    }

    const preloaded: PreloadedData = sharedData ?? {
      // 2026-04-09 외부에서 받으면 재사용, 없으면 직접 로딩
      assets: await storage.getAssets(),
      users: await storage.getUsers(),
      teams: await storage.getTeams(),
      cats: await storage.getCategories(),
      personalTasks: await storage.getAllPersonalTasksForScheduler(),
    };

    let emailSentCount = 0;
    let emailFailedCount = 0;
    for (const user of preloaded.users) {
      if (!user.email) continue;
      const digest = collectDailyDigestForUser(user.id, preloaded);
      if (!digest) continue;
      const result = await sendDailyDigestEmail(user, digest);
      if (result.success) {
        console.log(
          `[SCHEDULER] Digest sent to ${user.email} ` +
            `(inspections:${digest.inspectionItems.length} today:${digest.todayTasks.length} tomorrow:${digest.tomorrowTasks.length})`,
        );
        emailSentCount++;
      } else {
        console.error(
          `[SCHEDULER] Failed to send digest to ${user.email}: ${result.error}`,
        );
        emailFailedCount++;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    console.log(
      `[SCHEDULER] Daily digest emails — sent: ${emailSentCount}, failed: ${emailFailedCount}`,
    );

    if (emailFailedCount === 0) {
      await setSystemSetting("last_daily_digest_date", today);
      console.log("[SCHEDULER] Daily digest completed and date recorded");
    } else {
      console.error(
        `[SCHEDULER] Daily digest completed with ${emailFailedCount} email failure(s). ` +
          "last_daily_digest_date NOT finalized — will retry on next server restart.",
      );
    }
  } catch (error) {
    console.error("[SCHEDULER] Error in daily digest:", error);
  } finally {
    isDailyDigestRunning = false;
  }
}

// 2026-04-09 오전 9시 푸시 전용 함수 (일정 + 장비 점검, 등록자 + 공유 대상, 없으면 안 보냄)
async function sendMorningPush(sharedData?: PreloadedData) {
  // 2026-04-09 외부 데이터 공유 지원
  if (isMorningPushRunning) {
    console.log("[SCHEDULER] Morning push is already running, skipping");
    return;
  }
  isMorningPushRunning = true;

  console.log("[SCHEDULER] Starting morning push notifications...");

  try {
    const today = getTodayKST();

    const lastPushDate = await getSystemSetting("last_morning_push_date");
    if (lastPushDate === today) {
      console.log("[SCHEDULER] Morning push already completed today, skipping");
      return;
    }

    const preloaded: PreloadedData = sharedData ?? {
      // 2026-04-09 외부에서 받으면 재사용, 없으면 직접 로딩
      assets: await storage.getAssets(),
      users: await storage.getUsers(),
      teams: await storage.getTeams(),
      cats: await storage.getCategories(),
      personalTasks: await storage.getAllPersonalTasksForScheduler(),
    };

    // ① 장비 점검 푸시
    await sendInspectionPushNotifications(preloaded);

    // ② 오늘 일정 푸시 (등록자 + 공유 대상 전원)
    const morningNotifyTaskIds: string[] = [];
    for (const task of preloaded.personalTasks) {
      if (task.lastMorningNotifiedDate === today) continue;
      if (task.completed) continue;
      const startDate = toKSTDateStr(task.scheduledAt);

      if (task.scheduledEndAt) {
        if (startDate > today || today > task.scheduledEndAt) continue;
      } else {
        if (startDate > today) continue;
      }

      const ownerName =
        preloaded.users.find((u) => u.id === task.userId)?.username ||
        "알 수 없음";
      const timeKST = toKSTTimeStr(task.scheduledAt);
      const isOverdue = !task.scheduledEndAt && startDate < today;

      const dateLabel = task.scheduledEndAt
        ? `${formatDateShort(startDate)} ~ ${formatDateShort(task.scheduledEndAt)}`
        : `${startDate} ${timeKST}`;

      // 등록자 푸시
      await sendPushToUser(
        task.userId,
        isOverdue
          ? `📅 미완료 일정: ${task.title}`
          : `📅 오늘 일정: ${task.title}`,
        task.scheduledEndAt
          ? `${dateLabel} 기간 중 일정입니다.`
          : `${dateLabel}에 예정된 일정입니다.`,
        "/schedule",
      );

      // 공유 대상 전원 푸시
      for (const targetId of getSharedTargetUserIds(task, preloaded.users)) {
        await sendPushToUser(
          targetId,
          `📅 공유 일정: ${task.title}`,
          task.scheduledEndAt
            ? `${ownerName}님의 일정 | ${dateLabel} 기간 중`
            : `${ownerName}님의 일정 | ${dateLabel} 예정`,
          "/schedule",
        );
      }

      morningNotifyTaskIds.push(task.id);
    }

    // ③ 푸시 발송 완료 표시
    for (const taskId of morningNotifyTaskIds) {
      await storage.updatePersonalTask(taskId, {
        lastMorningNotifiedDate: today,
      });
    }

    await setSystemSetting("last_morning_push_date", today);
    console.log(
      `[SCHEDULER] Morning push completed — ${morningNotifyTaskIds.length} task(s) notified`,
    );
  } catch (error) {
    console.error("[SCHEDULER] Error in morning push:", error);
  } finally {
    isMorningPushRunning = false;
  }
}

// 30분 전 리마인더 푸시 (등록자 + 공유 대상)
async function checkPersonalTasksReminder() {
  try {
    const tasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();
    const now = new Date();

    for (const task of tasks) {
      if (task.reminderNotified) continue;
      if (task.completed) continue;

      const scheduledDate = parseISO(task.scheduledAt);
      const thirtyMinsBefore = subMinutes(scheduledDate, 30);

      if (now >= thirtyMinsBefore && now < scheduledDate) {
        const ownerName =
          users.find((u) => u.id === task.userId)?.username || "알 수 없음";

        await sendPushToUser(
          task.userId,
          `⏰ 30분 후 일정: ${task.title}`,
          `곧 시작되는 일정이 있습니다.`,
          "/schedule",
        );

        for (const targetId of getSharedTargetUserIds(task, users)) {
          await sendPushToUser(
            targetId,
            `⏰ 30분 후 공유 일정: ${task.title}`,
            `${ownerName}님의 일정이 곧 시작됩니다.`,
            "/schedule",
          );
        }

        await storage.updatePersonalTask(task.id, { reminderNotified: true });
      }
    }
  } catch (error) {
    console.error("[SCHEDULER] Error in personal tasks reminder:", error);
  }
}

export function startScheduler() {
  // 2026-04-09 오전 6시: 이메일만 발송
  cron.schedule(
    "0 6 * * *",
    () => {
      console.log("[SCHEDULER] 6 AM KST - running daily digest email");
      sendDailyDigest();
    },
    { timezone: "Asia/Seoul" },
  );

  // 2026-04-09 오전 9시: 푸시만 발송 (일정 + 장비 점검)
  cron.schedule(
    "0 9 * * *",
    () => {
      console.log("[SCHEDULER] 9 AM KST - running morning push notifications");
      sendMorningPush();
    },
    { timezone: "Asia/Seoul" },
  );

  // 매분: 30분 전 리마인더 푸시
  cron.schedule(
    "* * * * *",
    () => {
      checkPersonalTasksReminder();
    },
    { timezone: "Asia/Seoul" },
  );

  // 자정: 알림 플래그 초기화 + 지난 일정 자동 완료
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log(
        "[SCHEDULER] Midnight KST - resetting flags & auto-completing past tasks",
      );
      storage.resetDailyNotificationFlags();

      const today = getTodayKST();
      const count = await storage.autoCompletePastTasks(today);
      if (count > 0) {
        console.log(`[SCHEDULER] Auto-completed ${count} past task(s)`);
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log(
    "[SCHEDULER] Scheduler started - 6 AM email, 9 AM push, every min reminder, midnight reset",
  );

  // 2026-04-09 서버 재시작 catch-up (데이터 1회 로딩으로 DB 부하 최소화)
  const now = new Date();
  const kstHour = parseInt(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false,
    }),
  );

  if (kstHour >= 6 && kstHour < 23) {
    // 2026-04-09 심야 재시작 시 catch-up 방지
    setTimeout(async () => {
      console.log(
        `[SCHEDULER] Server started at KST hour ${kstHour} - running catch-up`,
      );
      // 2026-04-09 데이터 1회만 로딩하여 이메일/푸시에 공유 (400명 규모 DB 부하 절감)
      const preloaded: PreloadedData = {
        assets: await storage.getAssets(),
        users: await storage.getUsers(),
        teams: await storage.getTeams(),
        cats: await storage.getCategories(),
        personalTasks: await storage.getAllPersonalTasksForScheduler(),
      };
      await sendDailyDigest(preloaded); // 2026-04-09 내부에서 이미 완료 여부 체크
      if (kstHour >= 9) {
        // 2026-04-09 9시 이후에만 푸시 catch-up
        await sendMorningPush(preloaded);
      }
    }, 5000);
  }
}

export { sendInspectionPushNotifications, collectDailyDigestForUser };
