import cron from 'node-cron';
import { storage } from './storage';
import { sendInspectionReminder } from './emailService';
import { addDays, parseISO, isAfter, isBefore, format } from 'date-fns';

async function checkUpcomingInspections() {
  console.log('[SCHEDULER] Checking for upcoming inspections...');
  
  try {
    const assets = await storage.getAssets();
    const users = await storage.getUsers();
    const teams = await storage.getTeams();
    
    const today = new Date();
    const sevenDaysFromNow = addDays(today, 7);
    
    const upcomingAssets = assets.filter(asset => {
      if (!asset.nextDueDate) return false;
      const dueDate = parseISO(asset.nextDueDate);
      return isAfter(dueDate, today) && isBefore(dueDate, sevenDaysFromNow);
    });
    
    console.log(`[SCHEDULER] Found ${upcomingAssets.length} assets with inspections due within 7 days`);
    
    for (const asset of upcomingAssets) {
      const team = teams.find(t => t.id === asset.teamId);
      const staff = users.find(u => u.id === asset.staffId);
      
      if (team?.contactEmail) {
        const staffName = staff?.username || '담당자';
        const dueDate = format(parseISO(asset.nextDueDate!), 'yyyy-MM-dd');
        
        console.log(`[SCHEDULER] Sending reminder for ${asset.name} to ${team.contactEmail}`);
        
        const result = await sendInspectionReminder(
          team.contactEmail,
          asset.name,
          dueDate,
          staffName
        );
        
        if (result.success) {
          console.log(`[SCHEDULER] Sent reminder for ${asset.name} (ID: ${result.messageId})`);
        } else {
          console.error(`[SCHEDULER] Failed to send reminder for ${asset.name}: ${result.error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('[SCHEDULER] Inspection check completed');
  } catch (error) {
    console.error('[SCHEDULER] Error checking inspections:', error);
  }
}

export function startScheduler() {
  cron.schedule('0 9 * * *', () => {
    console.log('[SCHEDULER] Running daily inspection check at 9 AM KST');
    checkUpcomingInspections();
  }, {
    timezone: 'Asia/Seoul'
  });
  
  console.log('[SCHEDULER] Scheduler started - Daily check at 9:00 AM KST');
}

export { checkUpcomingInspections };
