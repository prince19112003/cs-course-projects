import { eq } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { systemSettings } from '../schema/system.js';

export class SystemRepository {
  static async getSetting(key: string): Promise<string | null> {
    const db = getDb();
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    return rows[0]?.value || null;
  }

  static async setSetting(key: string, value: string, description?: string): Promise<void> {
    const db = getDb();
    const existing = await this.getSetting(key);
    const now = Date.now();

    if (existing !== null) {
      await db
        .update(systemSettings)
        .set({ value, description: description || null, updatedAt: now })
        .where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({
        key,
        value,
        description: description || null,
        updatedAt: now,
      });
    }
  }

  static async getAllSettings(): Promise<Record<string, string>> {
    const db = getDb();
    const rows = await db.select().from(systemSettings);
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return map;
  }
}
