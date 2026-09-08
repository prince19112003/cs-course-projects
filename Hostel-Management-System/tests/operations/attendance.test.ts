import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { hostels, blocks, floors, rooms, beds } from '../../src/main/database/schema/infrastructure.js';
import { allocations } from '../../src/main/database/schema/allocations.js';
import { students } from '../../src/main/database/schema/students.js';
import { gatePasses } from '../../src/main/database/schema/operations.js';
import { OperationsService } from '../../src/main/services/OperationsService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 06 Operations: Attendance Roll Call & Auto-Leave Detection', () => {
  const mockWarden: SessionUser = {
    id: 'USR-WARDEN-001',
    name: 'Warden Smith',
    email: 'warden@nexus.test',
    phone: '9876543210',
    role: 'warden',
    permissions: ['attendance:mark', 'rooms:view', 'students:view'],
    forcePasswordChange: false,
  };

  const mockUnauthorized: SessionUser = {
    id: 'USR-GUEST-001',
    name: 'Guest User',
    email: 'guest@nexus.test',
    phone: '9876543299',
    role: 'resident',
    permissions: ['rooms:view'],
    forcePasswordChange: false,
  };

  let studentAId = 'STU-TEST-0001';
  let studentBId = 'STU-TEST-0002';
  let hostelId = 'HST-TEST-0001';

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
      id: mockWarden.id,
      name: mockWarden.name,
      email: mockWarden.email,
      phone: mockWarden.phone,
      passwordHash: 'hash',
      role: 'warden',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(hostels).values({
      id: hostelId,
      institutionId: 'INST-0001',
      name: 'Alpha Block Hostel',
      code: 'ABH',
      genderType: 'boys',
      address: 'North Wing',
      totalFloors: 2,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(blocks).values({
      id: 'BLK-0001',
      hostelId,
      name: 'Block A',
      code: 'BA',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(floors).values({
      id: 'FLR-0001',
      blockId: 'BLK-0001',
      floorNumber: 1,
      name: '1st Floor',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(rooms).values({
      id: 'RM-0001',
      floorId: 'FLR-0001',
      roomNumber: '101',
      roomType: 'double',
      capacity: 2,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(beds).values([
      { id: 'BED-0001', roomId: 'RM-0001', bedLabel: '101-A', createdAt: now, updatedAt: now },
      { id: 'BED-0002', roomId: 'RM-0001', bedLabel: '101-B', createdAt: now, updatedAt: now },
    ]);

    await db.insert(students).values([
      {
        id: studentAId,
        institutionId: 'INST-0001',
        enrollmentNumber: 'ENR-2026-001',
        firstName: 'Alice',
        lastName: 'Walker',
        dateOfBirth: '2004-01-01',
        gender: 'female',
        email: 'alice@nexus.edu',
        phone: '9870000001',
        course: 'B.Tech',
        department: 'CS',
        academicYear: 2,
        admissionDate: '2024-08-01',
        permanentAddress: 'City A',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: studentBId,
        institutionId: 'INST-0001',
        enrollmentNumber: 'ENR-2026-002',
        firstName: 'Bob',
        lastName: 'Martin',
        dateOfBirth: '2004-02-02',
        gender: 'male',
        email: 'bob@nexus.edu',
        phone: '9870000002',
        course: 'B.Tech',
        department: 'ME',
        academicYear: 2,
        admissionDate: '2024-08-01',
        permanentAddress: 'City B',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Allocate Alice to BED-0001
    await db.insert(allocations).values({
      id: 'ALC-0001',
      studentId: studentAId,
      bedId: 'BED-0001',
      allocatedAt: now,
      allocationType: 'fresh_admission',
      allocatedBy: mockWarden.id,
      status: 'active',
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('marks attendance batch successfully and calculates summary', async () => {
    const today = '2026-10-15';

    const result = await OperationsService.markAttendance(mockWarden, today, [
      { studentId: studentAId, status: 'present' },
      { studentId: studentBId, status: 'absent', remarks: 'Unexcused absence' },
    ]);

    expect(result.markedCount).toBe(2);

    // Verify summary
    const summary = await OperationsService.getAttendanceSummary(mockWarden, today);
    expect(summary.totalResidents).toBeGreaterThanOrEqual(2);
    expect(summary.present).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.approvedLeave).toBe(0);
  });

  it('automatically tags student as approved_leave when an approved gate pass exists for that date', async () => {
    const db = getDb();
    const targetDate = '2026-10-20';
    const dayStartEpoch = new Date(`${targetDate}T00:00:00Z`).getTime();
    const dayEndEpoch = new Date(`${targetDate}T23:59:59Z`).getTime();

    // Create an approved gate pass spanning the target date for student B
    await db.insert(gatePasses).values({
      id: 'GP-TEST-001',
      studentId: studentBId,
      passType: 'vacation',
      reason: 'Family Event',
      destination: 'Home City',
      departureTime: dayStartEpoch - 86400000,
      expectedReturnTime: dayEndEpoch + 86400000,
      status: 'approved',
      reviewedBy: mockWarden.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Mark attendance with student B requested as 'present' or 'absent'
    await OperationsService.markAttendance(mockWarden, targetDate, [
      { studentId: studentAId, status: 'present' },
      { studentId: studentBId, status: 'absent' }, // Should be overridden to approved_leave!
    ]);

    const records = await OperationsService.getAttendanceByDate(mockWarden, { date: targetDate });
    const bRecord = records.find((r) => r.studentId === studentBId);

    expect(bRecord).toBeDefined();
    expect(bRecord?.status).toBe('approved_leave');
    expect(bRecord?.remarks).toContain('Approved Gate Pass');
  });

  it('rejects attendance marking without attendance:mark permission', async () => {
    await expect(
      OperationsService.markAttendance(mockUnauthorized, '2026-10-15', [
        { studentId: studentAId, status: 'present' },
      ])
    ).rejects.toThrow(/FORBIDDEN/i);
  });
});
