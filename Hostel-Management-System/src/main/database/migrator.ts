import { initialSchemaSql } from './migrations/0001_initial_schema.js';
import { rolesAndPermissionsMigrationSql } from './migrations/0002_roles_and_permissions.js';

export interface Migration {
  name: string;
  sql: string;
}

const REGISTERED_MIGRATIONS: Migration[] = [
  {
    name: '0001_initial_schema',
    sql: initialSchemaSql,
  },
  {
    name: '0002_roles_and_permissions',
    sql: rolesAndPermissionsMigrationSql,
  },
];


/**
 * Executes all unapplied schema migrations inside atomic transactions.
 * Compatible with both better-sqlite3 and sql.js engines.
 */
export function applyMigrations(sqlite: any): { appliedCount: number; migrations: string[] } {
  // Ensure migration tracking table exists
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __nexus_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  let appliedNames: string[] = [];
  if (typeof sqlite.prepare === 'function' && typeof sqlite.transaction === 'function') {
    try {
      const appliedRows = sqlite.prepare('SELECT migration_name FROM __nexus_migrations').all() as { migration_name: string }[];
      appliedNames = appliedRows.map((r) => r.migration_name);
    } catch {
      // Fallback
    }
  }

  if (appliedNames.length === 0 && typeof sqlite.exec === 'function') {
    try {
      const res = sqlite.exec('SELECT migration_name FROM __nexus_migrations;');
      if (res && res.length > 0 && res[0].values) {
        appliedNames = res[0].values.map((v: any[]) => String(v[0]));
      }
    } catch {
      // Empty
    }
  }

  const appliedSet = new Set(appliedNames);
  const newlyApplied: string[] = [];

  for (const migration of REGISTERED_MIGRATIONS) {
    if (!appliedSet.has(migration.name)) {
      if (typeof sqlite.transaction === 'function') {
        const runTx = sqlite.transaction(() => {
          sqlite.exec(migration.sql);
          if (typeof sqlite.prepare === 'function') {
            sqlite
              .prepare('INSERT INTO __nexus_migrations (migration_name, applied_at) VALUES (?, ?)')
              .run(migration.name, Date.now());
          } else {
            sqlite.run('INSERT INTO __nexus_migrations (migration_name, applied_at) VALUES (?, ?);', [migration.name, Date.now()]);
          }
        });
        runTx();
      } else {
        sqlite.exec('BEGIN TRANSACTION;');
        try {
          sqlite.exec(migration.sql);
          if (typeof sqlite.run === 'function') {
            sqlite.run('INSERT INTO __nexus_migrations (migration_name, applied_at) VALUES (?, ?);', [migration.name, Date.now()]);
          } else {
            sqlite.exec(`INSERT INTO __nexus_migrations (migration_name, applied_at) VALUES ('${migration.name}', ${Date.now()});`);
          }
          sqlite.exec('COMMIT;');
        } catch (err) {
          sqlite.exec('ROLLBACK;');
          throw err;
        }
      }
      newlyApplied.push(migration.name);
    }
  }

  return {
    appliedCount: newlyApplied.length,
    migrations: newlyApplied,
  };
}

/**
 * Returns all applied migrations.
 */
export function getAppliedMigrations(sqlite: any): { name: string; appliedAt: number }[] {
  try {
    if (typeof sqlite.prepare === 'function' && typeof sqlite.transaction === 'function') {
      const rows = sqlite
        .prepare('SELECT migration_name as name, applied_at as appliedAt FROM __nexus_migrations ORDER BY id ASC')
        .all() as { name: string; appliedAt: number }[];
      return rows;
    } else if (typeof sqlite.exec === 'function') {
      const res = sqlite.exec('SELECT migration_name, applied_at FROM __nexus_migrations ORDER BY id ASC;');
      if (!res || res.length === 0 || !res[0].values) return [];
      return res[0].values.map((v: any[]) => ({ name: String(v[0]), appliedAt: Number(v[1]) }));
    }
    return [];
  } catch {
    return [];
  }
}

