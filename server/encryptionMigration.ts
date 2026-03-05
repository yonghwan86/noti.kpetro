import { db } from "../db";
import { users } from "@shared/schema";
import { encrypt, isEncrypted } from "./encryption";
import { eq } from "drizzle-orm";

export async function migrateEncryption(): Promise<void> {
  try {
    const result = await db.execute(
      `SELECT value FROM system_settings WHERE key = 'encryption_migrated' LIMIT 1`
    );
    if (result.rows && result.rows.length > 0 && result.rows[0].value === 'true') {
      console.log('[ENCRYPTION] Migration already completed, skipping');
      return;
    }
  } catch (e) {
    console.log('[ENCRYPTION] system_settings check skipped (table may not exist yet)');
  }

  console.log('[ENCRYPTION] Starting username encryption migration...');
  const allUsers = await db.select().from(users);
  let migrated = 0;

  for (const user of allUsers) {
    if (!user.username || isEncrypted(user.username)) continue;

    const encrypted = encrypt(user.username);
    await db.update(users).set({ username: encrypted }).where(eq(users.id, user.id));
    migrated++;
  }

  console.log(`[ENCRYPTION] Migrated ${migrated} usernames`);

  try {
    await db.execute(
      `INSERT INTO system_settings (key, value) VALUES ('encryption_migrated', 'true')
       ON CONFLICT (key) DO UPDATE SET value = 'true'`
    );
  } catch (e) {
    console.log('[ENCRYPTION] Could not save migration flag (system_settings may not exist)');
  }
}
