import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // 'super_admin' | 'warden' | 'accountant'
  isActive: integer('is_active').notNull().default(1),
  forcePasswordChange: integer('force_password_change').notNull().default(0),
  lastLoginAt: integer('last_login_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  roleIdx: index('idx_users_role').on(table.role),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
