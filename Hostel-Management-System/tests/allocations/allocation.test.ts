import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { InfrastructureService } from '../../src/main/services/InfrastructureService.js';
import { AllocationService } from '../../src/main/services/AllocationService.js';
import { AuditRepository } from '../../src/main/database/repositories/AuditRepository.js';
import { SessionUser } from '../../src/shared/types.js';
import { beds } from '../../src/main/database/schema/infrastructure.js';
import { students } from '../../src/main/database/schema/students.js';
import { allocations } from '../../src/main/database/schema/allocations.js';
import { eq } from 'drizzle-orm';

describe('Bed Allocations, Atomic Transfers, Vacating & Invariant Rules', () => {
  const mockWarden: SessionUser = {
    id: 'USR-WARDEN-001',
    name: 'Warden John',
    email: 'warden@nexus.test',
    phone: '9888888888',
    role: 'warden',
    permissions: ['allocations:view', 'allocations:manage', 'rooms:view'],
    forcePasswordChange: false,
  };

  let testHostelId: string;
  let testBedId1: string;
  let testBedId2: string;
  let testBedId3: string;
  let student1Id: string;
  let student2Id: string;

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
      passwordHash: 'hashed_pw',
      role: 'warden',
      createdAt: now,
      updatedAt: now,
    });

    // Setup hierarchy
    const hostel = await InfrastructureService.createHostel(mockWarden, {
      name: 'Everest Hall',
      code: 'EVR-1',
      genderType: 'boys',
    });
    testHostelId = hostel.id;

    const block = await InfrastructureService.createBlock(mockWarden, {
      hostelId: hostel.id,
      name: 'Block A',
      code: 'A',
    });

    const floor = await InfrastructureService.createFloor(mockWarden, {
      blockId: block.id,
      floorNumber: 1,
      name: 'Floor 1',
    });

    const room = await InfrastructureService.createRoom(mockWarden, {
      floorId: floor.id,
      roomNumber: '101',
      capacity: 3,
      roomType: 'triple',
    });

    const bed1 = await InfrastructureService.createBed(mockWarden, {
      roomId: room.id,
      bedLabel: 'Bed 1',
    });
    testBedId1 = bed1.id;

    const bed2 = await InfrastructureService.createBed(mockWarden, {
      roomId: room.id,
      bedLabel: 'Bed 2',
    });
    testBedId2 = bed2.id;

    const bed3 = await InfrastructureService.createBed(mockWarden, {
      roomId: room.id,
      bedLabel: 'Bed 3',
    });
    testBedId3 = bed3.id;

    const devStudents = await AllocationService.getDevTestStudents();
    student1Id = devStudents[0].id;
    student2Id = devStudents[1].id;
  });

  afterEach(() => {
    closeDatabase();
  });

  it('successfully allocates a student to a vacant bed inside an ACID transaction', async () => {
    const alloc = await AllocationService.allocateBed(mockWarden, {
      studentId: student1Id,
      bedId: testBedId1,
      remarks: 'Fresh entry semester 1',
    });

    expect(alloc.id).toMatch(/^ALC-/);
    expect(alloc.studentId).toBe(student1Id);
    expect(alloc.bedId).toBe(testBedId1);
    expect(alloc.status).toBe('active');
    expect(alloc.vacatedAt).toBeNull();

    // Verify bed status updated in DB
    const db = getDb();
    const bed = db.select().from(beds).where(eq(beds.id, testBedId1)).get();
    expect(bed?.status).toBe('occupied');

    // Verify student assignedBedId updated in DB
    const student = db.select().from(students).where(eq(students.id, student1Id)).get();
    expect(student?.assignedBedId).toBe(testBedId1);

    // Verify Audit log entry
    const auditLogs = await AuditRepository.getRecent(10);
    const allocAudit = auditLogs.find((l) => l.action === 'ALLOCATION_CREATED' && l.entityId === alloc.id);
    expect(allocAudit).toBeDefined();
    expect(allocAudit?.userId).toBe(mockWarden.id);
  });

  it('strictly rejects duplicate allocation for a student who already holds an active bed', async () => {
    // 1. Allocate student 1 to Bed 1
    await AllocationService.allocateBed(mockWarden, {
      studentId: student1Id,
      bedId: testBedId1,
    });

    // 2. Attempt to allocate same student 1 to Bed 2 -> Must fail
    await expect(
      AllocationService.allocateBed(mockWarden, {
        studentId: student1Id,
        bedId: testBedId2,
      })
    ).rejects.toThrow(/STUDENT_ALREADY_ALLOCATED/);
  });

  it('strictly rejects allocating to a bed that is already occupied', async () => {
    // 1. Allocate student 1 to Bed 1
    await AllocationService.allocateBed(mockWarden, {
      studentId: student1Id,
      bedId: testBedId1,
    });

    // 2. Attempt to allocate student 2 to same Bed 1 -> Must fail
    await expect(
      AllocationService.allocateBed(mockWarden, {
        studentId: student2Id,
        bedId: testBedId1,
      })
    ).rejects.toThrow(/BED_OCCUPIED/);
  });

  it('rejects allocation when bed is under maintenance or parent hierarchy is inactive', async () => {
    // Set Bed 3 to maintenance
    await InfrastructureService.toggleBedStatus(mockWarden, testBedId3, 'maintenance');

    await expect(
      AllocationService.allocateBed(mockWarden, {
        studentId: student2Id,
        bedId: testBedId3,
      })
    ).rejects.toThrow(/BED_OCCUPIED/);
  });

  it('successfully executes atomic bed transfer, preserving history and swapping states', async () => {
    // 1. Allocate student 1 to Bed 1
    const originalAlloc = await AllocationService.allocateBed(mockWarden, {
      studentId: student1Id,
      bedId: testBedId1,
      remarks: 'Initial room',
    });

    // 2. Transfer student 1 from Bed 1 to Bed 2
    const transferResult = await AllocationService.transferBed(mockWarden, {
      studentId: student1Id,
      destinationBedId: testBedId2,
      transferType: 'requested_transfer',
      remarks: 'Medical ground request to lower berth',
    });

    expect(transferResult.oldAllocation.id).toBe(originalAlloc.id);
    expect(transferResult.oldAllocation.status).toBe('transferred');
    expect(transferResult.oldAllocation.vacatedAt).toBeGreaterThan(0);

    expect(transferResult.newAllocation.status).toBe('active');
    expect(transferResult.newAllocation.bedId).toBe(testBedId2);
    expect(transferResult.newAllocation.studentId).toBe(student1Id);

    const db = getDb();
    // Previous bed must now be vacant
    const oldBed = db.select().from(beds).where(eq(beds.id, testBedId1)).get();
    expect(oldBed?.status).toBe('vacant');

    // New bed must now be occupied
    const newBed = db.select().from(beds).where(eq(beds.id, testBedId2)).get();
    expect(newBed?.status).toBe('occupied');

    // Student assignedBedId must point to new bed
    const student = db.select().from(students).where(eq(students.id, student1Id)).get();
    expect(student?.assignedBedId).toBe(testBedId2);

    // Audit log
    const auditLogs = await AuditRepository.getRecent(10);
    const transferAudit = auditLogs.find((l) => l.action === 'ALLOCATION_TRANSFERRED');
    expect(transferAudit).toBeDefined();
  });

  it('rolls back transfer atomically on destination failure, leaving student in original bed', async () => {
    // Student 1 in Bed 1
    await AllocationService.allocateBed(mockWarden, {
      studentId: student1Id,
      bedId: testBedId1,
    });

    // Student 2 in Bed 2
    await AllocationService.allocateBed(mockWarden, {
      studentId: student2Id,
      bedId: testBedId2,
    });

    // Attempt transfer of Student 1 into Bed 2 (which is occupied) -> Must fail and rollback
    await expect(
      AllocationService.transferBed(mockWarden, {
        studentId: student1Id,
        destinationBedId: testBedId2,
      })
    ).rejects.toThrow(/DESTINATION_BED_UNAVAILABLE/);

    const db = getDb();
    // Student 1 remains assigned to Bed 1
    const student1 = db.select().from(students).where(eq(students.id, student1Id)).get();
    expect(student1?.assignedBedId).toBe(testBedId1);

    // Bed 1 remains occupied
    const bed1 = db.select().from(beds).where(eq(beds.id, testBedId1)).get();
    expect(bed1?.status).toBe('occupied');

    // Bed 2 remains occupied by Student 2
    const bed2 = db.select().from(beds).where(eq(beds.id, testBedId2)).get();
    expect(bed2?.status).toBe('occupied');
  });

  it('vacates an allocation atomically, restoring bed to vacant and logging checkout', async () => {
    const alloc = await AllocationService.allocateBed(mockWarden, {
      studentId: student1Id,
      bedId: testBedId1,
    });

    const vacated = await AllocationService.vacateBed(mockWarden, {
      allocationId: alloc.id,
      remarks: 'Course completed, keys returned',
    });

    expect(vacated.status).toBe('vacated');
    expect(vacated.vacatedAt).toBeGreaterThan(0);
    expect(vacated.remarks).toContain('Course completed');

    const db = getDb();
    // Bed is vacant again
    const bed = db.select().from(beds).where(eq(beds.id, testBedId1)).get();
    expect(bed?.status).toBe('vacant');

    // Student has null assignedBedId
    const student = db.select().from(students).where(eq(students.id, student1Id)).get();
    expect(student?.assignedBedId).toBeNull();
  });
});
