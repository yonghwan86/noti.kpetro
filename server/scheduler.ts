import cron from 'node-cron';
import { storage } from './storage';
import { sendInspectionReminder, sendOverdueAlert } from './emailService';
import { addDays, parseISO, isAfter, isBefore, format } from 'date-fns';

async function checkUpcomingInspections() {
  console.log('[SCHEDULER] Checking for upcoming and overdue inspections...');
  
  try {
    const assets = await storage.getAssets();
    const users = await storage.getUsers();
    const teams = await storage.getTeams();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = addDays(today, 7);
    
    const upcomingAssets = assets.filter(asset => {
      if (!asset.nextDueDate) return false;
      const dueDate = parseISO(asset.nextDueDate);
      return isAfter(dueDate, today) && isBefore(dueDate, sevenDaysFromNow);
    });

    const overdueAssets = assets.filter(asset => {
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

export function startScheduler() {
  cron.schedule('0 9 * * *', () => {
    console.log('[SCHEDULER] Running daily inspection check at 9 AM KST');
    checkUpcomingInspections();
  }, {
    timezone: 'Asia/Seoul'
  });
  
  console.log('[SCHEDULER] Scheduler started - Daily check at 9:00 AM KST');

  const now = new Date();
  const kstHour = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }));
  if (kstHour >= 9) {
    console.log('[SCHEDULER] Server started after 9 AM KST - running inspection check now');
    setTimeout(() => {
      checkUpcomingInspections();
    }, 5000);
  }
}

export { checkUpcomingInspections };
