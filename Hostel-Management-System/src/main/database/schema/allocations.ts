import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { students } from './students.js';
import { beds } from './infrastructure.js';
import { users } from './users.js';

export const allocations = sqliteTable('allocations', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  bedId: text('bed_id').notNull().references(() => beds.id, { onDelete: 'restrict' }),
  allocatedAt: integer('allocated_at').notNull(),
  vacatedAt: integer('vacated_at'),
  allocationType: text('allocation_type').notNull(), // 'fresh_admission' | 'requested_transfer' | 'administrative_transfer'
  status: text('status').notNull().default('active'), // 'active' | 'transferred' | 'vacated'
  allocatedBy: text('allocated_by').notNull().references(() => users.id),
  remarks: text('remarks'),
}, (table) => ({
  studentIdx: index('idx_alloc_student').on(table.studentId),
  bedIdx: index('idx_alloc_bed').on(table.bedId),
  statusIdx: index('idx_alloc_status').on(table.status),
}));

export type Allocation = typeof allocations.$inferSelect;
export type NewAllocation = typeof allocations.$inferInsert;
