import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { students } from './students.js';
import { users } from './users.js';

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  billingCycle: text('billing_cycle').notNull(), // 'YYYY-MM'
  description: text('description').notNull(),
  amountDue: integer('amount_due').notNull(), // stored in lowest currency unit (cents / paisa)
  amountPaid: integer('amount_paid').notNull().default(0),
  dueDate: integer('due_date').notNull(),
  status: text('status').notNull().default('unpaid'), // 'unpaid' | 'partially_paid' | 'paid' | 'cancelled'
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  cycleStatusIdx: index('idx_invoices_cycle_status').on(table.billingCycle, table.status),
  studentIdx: index('idx_invoices_student').on(table.studentId),
  uniqueStudentCycle: unique('uq_invoices_student_cycle').on(table.studentId, table.billingCycle),
}));

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'restrict' }),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  amount: integer('amount').notNull(),
  paymentMode: text('payment_mode').notNull(), // 'cash' | 'bank_transfer' | 'cheque' | 'pos_card'
  referenceNumber: text('reference_number'),
  collectedBy: text('collected_by').notNull().references(() => users.id),
  paymentDate: integer('payment_date').notNull(),
  receiptNumber: text('receipt_number').notNull().unique(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  invoiceIdx: index('idx_payments_invoice').on(table.invoiceId),
  studentIdx: index('idx_payments_student').on(table.studentId),
  dateIdx: index('idx_payments_date').on(table.paymentDate),
}));

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
