import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),                       // e.g. 'super_admin', 'warden'
  name: text('name').notNull().unique(),             // e.g. 'Super Administrator'
  description: text('description'),
  isSystemRole: integer('is_system_role').notNull().default(0), // 1 for protected roles
  createdAt: integer('created_at').notNull(),
});

export const permissions = sqliteTable('permissions', {
  code: text('code').primaryKey(),                   // e.g. 'students:create'
  module: text('module').notNull(),                  // e.g. 'students', 'allocations'
  description: text('description').notNull(),
});

export const rolePermissions = sqliteTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionCode: text('permission_code').notNull().references(() => permissions.code, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionCode] }),
  roleIdx: index('idx_role_perms_role').on(table.roleId),
}));

export const userHostels = sqliteTable('user_hostels', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  hostelId: text('hostel_id').notNull(),
  assignedAt: integer('assigned_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.hostelId] }),
  userIdx: index('idx_user_hostels_user').on(table.userId),
}));

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type UserHostel = typeof userHostels.$inferSelect;
