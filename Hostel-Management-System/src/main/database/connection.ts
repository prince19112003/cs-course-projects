import Database from 'better-sqlite3';
import { drizzle as drizzleBetterSqlite3, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleSqlJs, SQLJsDatabase } from 'drizzle-orm/sql-js';
import path from 'path';
import fs from 'fs';
import * as schema from './schema/index.js';
import { applyMigrations, getAppliedMigrations } from './migrator.js';

export interface DatabaseHealth {
  ok: boolean;
  journalMode: string;
  foreignKeys: boolean;
  integrity: string;
  appliedMigrations: string[];
  dbPath: string;
  error?: string;
  driver?: 'better-sqlite3' | 'sql-js';
}

export interface InitDbOptions {
  dbPath?: string;
  inMemory?: boolean;
  autoMigrate?: boolean;
  driver?: 'better-sqlite3' | 'sql-js' | 'auto';
}

export type AppDatabase = BetterSQLite3Database<typeof schema> | SQLJsDatabase<typeof schema>;

let sqliteInstance: Database.Database | null = null;
let sqlJsInstance: any | null = null;
let drizzleInstance: any | null = null;
let currentDbPath: string = ':memory:';
let activeDriver: 'better-sqlite3' | 'sql-js' = 'better-sqlite3';

const isElectron = typeof process !== 'undefined' && Boolean(process.versions?.electron);

/**
 * Initializes the SQLite database engine with the approved PRAGMA profile and Drizzle ORM.
 * When running in standard Node (Vitest/scripts), uses high-performance better-sqlite3.
 * When running in Electron or requested, uses sql.js Wasm/asm.js engine with disk persistence.
 */
export async function initDatabaseAsync(options: InitDbOptions = {}): Promise<{
  db: AppDatabase;
  sqlite: any;
}> {
  if ((sqliteInstance || sqlJsInstance) && drizzleInstance) {
    return { db: drizzleInstance, sqlite: sqliteInstance || sqlJsInstance };
  }

  const { inMemory = false, autoMigrate = true, driver = 'auto' } = options;
  const useSqlJs = driver === 'sql-js' || (driver === 'auto' && isElectron);

  if (useSqlJs) {
    activeDriver = 'sql-js';
    // Load sql-asm.js
    const initSqlJsModule = await import('sql.js/dist/sql-asm.js');
    const initSqlJs = initSqlJsModule.default || initSqlJsModule;
    const SQL = await initSqlJs();

    if (inMemory) {
      currentDbPath = ':memory:';
      sqlJsInstance = new SQL.Database();
    } else {
      const targetPath = options.dbPath || getDefaultDatabasePath();
      currentDbPath = targetPath;
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (fs.existsSync(targetPath)) {
        const fileBuffer = fs.readFileSync(targetPath);
        sqlJsInstance = new SQL.Database(fileBuffer);
      } else {
        sqlJsInstance = new SQL.Database();
      }
    }

    // SQLite settings
    sqlJsInstance.run('PRAGMA foreign_keys = ON;');

    if (autoMigrate) {
      applyMigrations(sqlJsInstance);
    }

    // Persist to disk if file-based
    persistDatabase();

    drizzleInstance = drizzleSqlJs(sqlJsInstance, { schema });

    return {
      db: drizzleInstance,
      sqlite: sqlJsInstance,
    };
  } else {
    activeDriver = 'better-sqlite3';
    if (inMemory) {
      currentDbPath = ':memory:';
      sqliteInstance = new Database(':memory:');
    } else {
      const targetPath = options.dbPath || getDefaultDatabasePath();
      currentDbPath = targetPath;

      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      sqliteInstance = new Database(targetPath);
    }

    // Enforce approved SQLite high-performance & resilience PRAGMAs
    sqliteInstance.pragma('journal_mode = WAL');
    sqliteInstance.pragma('synchronous = NORMAL');
    sqliteInstance.pragma('foreign_keys = ON');
    sqliteInstance.pragma('cache_size = -64000'); // 64MB cache
    sqliteInstance.pragma('temp_store = MEMORY');
    sqliteInstance.pragma('mmap_size = 268435456'); // 256MB MMAP
    sqliteInstance.pragma('auto_vacuum = INCREMENTAL');

    if (autoMigrate) {
      applyMigrations(sqliteInstance);
    }

    drizzleInstance = drizzleBetterSqlite3(sqliteInstance, { schema });

    return {
      db: drizzleInstance,
      sqlite: sqliteInstance,
    };
  }
}

/**
 * Synchronous initialization variant for pure Node / Vitest test runners.
 */
