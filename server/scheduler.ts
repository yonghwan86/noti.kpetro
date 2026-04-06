import cron from 'node-cron';
import { storage } from './storage';
import { sendDailyDigestEmail } from './emailService';
import { sendPushToUser } from './pushService';
import { parseISO, format, subMinutes } from 'date-fns';

// ── 공유 일정 수신자 ID 목록 ─────────────────────────────────────────────────
interface TaskWithShare {
  userId: string;
  shareScope: string;
  shareTeamIds: string[] | null;
  shareUserIds: string[] | null;
}

function getSharedTargetUserIds(task: TaskWithShare, allUsers: { id: string; teamId: string }[]): string[] {
  if (task.shareScope === 'private') return [];
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

// Bug Fix #2: 푸시 수신자 ID 수집 (staff + 카테고리 구분관리자 전원)
function collectPushRecipientIds(asset: any, cats: any[]): Set<string> {
  const ids = new Set<string>();
  if (asset.staffId) ids.add(asset.staffId);
  const category = cats.find((c: any) => c.id === asset.categoryId);
  for (const mid of category?.managerIds || []) ids.add(mid);
  if (asset.managerId) ids.add(asset.managerId);
  return ids;
}

// ── KST 날짜 유틸 ────────────────────────────────────────────────────────────
function getTodayKST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function getTomorrowKST(): string {
  return getKSTDatePlusDays(1);
}

// KST 오늘로부터 n일 후 날짜 문자열 (YYYY-MM-DD) 반환
function getKSTDatePlusDays(n: number): string {
  const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  nowKST.setDate(nowKST.getDate() + n);
  return nowKST.toLocaleDateString('en-CA');
}

// KST 기준 두 날짜 사이의 일수 차 (d2 - d1, YYYY-MM-DD 문자열)
// KST 자정 기준으로 +09:00 오프셋을 붙여 UTC 변환 후 계산
function daysDiffKST(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(`${dateStr1}T00:00:00+09:00`);
  const d2 = new Date(`${dateStr2}T00:00:00+09:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

// ── 시스템 설정 (멱등성 키 등) ──────────────────────────────────────────────
async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const { db } = await import('../db');
    const result = await db.execute(`SELECT value FROM system_settings WHERE key = '${key}' LIMIT 1`);
    const rows = result.rows as any[];
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function setSystemSetting(key: string, value: string): Promise<void> {
  try {
    const { db } = await import('../db');
    await db.execute(
      `INSERT INTO system_settings (key, value) VALUES ('${key}', '${value}')
       ON CONFLICT (key) DO UPDATE SET value = '${value}'`
    );
  } catch (error) {
    console.error(`[SCHEDULER] Failed to save system setting ${key}:`, error);
  }
}

// ── 프리로드 데이터 타입 ─────────────────────────────────────────────────────
interface PreloadedData {
  assets: any[];
  users: any[];
  teams: any[];
  cats: any[];
  personalTasks: any[];
}

// ── Task 4: 장비 점검 푸시 전용 (checkUpcomingInspections 리네이밍, 이메일 제거) ──
async function sendInspectionPushNotifications(preloaded: PreloadedData) {
  console.log('[SCHEDULER] Sending inspection push notifications...');
  const { assets, users, teams, cats } = preloaded;

  // KST 날짜 문자열 기반 비교 — 서버가 UTC여도 6AM KST에서 올바른 날짜 사용
  const todayStr = getTodayKST();
  const sevenDaysLaterStr = getKSTDatePlusDays(7);

  const activeAssets = assets.filter((a: any) => a.status !== 'suspended');

  const upcomingAssets = activeAssets.filter((asset: any) => {
    if (!asset.nextDueDate) return false;
    return asset.nextDueDate > todayStr && asset.nextDueDate <= sevenDaysLaterStr;
  });

  const overdueAssets = activeAssets.filter((asset: any) => {
    if (!asset.nextDueDate) return false;
    return asset.nextDueDate < todayStr;
  });

  console.log(`[SCHEDULER] Found ${upcomingAssets.length} upcoming, ${overdueAssets.length} overdue assets for push`);

  for (const asset of upcomingAssets) {
    const staff = users.find((u: any) => u.id === asset.staffId);
    const staffName = staff?.username || '담당자';
    const team = teams.find((t: any) => t.id === asset.teamId);
    const teamName = team?.name || '미지정';
    const dueDate = asset.nextDueDate as string;
    const daysLeft = daysDiffKST(todayStr, dueDate);
    const pushRecipientIds = collectPushRecipientIds(asset, cats);
    for (const uid of pushRecipientIds) {
      await sendPushToUser(uid, `🔔 ${asset.name} 점검 예정`, `점검일: ${dueDate} (D-${daysLeft}일) | 담당: ${staffName} | 팀: ${teamName}`, '/');
    }
  }

  for (const asset of overdueAssets) {
    const staff = users.find((u: any) => u.id === asset.staffId);
    const staffName = staff?.username || '담당자';
    const team = teams.find((t: any) => t.id === asset.teamId);
    const teamName = team?.name || '미지정';
    const dueDate = asset.nextDueDate as string;
    const overdueDays = daysDiffKST(dueDate, todayStr);
    const pushRecipientIds = collectPushRecipientIds(asset, cats);
    for (const uid of pushRecipientIds) {
      await sendPushToUser(uid, `🚨 ${asset.name} 점검 지연!`, `점검 예정일: ${dueDate} (${overdueDays}일 초과) | 담당: ${staffName} | 즉시 확인하세요`, '/');
    }
  }

  console.log('[SCHEDULER] Inspection push notifications completed');
}

// ── Task 1: 사용자별 다이제스트 데이터 수집 ──────────────────────────────────
interface InspectionItem {
  assetName: string;
  dueDate: string;
  status: 'upcoming' | 'overdue';
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
}

interface DigestData {
  inspectionItems: InspectionItem[];
  todayTasks: PersonalTaskItem[];
  tomorrowTasks: PersonalTaskItem[];
}

function collectDailyDigestForUser(userId: string, preloaded: PreloadedData): DigestData | null {
  const { assets, users, teams, cats, personalTasks } = preloaded;
  const user = users.find((u: any) => u.id === userId);
  if (!user) return null;

  // KST 날짜 문자열 기반 비교 — 서버가 UTC여도 6AM KST에서 올바른 날짜 사용
  const today = getTodayKST();
  const tomorrow = getTomorrowKST();
  const sevenDaysLaterStr = getKSTDatePlusDays(7);

  const isLeader = user.position === '팀장';

  // ── 장비 점검 알림 수집 ────────────────────────────────────────────────────
  const inspectionItems: InspectionItem[] = [];

  for (const asset of assets) {
    if (asset.status === 'suspended') continue;
    if (!asset.nextDueDate) continue;

    const category = cats.find((c: any) => c.id === asset.categoryId);
    const categoryManagerIds: string[] = category?.managerIds || [];

    const isStaff = asset.staffId === userId;
    const isDirectManager = asset.managerId === userId;
    const isCategoryManager = categoryManagerIds.includes(userId);
    const isTeamLeader = isLeader && asset.teamId === user.teamId;

    if (!isStaff && !isDirectManager && !isCategoryManager && !isTeamLeader) continue;

    const dueDateStr = asset.nextDueDate as string;
    const staffUser = users.find((u: any) => u.id === asset.staffId);
    const staffName = staffUser?.username || '담당자';

    if (dueDateStr > today && dueDateStr <= sevenDaysLaterStr) {
      const daysLeft = daysDiffKST(today, dueDateStr);
      inspectionItems.push({ assetName: asset.name, dueDate: dueDateStr, status: 'upcoming', daysLeft, staffName });
    } else if (dueDateStr < today) {
      const daysOverdue = daysDiffKST(dueDateStr, today);
      inspectionItems.push({ assetName: asset.name, dueDate: dueDateStr, status: 'overdue', daysOverdue, staffName });
    }
  }

  // ── 오늘 일정 수집 ────────────────────────────────────────────────────────
  const todayTasks: PersonalTaskItem[] = [];
  for (const task of personalTasks) {
    if (task.completed) continue;
    const taskDate = task.scheduledAt.substring(0, 10);
    if (taskDate !== today) continue;

    const isOwn = task.userId === userId;
    const isShared = task.shareScope === 'selected' && (
      (task.shareUserIds || []).includes(userId) ||
      (task.shareTeamIds || []).includes(user.teamId)
    );

    if (!isOwn && !isShared) continue;

    const owner = users.find((u: any) => u.id === task.userId);
    todayTasks.push({
      title: task.title,
      time: format(parseISO(task.scheduledAt), 'HH:mm'),
      description: task.description || undefined,
      isShared: !isOwn,
      ownerName: !isOwn ? (owner?.username || '알 수 없음') : undefined,
    });
  }

  // ── 내일 예정 수집 ────────────────────────────────────────────────────────
  const tomorrowTasks: PersonalTaskItem[] = [];
  for (const task of personalTasks) {
    if (task.completed) continue;
    const taskDate = task.scheduledAt.substring(0, 10);
    if (taskDate !== tomorrow) continue;

    const isOwn = task.userId === userId;
    const isShared = task.shareScope === 'selected' && (
      (task.shareUserIds || []).includes(userId) ||
      (task.shareTeamIds || []).includes(user.teamId)
    );

    if (!isOwn && !isShared) continue;

    const owner = users.find((u: any) => u.id === task.userId);
    tomorrowTasks.push({
      title: task.title,
      time: format(parseISO(task.scheduledAt), 'HH:mm'),
      description: task.description || undefined,
      isShared: !isOwn,
      ownerName: !isOwn ? (owner?.username || '알 수 없음') : undefined,
    });
  }

  if (inspectionItems.length === 0 && todayTasks.length === 0 && tomorrowTasks.length === 0) {
    return null;
  }

  return { inspectionItems, todayTasks, tomorrowTasks };
}

// ── 프로세스 레벨 동시 실행 방지 (cron + catch-up 중복 실행 방지) ──────────
let isDailyDigestRunning = false;

// ── Task 3: 통합 다이제스트 발송 (실행 순서 ①~⑤ 준수) ──────────────────────
async function sendDailyDigest() {
  // 1단계 가드 (프로세스 레벨) —
  // JS는 단일 스레드이므로, 첫 await 이전에 동기적으로 플래그를 설정하면
  // 두 번째 호출이 끼어들 수 없다. cron + catch-up 동시 실행 방지.
  if (isDailyDigestRunning) {
    console.log('[SCHEDULER] Daily digest is already running, skipping concurrent invocation');
    return;
  }
  isDailyDigestRunning = true; // ← 반드시 첫 await 이전, 동기적으로 설정

  console.log('[SCHEDULER] Starting daily digest...');

  try {
    // 2단계 가드 (DB 레벨 완료 키) —
    // last_daily_digest_date는 성공 완료(⑤)에만 기록.
    // 실패·크래시 시 미기록 → 다음 재시작에서 재시도 가능.
    const today = getTodayKST();
    const lastDate = await getSystemSetting('last_daily_digest_date');
    if (lastDate === today) {
      console.log('[SCHEDULER] Daily digest already completed today, skipping');
      return; // finally 블록에서 isDailyDigestRunning = false 처리
    }

    // 데이터 한 번만 로드 (모든 함수에 주입)
    const preloaded: PreloadedData = {
      assets: await storage.getAssets(),
      users: await storage.getUsers(),
      teams: await storage.getTeams(),
      cats: await storage.getCategories(),
      personalTasks: await storage.getAllPersonalTasksForScheduler(),
    };

    // ① 장비 점검 푸시 발송
    await sendInspectionPushNotifications(preloaded);

    // ② 개인일정 모닝 푸시 발송 (morningNotified=false인 오늘 이전 일정)
    const morningNotifyTaskIds: string[] = [];
    for (const task of preloaded.personalTasks) {
      if (task.morningNotified) continue;
      if (task.completed) continue;
      const taskDateStr = task.scheduledAt.substring(0, 10);
      if (taskDateStr > today) continue;

      const owner = preloaded.users.find((u: any) => u.id === task.userId);
      const ownerName = owner?.username || '알 수 없음';
      const timeStr = format(parseISO(task.scheduledAt), 'HH:mm');
      const dateStr = task.scheduledAt.substring(0, 10);
      const isOverdue = taskDateStr < today;

      await sendPushToUser(
        task.userId,
        isOverdue ? `📅 미발송 일정: ${task.title}` : `📅 오늘 일정: ${task.title}`,
        `${dateStr} ${timeStr}에 예정된 일정입니다.`,
        '/schedule'
      );

      const targetIds = getSharedTargetUserIds(task, preloaded.users);
      for (const targetId of targetIds) {
        await sendPushToUser(targetId, `📅 공유 일정: ${task.title}`, `${ownerName}님의 일정 | ${dateStr} ${timeStr} 예정`, '/schedule');
      }

      morningNotifyTaskIds.push(task.id);
    }

    // ③ 이메일 다이제스트 발송 (1인 1통)
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
          `(inspections:${digest.inspectionItems.length} today:${digest.todayTasks.length} tomorrow:${digest.tomorrowTasks.length})`
        );
        emailSentCount++;
      } else {
        console.error(`[SCHEDULER] Failed to send digest to ${user.email}: ${result.error}`);
        emailFailedCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log(`[SCHEDULER] Daily digest emails — sent: ${emailSentCount}, failed: ${emailFailedCount}`);

    // ④ morningNotified = true 설정 (①②③ 완료 후)
    for (const taskId of morningNotifyTaskIds) {
      await storage.updatePersonalTask(taskId, { morningNotified: true });
    }

    // ⑤ last_daily_digest_date 기록 — 이메일 실패가 있으면 미기록 → 재시도 보장
    if (emailFailedCount === 0) {
      await setSystemSetting('last_daily_digest_date', today);
      console.log('[SCHEDULER] Daily digest completed and date recorded');
    } else {
      // 클레임('today:running')은 남아 있으므로 동일 프로세스 내 재진입은 막힘.
      // 그러나 DB에 완료 표시를 하지 않으므로 다음 서버 재시작 시 재시도 가능.
      console.error(
        `[SCHEDULER] Daily digest completed with ${emailFailedCount} email failure(s). ` +
        'last_daily_digest_date NOT finalized — will retry on next server restart.'
      );
    }

  } catch (error) {
    console.error('[SCHEDULER] Error in daily digest:', error);
    // 예외 시에도 ⑤를 기록하지 않으므로 다음 실행에서 자동 재시도 가능
  } finally {
    isDailyDigestRunning = false;
  }
}

// ── 10분 전 reminder (푸시 전용, 당일 실시간) ────────────────────────────────
async function checkPersonalTasksReminder() {
  try {
    const tasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();
    const now = new Date();

    for (const task of tasks) {
      if (task.reminderNotified) continue;
      if (task.completed) continue;

      const scheduledDate = parseISO(task.scheduledAt);
      const tenMinsBefore = subMinutes(scheduledDate, 10);

      if (now >= tenMinsBefore && now < scheduledDate) {
        const ownerName = users.find((u: any) => u.id === task.userId)?.username || '알 수 없음';

        await sendPushToUser(task.userId, `⏰ 10분 후 일정: ${task.title}`, `곧 시작되는 일정이 있습니다.`, '/schedule');

        const targetIds = getSharedTargetUserIds(task, users);
        for (const targetId of targetIds) {
          await sendPushToUser(targetId, `⏰ 10분 후 공유 일정: ${task.title}`, `${ownerName}님의 일정이 곧 시작됩니다.`, '/schedule');
        }

        await storage.updatePersonalTask(task.id, { reminderNotified: true });
      }
    }
  } catch (error) {
    console.error('[SCHEDULER] Error in personal tasks reminder:', error);
  }
}

// ── Task 5: 스케줄러 cron 재구성 ──────────────────────────────────────────────
export function startScheduler() {
  // ── 오전 6시: 통합 다이제스트 (장비 점검 푸시 + 개인일정 푸시 + 이메일 1통) ──
  cron.schedule('0 6 * * *', () => {
    console.log('[SCHEDULER] 6 AM KST - running daily digest');
    sendDailyDigest();
  }, { timezone: 'Asia/Seoul' });

  // ── 매 1분: 10분 전 reminder (푸시 전용) ─────────────────────────────────
  cron.schedule('* * * * *', () => {
    checkPersonalTasksReminder();
  }, { timezone: 'Asia/Seoul' });

  // ── 자정: morningNotified·reminderNotified 리셋 (emailDigestSent 리셋 제거됨) ──
  cron.schedule('0 0 * * *', () => {
    console.log('[SCHEDULER] Midnight KST - resetting daily notification flags');
    storage.resetDailyNotificationFlags();
  }, { timezone: 'Asia/Seoul' });

  console.log('[SCHEDULER] Scheduler started - 6 AM digest, every min reminder, midnight reset');

  // ── 서버 재시작 catch-up (kstHour >= 6이면 당일 미발송 시 발송) ──────────
  const now = new Date();
  const kstHour = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }));

  if (kstHour >= 6) {
    console.log(`[SCHEDULER] Server started at KST hour ${kstHour} - running morning catch-up`);
    setTimeout(async () => {
      await sendDailyDigest();
    }, 5000);
  }
}

export { sendInspectionPushNotifications };
