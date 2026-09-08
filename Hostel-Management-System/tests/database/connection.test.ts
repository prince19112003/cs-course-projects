import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, checkDatabaseHealth, closeDatabase, getSqlite } from '../../src/main/database/connection.js';

describe('Database Connection & Health Checks', () => {
  beforeEach(() => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('initializes in-memory database with approved PRAGMA profile', () => {
    const sqlite = getSqlite();
    expect(sqlite).toBeDefined();

    const fk = sqlite.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);

    const tempStore = sqlite.pragma('temp_store', { simple: true });
    expect(tempStore).toBe(2); // 2 = MEMORY
  });

  it('reports database health as operational and integrity as ok', () => {
    const health = checkDatabaseHealth();
    expect(health.ok).toBe(true);
    expect(health.foreignKeys).toBe(true);
    expect(health.integrity).toBe('ok');
    expect(health.appliedMigrations).toContain('0001_initial_schema');
  });

  it('safely handles double initialization without crashing', () => {
    const health1 = checkDatabaseHealth();
    initDatabase({ inMemory: true });
    const health2 = checkDatabaseHealth();
    expect(health1.ok).toBe(true);
    expect(health2.ok).toBe(true);
  });
});
