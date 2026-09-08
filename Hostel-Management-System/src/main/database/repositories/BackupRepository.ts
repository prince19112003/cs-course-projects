import Database from 'better-sqlite3';
import { getSqlite, getDb, persistDatabase } from '../connection.js';
import { students } from '../schema/students.js';
import { hostels, blocks, floors, rooms, beds } from '../schema/infrastructure.js';
import { allocations } from '../schema/allocations.js';
import { invoices, payments } from '../schema/billing.js';
import { attendance } from '../schema/operations.js';
import { users } from '../schema/users.js';
import { auditLogs } from '../schema/system.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'node:fs';

export class BackupRepository {
  /**
   * Creates an online copy of the active database without locking readers/writers.
   */
  static async createRawBackup(targetPath: string): Promise<void> {
    const sqlite = getSqlite();

    if (sqlite && typeof sqlite.backup === 'function') {
      await sqlite.backup(targetPath);
    } else if (sqlite && typeof sqlite.export === 'function') {
      const buffer = sqlite.export();
      fs.writeFileSync(targetPath, Buffer.from(buffer));
    } else {
      throw new Error('NO_BACKUP_DRIVER: Active SQLite instance does not support backup API.');
    }
  }

  /**
   * Creates a defragmented VACUUM INTO snapshot of the database.
   */
  static async createSnapshotDb(targetPath: string): Promise<void> {
    const sqlite = getSqlite();

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    try {
      if (sqlite && typeof sqlite.exec === 'function') {
        sqlite.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}';`);
      } else {
        await this.createRawBackup(targetPath);
      }
    } catch {
      // Fallback to online backup if VACUUM INTO fails (e.g. in-memory or older engine)
      await this.createRawBackup(targetPath);
    }
  }

  /**
   * Collects record count metrics across core institutional tables.
   */
  static async getRecordMetrics(): Promise<Record<string, number>> {
    const db = getDb();
    const metrics: Record<string, number> = {};

    try {
      const stuRows = await db.select({ count: sql<number>`count(*)` }).from(students);
      metrics.studentsCount = Number(stuRows[0]?.count || 0);

      const hRows = await db.select({ count: sql<number>`count(*)` }).from(hostels);
      metrics.hostelsCount = Number(hRows[0]?.count || 0);

      const rRows = await db.select({ count: sql<number>`count(*)` }).from(rooms);
      metrics.roomsCount = Number(rRows[0]?.count || 0);

      const bRows = await db.select({ count: sql<number>`count(*)` }).from(beds);
      metrics.bedsCount = Number(bRows[0]?.count || 0);

      const aRows = await db.select({ count: sql<number>`count(*)` }).from(allocations);
      metrics.allocationsCount = Number(aRows[0]?.count || 0);

      const iRows = await db.select({ count: sql<number>`count(*)` }).from(invoices);
      metrics.invoicesCount = Number(iRows[0]?.count || 0);

      const uRows = await db.select({ count: sql<number>`count(*)` }).from(users);
      metrics.usersCount = Number(uRows[0]?.count || 0);

      const logRows = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
      metrics.auditLogsCount = Number(logRows[0]?.count || 0);
    } catch (err) {
      console.error('Failed to collect record metrics:', err);
    }

    return metrics;
  }

  /**
   * Performs deep integrity and foreign key checks on a database file.
   */
  static runIntegrityCheck(targetDbPath?: string): {
    ok: boolean;
    quickCheck: string;
    integrity: string;
    foreignKeys: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    let dbInstance: any;
    let shouldClose = false;

    if (targetDbPath) {
      try {
        dbInstance = new Database(targetDbPath, { readonly: true, fileMustExist: true });
        shouldClose = true;
      } catch (err) {
        return {
          ok: false,
          quickCheck: 'ERROR',
          integrity: (err as Error).message,
          foreignKeys: false,
          errors: [`Failed opening database: ${(err as Error).message}`],
        };
      }
    } else {
      dbInstance = getSqlite();
    }

    try {
      let quickCheck = 'unknown';
      let integrity = 'unknown';
      let foreignKeysOk = true;

      if (typeof dbInstance.pragma === 'function') {
        quickCheck = dbInstance.pragma('quick_check', { simple: true }) as string;
        integrity = dbInstance.pragma('integrity_check', { simple: true }) as string;
        const fkIssues = dbInstance.pragma('foreign_key_check') as any[];
        if (fkIssues && fkIssues.length > 0) {
          foreignKeysOk = false;
          errors.push(`Foreign key check failed: ${fkIssues.length} orphaned references detected.`);
        }
      } else if (typeof dbInstance.exec === 'function') {
        const qRes = dbInstance.exec('PRAGMA quick_check;');
        quickCheck = qRes.length > 0 && qRes[0].values?.[0]?.[0] ? String(qRes[0].values[0][0]) : 'unknown';

        const iRes = dbInstance.exec('PRAGMA integrity_check;');
        integrity = iRes.length > 0 && iRes[0].values?.[0]?.[0] ? String(iRes[0].values[0][0]) : 'unknown';
      }

      if (quickCheck !== 'ok') {
        errors.push(`Quick check issue: ${quickCheck}`);
      }
      if (integrity !== 'ok') {
        errors.push(`Integrity issue: ${integrity}`);
      }

      const isOk = errors.length === 0;

      return {
        ok: isOk,
        quickCheck,
        integrity,
        foreignKeys: foreignKeysOk,
        errors,
      };
    } finally {
      if (shouldClose && dbInstance) {
        try {
          dbInstance.close();
        } catch {}
      }
    }
  }

  /**
   * Reconciles and merges records from an incoming portable database into the active database.
   * Preserves destination station credentials (`users` table).
   */
  static async reconcileBranchMerge(
    incomingDbPath: string,
    conflictPolicy: 'skip' | 'overwrite' = 'skip'
  ): Promise<{ importedCount: number; updatedCount: number; skippedCount: number }> {
    const incomingDb = new Database(incomingDbPath, { readonly: true, fileMustExist: true });
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      // 1. Fetch incoming students
      const incomingStudents = incomingDb.prepare('SELECT * FROM students').all() as any[];
      const activeDb = getDb();
      const now = Date.now();

      activeDb.transaction((tx: any) => {
        for (const stu of incomingStudents) {
          const existing = tx
            .select()
            .from(students)
            .where(eq(students.enrollmentNumber, stu.enrollment_number))
            .all();

          if (existing.length > 0) {
            if (conflictPolicy === 'overwrite') {
              tx.update(students)
                .set({
                  firstName: stu.first_name,
                  lastName: stu.last_name,
                  email: stu.email,
                  phone: stu.phone,
                  gender: stu.gender,
                  course: stu.course,
                  department: stu.department,
                  academicYear: stu.academic_year,
                  status: stu.status,
                  updatedAt: now,
                })
                .where(eq(students.id, existing[0].id))
                .run();
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            tx.insert(students)
              .values({
                id: stu.id,
                institutionId: stu.institution_id || 'INST-0001',
                enrollmentNumber: stu.enrollment_number,
                firstName: stu.first_name,
                lastName: stu.last_name,
                dateOfBirth: stu.date_of_birth || '2004-01-01',
                gender: stu.gender,
                email: stu.email,
                phone: stu.phone,
                course: stu.course,
                department: stu.department,
                academicYear: stu.academic_year,
                admissionDate: stu.admission_date || '2024-08-01',
                permanentAddress: stu.permanent_address || 'Address',
                status: stu.status || 'active',
                feeStatus: stu.fee_status || 'pending',
                assignedBedId: null, // Reset bed allocation on merge to prevent conflicting allocations
                createdAt: stu.created_at || now,
                updatedAt: now,
              })
              .run();
            importedCount++;
          }
        }
      });
    } finally {
      incomingDb.close();
    }

    persistDatabase();

    return {
      importedCount,
      updatedCount,
      skippedCount,
    };
  }
}
