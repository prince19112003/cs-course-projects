import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { hostels, blocks, floors, rooms, beds } from '../../src/main/database/schema/infrastructure.js';
import { students } from '../../src/main/database/schema/students.js';
import { allocations } from '../../src/main/database/schema/allocations.js';
import { invoices } from '../../src/main/database/schema/billing.js';
import { attendance } from '../../src/main/database/schema/operations.js';
import { auditLogs } from '../../src/main/database/schema/system.js';
import { BulkOperationsService } from '../../src/main/services/BulkOperationsService.js';
import { SessionUser } from '../../src/shared/types.js';
import { eq } from 'drizzle-orm';

describe('Phase 07: Bulk Operations Engine', () => {
  const mockAdmin: SessionUser = {
    id: 'USR-ADMIN-BULK',
    name: 'Ops Admin',
    email: 'ops@nexus.test',
    phone: '9876543210',
    role: 'admin',
    permissions: ['billing:run', 'allocations:manage', 'attendance:mark'],
    forcePasswordChange: false,
  };

  const mockUnauthorized: SessionUser = {
    id: 'USR-GUEST-BULK',
    name: 'Guest Ops',
    email: 'guestops@nexus.test',
    phone: '9876543299',
    role: 'resident',
    permissions: [],
    forcePasswordChange: false,
  };

  const hostelId = 'HST-BLK-001';
  const blockId = 'BLK-BLK-001';
  const floorId = 'FLR-BLK-001';
  const roomId = 'RM-BLK-001';
  const bed1Id = 'BED-BLK-001';
  const bed2Id = 'BED-BLK-002';
  const bed3Id = 'BED-BLK-003';

  const studentAId = 'STU-BLK-001';
  const studentBId = 'STU-BLK-002';
  const studentCId = 'STU-BLK-003';

  beforeEach(async () => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });

    const db = getDb();
    const now = Date.now();

    await db.insert(institutions).values({
      id: 'INST-0001',
      name: 'Nexus Tech University',
      code: 'NEXUS-01',
      address: '100 Campus Way',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(users).values({
      id: mockAdmin.id,
      name: mockAdmin.name,
      email: mockAdmin.email,
      phone: mockAdmin.phone,
      passwordHash: 'hash',
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(hostels).values({
      id: hostelId,
      institutionId: 'INST-0001',
      name: 'North Wing Hostel',
      code: 'NWH',
      genderType: 'boys',
      address: 'North Campus',
      totalFloors: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blocks).values({
      id: blockId,
      hostelId,
      name: 'Block N1',
      code: 'N1',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(floors).values({
      id: floorId,
      blockId,
      floorNumber: 1,
      name: '1st Floor',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(rooms).values({
      id: roomId,
      floorId,
      roomNumber: 'N-101',
      roomType: 'triple',
      capacity: 3,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(beds).values([
      { id: bed1Id, roomId, bedLabel: 'N-101-A', status: 'vacant', createdAt: now, updatedAt: now },
      { id: bed2Id, roomId, bedLabel: 'N-101-B', status: 'vacant', createdAt: now, updatedAt: now },
      { id: bed3Id, roomId, bedLabel: 'N-101-C', status: 'vacant', createdAt: now, updatedAt: now },
    ]);

    await db.insert(students).values([
      {
        id: studentAId,
        institutionId: 'INST-0001',
        enrollmentNumber: 'ENR-BLK-001',
        firstName: 'Alice',
        lastName: 'Walker',
        dateOfBirth: '2004-03-10',
        gender: 'female',
        email: 'alice@nexus.edu',
        phone: '9871110001',
        course: 'B.Tech',
        department: 'CS',
        academicYear: 1,
        admissionDate: '2024-08-01',
        permanentAddress: 'City A',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: studentBId,
        institutionId: 'INST-0001',
        enrollmentNumber: 'ENR-BLK-002',
        firstName: 'Bob',
        lastName: 'Smith',
        dateOfBirth: '2004-04-12',
        gender: 'male',
        email: 'bob@nexus.edu',
        phone: '9871110002',
        course: 'B.Tech',
        department: 'EC',
        academicYear: 1,
        admissionDate: '2024-08-01',
        permanentAddress: 'City B',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: studentCId,
        institutionId: 'INST-0001',
        enrollmentNumber: 'ENR-BLK-003',
        firstName: 'Charlie',
        lastName: 'Brown',
        dateOfBirth: '2004-05-15',
        gender: 'male',
        email: 'charlie@nexus.edu',
        phone: '9871110003',
        course: 'B.Tech',
        department: 'ME',
        academicYear: 1,
        admissionDate: '2024-08-01',
        permanentAddress: 'City C',
        status: 'inactive', // Inactive student
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  describe('Bulk Invoicing', () => {
    it('generates invoices for all active students with correct counts and sums', async () => {
      const result = await BulkOperationsService.bulkCreateInvoices(mockAdmin, {
        target: 'all',
        billingCycle: '2026-11',
        description: 'Hostel Maintenance Nov 2026',
        amountDue: 5000,
        dueDate: Date.now() + 86400000 * 10,
      });

      expect(result.totalTargeted).toBe(2); // Only Alice and Bob are active
      expect(result.generatedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.totalAmountInvoiced).toBe(10000);

      const db = getDb();
      const allInvoices = await db.select().from(invoices);
      expect(allInvoices.length).toBe(2);
      expect(allInvoices.every((i: any) => i.amountDue === 5000)).toBe(true);

      // Verify audit log
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'BULK_INVOICES_GENERATED'));
      expect(logs.length).toBe(1);
    });

    it('skips students who already have an invoice for the specified billing cycle (idempotency)', async () => {
      // First run
      await BulkOperationsService.bulkCreateInvoices(mockAdmin, {
        target: 'all',
        billingCycle: '2026-11',
        description: 'Hostel Maintenance Nov 2026',
        amountDue: 5000,
      });

      // Second run for same cycle
      const secondResult = await BulkOperationsService.bulkCreateInvoices(mockAdmin, {
        target: 'all',
        billingCycle: '2026-11',
        description: 'Hostel Maintenance Nov 2026',
        amountDue: 5000,
      });

      expect(secondResult.totalTargeted).toBe(2);
      expect(secondResult.generatedCount).toBe(0);
      expect(secondResult.skippedCount).toBe(2);
      expect(secondResult.totalAmountInvoiced).toBe(0);
    });

    it('rejects invalid billing cycle format or non-positive amount', async () => {
      await expect(
        BulkOperationsService.bulkCreateInvoices(mockAdmin, {
          target: 'all',
          billingCycle: 'November-2026', // Bad format
          description: 'Fee',
          amountDue: 5000,
        })
      ).rejects.toThrow(/INVALID_BILLING_CYCLE/i);

      await expect(
        BulkOperationsService.bulkCreateInvoices(mockAdmin, {
          target: 'all',
          billingCycle: '2026-11',
          description: 'Fee',
          amountDue: 0, // Bad amount
        })
      ).rejects.toThrow(/INVALID_AMOUNT/i);
    });

    it('enforces RBAC permission check on bulk invoicing', async () => {
      await expect(
        BulkOperationsService.bulkCreateInvoices(mockUnauthorized, {
          target: 'all',
          billingCycle: '2026-11',
          description: 'Fee',
          amountDue: 5000,
        })
      ).rejects.toThrow(/FORBIDDEN/i);
    });
  });

  describe('Bulk Bed Allocation', () => {
    it('allocates beds to multiple students in a single atomic transaction', async () => {
      const result = await BulkOperationsService.bulkAllocateBeds(mockAdmin, {
        assignments: [
          { studentId: studentAId, bedId: bed1Id, academicYear: '2026-2027' },
          { studentId: studentBId, bedId: bed2Id, academicYear: '2026-2027' },
        ],
      });

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.allocatedBedIds).toEqual([bed1Id, bed2Id]);

      const db = getDb();
      const studentA = await db.select().from(students).where(eq(students.id, studentAId));
      expect(studentA[0].assignedBedId).toBe(bed1Id);

      const b1 = await db.select().from(beds).where(eq(beds.id, bed1Id));
      expect(b1[0].status).toBe('occupied');

      const allAllocs = await db.select().from(allocations);
      expect(allAllocs.length).toBe(2);

      // Verify audit log
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'BULK_BEDS_ALLOCATED'));
      expect(logs.length).toBe(1);
    });

    it('detects and handles conflicts if bed is already occupied or student is already allocated', async () => {
      // Allocate bed 1 to Alice
      await BulkOperationsService.bulkAllocateBeds(mockAdmin, {
        assignments: [{ studentId: studentAId, bedId: bed1Id }],
      });

      // Try allocating bed 1 to Bob, and bed 2 to Alice
      const result = await BulkOperationsService.bulkAllocateBeds(mockAdmin, {
        assignments: [
          { studentId: studentBId, bedId: bed1Id }, // Bed 1 is occupied
          { studentId: studentAId, bedId: bed2Id }, // Alice is already allocated
        ],
      });

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(2);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].error).toMatch(/OCCUPIED/i);
      expect(result.errors[1].error).toMatch(/ALREADY_ALLOCATED/i);
    });

    it('enforces RBAC permission check on bulk allocations', async () => {
      await expect(
        BulkOperationsService.bulkAllocateBeds(mockUnauthorized, {
          assignments: [{ studentId: studentAId, bedId: bed1Id }],
        })
      ).rejects.toThrow(/FORBIDDEN/i);
    });
  });

  describe('Bulk Attendance Marking', () => {
    it('marks attendance records for multiple students atomically', async () => {
      const result = await BulkOperationsService.bulkMarkAttendance(mockAdmin, {
        date: '2026-11-01',
        records: [
          { studentId: studentAId, status: 'present' },
          { studentId: studentBId, status: 'absent', remarks: 'Medical leave' },
        ],
      });

      expect(result.markedCount).toBe(2);
      expect(result.date).toBe('2026-11-01');

      const db = getDb();
      const marks = await db.select().from(attendance).where(eq(attendance.date, '2026-11-01'));
      expect(marks.length).toBe(2);
      const bobMark = marks.find((m: any) => m.studentId === studentBId);
      expect(bobMark?.status).toBe('absent');
      expect(bobMark?.remarks).toBe('Medical leave');

      // Verify audit log
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'BULK_ATTENDANCE_RECORDED'));
      expect(logs.length).toBe(1);
    });

    it('supports markAllPresent shortcut across all active allocated students', async () => {
      // First allocate Alice and Bob
      await BulkOperationsService.bulkAllocateBeds(mockAdmin, {
        assignments: [
          { studentId: studentAId, bedId: bed1Id },
          { studentId: studentBId, bedId: bed2Id },
        ],
      });

      const result = await BulkOperationsService.bulkMarkAttendance(mockAdmin, {
        date: '2026-11-02',
        markAllPresent: true,
      });

      expect(result.markedCount).toBe(2);

      const db = getDb();
      const marks = await db.select().from(attendance).where(eq(attendance.date, '2026-11-02'));
      expect(marks.length).toBe(2);
      expect(marks.every((m: any) => m.status === 'present')).toBe(true);
    });

    it('enforces RBAC permission check on bulk attendance', async () => {
      await expect(
        BulkOperationsService.bulkMarkAttendance(mockUnauthorized, {
          date: '2026-11-01',
          records: [{ studentId: studentAId, status: 'present' }],
        })
      ).rejects.toThrow(/FORBIDDEN/i);
    });
  });
});