export function initDatabase(options: InitDbOptions = {}): {
  db: AppDatabase;
  sqlite: any;
} {
  if ((sqliteInstance || sqlJsInstance) && drizzleInstance) {
    return { db: drizzleInstance, sqlite: sqliteInstance || sqlJsInstance };
  }

  const { inMemory = false, autoMigrate = true } = options;
  activeDriver = 'better-sqlite3';

  if (inMemory) {
    currentDbPath = ':memory:';
    sqliteInstance = new Database(':memory:');
  } else {
    const targetPath = options.dbPath || getDefaultDatabasePath();
    currentDbPath = targetPath;

    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    sqliteInstance = new Database(targetPath);
  }

  // Enforce approved SQLite high-performance & resilience PRAGMAs
  sqliteInstance.pragma('journal_mode = WAL');
  sqliteInstance.pragma('synchronous = NORMAL');
  sqliteInstance.pragma('foreign_keys = ON');
  sqliteInstance.pragma('cache_size = -64000');
  sqliteInstance.pragma('temp_store = MEMORY');
  sqliteInstance.pragma('mmap_size = 268435456');
  sqliteInstance.pragma('auto_vacuum = INCREMENTAL');

  if (autoMigrate) {
    applyMigrations(sqliteInstance);
  }

  drizzleInstance = drizzleBetterSqlite3(sqliteInstance, { schema });

  return {
    db: drizzleInstance,
    sqlite: sqliteInstance,
  };
}

/**
 * Returns the active Drizzle ORM instance.
 */
export function getDb(): any {
  if (!drizzleInstance) {
    throw new Error('DATABASE_NOT_INITIALIZED: Call initDatabase() before accessing the database.');
  }
  return drizzleInstance;
}

/**
 * Returns the underlying SQLite instance.
 */
export function getSqlite(): any {
  if (!sqliteInstance && !sqlJsInstance) {
    throw new Error('DATABASE_NOT_INITIALIZED: Call initDatabase() before accessing SQLite.');
  }
  return sqliteInstance || sqlJsInstance;
}

/**
 * Persists the sql.js database buffer to disk if active and using a file path.
 */
export function persistDatabase(): void {
  if (sqlJsInstance && currentDbPath && currentDbPath !== ':memory:') {
    try {
      const data = sqlJsInstance.export();
      const parentDir = path.dirname(currentDbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(currentDbPath, Buffer.from(data));
    } catch (err) {
      console.error('Failed to persist database to disk:', err);
    }
  }
}

/**
 * Performs a comprehensive database health verification.
 */
export function checkDatabaseHealth(): DatabaseHealth {
  if (!sqliteInstance && !sqlJsInstance) {
    return {
      ok: false,
      journalMode: 'unknown',
      foreignKeys: false,
      integrity: 'DATABASE_NOT_INITIALIZED',
      appliedMigrations: [],
      dbPath: currentDbPath,
      error: 'Database is not initialized',
    };
  }

  try {
    if (activeDriver === 'better-sqlite3' && sqliteInstance) {
      const jMode = sqliteInstance.pragma('journal_mode', { simple: true }) as string;
      const fk = sqliteInstance.pragma('foreign_keys', { simple: true }) as number;
      const integrityRow = sqliteInstance.pragma('quick_check', { simple: true }) as string;
      const migrations = getAppliedMigrations(sqliteInstance).map((m) => m.name);

      const isOk = integrityRow === 'ok';

      return {
        ok: isOk,
        journalMode: jMode,
        foreignKeys: fk === 1,
        integrity: integrityRow,
        appliedMigrations: migrations,
        dbPath: currentDbPath,
        driver: 'better-sqlite3',
      };
    } else if (sqlJsInstance) {
      const fkRes = sqlJsInstance.exec('PRAGMA foreign_keys;');
      const integrityRes = sqlJsInstance.exec('PRAGMA quick_check;');
      const fk = Boolean(fkRes.length > 0 && Number(fkRes[0]?.values?.[0]?.[0]) === 1);
      const integrityRow = integrityRes.length > 0 && integrityRes[0]?.values?.[0]?.[0] === 'ok' ? 'ok' : 'unknown';
      const migrations = getAppliedMigrations(sqlJsInstance).map((m: any) => m.name);

      return {
        ok: integrityRow === 'ok',
        journalMode: 'memory',
        foreignKeys: fk,
        integrity: integrityRow,
        appliedMigrations: migrations,
        dbPath: currentDbPath,
        driver: 'sql-js',
      };
    }

    return {
      ok: false,
      journalMode: 'unknown',
      foreignKeys: false,
      integrity: 'UNKNOWN_DRIVER',
      appliedMigrations: [],
      dbPath: currentDbPath,
    };
  } catch (err) {
    return {
      ok: false,
      journalMode: 'unknown',
      foreignKeys: false,
      integrity: 'ERROR',
      appliedMigrations: [],
      dbPath: currentDbPath,
      error: (err as Error).message,
    };
  }
}

/**
 * Safely closes the database connection after flushing and checkpointing.
 */
export function closeDatabase(): void {
  if (sqlJsInstance) {
    persistDatabase();
    try {
      sqlJsInstance.close();
    } catch {}
    sqlJsInstance = null;
  }

  if (sqliteInstance) {
    try {
      sqliteInstance.pragma('wal_checkpoint(TRUNCATE)');
    } catch {}
    sqliteInstance.close();
    sqliteInstance = null;
  }

  drizzleInstance = null;
}

/**
 * Resolves the default production path (%APPDATA%/NexusHostel/data/hostel_master.db).
 */
export function getDefaultDatabasePath(): string {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Roaming');
  return path.join(appData, 'NexusHostel', 'data', 'hostel_master.db');
}
