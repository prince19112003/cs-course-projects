import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions, users, students } from '../../src/main/database/schema/index.js';
import { StudentRepository } from '../../src/main/database/repositories/StudentRepository.js';
import { InfrastructureRepository } from '../../src/main/database/repositories/InfrastructureRepository.js';
import { AllocationRepository } from '../../src/main/database/repositories/AllocationRepository.js';
import { SystemRepository } from '../../src/main/database/repositories/SystemRepository.js';
import { AuditRepository } from '../../src/main/database/repositories/AuditRepository.js';
import { generateEntityId } from '../../src/main/database/utils/id-generator.js';

describe('Repository Layer Operations & ACID Transactions', () => {
  const adminId = 'USR-TEST-01';
  const instId = 'INST-TEST-01';

  beforeEach(async () => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });

    // Seed test institution and admin
    const db = getDb();
    const now = Date.now();
    await db.insert(institutions).values({
      id: instId,
      name: 'Test Campus',
      code: 'TEST-INST',
      address: '123 Test Street',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(users).values({
      id: adminId,
      name: 'Test Admin',
      email: 'admin@test.local',
      phone: '1234567890',
      passwordHash: 'hash',
      role: 'super_admin',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('performs StudentRepository CRUD and paginated searches', async () => {
    const student = await StudentRepository.create({
      id: generateEntityId('STU'),
      enrollmentNumber: 'ENR-001',
      firstName: 'Alice',
      lastName: 'Smith',
      dateOfBirth: '2004-05-15',
      gender: 'female',
      email: 'alice@test.local',
      phone: '9876543210',
      course: 'B.Tech',
      department: 'Computer Science',
      academicYear: 2,
      admissionDate: '2024-08-01',
      permanentAddress: 'City Center',
      status: 'active',
      feeStatus: 'paid',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(student.id).toBeDefined();
    expect(student.firstName).toBe('Alice');

    // Find by ID
    const found = await StudentRepository.findById(student.id);
    expect(found?.enrollmentNumber).toBe('ENR-001');

    // Find by enrollment
    const foundByEnr = await StudentRepository.findByEnrollment('ENR-001');
    expect(foundByEnr?.email).toBe('alice@test.local');

    // Search with query
    const searchRes = await StudentRepository.search({ query: 'Alice' });
    expect(searchRes.total).toBe(1);
    expect(searchRes.data[0].id).toBe(student.id);

    // Update
    const updated = await StudentRepository.update(student.id, { feeStatus: 'pending' });
    expect(updated?.feeStatus).toBe('pending');

    // Total Count
    const totalCount = await StudentRepository.count();
    expect(totalCount).toBe(1);
  });

  it('performs InfrastructureRepository hierarchy creation and matrix retrieval', async () => {
    const now = Date.now();
    const hostel = await InfrastructureRepository.createHostel({
      id: generateEntityId('HST'),
      institutionId: instId,
      name: 'Alpha Hall',
      code: 'ALPHA',
      genderType: 'boys',
      wardenId: adminId,
      totalCapacity: 50,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    const block = await InfrastructureRepository.createBlock({
      id: generateEntityId('BLK'),
      hostelId: hostel.id,
      name: 'Block A',
      code: 'A',
      totalFloors: 1,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    const floor = await InfrastructureRepository.createFloor({
      id: generateEntityId('FLR'),
      blockId: block.id,
      floorNumber: 1,
      name: 'Floor 1',
      isActive: 1,
      createdAt: now,
    });

    const room = await InfrastructureRepository.createRoom({
      id: generateEntityId('RM'),
      floorId: floor.id,
      roomNumber: '101',
      capacity: 2,
      roomType: 'double',
      acType: 'non_ac',
      monthlyRent: 30000,
      status: 'available',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    const bed1 = await InfrastructureRepository.createBed({
      id: generateEntityId('BED'),
      roomId: room.id,
      bedLabel: 'A',
      status: 'vacant',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    const bed2 = await InfrastructureRepository.createBed({
      id: generateEntityId('BED'),
      roomId: room.id,
      bedLabel: 'B',
      status: 'vacant',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Query room matrix
    const matrix = await InfrastructureRepository.getRoomMatrix(hostel.id);
    expect(matrix.length).toBe(1);
    expect(matrix[0].rooms.length).toBe(1);
    expect(matrix[0].rooms[0].beds.length).toBe(2);

    // Stats
    const stats = await InfrastructureRepository.getStats();
    expect(stats.totalHostels).toBe(1);
    expect(stats.totalRooms).toBe(1);
    expect(stats.totalBeds).toBe(2);
    expect(stats.vacantBeds).toBe(2);
    expect(stats.occupiedBeds).toBe(0);
  });

  it('executes atomic allocation and vacate transactions cleanly', async () => {
    const now = Date.now();
    const hostel = await InfrastructureRepository.createHostel({
      id: generateEntityId('HST'),
      institutionId: instId,
      name: 'Beta Hall',
      code: 'BETA',
      genderType: 'girls',
      wardenId: adminId,
      totalCapacity: 10,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    const block = await InfrastructureRepository.createBlock({
      id: generateEntityId('BLK'),
      hostelId: hostel.id,
      name: 'Block B',
      code: 'B',
      totalFloors: 1,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });

    const floor = await InfrastructureRepository.createFloor({
      id: generateEntityId('FLR'),
      blockId: block.id,
      floorNumber: 1,
      name: '1st',
      isActive: 1,
      createdAt: now,
    });

    const room = await InfrastructureRepository.createRoom({
      id: generateEntityId('RM'),
      floorId: floor.id,
      roomNumber: '201',
      capacity: 1,
      roomType: 'single',
      acType: 'ac',
      monthlyRent: 60000,
      status: 'available',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    const bed = await InfrastructureRepository.createBed({
      id: generateEntityId('BED'),
      roomId: room.id,
      bedLabel: '1',
      status: 'vacant',
      isArchived: 0,
      createdAt: now,
      updatedAt: now,
    });

    const student = await StudentRepository.create({
      id: generateEntityId('STU'),
      enrollmentNumber: 'ENR-BETA-1',
      firstName: 'Bob',
      lastName: 'Miller',
      dateOfBirth: '2003-01-01',
      gender: 'male',
      email: 'bob@test.local',
      phone: '8887776665',
      course: 'M.Sc',
      department: 'Math',
      academicYear: 1,
      admissionDate: '2025-01-01',
      permanentAddress: 'North Zone',
      status: 'active',
      feeStatus: 'paid',
      createdAt: now,
      updatedAt: now,
    });

    // 1. Execute Atomic Allocation
    const allocation = await AllocationRepository.executeAtomicAllocation({
      studentId: student.id,
      bedId: bed.id,
      allocatedBy: adminId,
      remarks: 'Standard test allocation',
    });

    expect(allocation.status).toBe('active');
    expect(allocation.bedId).toBe(bed.id);

    // Verify bed is now marked occupied
    const activeBed = await AllocationRepository.getActiveAllocationForBed(bed.id);
    expect(activeBed?.studentId).toBe(student.id);

    // Verify student record points to assignedBedId
    const studentAfter = await StudentRepository.findById(student.id);
    expect(studentAfter?.assignedBedId).toBe(bed.id);

    // 2. Reject duplicate allocation for student
    await expect(
      AllocationRepository.executeAtomicAllocation({
        studentId: student.id,
        bedId: bed.id,
        allocatedBy: adminId,
      })
    ).rejects.toThrow();

    // 3. Execute Atomic Vacate
    const vacated = await AllocationRepository.executeAtomicVacate(allocation.id);
    expect(vacated.status).toBe('vacated');
    expect(vacated.vacatedAt).toBeDefined();

    // Verify bed is vacant again
    const clearedStudent = await StudentRepository.findById(student.id);
    expect(clearedStudent?.assignedBedId).toBeNull();
  });

  it('manages SystemRepository key-value configurations', async () => {
    await SystemRepository.setSetting('academic_year', '2026-2027', 'Current active academic cycle');
    const val = await SystemRepository.getSetting('academic_year');
    expect(val).toBe('2026-2027');

    const all = await SystemRepository.getAllSettings();
    expect(all['academic_year']).toBe('2026-2027');
  });

  it('writes and reads AuditRepository logs', async () => {
    await AuditRepository.log({
      action: 'MANUAL_TEST_AUDIT',
      entityType: 'students',
      entityId: 'STU-001',
      changesSummary: { before: 'vacant', after: 'occupied' },
      userId: adminId,
    });

    const logs = await AuditRepository.getRecentLogs(5);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('MANUAL_TEST_AUDIT');
  });

  it('rolls back atomic multi-table transaction when an exception is thrown', async () => {
    const db = getDb();
    const testStudentId = 'STU-ROLLBACK-TEST';
    const initialCount = await StudentRepository.count();

    expect(() => {
      db.transaction((tx) => {
        // Step 1: Insert student
        tx.insert(students).values({
          id: testStudentId,
          enrollmentNumber: 'ENR-ROLLBACK',
          firstName: 'Rollback',
          lastName: 'Candidate',
          dateOfBirth: '2000-01-01',
          gender: 'other',
          email: 'rollback@test.local',
          phone: '0000000000',
          course: 'Physics',
          department: 'Science',
          academicYear: 1,
          admissionDate: '2026-01-01',
          permanentAddress: 'Nowhere',
          status: 'active',
          feeStatus: 'paid',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }).run();

        // Step 2: Deliberate failure
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    }).toThrow('SIMULATED_TRANSACTION_FAILURE');

    // Assert student was rolled back
    const found = await StudentRepository.findById(testStudentId);
    expect(found).toBeNull();
    const countAfter = await StudentRepository.count();
    expect(countAfter).toBe(initialCount);
  });
});

