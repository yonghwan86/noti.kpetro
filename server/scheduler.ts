import cron from 'node-cron';
import { storage } from './storage';
import { sendInspectionReminder, sendOverdueAlert, sendEmail } from './emailService';
import { sendPushToUser } from './pushService';
import { addDays, parseISO, isAfter, isBefore, format, differenceInDays, isToday, subMinutes } from 'date-fns';

async function checkUpcomingInspections() {
  console.log('[SCHEDULER] Checking for upcoming and overdue inspections...');
  
  try {
    const assets = await storage.getAssets();
    const users = await storage.getUsers();
    const teams = await storage.getTeams();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = addDays(today, 7);
    
    const activeAssets = assets.filter(asset => asset.status !== 'suspended');

    const upcomingAssets = activeAssets.filter(asset => {
      if (!asset.nextDueDate) return false;
      const dueDate = parseISO(asset.nextDueDate);
      return isAfter(dueDate, today) && isBefore(dueDate, sevenDaysFromNow);
    });

    const overdueAssets = activeAssets.filter(asset => {
      if (!asset.nextDueDate) return false;
      const dueDate = parseISO(asset.nextDueDate);
      return isBefore(dueDate, today);
    });
    
    console.log(`[SCHEDULER] Found ${upcomingAssets.length} upcoming, ${overdueAssets.length} overdue assets`);
    
    for (const asset of upcomingAssets) {
      const recipients = collectRecipients(asset, users, teams);
      const staff = users.find(u => u.id === asset.staffId);
      const staffName = staff?.username || '담당자';
      const team = teams.find(t => t.id === asset.teamId);
      const teamName = team?.name || '미지정';
      const dueDate = format(parseISO(asset.nextDueDate!), 'yyyy-MM-dd');

      for (const email of recipients) {
        console.log(`[SCHEDULER] Sending upcoming reminder for ${asset.name} to ${email}`);
        const result = await sendInspectionReminder(email, asset.name, dueDate, staffName, teamName);
        if (result.success) {
          console.log(`[SCHEDULER] Sent reminder for ${asset.name} to ${email} (ID: ${result.messageId})`);
        } else {
          console.error(`[SCHEDULER] Failed to send reminder for ${asset.name} to ${email}: ${result.error}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const daysLeft = differenceInDays(parseISO(asset.nextDueDate!), today);
      const pushRecipientIds = new Set<string>();
      if (asset.staffId) pushRecipientIds.add(asset.staffId);
      if (asset.managerId) pushRecipientIds.add(asset.managerId);
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
      const recipients = collectRecipients(asset, users, teams);
      const staff = users.find(u => u.id === asset.staffId);
      const staffName = staff?.username || '담당자';
      const team = teams.find(t => t.id === asset.teamId);
      const teamName = team?.name || '미지정';
      const dueDate = format(parseISO(asset.nextDueDate!), 'yyyy-MM-dd');

      for (const email of recipients) {
        console.log(`[SCHEDULER] Sending overdue alert for ${asset.name} to ${email}`);
        const result = await sendOverdueAlert(email, asset.name, dueDate, staffName, teamName);
        if (result.success) {
          console.log(`[SCHEDULER] Sent overdue alert for ${asset.name} to ${email} (ID: ${result.messageId})`);
        } else {
          console.error(`[SCHEDULER] Failed to send overdue alert for ${asset.name} to ${email}: ${result.error}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const overdueDays = differenceInDays(today, parseISO(asset.nextDueDate!));
      const pushRecipientIds = new Set<string>();
      if (asset.staffId) pushRecipientIds.add(asset.staffId);
      if (asset.managerId) pushRecipientIds.add(asset.managerId);
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

function collectRecipients(asset: any, users: any[], teams: any[]): string[] {
  const recipients: string[] = [];

  const staff = users.find(u => u.id === asset.staffId);
  if (staff?.email) {
    recipients.push(staff.email);
  }

  const team = teams.find(t => t.id === asset.teamId);
  const teamLeaders = users.filter(
    u => u.role === 'staff' && u.teamId === asset.teamId && u.position === '팀장' && u.email
  );
  for (const leader of teamLeaders) {
    if (leader.email && !recipients.includes(leader.email)) {
      recipients.push(leader.email);
    }
  }

  if (team?.contactEmail && !recipients.includes(team.contactEmail)) {
    recipients.push(team.contactEmail);
  }

  const manager = users.find(u => u.id === asset.managerId);
  if (manager?.email && !recipients.includes(manager.email)) {
    recipients.push(manager.email);
  }

  return recipients;
}

function getTodayKST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

async function getLastEmailDate(): Promise<string | null> {
  try {
    const { db } = await import('../db');
    const result = await db.execute(
      `SELECT value FROM system_settings WHERE key = 'last_email_date' LIMIT 1`
    );
    const rows = result.rows as any[];
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function setLastEmailDate(date: string): Promise<void> {
  try {
    const { db } = await import('../db');
    await db.execute(
      `INSERT INTO system_settings (key, value) VALUES ('last_email_date', '${date}')
       ON CONFLICT (key) DO UPDATE SET value = '${date}'`
    );
  } catch (error) {
    console.error('[SCHEDULER] Failed to save last email date:', error);
  }
}

async function runDailyCheckIfNeeded() {
  const today = getTodayKST();
  const lastEmailDate = await getLastEmailDate();
  if (lastEmailDate === today) {
    console.log('[SCHEDULER] Already sent emails today, skipping');
    return;
  }
  await setLastEmailDate(today);
  console.log('[SCHEDULER] Running daily inspection check');
  await checkUpcomingInspections();
}

async function checkPersonalTasksMorning() {
  console.log('[SCHEDULER] Checking personal tasks for morning push...');
  try {
    const tasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();
    const teams = await storage.getTeams();
    const now = new Date();

    for (const task of tasks) {
      if (task.morningNotified) continue;
      const scheduledDate = parseISO(task.scheduledAt);
      if (!isToday(scheduledDate)) continue;

      const owner = users.find(u => u.id === task.userId);
      const ownerName = owner?.username || '알 수 없음';
      const timeStr = format(scheduledDate, 'HH:mm');

      await sendPushToUser(
        task.userId,
        `📅 오늘 일정: ${task.title}`,
        `${timeStr}에 예정된 일정이 있습니다.`,
        '/schedule'
      );

      if (task.shareScope !== 'private' && task.shareTeamIds && task.shareTeamIds.length > 0) {
        const targetUsers = users.filter(u =>
          u.id !== task.userId && task.shareTeamIds!.includes(u.teamId)
        );
        for (const target of targetUsers) {
          await sendPushToUser(
            target.id,
            `📅 공유 일정: ${task.title}`,
            `${ownerName}님의 일정 | ${timeStr} 예정`,
            '/schedule'
          );
        }
      }

      await storage.updatePersonalTask(task.id, { morningNotified: true });
    }
    console.log('[SCHEDULER] Personal tasks morning check completed');
  } catch (error) {
    console.error('[SCHEDULER] Error in personal tasks morning check:', error);
  }
}

async function checkPersonalTasksReminder() {
  try {
    const tasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();
    const now = new Date();

    for (const task of tasks) {
      if (task.reminderNotified) continue;
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

        if (task.shareScope !== 'private' && task.shareTeamIds && task.shareTeamIds.length > 0) {
          const targetUsers = users.filter(u =>
            u.id !== task.userId && task.shareTeamIds!.includes(u.teamId)
          );
          for (const target of targetUsers) {
            await sendPushToUser(
              target.id,
              `⏰ 10분 후 공유 일정: ${task.title}`,
              `${ownerName}님의 일정이 곧 시작됩니다.`,
              '/schedule'
            );
          }
        }

        await storage.updatePersonalTask(task.id, { reminderNotified: true });
      }
    }
  } catch (error) {
    console.error('[SCHEDULER] Error in personal tasks reminder:', error);
  }
}

async function sendSharedTasksEmailDigest() {
  console.log('[SCHEDULER] Sending shared tasks email digest...');
  try {
    const allTasks = await storage.getAllPersonalTasksForScheduler();
    const users = await storage.getUsers();
    const teams = await storage.getTeams();

    const todaySharedTasks = allTasks.filter(t =>
      t.shareScope !== 'private' &&
      t.shareTeamIds && t.shareTeamIds.length > 0 &&
      !t.emailDigestSent &&
      isToday(parseISO(t.createdAt))
    );

    if (todaySharedTasks.length === 0) {
      console.log('[SCHEDULER] No new shared tasks for email digest');
      return;
    }

    const recipientTasks = new Map<string, typeof todaySharedTasks>();

    for (const task of todaySharedTasks) {
      const targetUsers = users.filter(u =>
        u.id !== task.userId && task.shareTeamIds!.includes(u.teamId)
      );
      for (const target of targetUsers) {
        if (!target.email) continue;
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
  cron.schedule('0 9 * * *', () => {
    console.log('[SCHEDULER] 9 AM KST - running scheduled check');
    runDailyCheckIfNeeded();
    checkPersonalTasksMorning();
  }, {
    timezone: 'Asia/Seoul'
  });

  cron.schedule('* * * * *', () => {
    checkPersonalTasksReminder();
  }, {
    timezone: 'Asia/Seoul'
  });

  cron.schedule('0 18 * * *', () => {
    console.log('[SCHEDULER] 6 PM KST - sending shared tasks email digest');
    sendSharedTasksEmailDigest();
  }, {
    timezone: 'Asia/Seoul'
  });

  cron.schedule('0 0 * * *', () => {
    console.log('[SCHEDULER] Midnight KST - resetting daily notification flags');
    storage.resetDailyNotificationFlags();
  }, {
    timezone: 'Asia/Seoul'
  });
  
  console.log('[SCHEDULER] Scheduler started - Daily check at 9:00 AM KST, reminders every minute, digest at 6:00 PM KST');

  const now = new Date();
  const kstHour = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }));
  if (kstHour >= 9) {
    console.log('[SCHEDULER] Server started after 9 AM KST - checking if emails already sent today');
    setTimeout(() => {
      runDailyCheckIfNeeded();
    }, 5000);
  }
}

export { checkUpcomingInspections };
