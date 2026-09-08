import { BulkOperationsRepository } from '../database/repositories/BulkOperationsRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { StudentRepository } from '../database/repositories/StudentRepository.js';
import { getDb } from '../database/connection.js';
import { students } from '../database/schema/students.js';
import { allocations } from '../database/schema/allocations.js';
import { beds, rooms, blocks } from '../database/schema/infrastructure.js';
import { eq, and, sql } from 'drizzle-orm';
import {
  SessionUser,
  BulkInvoiceInput,
  BulkInvoiceResult,
  BulkAllocationInput,
  BulkAllocationResult,
  BulkAttendanceInput,
  BulkAttendanceResult,
} from '../../shared/types.js';

function verifyPermission(user: SessionUser, requiredPermission: string) {
  const hasWildcard = user.permissions.includes('*');
  const hasSpecific = user.permissions.includes(requiredPermission);
  if (!hasWildcard && !hasSpecific) {
    throw new Error(`FORBIDDEN: User lacks required permission '${requiredPermission}'.`);
  }
}

export class BulkOperationsService {
  // 1. Bulk Invoicing
  static async bulkCreateInvoices(
    user: SessionUser,
    input: BulkInvoiceInput
  ): Promise<BulkInvoiceResult> {
    verifyPermission(user, 'billing:run');

    if (!input.billingCycle || !/^\d{4}-\d{2}$/.test(input.billingCycle)) {
      throw new Error("INVALID_BILLING_CYCLE: Expected format 'YYYY-MM'.");
    }
    if (input.amountDue <= 0) {
      throw new Error('INVALID_AMOUNT: Invoice amount must be greater than zero.');
    }

    const db = getDb();
    let targetStudentIds: string[] = [];

    if (input.target === 'hostel' && input.hostelId) {
      // Find active students allocated in this hostel
      const hBlocks = await db.select().from(blocks).where(eq(blocks.hostelId, input.hostelId));
      const blockIds = hBlocks.map((b) => b.id);

      if (blockIds.length > 0) {
        const rows = await db
          .select({ studentId: allocations.studentId })
          .from(allocations)
          .innerJoin(beds, eq(allocations.bedId, beds.id))
          .innerJoin(rooms, eq(beds.roomId, rooms.id))
          .innerJoin(sql`floors`, eq(rooms.floorId, sql`floors.id`))
          .where(
            and(
              eq(allocations.status, 'active'),
              sql`floors.block_id IN (${sql.join(blockIds.map((id) => sql`${id}`), sql`, `)})`
            )
          );
        targetStudentIds = rows.map((r) => r.studentId);
      }
    } else {
      // All active students
      const rows = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.status, 'active'));
      targetStudentIds = rows.map((r) => r.id);
    }

    const result = await BulkOperationsRepository.bulkCreateInvoices({
      studentIds: targetStudentIds,
      billingCycle: input.billingCycle,
      description: input.description,
      amountDue: input.amountDue,
      dueDate: input.dueDate || Date.now() + 15 * 86400000,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'BULK_INVOICES_GENERATED',
      entityType: 'invoices',
      changesSummary: {
        cycle: input.billingCycle,
        generatedCount: result.generatedCount,
        skippedCount: result.skippedCount,
        totalAmount: result.totalAmountInvoiced,
      },
    });

    return result;
  }

  // 2. Bulk Bed Allocation
  static async bulkAllocateBeds(
    user: SessionUser,
    input: BulkAllocationInput
  ): Promise<BulkAllocationResult> {
    verifyPermission(user, 'allocations:manage');

    if (!input.assignments || input.assignments.length === 0) {
      throw new Error('INVALID_ASSIGNMENTS: At least one bed assignment item is required.');
    }

    const result = await BulkOperationsRepository.bulkAllocateBeds({
      assignments: input.assignments,
      allocatedBy: user.id,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'BULK_BEDS_ALLOCATED',
      entityType: 'allocations',
      changesSummary: {
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
    });

    return result;
  }

  // 3. Bulk Attendance Marking
  static async bulkMarkAttendance(
    user: SessionUser,
    input: BulkAttendanceInput
  ): Promise<BulkAttendanceResult> {
    verifyPermission(user, 'attendance:mark');

    const db = getDb();
    let studentIds: string[] = [];
    let defaultStatus: 'present' | 'absent' = input.defaultStatus || 'present';
    let exceptions = input.exceptions || [];

    if (input.records && input.records.length > 0) {
      studentIds = input.records.map((r) => r.studentId);
      exceptions = input.records;
      defaultStatus = 'present';
    } else if (input.hostelId && input.hostelId !== 'all') {
      const hBlocks = await db.select().from(blocks).where(eq(blocks.hostelId, input.hostelId));
      const blockIds = hBlocks.map((b) => b.id);
      if (blockIds.length > 0) {
        const rows = await db
          .select({ studentId: allocations.studentId })
          .from(allocations)
          .innerJoin(beds, eq(allocations.bedId, beds.id))
          .innerJoin(rooms, eq(beds.roomId, rooms.id))
          .innerJoin(sql`floors`, eq(rooms.floorId, sql`floors.id`))
          .where(
            and(
              eq(allocations.status, 'active'),
              sql`floors.block_id IN (${sql.join(blockIds.map((id) => sql`${id}`), sql`, `)})`
            )
          );
        studentIds = rows.map((r) => r.studentId);
      }
    } else {
      const rows = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.status, 'active'));
      studentIds = rows.map((r) => r.id);
    }

    if (input.markAllPresent) {
      defaultStatus = 'present';
      exceptions = [];
    }

    const result = await BulkOperationsRepository.bulkMarkAttendance({
      studentIds,
      date: input.date,
      defaultStatus,
      exceptions,
      recordedBy: user.id,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'BULK_ATTENDANCE_RECORDED',
      entityType: 'attendance',
      changesSummary: {
        date: input.date,
        markedCount: result.markedCount,
        presentCount: result.presentCount,
        absentCount: result.absentCount,
      },
    });

    return result;
  }
}
