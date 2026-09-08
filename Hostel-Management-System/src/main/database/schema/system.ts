import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  changesSummary: text('changes_summary'),
  ipHostname: text('ip_hostname').default('localhost'),
  timestamp: integer('timestamp').notNull(),
}, (table) => ({
  timeIdx: index('idx_audit_timestamp').on(table.timestamp),
  entityIdx: index('idx_audit_entity').on(table.entityType, table.entityId),
}));

export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: integer('updated_at').notNull(),
});

export const importExportHistory = sqliteTable('import_export_history', {
  id: text('id').primaryKey(),
  operationType: text('operation_type').notNull(), // 'EXPORT' | 'IMPORT'
  packageName: text('package_name').notNull(),
  schemaVersion: integer('schema_version').notNull(),
  recordCount: integer('record_count').notNull(),
  status: text('status').notNull(), // 'SUCCESS' | 'FAILED' | 'ROLLED_BACK'
  executedBy: text('executed_by').notNull().references(() => users.id),
  checksum: text('checksum').notNull(),
  timestamp: integer('timestamp').notNull(),
});

export const nexusMigrations = sqliteTable('__nexus_migrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  migrationName: text('migration_name').notNull().unique(),
  appliedAt: integer('applied_at').notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type ImportExportRecord = typeof importExportHistory.$inferSelect;
export type NexusMigration = typeof nexusMigrations.$inferSelect;
