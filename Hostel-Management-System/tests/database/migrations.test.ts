import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations, getAppliedMigrations } from '../../src/main/database/migrator.js';

describe('Database Migration Engine', () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
  });

  afterEach(() => {
    sqlite.close();
  });

  it('applies initial schema to a completely blank database', () => {
    const result = applyMigrations(sqlite);
    expect(result.appliedCount).toBe(2);
    expect(result.migrations).toContain('0001_initial_schema');
    expect(result.migrations).toContain('0002_roles_and_permissions');

    // Verify tables exist
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('__nexus_migrations');
    expect(tableNames).toContain('institutions');
    expect(tableNames).toContain('hostels');
    expect(tableNames).toContain('blocks');
    expect(tableNames).toContain('floors');
    expect(tableNames).toContain('rooms');
    expect(tableNames).toContain('beds');
    expect(tableNames).toContain('students');
    expect(tableNames).toContain('allocations');
    expect(tableNames).toContain('attendance');
    expect(tableNames).toContain('invoices');
    expect(tableNames).toContain('payments');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('roles');
    expect(tableNames).toContain('permissions');
    expect(tableNames).toContain('role_permissions');
    expect(tableNames).toContain('audit_logs');
    expect(tableNames).toContain('system_settings');
  });

  it('does not re-apply already executed migrations', () => {
    applyMigrations(sqlite);
    const secondRun = applyMigrations(sqlite);
    expect(secondRun.appliedCount).toBe(0);

    const history = getAppliedMigrations(sqlite);
    expect(history.length).toBe(2);
    expect(history[0].name).toBe('0001_initial_schema');
    expect(history[1].name).toBe('0002_roles_and_permissions');
  });

  it('creates partial unique indexes for one-active-allocation rule', () => {
    applyMigrations(sqlite);

    const indexes = sqlite
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='index'")
      .all() as { name: string; sql: string }[];
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_unique_active_student_alloc');
    expect(indexNames).toContain('idx_unique_active_bed_alloc');

    const studentAllocIndex = indexes.find((i) => i.name === 'idx_unique_active_student_alloc');
    expect(studentAllocIndex?.sql).toContain("WHERE status = 'active'");
  });
});
