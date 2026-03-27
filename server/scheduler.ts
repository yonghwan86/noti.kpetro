import cron from 'node-cron';
import { storage } from './storage';
import { sendInspectionReminder, sendOverdueAlert, sendEmail } from './emailService';
import { sendPushToUser } from './pushService';
import { addDays, parseISO, isAfter, isBefore, format, differenceInDays, isToday, subMinutes } from 'date-fns';

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

async function checkUpcomingInspections() {
  console.log('[SCHEDULER] Checking for upcoming and overdue inspections...');
  
  try {
    const assets = await storage.getAssets();
    const users = await storage.getUsers();
    const teams = await storage.getTeams();
    // Bug Fix #2: 카테고리 로드 - 구분관리자 전체(managerIds 배열) 수신자 포함
    const cats = await storage.getCategories();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = addDays(today, 7);
    
    const activeAssets = assets.filter(asset => asset.status !== 'suspended');

    const upcomingAssets = activeAssets.filter(asset => {
      if (!asset.nextDueDate) return false;
      const dueDate = parseISO(asset.nextDueDate);
      return isAfter(dueDate, today) && !isAfter(dueDate, sevenDaysFromNow);
    });

    const overdueAssets = activeAssets.filter(asset => {
      if (!asset.nextDueDate) return false;
      const dueDate = parseISO(asset.nextDueDate);
      return isBefore(dueDate, today);
    });
    
    console.log(`[SCHEDULER] Found ${upcomingAssets.length} upcoming, ${overdueAssets.length} overdue assets`);
    
    for (const asset of upcomingAssets) {
      const recipients = collectRecipients(asset, users, teams, cats);
      const staff = users.find(u => u.id === asset.staffId);
      const staffName = staff?.username || '담당자';
      const team = teams.find(t => t.id === asset.teamId);
      const teamName = team?.name || '미지정';
      const dueDate = format(parseISO(asset.nextDueDate!), 'yyyy-MM-dd');

      for (const email of recipients) {
        const recipientUser = users.find(u => u.email === email);
        const recipientName = recipientUser?.username;
        console.log(`[SCHEDULER] Sending upcoming reminder for ${asset.name} to ${email} (${recipientName || '팀 계정'})`);
        const result = await sendInspectionReminder(email, asset.name, dueDate, staffName, teamName, recipientName);
        if (result.success) {
          console.log(`[SCHEDULER] Sent reminder for ${asset.name} to ${email} (ID: ${result.messageId})`);
        } else {
          console.error(`[SCHEDULER] Failed to send reminder for ${asset.name} to ${email}: ${result.error}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const daysLeft = differenceInDays(parseISO(asset.nextDueDate!), today);
      // Bug Fix #2: 카테고리 구분관리자 전체 푸시 수신
      const pushRecipientIds = collectPushRecipientIds(asset, cats);
      for (const uid of pushRecipientIds) {
        await sendPushToUser(
          uid,
          `🔔 ${asset.name} 점검 예정`,
          `점검일: ${dueDate} (D-${daysLeft}일) | 담당: ${staffName} | 팀: ${teamName}`,
          '/'
        );
      }
    }

    for (const asset of overdueAssets) {
      const recipients = collectRecipients(asset, users, teams, cats);
      const staff = users.find(u => u.id === asset.staffId);
      const staffName = staff?.username || '담당자';
      const team = teams.find(t => t.id === asset.teamId);
      const teamName = team?.name || '미지정';
      const dueDate = format(parseISO(asset.nextDueDate!), 'yyyy-MM-dd');

      for (const email of recipients) {
        const recipientUser = users.find(u => u.email === email);
        const recipientName = recipientUser?.username;
        console.log(`[SCHEDULER] Sending overdue alert for ${asset.name} to ${email} (${recipientName || '팀 계정'})`);
        const result = await sendOverdueAlert(email, asset.name, dueDate, staffName, teamName, recipientName);
        if (result.success) {
          console.log(`[SCHEDULER] Sent overdue alert for ${asset.name} to ${email} (ID: ${result.messageId})`);
        } else {
          console.error(`[SCHEDULER] Failed to send overdue alert for ${asset.name} to ${email}: ${result.error}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const overdueDays = differenceInDays(today, parseISO(asset.nextDueDate!));
      // Bug Fix #2: 카테고리 구분관리자 전체 푸시 수신
      const pushRecipientIds = collectPushRecipientIds(asset, cats);
      for (const uid of pushRecipientIds) {
        await sendPushToUser(
          uid,
          `🚨 ${asset.name} 점검 지연!`,
          `점검 예정일: ${dueDate} (${overdueDays}일 초과) | 담당: ${staffName} | 즉시 확인하세요`,
          '/'
        );
      }
    }
    
    console.log('[SCHEDULER] Inspection check completed');
  } catch (error) {
    console.error('[SCHEDULER] Error checking inspections:', error);
  }
}

// Bug Fix #2: categories 파라미터 추가 → category.managerIds 배열 전체 포함
function collectRecipients(asset: any, users: any[], teams: any[], cats: any[]): string[] {
  const recipients: string[] = [];

  const addEmail = (email: string | null | undefined) => {
    if (email && !recipients.includes(email)) recipients.push(email);
  };

  // 1) 담당자(staffId)
  const staff = users.find(u => u.id === asset.staffId);
  addEmail(staff?.email);

  // 2) 담당팀 팀장
  const teamLeaders = users.filter(
    u => u.role === 'staff' && u.teamId === asset.teamId && u.position === '팀장'
  );
  for (const leader of teamLeaders) addEmail(leader.email);

  // 3) 팀 대표 이메일(contactEmail)
  const team = teams.find(t => t.id === asset.teamId);
  addEmail(team?.contactEmail);

  // 4) Bug Fix #2: 구분(category)의 managerIds 배열 전원 포함
  //    (기존: asset.managerId 1명만 → 수정: category.managerIds 전체)
  const category = cats.find((c: any) => c.id === asset.categoryId);
  const categoryManagerIds: string[] = category?.managerIds || [];
  for (const mid of categoryManagerIds) {
    const mgr = users.find(u => u.id === mid);
    addEmail(mgr?.email);
  }
  // asset.managerId 가 category.managerIds에 없는 경우를 대비해 추가 보장
  const directManager = users.find(u => u.id === asset.managerId);
  addEmail(directManager?.email);

  return recipients;
}

// Bug Fix #2: 푸시 수신자 ID 수집 (staff + 카테고리 구분관리자 전원)
function collectPushRecipientIds(asset: any, cats: any[]): Set<string> {
  const ids = new Set<string>();
  if (asset.staffId) ids.add(asset.staffId);
  // 카테고리 구분관리자 전원 (기존: asset.managerId 1명만)
  const category = cats.find((c: any) => c.id === asset.categoryId);
  for (const mid of category?.managerIds || []) ids.add(mid);
  if (asset.managerId) ids.add(asset.managerId);
  return ids;
}

function getTodayKST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

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

async function runDailyCheckIfNeeded() {
  const today = getTodayKST();
  const lastEmailDate = await getSystemSetting('last_email_date');
  if (lastEmailDate === today) {
    console.log('[SCHEDULER] Already sent inspection emails today, skipping');
    return;
  }
  // Bug Fix #1: 날짜를 먼저 기록하면 이메일 발송 실패 시 당일 재시도 불가.
  // 발송 완료 후 기록하여, 장애 시 다음 서버 재시작에서 자동 재시도 보장.
  console.log('[SCHEDULER] Running daily inspection check');
  await checkUpcomingInspections();
  await setSystemSetting('last_email_date', today);
  console.log('[SCHEDULER] Daily inspection check completed and date recorded');
}

// ── Bug Fix #1 & #2: 아침 개인일정 알림 (푸시 + 이메일 병행) ──────────────────
async function checkPersonalTasksMorning() {
  console.log('[SCHEDULER] Checking personal tasks for morning notification (push + email)...');
  try {
    const tasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();
    const today = getTodayKST();

    for (const task of tasks) {
      if (task.morningNotified) continue;
      if (task.completed) continue;

      const scheduledDate = parseISO(task.scheduledAt);
      const taskDateStr = task.scheduledAt.substring(0, 10);

      // 오늘 일정이거나 오늘 이전 일정 중 아직 알림 안 간 것 (당일 catch-up 포함)
      if (taskDateStr > today) continue;

      const owner = users.find(u => u.id === task.userId);
      const ownerName = owner?.username || '알 수 없음';
      const timeStr = format(scheduledDate, 'HH:mm');
      const dateStr = task.scheduledAt.substring(0, 10);
      const isOverdue = taskDateStr < today;

      // 1) 푸시 알림 (구독 여부 상관없이 시도)
      await sendPushToUser(
        task.userId,
        isOverdue ? `📅 미발송 일정: ${task.title}` : `📅 오늘 일정: ${task.title}`,
        `${dateStr} ${timeStr}에 예정된 일정입니다.`,
        '/schedule'
      );

      // 공유 대상 푸시
      const targetIds = getSharedTargetUserIds(task, users);
      for (const targetId of targetIds) {
        await sendPushToUser(
          targetId,
          `📅 공유 일정: ${task.title}`,
          `${ownerName}님의 일정 | ${dateStr} ${timeStr} 예정`,
          '/schedule'
        );
      }

      // 2) 이메일 알림 (푸시 미구독 대비 이메일 병행 발송) ← Bug Fix #2
      if (owner?.email) {
        const body = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">📅 ${isOverdue ? '미발송 일정 알림' : '오늘 일정 알림'}</h2>
    <p>${ownerName}님, ${isOverdue ? '발송이 누락된' : '오늘'} 일정을 알려드립니다.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e5e7eb;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 10px; text-align: left;">항목</th>
        <th style="padding: 10px; text-align: left;">내용</th>
      </tr>
      <tr>
        <td style="padding: 10px; border-top: 1px solid #e5e7eb;">일정 제목</td>
        <td style="padding: 10px; border-top: 1px solid #e5e7eb;"><strong>${task.title}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px; border-top: 1px solid #e5e7eb;">예정 일시</td>
        <td style="padding: 10px; border-top: 1px solid #e5e7eb;">${dateStr} ${timeStr}</td>
      </tr>
      ${task.description ? `
      <tr>
        <td style="padding: 10px; border-top: 1px solid #e5e7eb;">내용</td>
        <td style="padding: 10px; border-top: 1px solid #e5e7eb;">${task.description}</td>
      </tr>` : ''}
    </table>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 12px; color: #6b7280;">이 메일은 AI 업무 알림 서비스에서 자동 발송되었습니다.</p>
  </div>
</body>
</html>`;

        const result = await sendEmail({
          to: owner.email,
          subject: `[AI 업무 알림] ${isOverdue ? '미발송' : '오늘'} 일정: ${task.title} (${dateStr} ${timeStr})`,
          body,
          isHtml: true,
        });
        if (result.success) {
          console.log(`[SCHEDULER] Sent morning task email to ${owner.email}: ${task.title}`);
        } else {
          console.error(`[SCHEDULER] Failed morning task email to ${owner.email}: ${result.error}`);
        }
      }

      await storage.updatePersonalTask(task.id, { morningNotified: true });
    }
    console.log('[SCHEDULER] Personal tasks morning check completed');
  } catch (error) {
    console.error('[SCHEDULER] Error in personal tasks morning check:', error);
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
        const ownerName = users.find(u => u.id === task.userId)?.username || '알 수 없음';

        await sendPushToUser(
          task.userId,
          `⏰ 10분 후 일정: ${task.title}`,
          `곧 시작되는 일정이 있습니다.`,
          '/schedule'
        );

        const targetIds = getSharedTargetUserIds(task, users);
        for (const targetId of targetIds) {
          await sendPushToUser(
            targetId,
            `⏰ 10분 후 공유 일정: ${task.title}`,
            `${ownerName}님의 일정이 곧 시작됩니다.`,
            '/schedule'
          );
        }

        await storage.updatePersonalTask(task.id, { reminderNotified: true });
      }
    }
  } catch (error) {
    console.error('[SCHEDULER] Error in personal tasks reminder:', error);
  }
}

// ── 내일 일정 다이제스트 (소유자 이메일) ─────────────────────────────────────
async function sendOwnerTomorrowDigest() {
  console.log('[SCHEDULER] Sending owner tomorrow tasks digest...');
  try {
    const today = getTodayKST();
    const lastDate = await getSystemSetting('last_owner_digest_date');
    if (lastDate === today) {
      console.log('[SCHEDULER] Owner tomorrow digest already sent today, skipping');
      return;
    }

    const allTasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();

    const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const tomorrowKST = new Date(nowKST);
    tomorrowKST.setDate(tomorrowKST.getDate() + 1);
    const tomorrowStr = tomorrowKST.toLocaleDateString('en-CA');

    const tomorrowTasks = allTasks.filter(t => {
      if (t.completed) return false;
      const taskDate = t.scheduledAt.substring(0, 10);
      return taskDate === tomorrowStr;
    });

    await setSystemSetting('last_owner_digest_date', today);

    if (tomorrowTasks.length === 0) {
      console.log('[SCHEDULER] No personal tasks scheduled for tomorrow');
      return;
    }

    const ownerTasksMap = new Map<string, typeof tomorrowTasks>();
    for (const task of tomorrowTasks) {
      if (!ownerTasksMap.has(task.userId)) ownerTasksMap.set(task.userId, []);
      ownerTasksMap.get(task.userId)!.push(task);
    }

    for (const [userId, tasks] of ownerTasksMap) {
      const user = users.find(u => u.id === userId);
      if (!user?.email) continue;

      const taskRows = tasks.map(task => {
        const timeStr = format(parseISO(task.scheduledAt), 'HH:mm');
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.title}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${timeStr}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.description || '-'}</td>
          </tr>`;
      }).join('');

      const body = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">📅 내일 일정 알림</h2>
    <p>${user.username}님, 내일(${tomorrowStr}) 예정된 일정 ${tasks.length}건을 알려드립니다.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; text-align: left;">일정 제목</th>
          <th style="padding: 8px; text-align: left;">예정 시간</th>
          <th style="padding: 8px; text-align: left;">내용</th>
        </tr>
      </thead>
      <tbody>${taskRows}</tbody>
    </table>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 12px; color: #6b7280;">이 메일은 AI 업무 알림 서비스에서 자동 발송되었습니다.</p>
  </div>
</body>
</html>`;

      const result = await sendEmail({
        to: user.email,
        subject: `[AI 업무 알림] 내일 일정 ${tasks.length}건 (${tomorrowStr})`,
        body,
        isHtml: true,
      });
      if (result.success) {
        console.log(`[SCHEDULER] Sent tomorrow digest to ${user.email} (${tasks.length} tasks)`);
      } else {
        console.error(`[SCHEDULER] Failed tomorrow digest to ${user.email}: ${result.error}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[SCHEDULER] Owner tomorrow digest completed');
  } catch (error) {
    console.error('[SCHEDULER] Error in owner tomorrow digest:', error);
  }
}

// ── 공유 일정 이메일 다이제스트 (공유 수신자용) ───────────────────────────────
async function sendSharedTasksEmailDigest() {
  console.log('[SCHEDULER] Sending shared tasks email digest...');
  try {
    const allTasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();

    const todaySharedTasks = allTasks.filter(t =>
      t.shareScope !== 'private' &&
      ((t.shareTeamIds && t.shareTeamIds.length > 0) || (t.shareUserIds && t.shareUserIds.length > 0)) &&
      !t.emailDigestSent &&
      isToday(parseISO(t.createdAt))
    );

    if (todaySharedTasks.length === 0) {
      console.log('[SCHEDULER] No new shared tasks for email digest');
      return;
    }

    const recipientTasks = new Map<string, typeof todaySharedTasks>();

    for (const task of todaySharedTasks) {
      const targetIds = getSharedTargetUserIds(task, users);
      for (const targetId of targetIds) {
        const target = users.find(u => u.id === targetId);
        if (!target?.email) continue;
        if (!recipientTasks.has(target.id)) {
          recipientTasks.set(target.id, []);
        }
        recipientTasks.get(target.id)!.push(task);
      }
    }

    for (const [userId, sharedTasks] of recipientTasks) {
      const user = users.find(u => u.id === userId);
      if (!user?.email) continue;

      const taskRows = sharedTasks.map(task => {
        const owner = users.find(u => u.id === task.userId);
        const ownerName = owner?.username || '알 수 없음';
        const scheduledTime = format(parseISO(task.scheduledAt), 'yyyy-MM-dd HH:mm');
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.title}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${scheduledTime}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${ownerName}</td>
          </tr>`;
      }).join('');

      const body = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">📅 오늘의 공유 일정 알림</h2>
    <p>${user.username}님, 오늘 새로 공유된 일정 ${sharedTasks.length}건을 알려드립니다.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; text-align: left;">일정</th>
          <th style="padding: 8px; text-align: left;">예정일시</th>
          <th style="padding: 8px; text-align: left;">작성자</th>
        </tr>
      </thead>
      <tbody>${taskRows}</tbody>
    </table>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 12px; color: #6b7280;">이 메일은 AI 업무 알림 서비스에서 자동 발송되었습니다.</p>
  </div>
</body>
</html>`;

      await sendEmail({
        to: user.email,
        subject: `[AI 업무 알림] 오늘의 공유 일정 ${sharedTasks.length}건`,
        body,
        isHtml: true,
      });
      console.log(`[SCHEDULER] Sent shared tasks digest to ${user.email}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    for (const task of todaySharedTasks) {
      await storage.updatePersonalTask(task.id, { emailDigestSent: true });
    }

    console.log('[SCHEDULER] Shared tasks email digest completed');
  } catch (error) {
    console.error('[SCHEDULER] Error in shared tasks email digest:', error);
  }
}

export function startScheduler() {
  // ── 오전 9시: 장비 점검 이메일 + 개인일정 아침 알림 ──────────────────────
  cron.schedule('0 9 * * *', () => {
    console.log('[SCHEDULER] 9 AM KST - running scheduled check');
    runDailyCheckIfNeeded();
    checkPersonalTasksMorning();
  }, { timezone: 'Asia/Seoul' });

  // ── 매 1분: 10분 전 reminder ─────────────────────────────────────────────
  cron.schedule('* * * * *', () => {
    checkPersonalTasksReminder();
  }, { timezone: 'Asia/Seoul' });

  // ── 오후 6시: 내일 일정 다이제스트 + 공유 일정 다이제스트 ─────────────────
  cron.schedule('0 18 * * *', () => {
    console.log('[SCHEDULER] 6 PM KST - sending email digests');
    sendOwnerTomorrowDigest();
    sendSharedTasksEmailDigest();
  }, { timezone: 'Asia/Seoul' });

  // ── 자정: 알림 플래그 초기화 ─────────────────────────────────────────────
  cron.schedule('0 0 * * *', () => {
    console.log('[SCHEDULER] Midnight KST - resetting daily notification flags');
    storage.resetDailyNotificationFlags();
  }, { timezone: 'Asia/Seoul' });

  console.log('[SCHEDULER] Scheduler started - 9 AM inspection+personal check, every min reminder, 6 PM digest, midnight reset');

  // ── Bug Fix #1 & #3: 서버 재시작 시 시간대별 catch-up ────────────────────
  const now = new Date();
  const kstHour = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }));

  if (kstHour >= 9) {
    console.log(`[SCHEDULER] Server started at KST hour ${kstHour} - running morning catch-up`);
    setTimeout(async () => {
      // Bug Fix #1: 개인일정 아침 알림 catch-up 추가 (기존에 누락됐던 핵심 버그)
      await runDailyCheckIfNeeded();
      await checkPersonalTasksMorning();
    }, 5000);
  }

  if (kstHour >= 18) {
    // Bug Fix #3: 6 PM 이후 서버 재시작 시 다이제스트 catch-up
    console.log(`[SCHEDULER] Server started at KST hour ${kstHour} - running 6PM digest catch-up`);
    setTimeout(async () => {
      await sendOwnerTomorrowDigest();
      await sendSharedTasksEmailDigest();
    }, 8000);
  }
}

export { checkUpcomingInspections };
