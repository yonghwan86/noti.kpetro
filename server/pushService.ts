import webpush from 'web-push';
import { storage } from './storage';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:ax@kpetro.or.kr';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('[PUSH] Web Push configured with VAPID keys');
} else {
  console.warn('[PUSH] VAPID keys not found. Push notifications disabled.');
}

export async function sendPushToUser(userId: string, title: string, body: string, url?: string) {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const subs = await storage.getPushSubscriptionsByUserId(userId);
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: url || '/' });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await storage.deletePushSubscription(sub.endpoint);
        console.log(`[PUSH] Removed expired subscription for user ${userId}`);
      } else {
        console.error(`[PUSH] Failed to send to user ${userId}:`, err.message);
      }
    }
  }
}

export function getVapidPublicKey(): string | undefined {
  return vapidPublicKey;
}
