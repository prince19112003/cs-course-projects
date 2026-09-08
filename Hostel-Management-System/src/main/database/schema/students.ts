import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { beds } from './infrastructure.js';

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  enrollmentNumber: text('enrollment_number').notNull().unique(),
  nationalId: text('national_id').unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(), // 'YYYY-MM-DD'
  gender: text('gender').notNull(), // 'male' | 'female' | 'other'
  bloodGroup: text('blood_group'),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  course: text('course').notNull(),
  department: text('department').notNull(),
  academicYear: integer('academic_year').notNull(),
  admissionDate: text('admission_date').notNull(), // 'YYYY-MM-DD'
  permanentAddress: text('permanent_address').notNull(),
  currentAddress: text('current_address'),
  photoPath: text('photo_path'),
  assignedBedId: text('assigned_bed_id').references(() => beds.id),
  status: text('status').notNull().default('active'), // 'active' | 'graduated' | 'vacated' | 'expelled' | 'suspended'
  feeStatus: text('fee_status').notNull().default('paid'), // 'paid' | 'pending' | 'overdue'
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  searchIdx: index('idx_students_search').on(table.status, table.lastName, table.firstName),
  enrollmentIdx: index('idx_students_enrollment').on(table.enrollmentNumber),
  phoneIdx: index('idx_students_phone').on(table.phone),
  emailIdx: index('idx_students_email').on(table.email),
  bedIdx: index('idx_students_bed').on(table.assignedBedId),
}));

export const guardians = sqliteTable('guardians', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  relationship: text('relationship').notNull(), // 'father' | 'mother' | 'guardian'
  phone: text('phone').notNull(),
  alternatePhone: text('alternate_phone'),
  email: text('email'),
  address: text('address'),
  isPrimary: integer('is_primary').notNull().default(1),
}, (table) => ({
  studentIdx: index('idx_guardians_student').on(table.studentId),
}));

export const studentDocuments = sqliteTable('student_documents', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  docType: text('doc_type').notNull(), // 'id_proof' | 'admission_agreement' | 'medical_clearance' | 'undertaking'
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileHash: text('file_hash').notNull(),
  uploadedAt: integer('uploaded_at').notNull(),
}, (table) => ({
  studentIdx: index('idx_student_docs_student').on(table.studentId),
}));

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Guardian = typeof guardians.$inferSelect;
export type StudentDocument = typeof studentDocuments.$inferSelect;
