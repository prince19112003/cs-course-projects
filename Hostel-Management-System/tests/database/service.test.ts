import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../../src/main/database/services/DatabaseService.js';
import { InfrastructureRepository } from '../../src/main/database/repositories/InfrastructureRepository.js';
import { StudentRepository } from '../../src/main/database/repositories/StudentRepository.js';
import { AuditRepository } from '../../src/main/database/repositories/AuditRepository.js';

describe('DatabaseService Lifecycle & Baseline Initialization', () => {
  beforeEach(() => {
    DatabaseService.shutdown();
  });

  afterEach(() => {
    DatabaseService.shutdown();
  });

  it('initializes clean database from scratch, runs migrations, and seeds baseline metadata', async () => {
    const health = await DatabaseService.initialize({ inMemory: true, autoMigrate: true });
    expect(health.ok).toBe(true);
    expect(health.appliedMigrations).toContain('0001_initial_schema');
    expect(health.foreignKeys).toBe(true);
    expect(health.integrity).toBe('ok');

    // Verify baseline hostels
    const hostels = await InfrastructureRepository.getHostels();
    expect(hostels.length).toBeGreaterThanOrEqual(1);
    expect(hostels[0].code).toBe('MCRC-1');

    // Verify seeded stats
    const stats = await InfrastructureRepository.getStats();
    expect(stats.totalHostels).toBe(1);
    expect(stats.totalBlocks).toBe(2); // Block A & Block B
    expect(stats.totalRooms).toBe(4);
    expect(stats.totalBeds).toBe(8);
    expect(stats.vacantBeds).toBe(8);

    // Verify baseline audit log
    const auditLogs = await AuditRepository.getRecentLogs(5);
    expect(auditLogs.some((l) => l.action === 'SYSTEM_INITIAL_SEED')).toBe(true);
  });

  it('gracefully handles shutdown and reinitialization', async () => {
    await DatabaseService.initialize({ inMemory: true, autoMigrate: true });
    DatabaseService.shutdown();

    const healthAfterShutdown = DatabaseService.getHealth();
    expect(healthAfterShutdown.ok).toBe(false);

    await DatabaseService.initialize({ inMemory: true, autoMigrate: true });
    const healthReinit = DatabaseService.getHealth();
    expect(healthReinit.ok).toBe(true);
  });

  it('formats various database exceptions into secure, user-facing error structures', () => {
    const errUnique = new Error('UNIQUE constraint failed: students.enrollment_number');
    const fmtUnique = DatabaseService.formatError(errUnique);
    expect(fmtUnique.code).toBe('DUPLICATE_RECORD');
    expect(fmtUnique.field).toBe('students.enrollment_number');

    const errFk = new Error('FOREIGN KEY constraint failed');
    const fmtFk = DatabaseService.formatError(errFk);
    expect(fmtFk.code).toBe('FOREIGN_KEY_VIOLATION');

    const errCap = new Error('ROOM_CAPACITY_EXCEEDED');
    const fmtCap = DatabaseService.formatError(errCap);
    expect(fmtCap.code).toBe('ROOM_CAPACITY_EXCEEDED');

    const errAlloc = new Error('STUDENT_ALREADY_ALLOCATED');
    const fmtAlloc = DatabaseService.formatError(errAlloc);
    expect(fmtAlloc.code).toBe('STUDENT_ALREADY_ALLOCATED');

    const errBed = new Error('BED_OCCUPIED');
    const fmtBed = DatabaseService.formatError(errBed);
    expect(fmtBed.code).toBe('BED_OCCUPIED');
  });
});
