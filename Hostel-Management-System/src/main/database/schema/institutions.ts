import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const institutions = sqliteTable('institutions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  address: text('address').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  currencySymbol: text('currency_symbol').default('$'),
  logoPath: text('logo_path'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Institution = typeof institutions.$inferSelect;
export type NewInstitution = typeof institutions.$inferInsert;
