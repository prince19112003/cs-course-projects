import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { students } from './students.js';
import { rooms, blocks } from './infrastructure.js';
import { users } from './users.js';

export const staff = sqliteTable('staff', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  designation: text('designation').notNull(), // 'chief_warden' | 'warden' | 'security' | 'maintenance' | 'caretaker'
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
});

export const attendance = sqliteTable('attendance', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  status: text('status').notNull().default('present'), // 'present' | 'absent' | 'approved_leave' | 'late'
  recordedBy: text('recorded_by').notNull().references(() => users.id),
  remarks: text('remarks'),
  recordedAt: integer('recorded_at').notNull(),
}, (table) => ({
  dateStatusIdx: index('idx_att_date_status').on(table.date, table.status),
  studentIdx: index('idx_att_student').on(table.studentId),
  uniqueDateStudent: unique('uq_att_date_student').on(table.date, table.studentId),
}));

export const gatePasses = sqliteTable('gate_passes', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  passType: text('pass_type').notNull(), // 'day_out' | 'night_out' | 'vacation' | 'emergency'
  reason: text('reason').notNull(),
  destination: text('destination').notNull(),
  departureTime: integer('departure_time').notNull(),
  expectedReturnTime: integer('expected_return_time').notNull(),
  actualExitTime: integer('actual_exit_time'),
  actualReturnTime: integer('actual_return_time'),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'active_out' | 'closed' | 'overdue'
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewNotes: text('review_notes'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_gatepasses_student').on(table.studentId),
  statusIdx: index('idx_gatepasses_status').on(table.status),
}));

export const complaints = sqliteTable('complaints', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'restrict' }),
  category: text('category').notNull(), // 'electrical' | 'plumbing' | 'carpentry' | 'masonry' | 'cleaning' | 'other'
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'urgent'
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'resolved' | 'rejected'
  assignedStaffId: text('assigned_staff_id').references(() => staff.id),
  resolutionNotes: text('resolution_notes'),
  createdAt: integer('created_at').notNull(),
  resolvedAt: integer('resolved_at'),
}, (table) => ({
  statusIdx: index('idx_complaints_status').on(table.status),
  roomIdx: index('idx_complaints_room').on(table.roomId),
}));

export const messOptOuts = sqliteTable('mess_opt_outs', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  weekendStartDate: text('weekend_start_date').notNull(), // 'YYYY-MM-DD'
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_mess_opt_student').on(table.studentId),
  uniqueStudentWeekend: unique('uq_mess_opt_student_date').on(table.studentId, table.weekendStartDate),
}));

export const notices = sqliteTable('notices', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  targetAudience: text('target_audience').notNull().default('all'), // 'all' | 'boys_only' | 'girls_only' | 'block_specific'
  blockId: text('block_id').references(() => blocks.id),
  priority: text('priority').notNull().default('normal'), // 'normal' | 'urgent' | 'critical'
  publishedBy: text('published_by').notNull().references(() => users.id),
  isPinned: integer('is_pinned').notNull().default(0),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull(),
});

export const visitors = sqliteTable('visitors', {
  id: text('id').primaryKey(),
  visitorName: text('visitor_name').notNull(),
  phone: text('phone').notNull(),
  relationship: text('relationship').notNull(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  idProofDetails: text('id_proof_details').notNull(),
  purpose: text('purpose').notNull(),
  checkInTime: integer('check_in_time').notNull(),
  checkOutTime: integer('check_out_time'),
  gateOfficerId: text('gate_officer_id').notNull().references(() => users.id),
}, (table) => ({
  studentIdx: index('idx_visitors_student').on(table.studentId),
  checkinIdx: index('idx_visitors_checkin').on(table.checkInTime),
}));

export type Staff = typeof staff.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type GatePass = typeof gatePasses.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type MessOptOut = typeof messOptOuts.$inferSelect;
export type Notice = typeof notices.$inferSelect;
export type Visitor = typeof visitors.$inferSelect;
