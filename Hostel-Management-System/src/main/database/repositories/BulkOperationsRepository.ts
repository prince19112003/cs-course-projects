import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { invoices, Invoice } from '../schema/billing.js';
import { students } from '../schema/students.js';
import { beds } from '../schema/infrastructure.js';
import { allocations, Allocation } from '../schema/allocations.js';
import { attendance } from '../schema/operations.js';
import { generateEntityId } from '../utils/id-generator.js';
import {
  BulkInvoiceResult,
  BulkAllocationResult,
  BulkAttendanceResult,
} from '../../shared/types.js';

export class BulkOperationsRepository {
  // 1. Bulk Invoicing
  static async bulkCreateInvoices(data: {
    studentIds: string[];
    billingCycle: string;
    description: string;
    amountDue: number;
    dueDate: number;
  }): Promise<BulkInvoiceResult> {
    const db = getDb();
    const now = Date.now();
    const createdInvoices: Invoice[] = [];
    let skippedCount = 0;

    db.transaction((tx) => {
      for (const studentId of data.studentIds) {
        // Check if invoice already exists for this student & billing cycle to prevent duplicate charges
        const existing = tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.studentId, studentId),
              eq(invoices.billingCycle, data.billingCycle)
            )
          )
          .all();

        if (existing.length > 0) {
          skippedCount++;
          continue;
        }

        const id = generateEntityId('INV');
        tx.insert(invoices)
          .values({
            id,
            studentId,
            billingCycle: data.billingCycle,
            description: data.description.trim(),
            amountDue: data.amountDue,
            amountPaid: 0,
            dueDate: data.dueDate,
            status: 'unpaid',
            createdAt: now,
          })
          .run();

        createdInvoices.push({
          id,
          studentId,
          billingCycle: data.billingCycle,
          description: data.description.trim(),
          amountDue: data.amountDue,
          amountPaid: 0,
          dueDate: data.dueDate,
          status: 'unpaid',
          createdAt: now,
        });
      }
    });

    return {
      totalTargeted: data.studentIds.length,
      generatedCount: createdInvoices.length,
      skippedCount,
      totalAmountInvoiced: createdInvoices.length * data.amountDue,
      invoices: createdInvoices as any[],
    };
  }

  // 2. Bulk Bed Allocation
  static async bulkAllocateBeds(data: {
    assignments: Array<{ studentId: string; bedId: string }>;
    allocatedBy: string;
  }): Promise<BulkAllocationResult> {
    const db = getDb();
    const now = Date.now();
    const successfulAllocations: Allocation[] = [];
    const errors: Array<{ studentId: string; bedId: string; error: string }> = [];

    db.transaction((tx) => {
      for (const item of data.assignments) {
        // Verify student exists and is active
        const stuRows = tx.select().from(students).where(eq(students.id, item.studentId)).all();
        if (stuRows.length === 0) {
          errors.push({ ...item, error: 'Student record not found' });
          continue;
        }
        const stu = stuRows[0];
        if (stu.status !== 'active') {
          errors.push({ ...item, error: `Student status is ${stu.status} (must be active)` });
          continue;
        }

        // Verify student doesn't already have an active allocation
        const activeStuAlloc = tx
          .select()
          .from(allocations)
          .where(and(eq(allocations.studentId, item.studentId), eq(allocations.status, 'active')))
          .all();

        if (activeStuAlloc.length > 0) {
          errors.push({ ...item, error: 'Student ALREADY_ALLOCATED: active bed already allocated' });
          continue;
        }

        // Verify bed exists and is vacant (no active allocation)
        const bedRows = tx.select().from(beds).where(eq(beds.id, item.bedId)).all();
        if (bedRows.length === 0) {
          errors.push({ ...item, error: 'Bed record not found' });
          continue;
        }
        if (bedRows[0].status !== 'vacant') {
          errors.push({ ...item, error: `Bed OCCUPIED or unavailable (status: ${bedRows[0].status})` });
          continue;
        }

        const activeBedAlloc = tx
          .select()
          .from(allocations)
          .where(and(eq(allocations.bedId, item.bedId), eq(allocations.status, 'active')))
          .all();

        if (activeBedAlloc.length > 0) {
          errors.push({ ...item, error: 'Bed OCCUPIED: currently allocated' });
          continue;
        }

        // Allocate
        const allocId = generateEntityId('ALC');
        tx.insert(allocations)
          .values({
            id: allocId,
            studentId: item.studentId,
            bedId: item.bedId,
            allocatedAt: now,
            allocationType: 'fresh_admission',
            allocatedBy: data.allocatedBy,
            status: 'active',
          })
          .run();

        // Update bed status to occupied
        tx.update(beds)
          .set({ status: 'occupied', updatedAt: now })
          .where(eq(beds.id, item.bedId))
          .run();

        // Update student assignedBedId
        tx.update(students)
          .set({ assignedBedId: item.bedId, updatedAt: now })
          .where(eq(students.id, item.studentId))
          .run();

        successfulAllocations.push({
          id: allocId,
          studentId: item.studentId,
          bedId: item.bedId,
          allocatedAt: now,
          vacatedAt: null,
          allocationType: 'fresh_admission',
          status: 'active',
          allocatedBy: data.allocatedBy,
          remarks: null,
        });
      }
    });

    return {
      successCount: successfulAllocations.length,
      failureCount: errors.length,
      allocatedBedIds: successfulAllocations.map((a) => a.bedId),
      allocations: successfulAllocations as any[],
      errors,
    };
  }

  // 3. Bulk Attendance Marking
  static async bulkMarkAttendance(data: {
    studentIds: string[];
    date: string;
    defaultStatus: 'present' | 'absent';
    exceptions: Array<{ studentId: string; status: 'present' | 'absent' | 'late' | 'approved_leave'; remarks?: string }>;
    recordedBy: string;
  }): Promise<BulkAttendanceResult> {
    const db = getDb();
    const now = Date.now();
    const exceptionMap = new Map(data.exceptions.map((e) => [e.studentId, e]));

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    db.transaction((tx) => {
      for (const stuId of data.studentIds) {
        let status: 'present' | 'absent' | 'late' | 'approved_leave' = data.defaultStatus;
        let remarks: string | null = null;

        if (exceptionMap.has(stuId)) {
          const exc = exceptionMap.get(stuId)!;
          status = exc.status;
          remarks = exc.remarks || null;
        }

        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
        else if (status === 'approved_leave') leaveCount++;

        // Upsert attendance record
        const existing = tx
          .select()
          .from(attendance)
          .where(and(eq(attendance.studentId, stuId), eq(attendance.date, data.date)))
          .all();

        if (existing.length > 0) {
          tx.update(attendance)
            .set({ status, recordedBy: data.recordedBy, remarks, recordedAt: now })
            .where(eq(attendance.id, existing[0].id))
            .run();
        } else {
          const id = generateEntityId('ATT');
          tx.insert(attendance)
            .values({
              id,
              studentId: stuId,
              date: data.date,
              status,
              recordedBy: data.recordedBy,
              remarks,
              recordedAt: now,
            })
            .run();
        }
      }
    });

    return {
      date: data.date,
      markedCount: data.studentIds.length,
      presentCount,
      absentCount,
      leaveCount,
    };
  }
}
