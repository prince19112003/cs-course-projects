import { desc } from 'drizzle-orm';
import { getDb, persistDatabase } from '../connection.js';
import { auditLogs, AuditLog } from '../schema/system.js';
import { generateEntityId } from '../utils/id-generator.js';

export class AuditRepository {
  static async log(params: {
    action: string;
    entityType: string;
    entityId?: string;
    changesSummary?: string | object;
    userId?: string;
    userRole?: string;
    ipHostname?: string;
  }): Promise<void> {
    try {
      const db = getDb();
      const id = generateEntityId('AUD');
      
      let summaryStr: string | null = null;
      if (typeof params.changesSummary === 'object' && params.changesSummary !== null) {
        summaryStr = JSON.stringify({
          ...params.changesSummary,
          userRole: params.userRole,
        });
      } else if (params.changesSummary) {
        summaryStr = String(params.changesSummary);
      } else if (params.userRole) {
        summaryStr = JSON.stringify({ userRole: params.userRole });
      }

      await db.insert(auditLogs).values({
        id,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        changesSummary: summaryStr,
        userId: params.userId || null,
        ipHostname: params.ipHostname || 'localhost',
        timestamp: Date.now(),
      });

      persistDatabase();
    } catch {
      // Audit logging failures must never crash user workflows
    }
  }

  static async getRecentLogs(limit = 50): Promise<AuditLog[]> {
    const db = getDb();
    return db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(limit);
  }

  static async getRecent(limit = 50): Promise<AuditLog[]> {
    return this.getRecentLogs(limit);
  }

  static async createLog(params: {
    userId?: string;
    userRole?: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: string;
  }): Promise<void> {
    return this.log({
      userId: params.userId,
      userRole: params.userRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changesSummary: params.details,
    });
  }
}
